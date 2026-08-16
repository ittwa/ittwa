import { connection } from "next/server";
import { getLeagueUsers, getNFLPlayers } from "@/lib/data";
import { getFantasyCalcValues } from "@/lib/fantasycalc";
import { getCachedNflPosStats } from "@/lib/cached-stats";
import { getDisplayName } from "@/lib/sleeper";
import { SEASON_LEAGUE_IDS } from "@/lib/config";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";
import { AuctionBoardClient } from "./auction-client";
import type { PlayerRankings } from "@/types/auction";

export const metadata = { title: "Free Agent Auction" };

// The nomination tab joins these in client-side by player_id. They're
// slow-moving reference data (FantasyCalc updates daily, last-season stats
// never change), so they're fetched once here rather than riding the
// every-few-seconds /api/auction/state poll.
async function buildRankings(): Promise<PlayerRankings> {
  const seasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();
  const current = seasons[0];
  // "Last season" = the most recent completed season's actual stats (2025 when
  // the league is on 2026 all offseason); fall back to current if it's the only
  // one we have.
  const lastSeason = seasons.length > 1 ? seasons[1] : current;

  const [fcValues, nflPlayers] = await Promise.all([
    getFantasyCalcValues().catch(() => []),
    getNFLPlayers().catch(() => ({})),
  ]);
  const lastStats = await getCachedNflPosStats(lastSeason, nflPlayers, lastSeason === current).catch(() => ({}));

  const rankings: PlayerRankings = {};
  for (const e of fcValues) {
    const pid = e.player.sleeperId;
    if (!pid) continue; // draft picks and unmatched entries have no Sleeper id
    rankings[pid] = {
      overallRank: e.overallRank ?? null,
      dynastyValue: e.value ?? null,
      dynastyPosRank: e.positionRank ?? null,
      lastPoints: null,
      lastPosRank: null,
    };
  }
  for (const [pid, stat] of Object.entries(lastStats)) {
    const row = rankings[pid] ?? { overallRank: null, dynastyValue: null, dynastyPosRank: null, lastPoints: null, lastPosRank: null };
    row.lastPoints = stat.points;
    row.lastPosRank = stat.posRank;
    rankings[pid] = row;
  }
  return rankings;
}

export default async function AuctionPage() {
  await connection();
  const [users, rankings] = await Promise.all([
    getLeagueUsers().catch(() => []),
    buildRankings(),
  ]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
      <AuctionBoardClient rankings={rankings} />
    </OwnerAvatarsProvider>
  );
}
