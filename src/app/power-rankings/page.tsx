import { connection } from "next/server";

export const metadata = { title: "Power Rankings" };

import {
  getTeamsData,
  getLeagueUsers,
  getNFLState,
  getRosters,
  buildRosterOwnerMap,
  getContracts,
  getLatestActiveContracts,
  calculatePowerRankings,
  calculateRankChanges,
} from "@/lib/data";
import { getNFLPlayers, getDisplayName } from "@/lib/sleeper";
import { getScores } from "@/lib/sheets";
import { LEAGUE_ID, SEASON_LEAGUE_IDS, SALARY_CAP, DIVISION_NUMBER_MAP } from "@/lib/config";
import {
  PowerRankingEntry,
  calculatePowerRankingsFromScores,
  computeHistoricalPowerOnes,
} from "@/lib/power-rankings";
import { getCachedSeasonPosRanks } from "@/lib/cached-stats";
import { calculateRosterStrength } from "@/lib/roster-strength";
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

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const params = await searchParams;

  const [nflState, scores] = await Promise.all([getNFLState(), getScores()]);
  const season = nflState.season;

  const sleeperSeasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();
  const sheetSeasons = [...new Set(scores.map((s) => s.season))].filter(Boolean);
  const allSeasons = [...new Set([...sleeperSeasons, ...sheetSeasons])].sort().reverse();

  const selectedSeason =
    typeof params.season === "string" && allSeasons.includes(params.season)
      ? params.season
      : allSeasons[0];
  const isCurrentSeason = selectedSeason === allSeasons[0];

  const powerHistory = computeHistoricalPowerOnes(scores);

  const hasMatchupData = (matchups: Map<number, SleeperMatchup[]>) =>
    matchups.size > 0 &&
    Array.from(matchups.values()).some((ms) => ms.some((m) => m.points > 0));

  if (isCurrentSeason) {
    const [{ teams, currentWeek, allMatchups }, users] = await Promise.all([
      getTeamsData(),
      getLeagueUsers(LEAGUE_ID),
    ]);

    const ownerAvatars: Record<string, string> = {};
    for (const user of users) {
      if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
    }

    if (!hasMatchupData(allMatchups)) {
      const isOffSeason = nflState.season_type === "off";
      const prevSeason = String(parseInt(season) - 1);
      const prevLeagueId = SEASON_LEAGUE_IDS[prevSeason];

      if (prevLeagueId) {
        const [rosters, nflPlayers, contracts] = await Promise.all([
          getRosters(LEAGUE_ID),
          getNFLPlayers(),
          getContracts(),
        ]);
        const posRanks = await getCachedSeasonPosRanks(prevLeagueId, nflPlayers, false);
        const rosterOwnerMap = await buildRosterOwnerMap(LEAGUE_ID);

        const rosterDivisionMap: Record<number, string> = {};
        for (const t of teams) {
          rosterDivisionMap[t.rosterId] = t.division;
        }

        let capByOwner: Record<string, number> | undefined;
        if (isOffSeason) {
          const activeContracts = getLatestActiveContracts(contracts);
          const salaryByOwner: Record<string, number> = {};
          for (const c of activeContracts) {
            const owner = c.owner;
            salaryByOwner[owner] = (salaryByOwner[owner] || 0) + c.salary;
          }
          capByOwner = {};
          for (const t of teams) {
            capByOwner[t.displayName] = SALARY_CAP - (salaryByOwner[t.displayName] || 0);
          }
        }

        const offseasonData = calculateRosterStrength(
          rosters,
          rosterOwnerMap,
          rosterDivisionMap,
          posRanks,
          nflPlayers,
          capByOwner,
          isOffSeason,
        );

        return (
          <RankingsClient
            key={selectedSeason}
            weeklyRankings={{}}
            allPlayByWeek={{}}
            weeklyRankHistory={{}}
            teamStreaks={{}}
            ownerAvatars={ownerAvatars}
            season={season}
            currentWeek={0}
            availableSeasons={allSeasons}
            selectedSeason={selectedSeason}
            powerHistory={powerHistory}
            mode="offseason"
            offseasonData={offseasonData}
            offseasonLabel={isOffSeason ? "Offseason (Pre-Auction)" : "Preseason"}
          />
        );
      }

      return (
        <RankingsClient
            key={selectedSeason}
          weeklyRankings={{}}
          allPlayByWeek={{}}
          weeklyRankHistory={{}}
          teamStreaks={{}}
          ownerAvatars={ownerAvatars}
          season={season}
          currentWeek={0}
          availableSeasons={allSeasons}
          selectedSeason={selectedSeason}
          powerHistory={powerHistory}
          mode="season"
        />
      );
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
      const current = calculatePowerRankings(allMatchups, rosterInfo, w, true);
      if (w > 1) {
        const previous = calculatePowerRankings(allMatchups, rosterInfo, w - 1, true);
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
            key={selectedSeason}
        weeklyRankings={weeklyRankings}
        allPlayByWeek={allPlayByWeek}
        weeklyRankHistory={weeklyRankHistory}
        teamStreaks={teamStreaks}
        ownerAvatars={ownerAvatars}
        season={season}
        currentWeek={completedWeeks}
        availableSeasons={allSeasons}
        selectedSeason={selectedSeason}
        powerHistory={powerHistory}
        mode="season"
      />
    );
  }

  // --- Historical season (not current) ---

  const leagueId = SEASON_LEAGUE_IDS[selectedSeason];
  if (leagueId) {
    const [{ teams, allMatchups }, users] = await Promise.all([
      getTeamsData(leagueId),
      getLeagueUsers(leagueId),
    ]);

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

    const lastWeekWithData = allMatchups.size > 0
      ? Math.max(...Array.from(allMatchups.keys()))
      : 1;
    const completedWeeks = lastWeekWithData;

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
            key={selectedSeason}
        weeklyRankings={weeklyRankings}
        allPlayByWeek={allPlayByWeek}
        weeklyRankHistory={weeklyRankHistory}
        teamStreaks={teamStreaks}
        ownerAvatars={ownerAvatars}
        season={selectedSeason}
        currentWeek={completedWeeks}
        availableSeasons={allSeasons}
        selectedSeason={selectedSeason}
        powerHistory={powerHistory}
        mode="season"
      />
    );
  }

  // --- Pre-Sleeper season (from Sheets data) ---
  const {
    weeklyRankings: sheetRankings,
    allPlayByWeek: sheetAllPlay,
    weeklyRankHistory: sheetRankHistory,
    ownerIdMap,
    completedWeeks: sheetWeeks,
  } = calculatePowerRankingsFromScores(scores, selectedSeason);

  const ownerAvatars: Record<string, string> = {};
  try {
    const users = await getLeagueUsers(LEAGUE_ID);
    for (const user of users) {
      if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
    }
  } catch {
    // Pre-Sleeper season, avatars not critical
  }

  return (
    <RankingsClient
            key={selectedSeason}
      weeklyRankings={sheetRankings}
      allPlayByWeek={sheetAllPlay}
      weeklyRankHistory={sheetRankHistory}
      teamStreaks={{}}
      ownerAvatars={ownerAvatars}
      season={selectedSeason}
      currentWeek={sheetWeeks}
      availableSeasons={allSeasons}
      selectedSeason={selectedSeason}
      powerHistory={powerHistory}
      mode="season"
    />
  );
}
