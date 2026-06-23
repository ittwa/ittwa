import { unstable_cache } from "next/cache";
import {
  getNFLState,
  getLeague,
  getLeagueUsers,
  getMatchups,
  getTeamsData,
  buildRosterOwnerMap,
  calculateStandings,
} from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { LEAGUE_ID, SEASON_LEAGUE_IDS, SALARY_CAP, SALARY_FLOOR, YEARS_CAP, ALL_OWNERS } from "@/lib/config";
import { computeLuckIndex, type AllPlayRecord } from "@/lib/luck-index";
import { computeWeeklyRecaps, type WeeklyRecap } from "@/lib/weekly-recap";
import { buildHeadToHeadMatrix, type H2HMatrix, type H2HGame } from "@/lib/head-to-head";
import type { StandingsEntry } from "@/lib/standings";
import type { SleeperMatchup } from "@/types/sleeper";

// ── Winners bracket (defending champion) ────────────────────────────────────
// The Sleeper winners-bracket endpoint isn't covered by the (do-not-touch)
// sleeper.ts helpers, so fetch it here with the same revalidation pattern.
interface BracketMatch {
  r: number;            // round
  m: number;            // match
  t1: number | null;    // roster_id
  t2: number | null;
  w: number | null;     // winning roster_id
  l: number | null;     // losing roster_id
  p?: number;           // placement match (1 = championship)
}

async function getWinnersBracket(leagueId: string): Promise<BracketMatch[]> {
  try {
    const res = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    return (await res.json()) as BracketMatch[];
  } catch {
    return [];
  }
}

// ── Per-season derived stats ────────────────────────────────────────────────

export interface SeasonStats {
  season: string;
  standings: StandingsEntry[];
  luck: AllPlayRecord[];
  recaps: WeeklyRecap[];
  rosterOwnerMap: Record<number, string>;
  lastCompletedWeek: number;
}

async function computeSeasonStats(leagueId: string): Promise<SeasonStats> {
  const [teamsData, league] = await Promise.all([
    getTeamsData(leagueId),
    getLeague(leagueId),
  ]);

  const standings = calculateStandings(teamsData.teams, teamsData.allMatchups);

  const rosterOwnerMap: Record<number, string> = {};
  for (const team of teamsData.teams) {
    rosterOwnerMap[team.rosterId] = team.displayName;
  }

  // Luck and recaps are regular-season-only — drop playoff weeks.
  const playoffWeekStart = league.settings.playoff_week_start || 15;
  const regular = new Map<number, SleeperMatchup[]>();
  for (const [week, matchups] of teamsData.allMatchups) {
    if (week < playoffWeekStart) regular.set(week, matchups);
  }

  const lastCompletedWeek = regular.size > 0 ? Math.max(...regular.keys()) : 0;

  return {
    season: teamsData.season,
    standings,
    luck: computeLuckIndex(regular),
    recaps: computeWeeklyRecaps(regular, rosterOwnerMap),
    rosterOwnerMap,
    lastCompletedWeek,
  };
}

// ── All-time head-to-head matrix (cached, slow-moving) ──────────────────────

const getCachedH2HMatrix = unstable_cache(
  async (): Promise<H2HMatrix> => {
    const games: H2HGame[] = [];
    await Promise.all(
      Object.values(SEASON_LEAGUE_IDS).map(async (lid) => {
        const [ownerMap, weekData] = await Promise.all([
          buildRosterOwnerMap(lid).catch(() => ({} as Record<number, string>)),
          Promise.all(
            Array.from({ length: 17 }, (_, i) =>
              getMatchups(i + 1, lid).catch((): SleeperMatchup[] => []),
            ),
          ),
        ]);

        for (const ms of weekData) {
          const byId = new Map<number, SleeperMatchup[]>();
          for (const m of ms) {
            if (!m.matchup_id) continue;
            const arr = byId.get(m.matchup_id) ?? [];
            arr.push(m);
            byId.set(m.matchup_id, arr);
          }
          for (const [, pair] of byId) {
            if (pair.length !== 2) continue;
            const [a, b] = pair;
            const oa = ownerMap[a.roster_id];
            const ob = ownerMap[b.roster_id];
            if (!oa || !ob) continue;
            games.push({ ownerA: oa, ownerB: ob, scoreA: a.points, scoreB: b.points });
          }
        }
      }),
    );
    return buildHeadToHeadMatrix(games);
  },
  ["home-h2h-matrix"],
  { revalidate: 3600 },
);

// ── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderCard {
  label: string;
  owner: string;
  division: string;
  value: string;
  sub: string;
}

