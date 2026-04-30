export const dynamic = "force-dynamic";

import {
  getAllTransactions,
  getNFLState,
  buildRosterOwnerMap,
  getNFLPlayers,
  getContracts,
  getLatestActiveContracts,
  getLeagueHistory,
} from "@/lib/data";
import { TradesClient } from "./trades-client";
import type { EnrichedTrade } from "@/components/trade-card";
import { buildContractLookup, enrichTrades } from "@/lib/trade-utils";

export const revalidate = 300;

export default async function TradesPage() {
  const [leagues, nflState, players, rawContracts] = await Promise.all([
    getLeagueHistory(),
    getNFLState(),
    getNFLPlayers(),
    getContracts(),
  ]);

  const contracts = getLatestActiveContracts(rawContracts);
  const contractMap = buildContractLookup(contracts);
  const season = nflState.season;

  const leagueResults = await Promise.all(
    leagues.map(async (league) => {
      const [txns, rosterOwnerMap] = await Promise.all([
        getAllTransactions(league.league_id),
        buildRosterOwnerMap(league.league_id),
      ]);
      return { season: league.season, txns, rosterOwnerMap };
    })
  );

  const allTrades: EnrichedTrade[] = [];

  for (const { season: leagueSeason, txns, rosterOwnerMap } of leagueResults) {
    const counter = { value: 0 };
    allTrades.push(...enrichTrades(txns, rosterOwnerMap, contractMap, players, leagueSeason, counter));
  }

  allTrades.sort((a, b) => b.created - a.created);

  return <TradesClient trades={allTrades} season={season} />;
}
