// Public — no auth. Anyone can undo the last award to fix a mis-click;
// editing/deleting an arbitrary past result still requires the commissioner
// PIN (see /api/auction/admin/result/[id]).

import { NextResponse } from "next/server";
import { requireActiveAuctionId } from "@/lib/auction-route-utils";
import { undoLastResult } from "@/lib/auction-db";

export async function POST() {
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  await undoLastResult(auctionId);
  return NextResponse.json({ ok: true });
}
