export const dynamic = "force-dynamic";
export const revalidate = 300;

import {
  getTeamsData,
  getMatchupPairs,
  buildRosterOwnerMap,
  calculateStandings,
  getLeague,
  getLeagueUsers,
} from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { MatchupPair } from "@/types/sleeper";
import { MatchupsClient, type TeamMeta } from "./matchups-client";

export default async function MatchupsPage() {
  const [teamsData, rosterOwnerMap, league, users] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
    getLeague(),
    getLeagueUsers(),
  ]);

  const { teams, season, currentWeek, allMatchups } = teamsData;
  const standings = calculateStandings(teams, allMatchups);
  const playoffTeams = league.settings.playoff_teams || 6;
  const playoffWeekStart = league.settings.playoff_week_start || 15;

  const teamNames: Record<string, string> = {};
  for (const user of users) {
    teamNames[getDisplayName(user)] = user.metadata?.team_name || "";
  }

  const teamMeta: Record<string, TeamMeta> = {};
  for (const entry of standings) {
    teamMeta[entry.displayName] = {
      displayName: entry.displayName,
      division: entry.division,
      wins: entry.wins,
      losses: entry.losses,
      ties: entry.ties,
      pointsFor: entry.pointsFor,
      seed: entry.rank <= playoffTeams ? entry.rank : null,
      rank: entry.rank,
      streak: entry.streak,
      teamName: teamNames[entry.displayName] || "",
    };
  }

  const allPairs: Record<number, MatchupPair[]> = {};
  const promises = [];
  for (let w = 1; w <= 18; w++) {
    promises.push(
      getMatchupPairs(w, rosterOwnerMap)
        .then((pairs) => { allPairs[w] = pairs; })
        .catch(() => { allPairs[w] = []; })
    );
  }
  await Promise.all(promises);

  return (
    <MatchupsClient
      allPairs={allPairs}
      season={season}
      currentWeek={currentWeek}
      teamMeta={teamMeta}
      playoffWeekStart={playoffWeekStart}
    />
  );
}
