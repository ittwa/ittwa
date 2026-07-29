// Re-imports the derived inputs (rosters, cap hits, free agent pool) into a
// live auction from Sleeper + the Google Sheet, without disturbing anything
// the auction itself has produced. This is how a trade or a drop that landed
// after "Start Auction" gets reflected on the owner board.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auction-auth";
import { getLatestAuction, resyncAuctionInputs } from "@/lib/auction-db";
import { deriveInputs } from "@/lib/auction-derive";

export async function POST() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auction = await getLatestAuction();
  if (!auction) {
    return NextResponse.json({ error: "No auction to resync" }, { status: 404 });
  }

  // Always resync against the auction's own season, not today's default —
  // the commissioner may have started a season ahead of Sleeper's state.
  const derived = await deriveInputs(auction.season);
  const capHitsByOwner = new Map(derived.owners.map((o) => [o.owner, o.capHit] as const));

  const summary = await resyncAuctionInputs(auction.id, {
    roster: derived.roster,
    capHitsByOwner,
    pool: derived.pool,
  });

  return NextResponse.json({ ...summary, warnings: derived.warnings });
}
