export const dynamic = "force-dynamic";


import {
  getTeamsData,
  getMatchupPairs,
  buildRosterOwnerMap,
  calculateStandings,
  getLeague,
  getLeagueUsers,
} from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { SEASON_LEAGUE_IDS } from "@/lib/config";
import { MatchupPair } from "@/types/sleeper";
import { MatchupsClient, type TeamMeta } from "./matchups-client";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const availableSeasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();
  const selectedSeason =
    typeof params.season === "string" && SEASON_LEAGUE_IDS[params.season]
      ? params.season
      : availableSeasons[0];
  const leagueId = SEASON_LEAGUE_IDS[selectedSeason];
  const isCurrentSeason = selectedSeason === availableSeasons[0];

  const [teamsData, rosterOwnerMap, league, users] = await Promise.all([
    getTeamsData(leagueId),
    buildRosterOwnerMap(leagueId),
    getLeague(leagueId),
    getLeagueUsers(leagueId),
  ]);

  const { teams, season, currentWeek: rawCurrentWeek, allMatchups } = teamsData;
  const lastWeekWithData = allMatchups.size > 0
    ? Math.max(...Array.from(allMatchups.keys()))
    : 1;
  const currentWeek = isCurrentSeason ? rawCurrentWeek : lastWeekWithData + 1;

  const standings = calculateStandings(teams, allMatchups);
  const playoffTeams = league.settings.playoff_teams || 6;
  const playoffWeekStart = league.settings.playoff_week_start || 15;

  const teamNames: Record<string, string> = {};
  for (const user of users) {
    teamNames[getDisplayName(user)] = user.metadata?.team_name || "";
  }

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
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
      getMatchupPairs(w, rosterOwnerMap, leagueId)
        .then((pairs) => { allPairs[w] = pairs; })
        .catch(() => { allPairs[w] = []; })
    );
  }
  await Promise.all(promises);

  return (
    <MatchupsClient
      allPairs={allPairs}
      season={selectedSeason}
      currentWeek={currentWeek}
      teamMeta={teamMeta}
      playoffWeekStart={playoffWeekStart}
      ownerAvatars={ownerAvatars}
      availableSeasons={availableSeasons}
    />
  );
}
