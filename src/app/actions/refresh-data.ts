"use server";

import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/config";

// Manual "pull fresh data now" escape hatch for the footer Refresh button.
//
// Normally Sleeper and Google Sheets data is served from the Next.js Data Cache
// until its revalidate window elapses (rosters 10 min, matchups 5 min, sheets
// 10 min). That is the right default, but it means a trade or a contract edit
// made seconds ago is invisible until the window closes. This expires both
// source tags so the very next render refetches from upstream.
//
// `updateTag` (not `revalidateTag`) is deliberate: revalidateTag marks entries
// stale and serves the cached copy while refetching in the background, which
// would show the OLD data on the click that was supposed to update it.
// updateTag expires immediately, so the next request blocks on fresh data —
// exactly the read-your-own-writes behavior a manual refresh should have. It is
// only callable from a Server Action, which is why this is not a route handler.
export async function refreshLeagueData(): Promise<{ ok: boolean; error?: string }> {
  try {
    updateTag(CACHE_TAGS.sleeper);
    updateTag(CACHE_TAGS.sheets);
    return { ok: true };
  } catch (err) {
    console.error("Manual data refresh failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Refresh failed",
    };
  }
}
