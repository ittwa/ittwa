// Public, unauthenticated consolidated state for the /auction live board.
// Polled every few seconds via SWR. Returns a stable empty shape when no
// auction exists yet (pre-auction) and a 503 on DB errors so the client can
// show "reconnecting" while keeping the last good data on screen.

import { NextResponse } from "next/server";
import { getLatestAuction, getFullState } from "@/lib/auction-db";
import { bidToBeatTable } from "@/lib/auction";
import type { AuctionPublicState } from "@/types/auction";

export const dynamic = "force-dynamic";

function emptyState(): AuctionPublicState {
  return {
    auction: null,
    owners: [],
    current: null,
    bidToBeat: [],
    onClock: null,
    onDeck: null,
    results: [],
    pool: [],
    roster: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const latest = await getLatestAuction();
    if (!latest) return NextResponse.json(emptyState());

    const full = await getFullState(latest.id);
    if (!full) return NextResponse.json(emptyState());

    const bidToBeat = full.current
      ? bidToBeatTable(full.current.highBidSalary, full.current.highBidYears)
      : [];

    const state: AuctionPublicState = {
      auction: full.auction,
      owners: full.owners,
      current: full.current,
      bidToBeat,
      onClock: full.onClock,
      onDeck: full.onDeck,
      results: full.results,
      pool: full.pool,
      roster: full.roster,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(state);
  } catch (err) {
    console.error("[auction/state] unavailable:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
