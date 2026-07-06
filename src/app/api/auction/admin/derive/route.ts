// Computes the pre-auction derivation (rosters, cap math, free agent pool)
// straight from the Google Sheet + Sleeper — no database involved. This
// powers the setup wizard's review screen and its "Reload from Sheet" button.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auction-auth";
import { deriveAuctionState } from "@/lib/auction";
import { getContracts, getCapHits, getNFLPlayers, getNFLState } from "@/lib/data";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let season = searchParams.get("season") || undefined;

  const [contracts, capHits, nflPlayers, nflState] = await Promise.all([
    getContracts(),
    getCapHits(),
    getNFLPlayers(),
    getNFLState().catch(() => null),
  ]);

  if (!season) season = nflState?.season || String(new Date().getFullYear());

  const result = deriveAuctionState({ season, contracts, capHits, nflPlayers });
  return NextResponse.json(result);
}
