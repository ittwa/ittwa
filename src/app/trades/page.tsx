export const dynamic = 'force-dynamic';

import { getAllTransactions, getNFLState, buildRosterOwnerMap } from "@/lib/data";
import { TradesClient } from "./trades-client";

export const revalidate = 300;

export default async function TradesPage() {
  const [txns, nflState, rosterOwnerMap] = await Promise.all([
    getAllTransactions(),
    getNFLState(),
    buildRosterOwnerMap(),
  ]);

  const trades = txns
    .filter((t) => t.type === "trade" && t.status === "complete")
    .sort((a, b) => b.created - a.created)
    .map((t) => ({
      id: t.transaction_id,
      created: t.created,
      week: t.week,
      rosterIds: t.roster_ids,
      adds: t.adds || {},
      drops: t.drops || {},
      draftPicks: t.draft_picks || [],
    }));

  return (
    <TradesClient
      trades={trades}
      rosterOwnerMap={rosterOwnerMap}
      season={nflState.season}
    />
  );
}
