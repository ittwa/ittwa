// Snapshots the reviewed setup state into the database and goes live. From
// this point the DB is the single source of truth — the sheet and Sleeper
// are never re-read mid-auction.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auction-auth";
import { startAuction } from "@/lib/auction-db";
import { ensureAuctionSchema } from "@/lib/auction-schema";
import type { DerivedOwnerCap, DerivedRosterEntry, DerivedFreeAgent } from "@/types/auction";

interface StartBody {
  season: string;
  owners: DerivedOwnerCap[];
  roster: DerivedRosterEntry[];
  pool: DerivedFreeAgent[];
  nominationOrder: string[];
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as StartBody | null;
  if (!body || !body.season || !Array.isArray(body.owners) || !Array.isArray(body.nominationOrder)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body.nominationOrder.length === 0) {
    return NextResponse.json({ error: "Set a nomination order before starting" }, { status: 400 });
  }

  // Create the auction tables if this is the first auction ever run against
  // this database — idempotent, so it's a no-op on every start after that.
  // This means the commissioner never has to run `npm run db:migrate`.
  await ensureAuctionSchema();

  const auctionId = await startAuction({
    season: body.season,
    owners: body.owners.map((o) => ({ owner: o.owner, capHit: o.capHit, capHitOverridden: o.capHitOverridden })),
    roster: body.roster,
    pool: body.pool,
    nominationOrder: body.nominationOrder,
  });

  return NextResponse.json({ auctionId });
}
