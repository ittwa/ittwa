// Database access layer for the Free Agent Auction. All reads recompute
// owner cap numbers via the SAME functions in lib/auction.ts used at
// pre-auction derivation time — one set of formulas, used everywhere.
//
// The Neon HTTP driver executes each query over its own request, so there is
// no interactive multi-statement transaction support (a later statement
// can't consume a RETURNING value from an earlier one in the same batch).
// Writes below are sequential awaited statements; on failure we best-effort
// clean up any partially-created rows. This is an acceptable tradeoff for a
// single-commissioner, low-concurrency admin tool — see CLAUDE.md "How I
// Work" for when to leave a TODO instead of over-engineering this further.

import { getSql } from "./db";
import { computeOwnerCap } from "./auction";
import type {
  AuctionStatus,
  AuctionRecord,
  AuctionCurrentNomination,
  AuctionResultRow,
  DerivedOwnerCap,
  DerivedRosterEntry,
  DerivedFreeAgent,
  RosterSource,
  PoolStatus,
} from "@/types/auction";

// ── Row → domain mapping helpers ────────────────────────────────────────────

interface AuctionRow {
  id: number;
  season: string;
  status: AuctionStatus;
  nominationOrder: string[];
  currentNominatorIndex: number;
  nominatorOverride: string | null;
  createdAt: string;
}

function toAuctionRecord(row: AuctionRow): AuctionRecord {
  return {
    id: row.id,
    season: row.season,
    status: row.status,
    nominationOrder: row.nominationOrder ?? [],
    currentNominatorIndex: row.currentNominatorIndex,
    createdAt: row.createdAt,
  };
}

async function insertRows(table: string, columns: string[], rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return;
  const sql = getSql();
  const placeholders: string[] = [];
  const params: unknown[] = [];
  rows.forEach((row, i) => {
    const base = i * columns.length;
    placeholders.push(`(${columns.map((_, j) => `$${base + j + 1}`).join(",")})`);
    params.push(...row);
  });
  const text = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders.join(",")}`;
  await sql.query(text, params);
}

// ── Auction lifecycle ────────────────────────────────────────────────────────

export async function getLatestAuction(): Promise<AuctionRecord | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT id, season, status, nomination_order AS "nominationOrder",
            current_nominator_index AS "currentNominatorIndex",
            nominator_override AS "nominatorOverride",
            created_at AS "createdAt"
     FROM auction ORDER BY created_at DESC, id DESC LIMIT 1`,
  )) as unknown as AuctionRow[];
  return rows[0] ? toAuctionRecord(rows[0]) : null;
}

