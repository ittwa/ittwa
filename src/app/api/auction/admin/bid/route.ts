import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { setBid } from "@/lib/auction-db";

interface BidBody {
  salary: number;
  years: number;
  bidder?: string | null;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as BidBody | null;
  if (typeof body?.salary !== "number" || typeof body?.years !== "number") {
    return NextResponse.json({ error: "salary and years are required" }, { status: 400 });
  }

  await setBid(auctionId, { salary: body.salary, years: body.years, bidder: body.bidder ?? null });
  return NextResponse.json({ ok: true });
}
