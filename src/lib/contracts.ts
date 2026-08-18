import { ContractRow, ContractWithValue } from "@/types/contracts";
import { CONTRACT_VALUE_MULTIPLIERS, OWNER_LAST_NAME_MAP, NFL_TEAMS } from "./config";

// ── Team-defense id canonicalization ─────────────────────────────────────────
//
// Sleeper keys every team defense by its team abbreviation ("HOU"). The
// Contracts sheet, however, has keyed defenses by abbreviation in older seasons
// and by nickname ("Texans") in newer ones — so a single defense ends up under
// two different player_ids. That splits it into two "players": the Sleeper
// roster (which uses "HOU") joins the stale abbreviation row and shows the
// current nickname-keyed contract as missing (rendered $0/0). Collapsing both
// to the Sleeper abbreviation fixes every defense at once.
const DEF_POSITIONS = new Set(["DEF", "DST", "D/ST"]);

const DEF_ALIAS_TO_ABBREV: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [abbrev, fullName] of Object.entries(NFL_TEAMS)) {
    m[abbrev.toLowerCase()] = abbrev; // "HOU"
    m[fullName.toLowerCase()] = abbrev; // "houston texans"
    const nickname = fullName.split(" ").pop(); // "Texans"
    if (nickname) m[nickname.toLowerCase()] = abbrev;
  }
  return m;
})();

// Canonical player_id for a contract row. Team defenses resolve to the Sleeper
// team abbreviation (from the sheet's abbreviation, nickname, or full name);
// every other row is returned unchanged.
export function canonicalContractPlayerId(
  contract: Pick<ContractRow, "playerId" | "player" | "position">,
): string {
  if (DEF_POSITIONS.has((contract.position || "").toUpperCase())) {
    const fromId = DEF_ALIAS_TO_ABBREV[(contract.playerId || "").toLowerCase().trim()];
    if (fromId) return fromId;
    const fromName = DEF_ALIAS_TO_ABBREV[(contract.player || "").toLowerCase().trim()];
    if (fromName) return fromName;
  }
  return contract.playerId;
}

// Contract Status = "Active" is the SINGLE SOURCE OF TRUTH for whether a player
// appears anywhere on the site.
//
// A player with Years = 0 and Salary = $0.0 but Contract Status = "Active" is a
// legitimate mid-season FA pickup and MUST appear on the team's roster page and
// the Contracts page — labeled with a "Mid-Season Pickup" badge.
// This is not an error in the data; it is an intentional state.
//
// If Contract Status contains any value other than "Active", exclude that row
// from all displays.

export function filterActiveContracts(contracts: ContractRow[]): ContractRow[] {
  return contracts.filter((c) => c.contractStatus.toLowerCase() === "active");
}

export function filterBySeason(contracts: ContractRow[], season: string): ContractRow[] {
  return contracts.filter((c) => c.season === season);
}

export function filterByOwner(contracts: ContractRow[], ownerLastName: string): ContractRow[] {
  return contracts.filter((c) => c.owner === ownerLastName);
}

// Determine if a contract represents a mid-season pickup
// Mid-season pickups have Years = 0 and Salary = 0 but are still Active
export function isMidSeasonPickup(contract: ContractRow): boolean {
  return contract.years === 0 && contract.salary === 0;
}

// Calculate contract value using the defined multipliers:
//   Years = 0:  $0 (mid-season pickup — no contract value)
//   1-year:     Salary × 1.0
//   2-year:     Salary × 1.4
//   3-year:     Salary × 1.7
//   4-year:     Salary × 1.9
//   5-year:     Salary × 2.0
export function calculateContractValue(salary: number, years: number): number {
  if (years === 0) return 0; // Mid-season pickup — no contract value
  const multiplier = CONTRACT_VALUE_MULTIPLIERS[years] ?? CONTRACT_VALUE_MULTIPLIERS[5];
  return Math.round(salary * multiplier * 10) / 10;
}

// Enrich a contract row with calculated value and mid-season pickup flag
export function enrichContract(contract: ContractRow): ContractWithValue {
  return {
    ...contract,
    contractValue: calculateContractValue(contract.salary, contract.years),
    isMidSeasonPickup: isMidSeasonPickup(contract),
  };
}

// Get all active contracts for a season, enriched with computed values.
// If no contracts match the exact season, fall back to the latest season with active data.
export function getActiveContractsForSeason(
  contracts: ContractRow[],
  season: string
): ContractWithValue[] {
  const active = filterActiveContracts(contracts);
  const forSeason = active.filter((c) => c.season.trim() === season.trim());

  // If we found contracts for the requested season, use those
  if (forSeason.length > 0) {
    return forSeason.map(enrichContract);
  }

  // Otherwise, find the latest season that has active contracts
  const seasons = [...new Set(active.map((c) => c.season))].sort().reverse();
  if (seasons.length > 0) {
    return active.filter((c) => c.season === seasons[0]).map(enrichContract);
  }

  return [];
}

// Get the latest active contract per player across all seasons.
// The spreadsheet has one row per player per season. This deduplicates to the
// most recent season's entry so roster/cap data is correct even when the
// Sleeper season (e.g. "2026") has only partial data (draft picks).
export function getLatestActiveContracts(contracts: ContractRow[]): ContractWithValue[] {
  const active = filterActiveContracts(contracts);
  const sorted = [...active].sort((a, b) => a.season.localeCompare(b.season));

  const latest = new Map<string, ContractRow>();
  for (const c of sorted) {
    // Defenses key by their canonical Sleeper abbreviation so a team's
    // abbreviation- and nickname-keyed rows collapse to one player and the most
    // recent season wins — matching how Sleeper rosters reference the defense.
    const canonicalId = canonicalContractPlayerId(c);
    const key =
      canonicalId && canonicalId !== "#N/A" && canonicalId !== "N/A" && canonicalId !== ""
        ? canonicalId
        : c.player.toLowerCase().trim();
    latest.set(key, canonicalId !== c.playerId ? { ...c, playerId: canonicalId } : c);
  }

  return [...latest.values()].map(enrichContract);
}

// Resolve owner last name from Sheets to full display name
export function resolveOwnerName(ownerLastName: string): string {
  return OWNER_LAST_NAME_MAP[ownerLastName] || ownerLastName;
}
