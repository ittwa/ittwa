import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { overrideCapHit } from "@/lib/auction-db";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as { owner?: string; capHit?: number } | null;
  if (!body?.owner || typeof body.capHit !== "number") {
    return NextResponse.json({ error: "owner and capHit are required" }, { status: 400 });
  }

  await overrideCapHit(auctionId, body.owner, body.capHit);
  return NextResponse.json({ ok: true });
}
