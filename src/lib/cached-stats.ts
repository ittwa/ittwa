import { unstable_cache } from "next/cache";
import { getSeasonPosRanks } from "@/lib/data";
import { SLEEPER_API_BASE } from "@/lib/config";
import type { SleeperPlayersMap } from "@/types/sleeper";

/**
 * Cached positional ranks for a season, keyed by leagueId.
 *
 * `getSeasonPosRanks` reads and aggregates 18 weeks of matchup blobs. Past
 * seasons never change, yet the underlying matchup fetches use a 5-minute
 * revalidate — so without this, the contracts page re-read and re-aggregated
 * ~144 blobs (8 seasons × 18 weeks) on every render. Here we cache the small
 * computed result (a player_id -> rank map) with a long TTL for completed
 * seasons and a short one for the in-progress season.
 *
 * `nflPlayers` is captured via closure rather than passed as an argument so the
 * 5-10MB player map is never serialized into the cache key. Player positions
 * are stable, so reusing a prior render's map on a cache hit is safe.
 */
export async function getCachedSeasonPosRanks(
  leagueId: string,
  nflPlayers: SleeperPlayersMap,
  isCurrentSeason: boolean,
): Promise<Record<string, number>> {
  const cached = unstable_cache(
    async (lid: string) => {
      const ranks = await getSeasonPosRanks(lid, nflPlayers);
      return Object.fromEntries(ranks);
    },
    ["season-pos-ranks"],
    { revalidate: isCurrentSeason ? 600 : 86400 },
  );
  return cached(leagueId);
}

/**
 * NFL-wide positional ranks from Sleeper's stats API (pos_rank_half_ppr).
 * Unlike getCachedSeasonPosRanks which ranks only league-rostered players,
 * this returns official NFL-wide positional rankings.
 */
export async function getCachedNflPosRanks(
  season: string,
  isCurrentSeason: boolean,
): Promise<Record<string, number>> {
  const cached = unstable_cache(
    async (yr: string) => {
      try {
        const res = await fetch(`${SLEEPER_API_BASE}/stats/nfl/regular/${yr}`, {
          next: { revalidate: isCurrentSeason ? 3600 : 86400 },
        });
        if (!res.ok) return {};
        const data: Record<string, { pos_rank_half_ppr?: number }> =
          await res.json();
        const ranks: Record<string, number> = {};
        for (const [pid, stats] of Object.entries(data)) {
          if (stats.pos_rank_half_ppr && stats.pos_rank_half_ppr > 0) {
            ranks[pid] = stats.pos_rank_half_ppr;
          }
        }
        return ranks;
      } catch {
        return {};
      }
    },
    ["nfl-pos-ranks"],
    { revalidate: isCurrentSeason ? 3600 : 86400 },
  );
  return cached(season);
}
