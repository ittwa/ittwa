// Simple, de-emphasized timer — 30s/60s presets shown on the public board.
// No auto-actions fire when it expires; it's purely a visual aid.

import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { setTimer } from "@/lib/auction-db";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as { seconds?: number | null } | null;
  const endsAt =
    typeof body?.seconds === "number" ? new Date(Date.now() + body.seconds * 1000).toISOString() : null;

  await setTimer(auctionId, endsAt);
  return NextResponse.json({ ok: true, timerEndsAt: endsAt });
}
