// Shared guards for the auction admin API routes.

import { NextResponse } from "next/server";
import { isAdminRequest } from "./auction-auth";
import { getLatestAuction } from "./auction-db";

export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireActiveAuctionId(): Promise<number | NextResponse> {
  const auction = await getLatestAuction();
  if (!auction) {
    return NextResponse.json({ error: "No auction exists yet — run setup first" }, { status: 404 });
  }
  return auction.id;
}
