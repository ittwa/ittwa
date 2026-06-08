import { connection } from "next/server";

import { getLeagueUsers, getDisplayName } from "@/lib/sleeper";
import { LEAGUE_ID } from "@/lib/config";
import { getTradeAnalyzerData } from "@/lib/trade-analyzer/data";
import { TradeAnalyzerClient } from "./trade-analyzer-client";

export const metadata = {
  title: "Trade Analyzer · ITTWA",
  description: "Contract-adjusted dynasty trade analyzer for the ITTWA league.",
};

export default async function TradeAnalyzerPage() {
  await connection();

  const [data, users] = await Promise.all([getTradeAnalyzerData(), getLeagueUsers(LEAGUE_ID)]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  // Stable order: by division then owner, so the team selector reads sensibly.
  const teams = [...data.teams].sort(
    (a, b) => a.division.localeCompare(b.division) || a.owner.localeCompare(b.owner),
  );

  return (
    <TradeAnalyzerClient teams={teams} ownerAvatars={ownerAvatars} unmatchedCount={data.unmatchedCount} />
  );
}
