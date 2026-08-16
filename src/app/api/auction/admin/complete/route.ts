import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { getFullState, setStatus } from "@/lib/auction-db";
import { resultsToCsv } from "@/lib/auction";
import { sendAuctionResultsEmail, type EmailResult } from "@/lib/email";

export async function POST() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  await setStatus(auctionId, "complete");

  // Email the final results CSV to the league inbox. This is best-effort: a
  // send failure must not fail the completion itself (the status is already
  // flipped above and the CSV is always downloadable via Export CSV), so we
  // report the outcome instead of throwing.
  let email: EmailResult = { sent: false, skipped: "no results" };
  const full = await getFullState(auctionId);
  if (full) {
    // Oldest pick first, matching the Export CSV route and the old sheet.
    const chronological = [...full.results].sort((a, b) => a.pickNumber - b.pickNumber);
    const csv = resultsToCsv(chronological);
    email = await sendAuctionResultsEmail({ season: full.auction.season, csv });
  }

  return NextResponse.json({ ok: true, email });
}