export async function getAuctionById(id: number): Promise<AuctionRecord | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT id, season, status, nomination_order AS "nominationOrder",
            current_nominator_index AS "currentNominatorIndex",
            nominator_override AS "nominatorOverride",
            created_at AS "createdAt"
     FROM auction WHERE id = $1`,
    [id],
  )) as unknown as AuctionRow[];
  return rows[0] ? toAuctionRecord(rows[0]) : null;
}

export interface SnapshotInput {
  season: string;
  owners: { owner: string; capHit: number; capHitOverridden: boolean }[];
  roster: DerivedRosterEntry[];
  pool: DerivedFreeAgent[];
  nominationOrder: string[];
}

// Snapshots the reviewed pre-auction state into the DB and flips status to
// 'live'. From this point the DB is the single source of truth — the sheet
// and Sleeper are never re-read mid-auction.
export async function startAuction(input: SnapshotInput): Promise<number> {
  const sql = getSql();
  const created = (await sql.query(
    `INSERT INTO auction (season, status, nomination_order, current_nominator_index)
     VALUES ($1, 'live', $2, 0) RETURNING id`,
    [input.season, JSON.stringify(input.nominationOrder)],
  )) as unknown as { id: number }[];
  const auctionId = created[0].id;

  try {
    await insertRows(
      "auction_owner",
      ["auction_id", "owner", "cap_hit", "cap_hit_overridden"],
      input.owners.map((o) => [auctionId, o.owner, o.capHit, o.capHitOverridden]),
    );
    await insertRows(
      "auction_roster",
      ["auction_id", "owner", "player_id", "player", "position", "years", "salary", "source"],
      input.roster.map((r) => [auctionId, r.owner, r.playerId, r.player, r.position, r.years, r.salary, r.source]),
    );
    await insertRows(
      "auction_pool",
      ["auction_id", "player_id", "player", "position", "status", "rfa", "previous_owner"],
      input.pool.map((p) => [auctionId, p.playerId, p.player, p.position, p.status, p.rfa, p.previousOwner]),
    );
  } catch (err) {
    await sql.query(`DELETE FROM auction WHERE id = $1`, [auctionId]);
    throw err;
  }

  return auctionId;
}

export async function setStatus(auctionId: number, status: AuctionStatus): Promise<void> {
  const sql = getSql();
  await sql.query(`UPDATE auction SET status = $1 WHERE id = $2`, [status, auctionId]);
}

export async function resetAuction(auctionId: number): Promise<void> {
  const sql = getSql();
  await sql.query(`DELETE FROM auction WHERE id = $1`, [auctionId]);
}

export async function setNominatorOverride(auctionId: number, owner: string | null): Promise<void> {
  const sql = getSql();
  await sql.query(`UPDATE auction SET nominator_override = $1 WHERE id = $2`, [owner, auctionId]);
}

export async function setTimer(auctionId: number, endsAt: string | null): Promise<void> {
  const sql = getSql();
  await sql.query(`UPDATE auction_current SET timer_ends_at = $1 WHERE auction_id = $2`, [endsAt, auctionId]);
}

// ── Nomination + bidding ─────────────────────────────────────────────────────

export interface NominateInput {
  playerId: string;
  player: string;
  position: string;
  rfa: boolean;
  previousOwner: string | null;
}

export async function nominate(auctionId: number, input: NominateInput): Promise<void> {
  const sql = getSql();
  await sql.query(`DELETE FROM auction_current WHERE auction_id = $1`, [auctionId]);
  await sql.query(
    `INSERT INTO auction_current
       (auction_id, player_id, player, position, rfa, previous_owner, high_bid_salary, high_bid_years, high_bidder, timer_ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)`,
    [auctionId, input.playerId, input.player, input.position, input.rfa, input.previousOwner],
  );
  await sql.query(
    `UPDATE auction_pool SET status = 'nominated' WHERE auction_id = $1 AND player_id = $2`,
    [auctionId, input.playerId],
  );
}

export async function setBid(
  auctionId: number,
  bid: { salary: number; years: number; bidder: string | null },
): Promise<void> {
  const sql = getSql();
  await sql.query(
    `UPDATE auction_current SET high_bid_salary = $1, high_bid_years = $2, high_bidder = $3 WHERE auction_id = $4`,
    [bid.salary, bid.years, bid.bidder, auctionId],
  );
}

// ── Award / undo / edit / delete ─────────────────────────────────────────────

interface CurrentRow {
  playerId: string;
  player: string;
  position: string;
}

export async function awardCurrent(
  auctionId: number,
  award: { winner: string; salary: number; years: number },
): Promise<AuctionResultRow> {
  const sql = getSql();

  const auction = await getAuctionById(auctionId);
  if (!auction) throw new Error("Auction not found");

  const currentRows = (await sql.query(
    `SELECT player_id AS "playerId", player, position FROM auction_current WHERE auction_id = $1`,
    [auctionId],
  )) as unknown as CurrentRow[];
  const current = currentRows[0];
  if (!current) throw new Error("No player is currently nominated");

  const nominator =
    auction.nominationOrder.length > 0
      ? auction.nominationOrder[auction.currentNominatorIndex % auction.nominationOrder.length]
      : "—";
  // nominator_override (set via "override who's nominating") wins for this
  // one pick only, then is cleared below.
  const overrideRows = (await sql.query(
    `SELECT nominator_override AS "nominatorOverride" FROM auction WHERE id = $1`,
    [auctionId],
  )) as unknown as { nominatorOverride: string | null }[];
  const effectiveNominator = overrideRows[0]?.nominatorOverride || nominator;

  const pickRows = (await sql.query(
    `SELECT COALESCE(MAX(pick_number), 0) + 1 AS next FROM auction_result WHERE auction_id = $1`,
    [auctionId],
  )) as unknown as { next: number }[];
  const pickNumber = pickRows[0].next;

  const inserted = (await sql.query(
    `INSERT INTO auction_result
       (auction_id, pick_number, nominator, winner, player_id, player, position, years, salary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, pick_number AS "pickNumber", nominator, winner, player_id AS "playerId",
               player, position, years, salary, created_at AS "createdAt"`,
    [auctionId, pickNumber, effectiveNominator, award.winner, current.playerId, current.player, current.position, award.years, award.salary],
  )) as unknown as (Omit<AuctionResultRow, "salary"> & { salary: string })[];
  const resultRow = inserted[0];

  await sql.query(
    `INSERT INTO auction_roster (auction_id, owner, player_id, player, position, years, salary, source, result_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'auction',$8)`,
    [auctionId, award.winner, current.playerId, current.player, current.position, award.years, award.salary, resultRow.id],
  );

  await sql.query(
    `UPDATE auction_pool SET status = 'drafted' WHERE auction_id = $1 AND player_id = $2`,
    [auctionId, current.playerId],
  );

  await sql.query(`DELETE FROM auction_current WHERE auction_id = $1`, [auctionId]);

  const nextIndex =
    auction.nominationOrder.length > 0
      ? (auction.currentNominatorIndex + 1) % auction.nominationOrder.length
      : 0;
  await sql.query(
    `UPDATE auction SET current_nominator_index = $1, nominator_override = NULL WHERE id = $2`,
    [nextIndex, auctionId],
  );

  return { ...resultRow, salary: Number(resultRow.salary) };
}

export async function undoLastResult(auctionId: number): Promise<void> {
  const sql = getSql();
  const auction = await getAuctionById(auctionId);
  if (!auction) throw new Error("Auction not found");

  const lastRows = (await sql.query(
    `SELECT id FROM auction_result WHERE auction_id = $1 ORDER BY pick_number DESC LIMIT 1`,
    [auctionId],
  )) as unknown as { id: number }[];
  const last = lastRows[0];
  if (!last) return;

  await sql.query(`DELETE FROM auction_result WHERE id = $1`, [last.id]);

  const prevIndex =
    auction.nominationOrder.length > 0
      ? (auction.currentNominatorIndex - 1 + auction.nominationOrder.length) % auction.nominationOrder.length
      : 0;
  await sql.query(`UPDATE auction SET current_nominator_index = $1 WHERE id = $2`, [prevIndex, auctionId]);
}

export async function editResult(
  auctionId: number,
  resultId: number,
  edit: { winner: string; player: string; position: string; years: number; salary: number },
): Promise<void> {
  const sql = getSql();
  await sql.query(
    `UPDATE auction_result SET winner = $1, player = $2, position = $3, years = $4, salary = $5
     WHERE id = $6 AND auction_id = $7`,
    [edit.winner, edit.player, edit.position, edit.years, edit.salary, resultId, auctionId],
  );
  await sql.query(
    `UPDATE auction_roster SET owner = $1, player = $2, position = $3, years = $4, salary = $5
     WHERE result_id = $6`,
    [edit.winner, edit.player, edit.position, edit.years, edit.salary, resultId],
  );
}

export async function deleteResult(auctionId: number, resultId: number): Promise<void> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT player_id AS "playerId" FROM auction_result WHERE id = $1 AND auction_id = $2`,
    [resultId, auctionId],
  )) as unknown as { playerId: string }[];
  const playerId = rows[0]?.playerId;

  await sql.query(`DELETE FROM auction_result WHERE id = $1 AND auction_id = $2`, [resultId, auctionId]);

  if (playerId) {
    await sql.query(
      `UPDATE auction_pool SET status = 'available' WHERE auction_id = $1 AND player_id = $2`,
      [auctionId, playerId],
    );
  }
}

