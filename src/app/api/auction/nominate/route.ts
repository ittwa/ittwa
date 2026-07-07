// Public — no auth. Anyone with the /auction link can nominate a player for
// the current pick, so the whole call doesn't bottleneck on one device.

import { NextResponse } from "next/server";
import { requireActiveAuctionId } from "@/lib/auction-route-utils";
import { nominate, setNominatorOverride } from "@/lib/auction-db";

interface NominateBody {
  playerId: string;
  player: string;
  position: string;
  rfa?: boolean;
  previousOwner?: string | null;
  nominatorOverride?: string | null;
}

export async function POST(request: Request) {
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as NominateBody | null;
  if (!body?.playerId || !body.player || !body.position) {
    return NextResponse.json({ error: "playerId, player, and position are required" }, { status: 400 });
  }

  if (body.nominatorOverride !== undefined) {
    await setNominatorOverride(auctionId, body.nominatorOverride);
  }

  await nominate(auctionId, {
    playerId: body.playerId,
    player: body.player,
    position: body.position,
    rfa: body.rfa ?? false,
    previousOwner: body.previousOwner ?? null,
  });

  return NextResponse.json({ ok: true });
}
