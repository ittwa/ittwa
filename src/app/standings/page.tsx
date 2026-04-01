export const dynamic = 'force-dynamic';

import { getTeamsData, calculateStandings } from "@/lib/data";
import { getStandingsByDivision } from "@/lib/standings";
import { StandingsClient } from "./standings-client";

export const revalidate = 300; // 5 minutes — same cadence as matchup data

export default async function StandingsPage() {
  const { teams, season, currentWeek, allMatchups } = await getTeamsData();

  const standings = calculateStandings(teams, allMatchups);
  const standingsByDivision = getStandingsByDivision(standings);

  return (
    <StandingsClient
      standings={standings}
      standingsByDivision={standingsByDivision}
      season={season}
      currentWeek={currentWeek}
    />
  );
}
