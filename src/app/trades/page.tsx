import { connection } from "next/server";

import {
  getAllTransactions,
  getNFLState,
  buildRosterOwnerMap,
  getNFLPlayers,
  getContracts,
  getLatestActiveContracts,
  getLeagueHistory,
  getLeagueUsers,
} from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { TradesClient } from "./trades-client";
import type { EnrichedTrade } from "@/components/trade-card";
import { buildContractLookup, enrichTrades } from "@/lib/trade-utils";


export default async function TradesPage() {
  await connection();
  const [leagues, nflState, players, rawContracts, users] = await Promise.all([
    getLeagueHistory(),
    getNFLState(),
    getNFLPlayers(),
    getContracts(),
    getLeagueUsers(),
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

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return <TradesClient trades={allTrades} season={season} ownerAvatars={ownerAvatars} />;
}
