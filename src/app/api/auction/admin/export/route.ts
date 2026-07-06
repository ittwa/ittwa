import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { getFullState } from "@/lib/auction-db";
import { resultsToCsv } from "@/lib/auction";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const full = await getFullState(auctionId);
  if (!full) {
    return NextResponse.json({ error: "No auction data" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const includePlayerId = searchParams.get("includePlayerId") === "true";

  // getFullState returns results newest-first; the export should read oldest
  // pick first, matching the old Drafted Players sheet.
  const chronological = [...full.results].sort((a, b) => a.pickNumber - b.pickNumber);
  const csv = resultsToCsv(chronological, { includePlayerId });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ittwa-fa-auction-${full.auction.season}.csv"`,
    },
  });
}
