export const dynamic = 'force-dynamic';

import { getTeamsData, calculateStandings, getLeagueUsers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { getStandingsByDivision } from "@/lib/standings";
import { StandingsClient } from "./standings-client";

export const revalidate = 300; // 5 minutes — same cadence as matchup data

export default async function StandingsPage() {
  const [{ teams, season, currentWeek, allMatchups }, users] = await Promise.all([
    getTeamsData(),
    getLeagueUsers(),
  ]);

  const standings = calculateStandings(teams, allMatchups);
  const standingsByDivision = getStandingsByDivision(standings);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return (
    <StandingsClient
      standings={standings}
      standingsByDivision={standingsByDivision}
      season={season}
      currentWeek={currentWeek}
      ownerAvatars={ownerAvatars}
    />
  );
}
