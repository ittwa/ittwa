import { unstable_cache } from "next/cache";

// FantasyCalc dynasty values. Configured for ITTWA: single QB (numQbs=1),
// half-PPR (ppr=0.5), 12 teams. Picks come back as entries with
// position "PICK" and no sleeperId (name like "2027 Mid 1st").
//
// Cached server-side for 24h — FantasyCalc updates at most daily and we never
// want to hammer it on every page render.

const FANTASYCALC_URL =
  "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=1&numTeams=12&ppr=0.5";

export interface FantasyCalcPlayer {
  id: number;
  name: string;
  sleeperId?: string | null;
  position?: string;
  maybeTeam?: string | null;
  maybeAge?: number | null;
}

export interface FantasyCalcEntry {
  player: FantasyCalcPlayer;
  value: number;
  overallRank?: number;
  positionRank?: number;
  trend30Day?: number;
}

async function fetchFantasyCalcValues(): Promise<FantasyCalcEntry[]> {
  try {
    const res = await fetch(FANTASYCALC_URL, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as FantasyCalcEntry[]) : [];
  } catch {
    return [];
  }
}

// unstable_cache so the parsed array (not just the HTTP response) is reused
// across renders for a full day.
export const getFantasyCalcValues = unstable_cache(
  fetchFantasyCalcValues,
  ["fantasycalc-values-1qb-half-12"],
  { revalidate: 86400 },
);
