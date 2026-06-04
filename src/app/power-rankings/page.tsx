import { connection } from "next/server";

import { getTeamsData, getLeagueUsers, calculatePowerRankings, calculateRankChanges } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { LEAGUE_ID } from "@/lib/config";
import { PowerRankingEntry } from "@/lib/power-rankings";
import { SleeperMatchup } from "@/types/sleeper";
import { RankingsClient } from "./rankings-client";


function computeWeekAllPlay(
  matchups: SleeperMatchup[],
): Record<number, [number, number]> {
  const valid = matchups.filter((m) => m.points > 0);
  const result: Record<number, [number, number]> = {};
  for (const team of valid) {
    let wins = 0,
      losses = 0;
    for (const opp of valid) {
      if (opp.roster_id === team.roster_id) continue;
      if (team.points > opp.points) wins++;
      else if (team.points < opp.points) losses++;
    }
    result[team.roster_id] = [wins, losses];
  }
  return result;
}

export default async function PowerRankingsPage() {
  await connection();
  const [{ teams, season, currentWeek, allMatchups }, users] =
    await Promise.all([getTeamsData(), getLeagueUsers(LEAGUE_ID)]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

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

  const allPlayByWeek: Record<number, Record<number, [number, number]>> = {};
  for (let w = 1; w <= completedWeeks; w++) {
    const matchups = allMatchups.get(w);
    if (matchups) {
      allPlayByWeek[w] = computeWeekAllPlay(matchups);
    }
  }

  const weeklyRankHistory: Record<number, number[]> = {};
  const teamStreaks: Record<number, string> = {};
  for (const team of teams) {
    teamStreaks[team.rosterId] = team.streak;
  }
  for (let w = 1; w <= completedWeeks; w++) {
    const rankings = weeklyRankings[w];
    if (!rankings) continue;
    for (const entry of rankings) {
      (weeklyRankHistory[entry.rosterId] ??= []).push(entry.rank);
    }
  }

  return (
    <RankingsClient
      weeklyRankings={weeklyRankings}
      allPlayByWeek={allPlayByWeek}
      weeklyRankHistory={weeklyRankHistory}
      teamStreaks={teamStreaks}
      ownerAvatars={ownerAvatars}
      season={season}
      currentWeek={completedWeeks}
    />
  );
}
