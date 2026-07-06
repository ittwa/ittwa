import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { setNominatorOverride } from "@/lib/auction-db";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as { owner: string | null } | null;
  await setNominatorOverride(auctionId, body?.owner ?? null);
  return NextResponse.json({ ok: true });
}
