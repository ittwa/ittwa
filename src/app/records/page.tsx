import { connection } from "next/server";

export const metadata = { title: "Records" };

import { getTeamsData, buildRosterOwnerMap, getLeagueUsers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { getScores, getFinances } from "@/lib/sheets";
import { OWNER_LAST_NAME_MAP } from "@/lib/config";
import { computeChampions, computeAllTimeStandings, computeMilestones, computeGameRecords, computeSeasonRecords, computeSeasonSummaries } from "@/lib/historical";
import { RecordsClient } from "./records-client";
import { SleeperMatchup } from "@/types/sleeper";


export default async function RecordsPage() {
  await connection();
  const [teamsData, rosterOwnerMap, scores, users, finances] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
    getScores(),
    getLeagueUsers(),
    getFinances(),
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

  const ownerFinancials = (() => {
    const map = new Map<string, { seasons: number; dues: number; winnings: number }>();
    for (const f of finances) {
      const owner = OWNER_LAST_NAME_MAP[f.owner] || f.owner;
      if (!map.has(owner)) map.set(owner, { seasons: 0, dues: 0, winnings: 0 });
      const agg = map.get(owner)!;
      agg.seasons++;
      agg.dues += f.dues;
      agg.winnings += f.winnings;
    }
    return [...map.entries()].map(([owner, agg]) => ({
      owner,
      seasons: agg.seasons,
      totalDues: agg.dues,
      totalWinnings: agg.winnings,
      net: agg.winnings - agg.dues,
      roi: agg.dues > 0 ? ((agg.winnings - agg.dues) / agg.dues) * 100 : 0,
    }));
  })();

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
      ownerFinancials={ownerFinancials}
    />
  );
}