function computeLeaders(stats: SeasonStats): LeaderCard[] {
  const { standings, luck, rosterOwnerMap } = stats;
  const divisionOf = (rosterId: number) =>
    standings.find((s) => s.rosterId === rosterId)?.division ?? "";

  const pointsLeader = [...standings].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  const mostWins = [...standings].sort(
    (a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor,
  )[0];
  const luckiest = luck[0]; // already sorted luckiest-first
  const dominant = [...luck].sort((a, b) => b.allPlayPct - a.allPlayPct)[0];

  return [
    {
      label: "Points Leader",
      owner: pointsLeader?.displayName ?? "—",
      division: pointsLeader?.division ?? "",
      value: pointsLeader ? pointsLeader.pointsFor.toFixed(1) : "—",
      sub: "total points for",
    },
    {
      label: "Most Wins",
      owner: mostWins?.displayName ?? "—",
      division: mostWins?.division ?? "",
      value: mostWins ? `${mostWins.wins}-${mostWins.losses}` : "—",
      sub: "regular-season record",
    },
    {
      label: "Luckiest",
      owner: luckiest ? rosterOwnerMap[luckiest.rosterId] ?? "—" : "—",
      division: luckiest ? divisionOf(luckiest.rosterId) : "",
      value: luckiest ? `${luckiest.luck > 0 ? "+" : ""}${(luckiest.luck * 100).toFixed(0)}%` : "—",
      sub: "real vs all-play win%",
    },
    {
      label: "Most Dominant",
      owner: dominant ? rosterOwnerMap[dominant.rosterId] ?? "—" : "—",
      division: dominant ? divisionOf(dominant.rosterId) : "",
      value: dominant ? `${(dominant.allPlayPct * 100).toFixed(0)}%` : "—",
      sub: "all-play win%",
    },
  ];
}

// ── Public shape ────────────────────────────────────────────────────────────

export interface HomeData {
  leagueName: string;
  season: string;
  status: string;
  isPreseason: boolean;
  dataSeasonYear: string;
  currentWeek: number;
  lastCompletedWeek: number;
  capSummary: string;
  standings: StandingsEntry[];
  luckByRoster: Record<number, AllPlayRecord>;
  recaps: WeeklyRecap[];
  leaders: LeaderCard[];
  defendingChampion: { owner: string; year: string } | null;
  rosterOwnerMap: Record<number, string>;
  divisionMap: Record<string, string>;
  ownerAvatars: Record<string, string>;
  h2h: H2HMatrix;
  owners: string[];
  updatedAt: number;
}

export async function getHomeData(): Promise<HomeData> {
  const [league, nflState, users, currentStats, h2h] = await Promise.all([
    getLeague(LEAGUE_ID),
    getNFLState(),
    getLeagueUsers(LEAGUE_ID),
    computeSeasonStats(LEAGUE_ID),
    getCachedH2HMatrix(),
  ]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const isPreseason = currentStats.lastCompletedWeek === 0;
  const prevId = league.previous_league_id;

  // In the preseason the current season has no games, so leaders / recaps fall
  // back to last season's final picture. Defending champion always comes from
  // last season regardless.
  let dataStats = currentStats;
  if (isPreseason && prevId) {
    dataStats = await computeSeasonStats(prevId).catch(() => currentStats);
  }

  // Defending champion: winners-bracket championship match (p === 1).
  let defendingChampion: { owner: string; year: string } | null = null;
  if (prevId) {
    const [bracket, prevLeague, prevOwnerMap] = await Promise.all([
      getWinnersBracket(prevId),
      getLeague(prevId).catch(() => null),
      buildRosterOwnerMap(prevId).catch(() => ({} as Record<number, string>)),
    ]);
    const final = bracket.find((b) => b.p === 1);
    if (final?.w != null && prevOwnerMap[final.w]) {
      defendingChampion = {
        owner: prevOwnerMap[final.w],
        year: prevLeague?.season ?? "",
      };
    }
  }

  const luckByRoster: Record<number, AllPlayRecord> = {};
  for (const r of currentStats.luck) luckByRoster[r.rosterId] = r;

  const divisionMap: Record<string, string> = {};
  for (const entry of currentStats.standings) {
    divisionMap[entry.displayName] = entry.division;
  }

  return {
    leagueName: league.name,
    season: currentStats.season,
    status: league.status,
    isPreseason,
    dataSeasonYear: dataStats.season,
    currentWeek: nflState.week,
    lastCompletedWeek: currentStats.lastCompletedWeek,
    capSummary: `$${SALARY_CAP} cap · $${SALARY_FLOOR} floor · ${YEARS_CAP} contract years max`,
    standings: currentStats.standings,
    luckByRoster,
    recaps: dataStats.recaps,
    leaders: computeLeaders(dataStats),
    defendingChampion,
    rosterOwnerMap: currentStats.rosterOwnerMap,
    divisionMap,
    ownerAvatars,
    h2h,
    owners: ALL_OWNERS,
    updatedAt: Date.now(),
  };
}
