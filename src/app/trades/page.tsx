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
import type { EnrichedTrade, TradeItem } from "./trades-client";

export const revalidate = 300;

export default async function TradesPage() {
  const [leagues, nflState, players, rawContracts] = await Promise.all([
    getLeagueHistory(),
    getNFLState(),
    getNFLPlayers(),
    getContracts(),
  ]);

  const contracts = getLatestActiveContracts(rawContracts);
  const contractMap = new Map<string, { salary: number; years: number }>();
  for (const c of contracts) {
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      contractMap.set(c.playerId, { salary: c.salary, years: c.years });
    }
  }

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
  const tradeCounter = new Map<string, number>();

  for (const { season: leagueSeason, txns, rosterOwnerMap } of leagueResults) {
    const completed = txns
      .filter((t) => t.type === "trade" && t.status === "complete")
      .sort((a, b) => a.created - b.created);

    for (const t of completed) {
      const count = (tradeCounter.get(leagueSeason) || 0) + 1;
      tradeCounter.set(leagueSeason, count);
      const tradeId = `${leagueSeason}${String(count).padStart(2, "0")}`;

      const sideMap = new Map<number, TradeItem[]>();
      for (const rid of t.roster_ids) {
        sideMap.set(rid, []);
      }

      if (t.adds) {
        for (const [playerId, rosterId] of Object.entries(t.adds)) {
          const player = players[playerId];
          const contract = contractMap.get(playerId);
          const item: TradeItem = {
            type: "player" as const,
            name: player
              ? player.full_name || `${player.first_name} ${player.last_name}`
              : `Unknown (${playerId})`,
            pos: player?.position || "??",
            nflTeam: player?.team || "FA",
            sleeperId: playerId,
            salary: contract?.salary ?? 0,
            years: contract?.years ?? 0,
          };
          sideMap.get(Number(rosterId))?.push(item);
        }
      }

      if (t.draft_picks) {
        for (const pick of t.draft_picks) {
          const origOwner =
            rosterOwnerMap[pick.previous_owner_id] || `Team ${pick.previous_owner_id}`;
          const item: TradeItem = {
            type: "pick" as const,
            name: `${pick.season} Round ${pick.round} (via ${origOwner})`,
            round: pick.round,
            pickSeason: pick.season,
            originalOwner: origOwner,
          };
          sideMap.get(pick.owner_id)?.push(item);
        }
      }

      const sides = t.roster_ids.map((rid) => ({
        owner: rosterOwnerMap[rid] || `Team ${rid}`,
        rosterId: rid,
        received: sideMap.get(rid) || [],
      }));

      const week = t.week < 1 ? -1 : t.week;

      allTrades.push({ id: tradeId, created: t.created, week, season: leagueSeason, sides });
    }
  }

  allTrades.sort((a, b) => b.created - a.created);

  return <TradesClient trades={allTrades} season={season} />;
}
