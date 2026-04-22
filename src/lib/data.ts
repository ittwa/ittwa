import {
  getNFLState,
  getLeague,
  getLeagueUsers,
  getRosters,
  getMatchups,
  getAllTransactions,
  getDrafts,
  buildRosterOwnerMap,
  getDisplayName,
} from "./sleeper";
import { getContracts, getCapHits } from "./sheets";
import { getActiveContractsForSeason, enrichContract, filterActiveContracts } from "./contracts";
import { calculateStandings, calculateStreak } from "./standings";
import { calculatePowerRankings, calculateRankChanges } from "./power-rankings";
import { LEAGUE_ID, OWNER_DIVISION, DIVISION_NUMBER_MAP } from "./config";
import { TeamInfo, SleeperMatchup, MatchupPair, SleeperRoster } from "@/types/sleeper";

// --- Build full team info from Sleeper data ---

export async function getTeamsData(): Promise<{
  teams: TeamInfo[];
  season: string;
  currentWeek: number;
  allMatchups: Map<number, SleeperMatchup[]>;
}> {
  const [nflState, league, users, rosters] = await Promise.all([
    getNFLState(),
    getLeague(),
    getLeagueUsers(),
    getRosters(),
  ]);

  // Prefer the league's own season (e.g. "2026" for the 2026 dynasty league)
  // over the global NFL state season, which can lag in the off-season.
  const season = league.season || nflState.season;
  const currentWeek = nflState.week;

  // Build user ID → display name map
  const userMap: Record<string, string> = {};
  for (const user of users) {
    userMap[user.user_id] = getDisplayName(user);
  }

  // Fetch all 18 possible regular+playoff weeks to ensure we get all completed matchups.
  // Weeks with no data will return empty arrays and are filtered out naturally.
  const allMatchups = new Map<number, SleeperMatchup[]>();

  const matchupPromises = [];
  for (let w = 1; w <= 18; w++) {
    matchupPromises.push(
      getMatchups(w).then((m) => {
        // Only store weeks that have actual score data
        if (m && m.length > 0 && m.some((mm) => mm.points > 0)) {
          allMatchups.set(w, m);
        }
      }).catch(() => {})
    );
  }
  await Promise.all(matchupPromises);

  // Figure out the last completed week from the matchup data
  const completedWeeks = allMatchups.size > 0 ? Math.max(...Array.from(allMatchups.keys())) : 0;

  // Build division records from matchups
  const divRecords = calculateDivisionRecords(rosters, allMatchups, userMap);

  // Build teams — use Sleeper's roster.settings.division (a number 1-4) to resolve
  // division name, since Sleeper display names often don't match the real names
  // in our DIVISIONS config (e.g. "BooCake" vs "Clancy").
  const teams: TeamInfo[] = rosters.map((roster) => {
    const displayName = userMap[roster.owner_id] || `Team ${roster.roster_id}`;
    const divisionNum = roster.settings.division as unknown as number;
    const division = DIVISION_NUMBER_MAP[divisionNum] || OWNER_DIVISION[displayName] || "Unknown";

    return {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      username: displayName,
      displayName,
      division,
      wins: roster.settings.wins || 0,
      losses: roster.settings.losses || 0,
      ties: roster.settings.ties || 0,
      pointsFor: (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100,
      pointsAgainst: (roster.settings.fpts_against || 0) + (roster.settings.fpts_against_decimal || 0) / 100,
      optimalPoints: (roster.settings.ppts || 0) + (roster.settings.ppts_decimal || 0) / 100,
      streak: calculateStreak(roster.roster_id, allMatchups, completedWeeks),
      divisionRecord: divRecords.get(roster.roster_id) || "0-0",
      players: roster.players || [],
    };
  });

  return { teams, season, currentWeek, allMatchups };
}

// Calculate division records from matchup data
function calculateDivisionRecords(
  rosters: SleeperRoster[],
  allMatchups: Map<number, SleeperMatchup[]>,
  userMap: Record<string, string>
): Map<number, string> {
  const records = new Map<number, { wins: number; losses: number }>();

  // Build rosterId → division using Sleeper's division number
  const rosterDivision = new Map<number, string>();
  for (const roster of rosters) {
    const divisionNum = roster.settings.division as unknown as number;
    rosterDivision.set(roster.roster_id, DIVISION_NUMBER_MAP[divisionNum] || "");
    records.set(roster.roster_id, { wins: 0, losses: 0 });
  }

  for (const [, weekMatchups] of allMatchups) {
    // Group by matchup_id
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of weekMatchups) {
      const existing = byMatchup.get(m.matchup_id) || [];
      existing.push(m);
      byMatchup.set(m.matchup_id, existing);
    }

    for (const [, pair] of byMatchup) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      const divA = rosterDivision.get(a.roster_id);
      const divB = rosterDivision.get(b.roster_id);
      if (!divA || !divB || divA !== divB) continue;

      const recA = records.get(a.roster_id)!;
      const recB = records.get(b.roster_id)!;

      if (a.points > b.points) {
        recA.wins++;
        recB.losses++;
      } else if (b.points > a.points) {
        recB.wins++;
        recA.losses++;
      }
    }
  }

  const result = new Map<number, string>();
  for (const [id, rec] of records) {
    result.set(id, `${rec.wins}-${rec.losses}`);
  }
  return result;
}

// --- Matchup pairs for a given week ---

export async function getMatchupPairs(
  week: number,
  rosterOwnerMap?: Record<number, string>
): Promise<MatchupPair[]> {
  const [matchups, ownerMap] = await Promise.all([
    getMatchups(week),
    rosterOwnerMap ? Promise.resolve(rosterOwnerMap) : buildRosterOwnerMap(),
  ]);

  // Group by matchup_id
  const byMatchup = new Map<number, SleeperMatchup[]>();
  for (const m of matchups) {
    const existing = byMatchup.get(m.matchup_id) || [];
    existing.push(m);
    byMatchup.set(m.matchup_id, existing);
  }

  const pairs: MatchupPair[] = [];
  for (const [matchupId, pair] of byMatchup) {
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    pairs.push({
      week,
      matchupId,
      team1: {
        rosterId: a.roster_id,
        displayName: ownerMap[a.roster_id] || `Team ${a.roster_id}`,
        points: a.points,
      },
      team2: {
        rosterId: b.roster_id,
        displayName: ownerMap[b.roster_id] || `Team ${b.roster_id}`,
        points: b.points,
      },
      completed: a.points > 0 || b.points > 0,
    });
  }

  return pairs;
}

// Re-export for convenience
export {
  getNFLState,
  getLeague,
  getLeagueUsers,
  getRosters,
  getMatchups,
  getAllTransactions,
  getDrafts,
  buildRosterOwnerMap,
  getContracts,
  getCapHits,
  getActiveContractsForSeason,
  enrichContract,
  filterActiveContracts,
  calculateStandings,
  calculatePowerRankings,
  calculateRankChanges,
};
