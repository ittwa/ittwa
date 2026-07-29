// Fetches everything `deriveAuctionState` needs and runs it. Shared by the
// setup wizard's derive/reload endpoint and the mid-auction resync endpoint so
// both build rosters from exactly the same inputs.

import { deriveAuctionState } from "./auction";
import { getContracts, getCapHits, getNFLPlayers, getNFLState, getLeague, getLeagueUsers, getRosters } from "./data";
import type { DerivationResult } from "@/types/auction";

// The league's own season is authoritative (a 2026 dynasty league is on
// "2026" all offseason); the global NFL state season lags behind it.
export async function deriveDefaultSeason(): Promise<string> {
  const [league, nflState] = await Promise.all([
    getLeague().catch(() => null),
    getNFLState().catch(() => null),
  ]);
  return league?.season || nflState?.season || String(new Date().getFullYear());
}

export async function deriveInputs(season: string): Promise<DerivationResult> {
  const [contracts, capHits, nflPlayers, rosters, users] = await Promise.all([
    getContracts(),
    getCapHits(),
    getNFLPlayers(),
    // Sleeper decides who owns whom. If it is unreachable, deriveAuctionState
    // falls back to the sheet's Owner column and warns loudly about it rather
    // than failing the whole derivation.
    getRosters().catch(() => []),
    getLeagueUsers().catch(() => []),
  ]);

  return deriveAuctionState({ season, contracts, capHits, nflPlayers, rosters, users });
}
