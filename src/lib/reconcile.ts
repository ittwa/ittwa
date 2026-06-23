// Data Check reconciliation — compares Sleeper rosters against the Contracts
// sheet and flags disagreements so they can be fixed proactively.
//
// This module is intentionally framework-agnostic and PURE: `reconcile()` takes
// already-fetched data and returns a plain result object. The page is
// responsible for fetching (Google Sheets + Sleeper) and passing the inputs in.
// Keeping it pure makes the league-specific join/classification logic unit
// testable (see reconcile.test.ts).

import type { ContractRow } from "@/types/contracts";
import type { SleeperRoster, SleeperUser, SleeperPlayersMap } from "@/types/sleeper";

// Only numeric player_ids join Sleeper ↔ sheet. DEF units (e.g. "DET") and
// "#N/A" draft-pick rows are excluded from reconciliation entirely.
const NUMERIC_PID = /^\d+$/;

export type DiscrepancyType =
  | "ghost_on_sleeper" // on a Sleeper roster, no active contract anywhere in the sheet
  | "stale_in_sheet" // active in the sheet, not on any Sleeper roster
  | "owner_mismatch" // active in both, but different owners
  | "id_mismatch"; // same player stored under two ids (sheet has the wrong player_id)

export interface Discrepancy {
  type: DiscrepancyType;
  player: string;
  position?: string;
  // playerId is the id to use for the headshot. For id_mismatch this is the
  // correct/active Sleeper id.
  playerId: string;
  // ghost_on_sleeper / stale_in_sheet / owner_mismatch carry owners (surnames).
  // A null side means "not present on that side".
  sleeperOwner?: string | null;
  sheetOwner?: string | null;
  // id_mismatch only: the two ids and the (shared) owner surname.
  sleeperId?: string;
  sheetId?: string;
  owner?: string;
}

export interface AliasEntry {
  rosterId: number;
  sleeperOwner: string; // raw Sleeper handle / team name
  sheetOwner: string; // derived sheet surname
  overlap: number; // # of active pids shared between this roster and the sheet owner
  matchable: number; // # of this roster's pids that are active in the sheet under any owner
  ratio: number; // overlap / matchable — closer to 1.0 = higher confidence
}

export interface ReconcileTotals {
  ghost_on_sleeper: number;
  id_mismatch: number;
  stale_in_sheet: number;
  owner_mismatch: number;
  total: number;
  activeContracts: number;
  rosteredPlayers: number;
}

export interface ReconcileResult {
  generatedAt: string;
  season: string;
  totals: ReconcileTotals;
  aliasMap: AliasEntry[];
  discrepancies: Discrepancy[];
}

export interface ReconcileInput {
  season: string;
  contracts: ContractRow[];
  rosters: SleeperRoster[];
  users: SleeperUser[];
  // Sleeper /players/nfl dictionary — used to resolve display names for pids
  // that never appear in the sheet (rookies). Optional so tests can omit it.
  players?: SleeperPlayersMap;
  // Override for deterministic tests; defaults to now.
  generatedAt?: string;
}

// Normalize a player name for same-player matching: lowercase, strip anything
// that isn't a letter ("D.J. Moore" / "DJ Moore" → "djmoore").
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

// Display priority for the four flag types — drives stable sort order so the
// rendered output is deterministic.
const TYPE_ORDER: Record<DiscrepancyType, number> = {
  ghost_on_sleeper: 0,
  id_mismatch: 1,
  stale_in_sheet: 2,
  owner_mismatch: 3,
};

