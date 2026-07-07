// Public — no auth. Anyone can award the current nomination to the winning
// owner; the commissioner's only remaining authority over results is
// editing/deleting them after the fact (see /api/auction/admin/result/[id]).

import { NextResponse } from "next/server";
import { requireActiveAuctionId } from "@/lib/auction-route-utils";
import { awardCurrent, getFullState } from "@/lib/auction-db";
import { awardWarnings } from "@/lib/auction";

interface AwardBody {
  winner: string;
  salary: number;
  years: number;
}

export async function POST(request: Request) {
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const body = (await request.json().catch(() => null)) as AwardBody | null;
  if (!body?.winner || typeof body.salary !== "number" || typeof body.years !== "number") {
    return NextResponse.json({ error: "winner, salary, and years are required" }, { status: 400 });
  }

  // Soft warnings only — never blocks the award, just flags anything worth
  // a second look (busted cap, over max years, etc).
  const before = await getFullState(auctionId);
  const ownerCap = before?.owners.find((o) => o.owner === body.winner);
  const warnings = ownerCap ? awardWarnings(ownerCap, body.salary, body.years) : [];

  try {
    const result = await awardCurrent(auctionId, { winner: body.winner, salary: body.salary, years: body.years });
    return NextResponse.json({ ok: true, result, warnings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Award failed" }, { status: 400 });
  }
}
