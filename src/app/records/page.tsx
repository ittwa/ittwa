export const dynamic = 'force-dynamic';

import { getTeamsData, buildRosterOwnerMap } from "@/lib/data";
import { RecordsClient } from "./records-client";
import { SleeperMatchup } from "@/types/sleeper";

export const revalidate = 300;

export default async function RecordsPage() {
  const [teamsData, rosterOwnerMap] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
  ]);

  const { teams, season, currentWeek, allMatchups } = teamsData;

  // Serialize matchups Map for client
  const matchupsArray: [number, SleeperMatchup[]][] = Array.from(allMatchups.entries());

  // Build records from current season data
  const teamRecords = teams.map((t) => ({
    rosterId: t.rosterId,
    displayName: t.displayName,
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
    pointsFor: t.pointsFor,
    pointsAgainst: t.pointsAgainst,
  }));

  return (
    <RecordsClient
      matchupsArray={matchupsArray}
      rosterOwnerMap={rosterOwnerMap}
      teamRecords={teamRecords}
      season={season}
      currentWeek={currentWeek}
    />
  );
}
