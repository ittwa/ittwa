import { SLEEPER_API_BASE, SEASON_LEAGUE_IDS } from "@/lib/config";
import { getNFLPlayers } from "@/lib/sleeper";
import { getCachedNflPosStats, type NflPosStat } from "@/lib/cached-stats";

interface SleeperSeasonStats {
  gp?: number;
  tm?: string;
  team?: string;
  pos?: string;
  [key: string]: unknown;
}

export interface PlayerSeasonSummary {
  season: string;
  totalPoints: number;
  ppg: number;
  gamesPlayed: number;
  posRank: number | null;
  overallRank: number | null;
  position: string;
  nflTeam: string | null;
}

// 1 + number of players (any position) who outscored `points`.
function overallRank(scored: Record<string, NflPosStat>, points: number): number {
  let ahead = 0;
  for (const s of Object.values(scored)) if (s.points > points) ahead++;
  return ahead + 1;
}

async function fetchSeasonStats(
  season: string,
  currentSeason: string,
): Promise<Record<string, SleeperSeasonStats>> {
  const revalidate = season === currentSeason ? 3600 : 86400;
  try {
    const res = await fetch(`${SLEEPER_API_BASE}/stats/nfl/regular/${season}`, {
      next: { revalidate },
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export function getRelevantSeasons(
  yearsExp: number | undefined,
  currentSeason: string,
): string[] {
  const current = parseInt(currentSeason, 10);
  const firstSeason = current - (yearsExp ?? 0);
  const available = Object.keys(SEASON_LEAGUE_IDS);
  return available
    .filter((s) => parseInt(s, 10) >= firstSeason && parseInt(s, 10) <= current)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
}

export async function getPlayerCareerStats(
  playerId: string,
  position: string,
  yearsExp: number | undefined,
  currentSeason: string,
): Promise<PlayerSeasonSummary[]> {
  const seasons = getRelevantSeasons(yearsExp, currentSeason);
  if (seasons.length === 0) return [];

  // Points and ranks use the league's own scoring (see getCachedNflPosStats),
  // matching Sleeper's in-league Players view; the raw stats blob still
  // supplies games played and NFL team.
  const nflPlayers = await getNFLPlayers();
  const results = await Promise.allSettled(
    seasons.map((s) =>
      Promise.all([
        fetchSeasonStats(s, currentSeason),
        getCachedNflPosStats(s, nflPlayers, s === currentSeason),
      ]).then(([data, scored]) => ({ season: s, data, scored })),
    ),
  );

  const summaries: PlayerSeasonSummary[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { season, data, scored } = result.value;
    const stats = data[playerId];
    if (!stats || !stats.gp || stats.gp === 0) continue;

    const mine: NflPosStat | undefined = scored[playerId];
    const pts = mine?.points ?? 0;
    summaries.push({
      season,
      totalPoints: pts,
      ppg: pts / stats.gp,
      gamesPlayed: stats.gp,
      posRank: mine?.posRank ?? null,
      overallRank: mine ? overallRank(scored, mine.points) : null,
      position: stats.pos || position,
      nflTeam: stats.team || stats.tm || null,
    });
  }

  summaries.sort((a, b) => parseInt(b.season, 10) - parseInt(a.season, 10));
  return summaries;
}