// ── Mid-auction resync of the imported inputs ────────────────────────────────
//
// Starting an auction snapshots rosters and cap hits, and from then on the DB
// is the source of truth. But roster moves keep happening right up to (and
// during) the auction — a trade or a drop that lands after the snapshot leaves
// the owner board showing salary, cap space and max bid for a roster that no
// longer exists.
//
// This re-imports just the derived inputs and leaves everything the auction
// itself has produced alone: results, the roster rows those awards created
// (source='auction'), commissioner-added rows (source='manual'), overridden
// cap hits, the nomination order, and anything already nominated or drafted.

export interface ResyncInput {
  roster: DerivedRosterEntry[];
  capHitsByOwner: Map<string, number>;
  pool: DerivedFreeAgent[];
}

export interface ResyncSummary {
  rosterRows: number;
  capHitsUpdated: number;
  poolAdded: number;
  poolRemoved: number;
}

export async function resyncAuctionInputs(
  auctionId: number,
  input: ResyncInput,
): Promise<ResyncSummary> {
  const sql = getSql();

  // Player ids the auction itself owns — never re-import over them, even if
  // the sheet has since grown a contract row for a player who was just won.
  const keptRows = (await sql.query(
    `SELECT player_id AS "playerId" FROM auction_roster
     WHERE auction_id = $1 AND source <> 'import'`,
    [auctionId],
  )) as unknown as { playerId: string }[];
  const keptIds = new Set(keptRows.map((r) => r.playerId));

  const importRoster = input.roster.filter((r) => !keptIds.has(r.playerId));

  await sql.query(`DELETE FROM auction_roster WHERE auction_id = $1 AND source = 'import'`, [auctionId]);
  await insertRows(
    "auction_roster",
    ["auction_id", "owner", "player_id", "player", "position", "years", "salary", "source"],
    importRoster.map((r) => [auctionId, r.owner, r.playerId, r.player, r.position, r.years, r.salary, "import"]),
  );

  // Cap hits: skip owners the commissioner has hand-corrected.
  let capHitsUpdated = 0;
  const ownerRows = (await sql.query(
    `SELECT owner, cap_hit AS "capHit" FROM auction_owner
     WHERE auction_id = $1 AND cap_hit_overridden = FALSE`,
    [auctionId],
  )) as unknown as { owner: string; capHit: string }[];
  for (const row of ownerRows) {
    const fresh = input.capHitsByOwner.get(row.owner) ?? 0;
    if (Number(row.capHit) === fresh) continue;
    await sql.query(
      `UPDATE auction_owner SET cap_hit = $1 WHERE auction_id = $2 AND owner = $3 AND cap_hit_overridden = FALSE`,
      [fresh, auctionId, row.owner],
    );
    capHitsUpdated++;
  }

  // Pool: a player who is now under contract must not stay biddable, and a
  // player who was just dropped must become biddable. Only untouched
  // ('available') rows move — nominated and drafted players are left alone.
  const poolRows = (await sql.query(
    `SELECT player_id AS "playerId", status FROM auction_pool WHERE auction_id = $1`,
    [auctionId],
  )) as unknown as { playerId: string; status: PoolStatus }[];
  const existingPoolIds = new Set(poolRows.map((p) => p.playerId));

  const rosteredIds = new Set([...importRoster.map((r) => r.playerId), ...keptIds]);
  const nowRostered = poolRows
    .filter((p) => p.status === "available" && rosteredIds.has(p.playerId))
    .map((p) => p.playerId);

  let poolRemoved = 0;
  if (nowRostered.length > 0) {
    // Numbered placeholders rather than an array parameter — the Neon HTTP
    // driver is only exercised with scalars everywhere else in this file.
    const placeholders = nowRostered.map((_, i) => `$${i + 2}`).join(",");
    await sql.query(
      `DELETE FROM auction_pool
       WHERE auction_id = $1 AND status = 'available' AND player_id IN (${placeholders})`,
      [auctionId, ...nowRostered],
    );
    poolRemoved = nowRostered.length;
  }

  const newlyAvailable = input.pool.filter(
    (p) => !existingPoolIds.has(p.playerId) && !rosteredIds.has(p.playerId),
  );
  await insertRows(
    "auction_pool",
    ["auction_id", "player_id", "player", "position", "status", "rfa", "previous_owner"],
    newlyAvailable.map((p) => [auctionId, p.playerId, p.player, p.position, "available", p.rfa, p.previousOwner]),
  );

  return {
    rosterRows: importRoster.length,
    capHitsUpdated,
    poolAdded: newlyAvailable.length,
    poolRemoved,
  };
}

