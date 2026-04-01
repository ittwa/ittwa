export const dynamic = 'force-dynamic';

import { getTeamsData, calculatePowerRankings, calculateRankChanges } from "@/lib/data";
import { OWNER_DIVISION } from "@/lib/config";
import { PowerRankingEntry } from "@/lib/power-rankings";
import { RankingsClient } from "./rankings-client";

export const revalidate = 300;

export default async function PowerRankingsPage() {
  const { teams, season, currentWeek, allMatchups } = await getTeamsData();

  const rosterInfo = new Map<
    number,
    { displayName: string; division: string; wins: number; losses: number }
  >();
  for (const team of teams) {
    rosterInfo.set(team.rosterId, {
      displayName: team.displayName,
      division: team.division,
      wins: team.wins,
      losses: team.losses,
    });
  }

  const completedWeeks = Math.max(currentWeek - 1, 1);

  // Pre-calculate rankings for every week snapshot
  const weeklyRankings: Record<number, PowerRankingEntry[]> = {};

  for (let w = 1; w <= completedWeeks; w++) {
    const current = calculatePowerRankings(allMatchups, rosterInfo, w);
    if (w > 1) {
      const previous = calculatePowerRankings(allMatchups, rosterInfo, w - 1);
      weeklyRankings[w] = calculateRankChanges(current, previous);
    } else {
      weeklyRankings[w] = current;
    }
  }

  return (
    <RankingsClient
      weeklyRankings={weeklyRankings}
      season={season}
      currentWeek={completedWeeks}
    />
  );
}
