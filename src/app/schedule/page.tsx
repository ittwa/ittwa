import { connection } from "next/server";


import {
  getMatchups,
  getLeagueUsers,
  getRosters,
  getDisplayName,
  getNFLState,
  getLeague,
} from "@/lib/sleeper";
import { SEASON_LEAGUE_IDS, OWNER_DIVISION, DIVISION_NUMBER_MAP, USERNAME_OVERRIDES } from "@/lib/config";
import { ScheduleClient, type SeasonData, type ScheduleMatchup, type ScheduleTeamInfo } from "./schedule-client";
import type { SleeperMatchup } from "@/types/sleeper";

export default async function SchedulePage() {
  await connection();
  const nflState = await getNFLState();
  const currentSeason = nflState.season;
  const currentWeek = nflState.week;

  const users = await getLeagueUsers();
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const seasonIds = Object.entries(SEASON_LEAGUE_IDS).sort(
    ([a], [b]) => Number(b) - Number(a)
  );

  const seasons: Record<string, SeasonData> = {};

  await Promise.all(
    seasonIds.map(async ([seasonStr, leagueId]) => {
      const [users, rosters, league, weekData] = await Promise.all([
        getLeagueUsers(leagueId),
        getRosters(leagueId),
        getLeague(leagueId),
        Promise.all(
          Array.from({ length: 18 }, (_, i) =>
            getMatchups(i + 1, leagueId).catch((): SleeperMatchup[] => [])
          )
        ),
      ]);

      const rosterOwnerMap: Record<number, string> = {};
      for (const roster of rosters) {
        const uid = roster.owner_id;
        const user = users.find((u) => u.user_id === uid);
        const name = user
          ? USERNAME_OVERRIDES[user.display_name] ?? user.display_name
          : `Team ${roster.roster_id}`;
        rosterOwnerMap[roster.roster_id] = name;
      }

      const playoffWeekStart = league.settings?.playoff_week_start || 15;

      const rosterDivision: Record<number, string> = {};
      for (const roster of rosters) {
        const divNum = roster.settings.division as unknown as number;
        const ownerName = rosterOwnerMap[roster.roster_id];
        rosterDivision[roster.roster_id] =
          DIVISION_NUMBER_MAP[divNum] || OWNER_DIVISION[ownerName] || "Unknown";
      }

      const matchups: ScheduleMatchup[] = [];

      for (let weekIdx = 0; weekIdx < weekData.length; weekIdx++) {
        const week = weekIdx + 1;
        const byId = new Map<number, SleeperMatchup[]>();

        for (const m of weekData[weekIdx]) {
          if (!m.matchup_id) continue;
          const arr = byId.get(m.matchup_id) ?? [];
          arr.push(m);
          byId.set(m.matchup_id, arr);
        }

        for (const [, pair] of byId) {
          if (pair.length !== 2) continue;
          const [a, b] = pair;

          const hasScores = a.points > 0 || b.points > 0;
          const isPlayoff = week >= playoffWeekStart;

          matchups.push({
            week,
            matchupId: a.matchup_id,
            teamA: rosterOwnerMap[a.roster_id] || `Team ${a.roster_id}`,
            teamB: rosterOwnerMap[b.roster_id] || `Team ${b.roster_id}`,
            scoreA: a.points,
            scoreB: b.points,
            completed: hasScores,
            playoff: isPlayoff,
          });
        }
      }

      const teams: Record<string, ScheduleTeamInfo> = {};
      for (const roster of rosters) {
        const name = rosterOwnerMap[roster.roster_id];
        if (!name) continue;
        teams[name] = {
          division: rosterDivision[roster.roster_id] || "Unknown",
          wins: roster.settings.wins || 0,
          losses: roster.settings.losses || 0,
          pointsFor:
            (roster.settings.fpts || 0) +
            (roster.settings.fpts_decimal || 0) / 100,
          pointsAgainst:
            (roster.settings.fpts_against || 0) +
            (roster.settings.fpts_against_decimal || 0) / 100,
        };
      }

      seasons[seasonStr] = {
        season: seasonStr,
        matchups,
        teams,
        playoffWeekStart,
      };
    })
  );

  const availableSeasons = seasonIds.map(([s]) => s);

  return (
    <ScheduleClient
      seasons={seasons}
      currentSeason={currentSeason}
      currentWeek={currentWeek}
      availableSeasons={availableSeasons}
      ownerAvatars={ownerAvatars}
    />
  );
}
