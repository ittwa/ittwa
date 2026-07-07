// Public — no auth. Anyone can override who's on the clock for the next
// pick only (e.g. someone's away from the call) — it doesn't touch the
// underlying rotation order.

import { NextResponse } from "next/server";
import { requireActiveAuctionId } from "@/lib/auction-route-utils";
import { setNominatorOverride } from "@/lib/auction-db";

export async function POST(request: Request) {
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as { owner: string | null } | null;
  await setNominatorOverride(auctionId, body?.owner ?? null);
  return NextResponse.json({ ok: true });
}