export async function overrideCapHit(auctionId: number, owner: string, capHit: number): Promise<void> {
  const sql = getSql();
  await sql.query(
    `UPDATE auction_owner SET cap_hit = $1, cap_hit_overridden = TRUE WHERE auction_id = $2 AND owner = $3`,
    [capHit, auctionId, owner],
  );
}

// ── Full state read (recomputed live from the DB) ────────────────────────────

interface OwnerRow {
  owner: string;
  capHit: string;
  capHitOverridden: boolean;
}
interface RosterRow {
  owner: string;
  playerId: string;
  player: string;
  position: string;
  years: number;
  salary: string;
  source: RosterSource;
}
interface PoolRow {
  playerId: string;
  player: string;
  position: string;
  status: PoolStatus;
  rfa: boolean;
  previousOwner: string | null;
}
interface ResultRow {
  id: number;
  pickNumber: number;
  nominator: string;
  winner: string;
  playerId: string;
  player: string;
  position: string;
  years: number;
  salary: string;
  createdAt: string;
}
interface CurrentFullRow {
  playerId: string;
  player: string;
  position: string;
  rfa: boolean;
  previousOwner: string | null;
  highBidSalary: string | null;
  highBidYears: number | null;
  highBidder: string | null;
  timerEndsAt: string | null;
}

