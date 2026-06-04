import { SLEEPER_API_BASE, SEASON_LEAGUE_IDS } from "@/lib/config";

interface SleeperSeasonStats {
  pts_half_ppr?: number;
  gp?: number;
  pos_rank_half_ppr?: number;
  rank_half_ppr?: number;
  tm?: string;
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

  const results = await Promise.allSettled(
    seasons.map((s) => fetchSeasonStats(s, currentSeason).then((data) => ({ season: s, data }))),
  );

  const summaries: PlayerSeasonSummary[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { season, data } = result.value;
    const stats = data[playerId];
    if (!stats || !stats.gp || stats.gp === 0) continue;

    const pts = stats.pts_half_ppr ?? 0;
    summaries.push({
      season,
      totalPoints: pts,
      ppg: pts / stats.gp,
      gamesPlayed: stats.gp,
      posRank: stats.pos_rank_half_ppr ?? null,
      overallRank: stats.rank_half_ppr ?? null,
      position: stats.pos || position,
      nflTeam: stats.tm || null,
    });
  }

  summaries.sort((a, b) => parseInt(b.season, 10) - parseInt(a.season, 10));
  return summaries;
}
