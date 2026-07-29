// Computes the pre-auction derivation (rosters, cap math, free agent pool)
// straight from the Google Sheet + Sleeper — no database involved. This
// powers the setup wizard's review screen and its "Reload from Sheet" button.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auction-auth";
import { deriveDefaultSeason, deriveInputs } from "@/lib/auction-derive";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") || (await deriveDefaultSeason());

  const result = await deriveInputs(season);
  return NextResponse.json(result);
}
