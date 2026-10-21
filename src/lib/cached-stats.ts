import { unstable_cache } from "next/cache";
import { getLeague } from "@/lib/sleeper";
import { SLEEPER_API_BASE, SEASON_LEAGUE_IDS, CACHE_TAGS } from "@/lib/config";
import { fantasyPoints, rankByPosition, type StatLine } from "@/lib/league-scoring";
import type { SleeperPlayersMap } from "@/types/sleeper";

/**
 * NFL-wide positional ranks for a season, computed from Sleeper's stats API.
 *
 * Ranks every NFL player (not just league-rostered ones) at each position by his fantasy
 * points under the LEAGUE'S OWN scoring settings — reproducing exactly the
 * order shown in Sleeper's in-league Players view. Sleeper's generic
 * pts_half_ppr / pos_rank_half_ppr fields use default scoring and rank
 * players differently (e.g. interceptions cost more here), so they are only a
 * fallback for a season with no league ID.
 */
export interface NflPosStat {
  points: number;
  posRank: number;
}

// player_id -> league-scored season points, every NFL player with a stat line.
async function getCachedNflLeaguePoints(
  season: string,
  isCurrentSeason: boolean,
): Promise<Record<string, number>> {
  const revalidate = isCurrentSeason ? 3600 : 86400;
  const cached = unstable_cache(
    async (yr: string) => {
      try {
        const leagueId = SEASON_LEAGUE_IDS[yr];
        const [res, scoring] = await Promise.all([
          fetch(`${SLEEPER_API_BASE}/stats/nfl/regular/${yr}`, {
            next: { revalidate, tags: [CACHE_TAGS.sleeper] },
          }),
          leagueId
            ? getLeague(leagueId).then((l) => l.scoring_settings ?? null).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!res.ok) return {};
        const data: Record<string, StatLine> = await res.json();
        const out: Record<string, number> = {};
        for (const [pid, stats] of Object.entries(data)) {
          const pts = fantasyPoints(stats, scoring);
          if (pts !== undefined) out[pid] = pts;
        }
        return out;
      } catch {
        return {};
      }
    },
    ["nfl-league-points"],
    { revalidate, tags: [CACHE_TAGS.sleeper] },
  );
  return cached(season);
}

// Like getCachedNflPosRanks, but returns the league-scored points alongside
// the positional rank so a table can show both.
export async function getCachedNflPosStats(
  season: string,
  nflPlayers: SleeperPlayersMap,
  isCurrentSeason: boolean,
): Promise<Record<string, NflPosStat>> {
  const points = await getCachedNflLeaguePoints(season, isCurrentSeason);
  // Position comes from the players map — the stats blob's own pos field is
  // unreliable.
  const ranks = rankByPosition(points, (pid) => nflPlayers[pid]?.position);
  const out: Record<string, NflPosStat> = {};
  for (const [pid, posRank] of Object.entries(ranks)) {
    out[pid] = { points: Math.round(points[pid] * 10) / 10, posRank };
  }
  return out;
}

export async function getCachedNflPosRanks(
  season: string,
  nflPlayers: SleeperPlayersMap,
  isCurrentSeason: boolean,
): Promise<Record<string, number>> {
  const points = await getCachedNflLeaguePoints(season, isCurrentSeason);
  return rankByPosition(points, (pid) => nflPlayers[pid]?.position);
}

/**
 * Positional ranks "as of now": the current season's NFL-wide ranks once any
 * games have been played, otherwise (preseason / offseason, when the current
 * season has no stats yet) the last completed season's final ranks. This is
 * what Sleeper's Players view shows, so roster badges line up with the app.
 */
export async function getCachedLatestNflPosRanks(
  currentSeason: string,
  nflPlayers: SleeperPlayersMap,
): Promise<Record<string, number>> {
  const current = await getCachedNflPosRanks(currentSeason, nflPlayers, true);
  if (Object.keys(current).length > 0) return current;
  return getCachedNflPosRanks(String(parseInt(currentSeason, 10) - 1), nflPlayers, false);
}
