import { ContractRow, ContractWithValue } from "@/types/contracts";
import { CONTRACT_VALUE_MULTIPLIERS, OWNER_LAST_NAME_MAP } from "./config";

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
    const key =
      c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== ""
        ? c.playerId
        : c.player.toLowerCase().trim();
    latest.set(key, c);
  }

  return [...latest.values()].map(enrichContract);
}

// Resolve owner last name from Sheets to full display name
export function resolveOwnerName(ownerLastName: string): string {
  return OWNER_LAST_NAME_MAP[ownerLastName] || ownerLastName;
}
