// Free Agent Auction — derivation + rules engine.
//
// Everything the auction needs (rosters, cap math, free agent pool) is
// derived from data already fetched elsewhere in the app (Google Sheets
// contracts/cap hits, Sleeper players) plus the league constants in
// config.ts. These functions are used BOTH at pre-auction derivation time
// and to recompute the live board from the database during the auction —
// one set of formulas, used everywhere.

import type { ContractRow, CapHitRow } from "@/types/contracts";
import type { SleeperPlayersMap, SleeperRoster, SleeperUser } from "@/types/sleeper";
import type {
  DerivedRosterEntry,
  DerivedOwnerCap,
  DerivedFreeAgent,
  DerivationResult,
  BidToBeatRow,
  AuctionResultRow,
} from "@/types/auction";
import { SALARY_CAP, SALARY_FLOOR, YEARS_CAP, ROSTER_SIZE, ALL_OWNERS } from "./config";
import { calculateContractValue, resolveOwnerName } from "./contracts";
import { getDisplayName } from "./sleeper";

export { calculateContractValue };

function isRealPlayerId(id: string | undefined | null): id is string {
  return !!id && id !== "#N/A" && id !== "N/A" && id !== "";
}

// Same normalization the Data Check page uses for same-player matching:
// lowercase, letters only ("D.J. Moore" / "DJ Moore" -> "djmoore").
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function sleeperPlayerName(p: SleeperPlayersMap[string] | undefined): string {
  if (!p) return "";
  return p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

// ── Cap math (mirrors the old Cap Breakdown tab exactly) ────────────────────

export function computeOwnerCap(params: {
  owner: string;
  salaryRostered: number;
  yearsRostered: number;
  playersRostered: number;
  capHit: number;
  capHitOverridden?: boolean;
}): DerivedOwnerCap {
  const {
    owner,
    salaryRostered,
    yearsRostered,
    playersRostered,
    capHit,
    capHitOverridden = false,
  } = params;

  const cash = round1(SALARY_CAP - salaryRostered - capHit);
  const needToSpend = round1(Math.max(SALARY_FLOOR - salaryRostered, 0));
  const spotsRemaining = ROSTER_SIZE - playersRostered;
  const yearsRemaining = YEARS_CAP - yearsRostered;

  // Most an owner can pay for one player while still affording $1 minimum
  // bids for every other open roster spot.
  const maxBid = spotsRemaining > 0 ? round1(cash - 1.0 * (spotsRemaining - 1)) : null;
  // Longest deal an owner can offer while leaving at least 1 year for every
  // other open spot, capped at the 5-year contract max and floored at 1.
  const maxYears =
    spotsRemaining > 0 ? Math.max(1, Math.min(5, yearsRemaining - (spotsRemaining - 1))) : null;

  return {
    owner,
    salaryRostered: round1(salaryRostered),
    yearsRostered,
    playersRostered,
    capHit: round1(capHit),
    capHitOverridden,
    cash,
    needToSpend,
    spotsRemaining,
    yearsRemaining,
    maxBid,
    maxYears,
  };
}

export function aggregateOwnerCaps(
  roster: DerivedRosterEntry[],
  capHitsByOwner: Map<string, number>,
  owners: readonly string[] = ALL_OWNERS,
  capHitOverrides: Map<string, number> = new Map(),
): DerivedOwnerCap[] {
  return owners.map((owner) => {
    const rows = roster.filter((r) => r.owner === owner);
    const salaryRostered = rows.reduce((s, r) => s + r.salary, 0);
    const yearsRostered = rows.reduce((s, r) => s + r.years, 0);
    const playersRostered = rows.length;
    const overridden = capHitOverrides.has(owner);
    const capHit = overridden ? capHitOverrides.get(owner)! : (capHitsByOwner.get(owner) ?? 0);
    return computeOwnerCap({
      owner,
      salaryRostered,
      yearsRostered,
      playersRostered,
      capHit,
      capHitOverridden: overridden,
    });
  });
}

// ── Roster + cap hit derivation from sheet data ──────────────────────────────

export function deriveRosterFromContracts(
  contracts: ContractRow[],
  season: string,
): DerivedRosterEntry[] {
  return contracts
    .filter(
      (c) =>
        c.season.trim() === season &&
        c.contractStatus.toLowerCase() === "active" &&
        c.years >= 1 &&
        c.position.toLowerCase() !== "draft pick",
    )
    .map((c) => ({
      owner: resolveOwnerName(c.owner),
      playerId: c.playerId,
      player: c.player,
      position: c.position,
      years: c.years,
      salary: c.salary,
      source: "import" as const,
    }));
}

// Sleeper is the source of truth for WHO is on a roster; the sheet is the
// source of truth for contract TERMS (salary/years travel with the player
// through a trade).
//
// The Contracts sheet's Owner column is maintained by hand and lags behind
// trades and drops — that lag is exactly what the Data Check page flags. The
// team pages have always read rosters from Sleeper and joined contracts on
// player_id, which is why they show post-trade rosters correctly. This does
// the same join for the auction so the owner board's salary, cap space, max
// bid, and need-to-spend reflect the same rosters.
//
// Join order mirrors the team page: player_id first, normalized name as a
// fallback so sheet rows with a missing or "#N/A" player_id still match.
export function attributeRosterToSleeperOwners(params: {
  contractRoster: DerivedRosterEntry[];
  rosters: SleeperRoster[];
  users: SleeperUser[];
  nflPlayers: SleeperPlayersMap;
}): { roster: DerivedRosterEntry[]; unrostered: DerivedRosterEntry[] } {
  const { contractRoster, rosters, users, nflPlayers } = params;

  const byPlayerId = new Map<string, DerivedRosterEntry>();
  const byName = new Map<string, DerivedRosterEntry>();
  for (const entry of contractRoster) {
    if (isRealPlayerId(entry.playerId)) byPlayerId.set(entry.playerId, entry);
    if (entry.player) byName.set(normalizeName(entry.player), entry);
  }

  const ownerByUserId = new Map(users.map((u) => [u.user_id, getDisplayName(u)] as const));

  const roster: DerivedRosterEntry[] = [];
  const claimed = new Set<DerivedRosterEntry>();

  for (const r of rosters) {
    const owner = ownerByUserId.get(r.owner_id);
    if (!owner) continue;
    for (const playerId of r.players ?? []) {
      let entry = byPlayerId.get(playerId);
      if (!entry) {
        const name = sleeperPlayerName(nflPlayers[playerId]);
        if (name) entry = byName.get(normalizeName(name));
      }
      // A Sleeper-rostered player with no current-season contract row is not
      // rostered for auction purposes — his deal expired (or he was a
      // mid-season pickup), so he enters the free agent pool like any other
      // uncontracted player.
      if (!entry || claimed.has(entry)) continue;
      claimed.add(entry);
      // Carry Sleeper's player_id so the free agent pool excludes him even
      // when the sheet row's id is "#N/A".
      roster.push({ ...entry, owner, playerId });
    }
  }

  // Active in the sheet but on nobody's Sleeper roster — dropped or traded
  // away since the sheet was last updated.
  const unrostered = contractRoster.filter((entry) => !claimed.has(entry));
  return { roster, unrostered };
}

// pid -> current Sleeper owner, across every roster in the league.
function sleeperOwnerByPlayerId(
  rosters: SleeperRoster[],
  users: SleeperUser[],
): Map<string, string> {
  const ownerByUserId = new Map(users.map((u) => [u.user_id, getDisplayName(u)] as const));
  const map = new Map<string, string>();
  for (const r of rosters) {
    const owner = ownerByUserId.get(r.owner_id);
    if (!owner) continue;
    for (const playerId of r.players ?? []) map.set(playerId, owner);
  }
  return map;
}

export function deriveCapHitsByOwner(capHits: CapHitRow[], season: string): Map<string, number> {
  const seasonNum = parseInt(season, 10);
  const map = new Map<string, number>();
  for (const ch of capHits) {
    const owner = resolveOwnerName(ch.owner);
    const hit = ch.yearlyHits[seasonNum] ?? 0;
    if (hit) map.set(owner, (map.get(owner) ?? 0) + hit);
  }
  return map;
}

// ── Free agent pool derivation ───────────────────────────────────────────────

const AUCTION_POSITIONS = new Set(["QB", "RB", "WR", "TE", "DEF"]);

export function deriveFreeAgentPool(params: {
  nflPlayers: SleeperPlayersMap;
  contractedPlayerIds: Set<string>;
  priorSeasonOwnerByPlayerId: Map<string, string>;
}): DerivedFreeAgent[] {
  const { nflPlayers, contractedPlayerIds, priorSeasonOwnerByPlayerId } = params;
  const pool: DerivedFreeAgent[] = [];

  for (const [pid, p] of Object.entries(nflPlayers)) {
    if (!AUCTION_POSITIONS.has(p.position)) continue;
    if (contractedPlayerIds.has(pid)) continue;
    if (p.position !== "DEF" && p.sport && p.sport !== "nfl") continue;
    if (!p.team) continue;

    const name = p.full_name || `${p.first_name} ${p.last_name}`;
    const previousOwner = priorSeasonOwnerByPlayerId.get(pid) ?? null;

    pool.push({
      playerId: pid,
      player: name,
      position: p.position,
      team: p.team,
      rfa: previousOwner !== null,
      previousOwner,
      status: "available",
    });
  }

  return pool.sort((a, b) => a.player.localeCompare(b.player));
}

// ── Top-level derivation orchestrator (pre-auction setup / "Reload from Sheet") ──

export function deriveAuctionState(params: {
  season: string;
  contracts: ContractRow[];
  capHits: CapHitRow[];
  nflPlayers: SleeperPlayersMap;
  // Sleeper rosters + users decide who owns whom. Optional so the pure
  // contract-only path stays available, but callers should always pass them.
  rosters?: SleeperRoster[];
  users?: SleeperUser[];
}): DerivationResult {
  const { season, contracts, capHits, nflPlayers, rosters, users } = params;
  const warnings: string[] = [];

  const contractRoster = deriveRosterFromContracts(contracts, season);
  const hasSleeper = !!rosters?.length && !!users?.length;

  let roster = contractRoster;
  let unrostered: DerivedRosterEntry[] = [];
  if (hasSleeper) {
    ({ roster, unrostered } = attributeRosterToSleeperOwners({
      contractRoster,
      rosters: rosters!,
      users: users!,
      nflPlayers,
    }));
  } else {
    warnings.push(
      "Sleeper rosters were unavailable, so rosters fell back to the Contracts sheet's Owner column — trades and drops made since the sheet was last updated by hand are NOT reflected. Re-derive once Sleeper is reachable.",
    );
  }

  const capHitsByOwner = deriveCapHitsByOwner(capHits, season);
  const owners = aggregateOwnerCaps(roster, capHitsByOwner);

  const contractedPlayerIds = new Set(
    roster.map((r) => r.playerId).filter(isRealPlayerId),
  );

  // RFA = rostered (Active contract, any years including 0) at the end of
  // the prior season and not currently under contract.
  const priorSeason = String(parseInt(season, 10) - 1);
  const priorSeasonOwnerByPlayerId = new Map<string, string>();
  for (const c of contracts) {
    if (c.season.trim() !== priorSeason) continue;
    if (c.contractStatus.toLowerCase() !== "active") continue;
    if (!isRealPlayerId(c.playerId)) continue;
    priorSeasonOwnerByPlayerId.set(c.playerId, resolveOwnerName(c.owner));
  }

  // An expiring contract's RFA rights follow the player when he is traded, so
  // whoever holds him on Sleeper right now is the previous owner of record.
  // Only players already RFA-eligible from the prior season are re-attributed
  // — being on a Sleeper roster does not by itself make someone an RFA.
  if (hasSleeper) {
    const currentOwners = sleeperOwnerByPlayerId(rosters!, users!);
    for (const [playerId] of priorSeasonOwnerByPlayerId) {
      const currentOwner = currentOwners.get(playerId);
      if (currentOwner) priorSeasonOwnerByPlayerId.set(playerId, currentOwner);
    }
  }

  const pool = deriveFreeAgentPool({ nflPlayers, contractedPlayerIds, priorSeasonOwnerByPlayerId });

  const midSeasonPickups = contracts.filter(
    (c) =>
      c.season.trim() === season &&
      c.contractStatus.toLowerCase() === "active" &&
      c.years === 0,
  );
  if (midSeasonPickups.length > 0) {
    warnings.push(
      `${midSeasonPickups.length} mid-season pickup row${midSeasonPickups.length === 1 ? "" : "s"} for ${season} (Years = 0, Active) were excluded from rosters and are free agents entering the auction — double check they belong in the pool, not on a roster.`,
    );
  }

  if (unrostered.length > 0) {
    const names = unrostered.map((r) => `${r.player} (${r.owner})`);
    const shown = names.slice(0, 12).join(", ");
    const rest = names.length > 12 ? `, +${names.length - 12} more` : "";
    warnings.push(
      `${unrostered.length} active ${season} contract row${unrostered.length === 1 ? "" : "s"} in the sheet ${unrostered.length === 1 ? "is" : "are"} on nobody's Sleeper roster — dropped or traded away since the sheet was updated. Removed from rosters and added to the free agent pool: ${shown}${rest}. The owner shown is the stale one from the sheet.`,
    );
  }

  if (roster.length === 0) {
    warnings.push(
      `No active contract rows found for season ${season} — the sheet may not be updated for this season yet. Verify before starting the auction.`,
    );
  }

  const mismatchedIds = contracts.filter(
    (c) =>
      c.season.trim() === season &&
      c.contractStatus.toLowerCase() === "active" &&
      c.years >= 1 &&
      !isRealPlayerId(c.playerId),
  );
  if (mismatchedIds.length > 0) {
    warnings.push(
      `${mismatchedIds.length} rostered contract${mismatchedIds.length === 1 ? "" : "s"} for ${season} have no Sleeper player_id (shown as "#N/A" in the sheet) — verify these players and their salaries manually on the review screen.`,
    );
  }

  return { season, roster, owners, pool, warnings };
}

// ── Auction bidding rules ────────────────────────────────────────────────────

export const MIN_BID = 1.0;
const BID_INCREMENT_THRESHOLD = 10;

// $0.5 increments below $10, $1.0 increments at $10 and above.
export function bidIncrement(salary: number): number {
  return salary < BID_INCREMENT_THRESHOLD ? 0.5 : 1.0;
}

// The full ladder of legal bid amounts from $1.0 up to `max`.
export function legalBidLadder(max: number = 500): number[] {
  const ladder: number[] = [];
  let s = MIN_BID;
  while (s <= max + 1e-9) {
    ladder.push(round1(s));
    s += bidIncrement(s);
  }
  return ladder;
}

// A bid wins if its auction value is strictly greater, OR equal with MORE
// years (constitution: "you may match someone's bid if you add more years").
export function bidBeats(
  newSalary: number,
  newYears: number,
  currentSalary: number | null,
  currentYears: number | null,
): boolean {
  if (currentSalary == null) return newSalary >= MIN_BID;
  const newValue = calculateContractValue(newSalary, newYears);
  const currentValue = calculateContractValue(currentSalary, currentYears ?? 1);
  return newValue > currentValue || (newValue === currentValue && newYears > (currentYears ?? 0));
}

// For the current bid, the minimum legal salary at each contract length
// (1-5 years) that would win under bidBeats(), and the resulting value.
export function bidToBeatTable(
  currentSalary: number | null,
  currentYears: number | null,
): BidToBeatRow[] {
  const ladder = legalBidLadder();
  const rows: BidToBeatRow[] = [];

  for (let years = 1; years <= 5; years++) {
    let salary = MIN_BID;
    if (currentSalary != null) {
      const found = ladder.find((s) => bidBeats(s, years, currentSalary, currentYears));
      salary = found ?? ladder[ladder.length - 1];
    }
    rows.push({ years, salary, value: calculateContractValue(salary, years) });
  }

  return rows;
}

// ── CSV export (exact old Drafted Players format) ───────────────────────────

export function resultsToCsv(
  results: AuctionResultRow[],
  opts: { includePlayerId?: boolean } = {},
): string {
  const headers = ["ID", "Nominator", "Owner", "Player", "Position", "Years", "Salary"];
  if (opts.includePlayerId) headers.push("Player ID");

  const lines = [headers.join(",")];
  for (const r of results) {
    const id = String(r.pickNumber).padStart(3, "0");
    const row = [
      id,
      r.nominator,
      r.winner,
      r.player,
      r.position,
      String(r.years),
      r.salary.toFixed(1),
    ];
    if (opts.includePlayerId) row.push(r.playerId);
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvEscape(val: string): string {
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Award-time soft warnings ─────────────────────────────────────────────────
// The commissioner is the authority — these never block an award, they only
// flag it for a second look.

export function awardWarnings(cap: DerivedOwnerCap, salary: number, years: number): string[] {
  const warnings: string[] = [];
  if (cap.maxBid != null && salary > cap.maxBid) {
    warnings.push(`Exceeds ${cap.owner}'s max bid of $${cap.maxBid.toFixed(1)} while affording $1 minimums for every other open spot.`);
  }
  if (cap.maxYears != null && years > cap.maxYears) {
    warnings.push(`Exceeds ${cap.owner}'s max contract length of ${cap.maxYears} year(s) given remaining roster spots.`);
  }
  if (salary > cap.cash) {
    warnings.push(`Exceeds ${cap.owner}'s available cash ($${cap.cash.toFixed(1)}).`);
  }
  return warnings;
}
