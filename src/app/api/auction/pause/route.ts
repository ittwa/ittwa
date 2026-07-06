// Public — no auth. Anyone can pause the auction (e.g. for a call break).

import { NextResponse } from "next/server";
import { requireActiveAuctionId } from "@/lib/auction-route-utils";
import { setStatus } from "@/lib/auction-db";

export async function POST() {
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  await setStatus(auctionId, "paused");
  return NextResponse.json({ ok: true });
}
