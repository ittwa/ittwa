// Confirm-guarded full reset — deletes the current auction and everything
// under it (cascades). Meant for practice runs before the real thing.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auction-route-utils";
import { getLatestAuction, resetAuction } from "@/lib/auction-db";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as { confirm?: boolean } | null;
  if (!body?.confirm) {
    return NextResponse.json({ error: "Reset requires confirm: true" }, { status: 400 });
  }

  const auction = await getLatestAuction();
  if (auction) await resetAuction(auction.id);

  return NextResponse.json({ ok: true });
}
