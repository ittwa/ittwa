import { connection } from "next/server";

export const metadata = { title: "Trades" };

import {
  getAllTransactions,
  getNFLState,
  buildRosterOwnerMap,
  getNFLPlayers,
  getContracts,
  getLatestActiveContracts,
  getLeagueHistory,
  getLeagueUsers,
  getDrafts,
} from "@/lib/data";
import { getDraftPicks, getDisplayName } from "@/lib/sleeper";
import { TradesClient } from "./trades-client";
import type { EnrichedTrade } from "@/components/trade-card";
import { buildContractLookup, enrichTrades } from "@/lib/trade-utils";
import { getPlayerValueMap } from "@/lib/trade-analyzer/player-values";
import { buildResolvedPickMap, gradeTrade } from "@/lib/trade-grading";
import type { SleeperDraft, SleeperDraftPick } from "@/types/sleeper";


export default async function TradesPage() {
  await connection();
  const [leagues, nflState, players, rawContracts, users, playerValueMap] = await Promise.all([
    getLeagueHistory(),
    getNFLState(),
    getNFLPlayers(),
    getContracts(),
    getLeagueUsers(),
    getPlayerValueMap(),
  ]);

  const contracts = getLatestActiveContracts(rawContracts);
  const contractMap = buildContractLookup(contracts);
  const season = nflState.season;

  // Fetch transactions and roster maps for all seasons
  const leagueResults = await Promise.all(
    leagues.map(async (league) => {
      const [txns, rosterOwnerMap] = await Promise.all([
        getAllTransactions(league.league_id),
        buildRosterOwnerMap(league.league_id),
      ]);
      return { season: league.season, leagueId: league.league_id, txns, rosterOwnerMap };
    })
  );

  // Build resolved-pick map: for each completed draft, map
  // (season, round, originalRosterId) → drafted player
  const allDrafts: SleeperDraft[] = [];
  const draftPicksByDraftId = new Map<string, SleeperDraftPick[]>();

  await Promise.all(
    leagueResults.map(async ({ leagueId }) => {
      try {
        const drafts = await getDrafts(leagueId);
        const completedDrafts = drafts.filter((d) => d.status === "complete");
        allDrafts.push(...completedDrafts);
        await Promise.all(
          completedDrafts.map(async (d) => {
            try {
              const picks = await getDraftPicks(d.draft_id);
              draftPicksByDraftId.set(d.draft_id, picks);
            } catch {
              // Graceful degradation: picks unresolved for this draft
            }
          })
        );
      } catch {
        // Graceful degradation: no draft data for this league season
      }
    })
  );

  const resolvedPickMap = buildResolvedPickMap(allDrafts, draftPicksByDraftId);

  // Build all trades then grade them
  const allTrades: EnrichedTrade[] = [];

  for (const { season: leagueSeason, txns, rosterOwnerMap } of leagueResults) {
    const counter = { value: 0 };
    allTrades.push(...enrichTrades(txns, rosterOwnerMap, contractMap, players, leagueSeason, counter));
  }

  allTrades.sort((a, b) => b.created - a.created);

  // Attach grades (neutral strategy, default config + live valuePerDollar)
  for (const trade of allTrades) {
    const grade = gradeTrade(trade, playerValueMap.valueByPlayerId, resolvedPickMap);
    if (grade) trade.grade = grade;
  }

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return <TradesClient trades={allTrades} season={season} ownerAvatars={ownerAvatars} />;
}