export function reconcile(input: ReconcileInput): ReconcileResult {
  const { season, contracts, rosters, users, players = {}, generatedAt } = input;

  // ── 1. Source of truth: active-in-sheet rows for the current season ────────
  // A Contracts row is "active in the sheet" when Season == currentSeason AND
  // Contract Status == "Active". Exclude non-numeric player_ids.
  const sheetByPid = new Map<string, { player: string; position: string; owner: string }>();
  const sheetOwnerPids = new Map<string, Set<string>>(); // surname -> active pids
  for (const c of contracts) {
    if (c.season !== season) continue;
    if (c.contractStatus !== "Active") continue;
    if (!NUMERIC_PID.test(c.playerId)) continue;

    sheetByPid.set(c.playerId, { player: c.player, position: c.position, owner: c.owner });
    let set = sheetOwnerPids.get(c.owner);
    if (!set) {
      set = new Set();
      sheetOwnerPids.set(c.owner, set);
    }
    set.add(c.playerId);
  }

  // ── 2. Sleeper rosters → numeric pid sets ─────────────────────────────────
  const userById = new Map(users.map((u) => [u.user_id, u] as const));
  const rosterPids = new Map<number, Set<string>>();
  for (const r of rosters) {
    const set = new Set<string>();
    for (const pid of r.players || []) {
      if (NUMERIC_PID.test(pid)) set.add(pid);
    }
    rosterPids.set(r.roster_id, set);
  }

  // ── 3. Derive the owner alias map (Sleeper roster ↔ sheet surname) ────────
  // The sheet's Owner column uses surnames while Sleeper uses handles/team
  // names. For each roster, pick the sheet owner whose active player set it
  // overlaps the most. Then assert the mapping is 1:1.
  const sheetOwners = [...sheetOwnerPids.keys()];
  const rosterToSurname = new Map<number, string>();
  const aliasMap: AliasEntry[] = [];

  for (const r of rosters) {
    const pids = rosterPids.get(r.roster_id)!;
    let matchable = 0;
    for (const pid of pids) if (sheetByPid.has(pid)) matchable++;

    let bestOwner = "";
    let bestOverlap = -1;
    for (const surname of sheetOwners) {
      const ownerSet = sheetOwnerPids.get(surname)!;
      let overlap = 0;
      for (const pid of pids) if (ownerSet.has(pid)) overlap++;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestOwner = surname;
      }
    }

    rosterToSurname.set(r.roster_id, bestOwner);
    const user = userById.get(r.owner_id);
    aliasMap.push({
      rosterId: r.roster_id,
      sleeperOwner: user?.display_name || `Roster ${r.roster_id}`,
      sheetOwner: bestOwner,
      overlap: Math.max(0, bestOverlap),
      matchable,
      ratio: matchable > 0 ? Math.max(0, bestOverlap) / matchable : 0,
    });
  }

  // Assert all rosters map to distinct owners — a duplicate means the overlap
  // heuristic failed and the rest of the reconciliation would be untrustworthy.
  const assigned = [...rosterToSurname.values()];
  const distinct = new Set(assigned);
  if (distinct.size !== assigned.length) {
    const counts = new Map<string, number>();
    for (const s of assigned) counts.set(s, (counts.get(s) || 0) + 1);
    const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([s, n]) => `${s} (×${n})`);
    throw new Error(
      `Owner alias map is not 1:1 — ${assigned.length} rosters mapped to ${distinct.size} distinct sheet owners. Duplicates: ${dupes.join(", ")}`,
    );
  }

  // ── 4. Build sleeperByPid (pid -> surname) over the union of pids ─────────
  const sleeperByPid = new Map<string, string>();
  const rosteredPids = new Set<string>();
  for (const r of rosters) {
    const surname = rosterToSurname.get(r.roster_id)!;
    for (const pid of rosterPids.get(r.roster_id)!) {
      sleeperByPid.set(pid, surname);
      rosteredPids.add(pid);
    }
  }

  const resolveName = (pid: string): string => {
    const sheet = sheetByPid.get(pid);
    if (sheet?.player) return sheet.player;
    const p = players[pid];
    if (p) return p.full_name || `${p.first_name} ${p.last_name}`.trim();
    return `Unknown (${pid})`;
  };

  // ── 5. Classify the union into ghost / stale / owner_mismatch ─────────────
  const ghosts: Discrepancy[] = [];
  const stales: Discrepancy[] = [];
  const mismatches: Discrepancy[] = [];

  const union = new Set<string>([...sheetByPid.keys(), ...sleeperByPid.keys()]);
  for (const pid of union) {
    const inSheet = sheetByPid.get(pid);
    const sleeperOwner = sleeperByPid.get(pid);

    if (sleeperOwner && !inSheet) {
      ghosts.push({
        type: "ghost_on_sleeper",
        playerId: pid,
        player: resolveName(pid),
        position: players[pid]?.position,
        sleeperOwner,
        sheetOwner: null,
      });
    } else if (inSheet && !sleeperOwner) {
      stales.push({
        type: "stale_in_sheet",
        playerId: pid,
        player: inSheet.player,
        position: inSheet.position,
        sleeperOwner: null,
        sheetOwner: inSheet.owner,
      });
    } else if (inSheet && sleeperOwner && inSheet.owner !== sleeperOwner) {
      mismatches.push({
        type: "owner_mismatch",
        playerId: pid,
        player: inSheet.player,
        position: inSheet.position,
        sleeperOwner,
        sheetOwner: inSheet.owner,
      });
    }
  }

  // ── 6. Collapse pass: id_mismatch ─────────────────────────────────────────
  // A ghost and a stale whose normalized names match AND whose owners match are
  // the SAME player stored under two ids — the sheet has the wrong player_id
  // (almost always an inactive namesake). Emit one id_mismatch and remove both
  // originals from the ghost/stale lists.
  const idMismatches: Discrepancy[] = [];
  const usedGhost = new Set<number>();
  const usedStale = new Set<number>();

  for (let gi = 0; gi < ghosts.length; gi++) {
    const g = ghosts[gi];
    const gKey = normalizeName(g.player);
    for (let si = 0; si < stales.length; si++) {
      if (usedStale.has(si)) continue;
      const s = stales[si];
      if (normalizeName(s.player) === gKey && g.sleeperOwner === s.sheetOwner) {
        idMismatches.push({
          type: "id_mismatch",
          player: s.player || g.player, // prefer the sheet's Player column
          position: s.position || g.position,
          playerId: g.playerId, // headshot uses the correct/active Sleeper id
          sleeperId: g.playerId, // correct (active) id from Sleeper
          sheetId: s.playerId, // stale namesake id stored in the sheet
          owner: s.sheetOwner!,
        });
        usedGhost.add(gi);
        usedStale.add(si);
        break;
      }
    }
  }

  const remGhosts = ghosts.filter((_, i) => !usedGhost.has(i));
  const remStales = stales.filter((_, i) => !usedStale.has(i));

  const discrepancies = [...remGhosts, ...idMismatches, ...remStales, ...mismatches].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.player.localeCompare(b.player),
  );

  const totals: ReconcileTotals = {
    ghost_on_sleeper: remGhosts.length,
    id_mismatch: idMismatches.length,
    stale_in_sheet: remStales.length,
    owner_mismatch: mismatches.length,
    total: remGhosts.length + idMismatches.length + remStales.length + mismatches.length,
    activeContracts: sheetByPid.size,
    rosteredPlayers: rosteredPids.size,
  };

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    season,
    totals,
    aliasMap: aliasMap.sort((a, b) => a.sheetOwner.localeCompare(b.sheetOwner)),
    discrepancies,
  };
}
