import { unstable_cache } from "next/cache";
import { getNFLState } from "@/lib/sleeper";
import { getContracts } from "@/lib/sheets";
import { REVALIDATE } from "@/lib/config";

// ── Data freshness timestamps ────────────────────────────────────────────────
//
// Reports when each upstream source was last pulled, for the site footer. The
// timestamp is captured INSIDE an unstable_cache so it reflects the moment the
// cache entry was (re)built rather than the current request time — i.e. genuine
// "last updated" within each source's revalidation window:
//   • Sleeper  → 5 min (matches the most volatile feed, matchups)
//   • Sheets   → 10 min (contract/cap-hit tabs revalidate at 600s)

export interface DataFreshness {
  sleeperAt: number;
  sheetsAt: number;
}

const SHEETS_REVALIDATE = 600;

const getSleeperFreshness = unstable_cache(
  async () => {
    try {
      await getNFLState();
    } catch {
      // Even if the touch fails we still report a timestamp so the footer renders.
    }
    return Date.now();
  },
  ["freshness-sleeper"],
  { revalidate: REVALIDATE.matchups },
);

const getSheetsFreshness = unstable_cache(
  async () => {
    try {
      await getContracts();
    } catch {
      // getContracts already degrades to [] without a key; guard anyway.
    }
    return Date.now();
  },
  ["freshness-sheets"],
  { revalidate: SHEETS_REVALIDATE },
);

export async function getDataFreshness(): Promise<DataFreshness> {
  const [sleeperAt, sheetsAt] = await Promise.all([
    getSleeperFreshness(),
    getSheetsFreshness(),
  ]);
  return { sleeperAt, sheetsAt };
}
