import { unstable_cache } from "next/cache";
import type { SleeperPlayer, SleeperPlayersMap } from "@/types/sleeper";
import { SLEEPER_API_BASE, REVALIDATE, CACHE_TAGS } from "./config";

// Why this module exists (Vercel CPU usage):
// Sleeper's /players/nfl is ~15 MB of JSON (~20 MB once Next serializes it),
// which is over the Data Cache's 2 MB per-item limit ("items over 2MB can not
// be cached"). So the old `fetch(..., { next: { revalidate } })` was never
// actually cached: every fresh serverless instance re-downloaded and
// re-parsed all of it, costing 1–2 s of CPU on the first request. On a
// low-traffic site most requests land on a fresh instance, which is what
// pushed the project past the Hobby plan's Fluid Active CPU limit (Nov 2026).
//
// Fix: download once, keep only the fields the app reads (the SleeperPlayer
// type) for fantasy-relevant positions, and cache THAT (~1.4 MB) with
// unstable_cache so every instance reads the small copy from the Data Cache.

// Positions this league can roster (QB/RB/WR/TE/FLEX/DEF every season since
// 2019). K is kept as a safety margin. Offensive linemen, IDP, etc. can never
// be on an ITTWA roster, contract or trade, and they're ~2/3 of the payload.
const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

// Every field declared on SleeperPlayer. Anything else in Sleeper's payload
// (ids for other sites, metadata, news, practice reports…) is unused here.
const KEEP_FIELDS: (keyof SleeperPlayer)[] = [
  "player_id",
  "first_name",
  "last_name",
  "full_name",
  "position",
  "team",
  "age",
  "years_exp",
  "fantasy_positions",
  "status",
  "injury_status",
  "number",
  "depth_chart_position",
  "depth_chart_order",
  "height",
  "weight",
  "college",
  "sport",
  "search_full_name",
];

// Raw Sleeper entries: loosely typed, since Sleeper sends nulls for many fields.
type RawSleeperPlayer = Record<string, unknown>;

export function slimPlayersMap(full: Record<string, RawSleeperPlayer>): SleeperPlayersMap {
  const out: SleeperPlayersMap = {};
  for (const [id, p] of Object.entries(full)) {
    if (!p) continue;
    const fantasyPositions = Array.isArray(p.fantasy_positions) ? (p.fantasy_positions as string[]) : null;
    const positions = fantasyPositions ?? (typeof p.position === "string" ? [p.position] : []);
    if (!positions.some((pos) => FANTASY_POSITIONS.has(pos))) continue;

    const slim: Record<string, unknown> = {};
    for (const key of KEEP_FIELDS) {
      const value = p[key];
      if (value !== undefined && value !== null) slim[key] = value;
    }
    // `team` is typed `string | null`; keep the explicit null for free agents.
    if (!("team" in slim)) slim.team = null;
    out[id] = slim as unknown as SleeperPlayer;
  }
  return out;
}

async function fetchSlimNFLPlayers(): Promise<SleeperPlayersMap> {
  // no-store: the raw response is too big for the Data Cache anyway (it would
  // only log a "can not be cached" warning). The slimmed result is what gets
  // cached, by the unstable_cache wrapper below.
  const res = await fetch(`${SLEEPER_API_BASE}/players/nfl`, { cache: "no-store" });
  if (!res.ok) {
    // Throwing means nothing is cached, so the next request retries.
    throw new Error(`Sleeper API error: ${res.status} ${res.statusText} for /players/nfl`);
  }
  return slimPlayersMap(await res.json());
}

export const getSlimNFLPlayers = unstable_cache(
  fetchSlimNFLPlayers,
  ["sleeper-players-nfl-slim-v1"],
  // Same 24h window as before; the `sleeper` tag keeps the footer Refresh
  // button working for player data too.
  { revalidate: REVALIDATE.players, tags: [CACHE_TAGS.sleeper] },
);
