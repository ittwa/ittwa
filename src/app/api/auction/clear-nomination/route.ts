// Public — no auth, like nominate/bid/award/undo. Takes the current player off
// the block without awarding them, so a mis-nomination can be undone before any
// bid is finalized. The same owner stays on the clock.

import { NextResponse } from "next/server";
import { requireActiveAuctionId } from "@/lib/auction-route-utils";
import { clearNomination } from "@/lib/auction-db";

export async function POST() {
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  await clearNomination(auctionId);
  return NextResponse.json({ ok: true });
}
