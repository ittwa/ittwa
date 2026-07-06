import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { setStatus } from "@/lib/auction-db";

export async function POST() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  await setStatus(auctionId, "live");
  return NextResponse.json({ ok: true });
}