export interface FullAuctionState {
  auction: AuctionRecord;
  owners: DerivedOwnerCap[];
  roster: DerivedRosterEntry[];
  pool: DerivedFreeAgent[];
  results: AuctionResultRow[];
  current: AuctionCurrentNomination | null;
  onClock: string | null;
  onDeck: string | null;
}

export async function getFullState(auctionId: number): Promise<FullAuctionState | null> {
  const sql = getSql();
  const auction = await getAuctionById(auctionId);
  if (!auction) return null;

  const [ownerRows, rosterRows, poolRows, resultRows, currentRows] = await Promise.all([
    sql.query(
      `SELECT owner, cap_hit AS "capHit", cap_hit_overridden AS "capHitOverridden"
       FROM auction_owner WHERE auction_id = $1 ORDER BY owner`,
      [auctionId],
    ) as unknown as Promise<OwnerRow[]>,
    sql.query(
      `SELECT owner, player_id AS "playerId", player, position, years, salary, source
       FROM auction_roster WHERE auction_id = $1 ORDER BY player`,
      [auctionId],
    ) as unknown as Promise<RosterRow[]>,
    sql.query(
      `SELECT player_id AS "playerId", player, position, status, rfa, previous_owner AS "previousOwner"
       FROM auction_pool WHERE auction_id = $1 ORDER BY player`,
      [auctionId],
    ) as unknown as Promise<PoolRow[]>,
    sql.query(
      `SELECT id, pick_number AS "pickNumber", nominator, winner, player_id AS "playerId",
              player, position, years, salary, created_at AS "createdAt"
       FROM auction_result WHERE auction_id = $1 ORDER BY pick_number DESC`,
      [auctionId],
    ) as unknown as Promise<ResultRow[]>,
    sql.query(
      `SELECT player_id AS "playerId", player, position, rfa, previous_owner AS "previousOwner",
              high_bid_salary AS "highBidSalary", high_bid_years AS "highBidYears",
              high_bidder AS "highBidder", timer_ends_at AS "timerEndsAt"
       FROM auction_current WHERE auction_id = $1`,
      [auctionId],
    ) as unknown as Promise<CurrentFullRow[]>,
  ]);

  const roster: DerivedRosterEntry[] = rosterRows.map((r) => ({
    owner: r.owner,
    playerId: r.playerId,
    player: r.player,
    position: r.position,
    years: r.years,
    salary: Number(r.salary),
    source: r.source,
  }));

  const owners: DerivedOwnerCap[] = ownerRows.map((o) => {
    const rows = roster.filter((r) => r.owner === o.owner);
    return computeOwnerCap({
      owner: o.owner,
      salaryRostered: rows.reduce((s, r) => s + r.salary, 0),
      yearsRostered: rows.reduce((s, r) => s + r.years, 0),
      playersRostered: rows.length,
      capHit: Number(o.capHit),
      capHitOverridden: o.capHitOverridden,
    });
  });

  const pool: DerivedFreeAgent[] = poolRows.map((p) => ({
    playerId: p.playerId,
    player: p.player,
    position: p.position,
    team: null,
    rfa: p.rfa,
    previousOwner: p.previousOwner,
    status: p.status,
  }));

  const results: AuctionResultRow[] = resultRows.map((r) => ({ ...r, salary: Number(r.salary) }));

  const cur = currentRows[0];
  const current: AuctionCurrentNomination | null = cur
    ? {
        playerId: cur.playerId,
        player: cur.player,
        position: cur.position,
        rfa: cur.rfa,
        previousOwner: cur.previousOwner,
        highBidSalary: cur.highBidSalary != null ? Number(cur.highBidSalary) : null,
        highBidYears: cur.highBidYears,
        highBidder: cur.highBidder,
        timerEndsAt: cur.timerEndsAt,
      }
    : null;

  const order = auction.nominationOrder;
  const onClock =
    order.length > 0 ? order[auction.currentNominatorIndex % order.length] : null;
  const onDeck =
    order.length > 1 ? order[(auction.currentNominatorIndex + 1) % order.length] : null;

  return { auction, owners, roster, pool, results, current, onClock, onDeck };
}
