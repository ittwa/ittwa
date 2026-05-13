export const dynamic = 'force-dynamic';

import { getTeamsData, buildRosterOwnerMap, getLeagueUsers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { getScores } from "@/lib/sheets";
import { computeChampions, computeAllTimeStandings, computeMilestones, computeGameRecords, computeSeasonRecords, computeSeasonSummaries } from "@/lib/historical";
import { RecordsClient } from "./records-client";
import { SleeperMatchup } from "@/types/sleeper";

export const revalidate = 300;

export default async function RecordsPage() {
  const [teamsData, rosterOwnerMap, scores, users] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
    getScores(),
    getLeagueUsers(),
  ]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const { teams, season, currentWeek, allMatchups } = teamsData;

  const matchupsArray: [number, SleeperMatchup[]][] = Array.from(allMatchups.entries());

  const teamRecords = teams.map((t) => ({
    rosterId: t.rosterId,
    displayName: t.displayName,
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
    pointsFor: t.pointsFor,
    pointsAgainst: t.pointsAgainst,
  }));

  const champions = computeChampions(scores);
  const allTimeStandings = computeAllTimeStandings(scores, champions);
  const milestones = computeMilestones(scores);
  const gameRecords = computeGameRecords(scores);
  const seasonRecords = computeSeasonRecords(scores);
  const seasonSummaries = computeSeasonSummaries(scores);
  const availableSeasons = [...new Set(scores.map((s) => s.season))].filter(Boolean).sort().reverse();

  return (
    <RecordsClient
      matchupsArray={matchupsArray}
      rosterOwnerMap={rosterOwnerMap}
      teamRecords={teamRecords}
      season={season}
      currentWeek={currentWeek}
      champions={champions}
      allTimeStandings={allTimeStandings}
      milestones={milestones}
      gameRecords={gameRecords}
      seasonRecords={seasonRecords}
      seasonSummaries={seasonSummaries}
      availableSeasons={availableSeasons}
      ownerAvatars={ownerAvatars}
    />
  );
}
