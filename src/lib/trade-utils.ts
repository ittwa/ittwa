import type { EnrichedTrade, TradeItem } from "@/components/trade-card";
import type { SleeperTransaction } from "@/types/sleeper";
import type { SleeperPlayersMap } from "@/types/sleeper";
import type { ContractWithValue } from "@/types/contracts";

export function buildContractLookup(contracts: ContractWithValue[]): Map<string, { salary: number; years: number }> {
  const map = new Map<string, { salary: number; years: number }>();
  for (const c of contracts) {
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      map.set(c.playerId, { salary: c.salary, years: c.years });
    }
  }
  return map;
}

export function enrichTrades(
  txns: SleeperTransaction[],
  rosterOwnerMap: Record<string, string>,
  contractMap: Map<string, { salary: number; years: number }>,
  players: SleeperPlayersMap,
  season: string,
  counter: { value: number },
): EnrichedTrade[] {
  const completed = txns
    .filter((t) => t.type === "trade" && t.status === "complete")
    .sort((a, b) => a.created - b.created);

  const trades: EnrichedTrade[] = [];

  for (const t of completed) {
    counter.value++;
    const tradeId = `${season}${String(counter.value).padStart(2, "0")}`;

    const sideMap = new Map<number, TradeItem[]>();
    for (const rid of t.roster_ids) sideMap.set(rid, []);

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
        const origOwner = rosterOwnerMap[pick.previous_owner_id] || `Team ${pick.previous_owner_id}`;
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

    const week = t.week == null || t.week < 1 ? -1 : t.week;
    trades.push({ id: tradeId, created: t.created, week, season, sides });
  }

  return trades;
}
