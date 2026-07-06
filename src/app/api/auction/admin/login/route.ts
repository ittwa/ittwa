import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkPin, createAdminToken, ADMIN_COOKIE_NAME, ADMIN_COOKIE_OPTIONS } from "@/lib/auction-auth";

export async function POST(request: Request) {
  if (!process.env.AUCTION_ADMIN_PIN) {
    return NextResponse.json({ error: "AUCTION_ADMIN_PIN is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!pin || !checkPin(pin)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createAdminToken(), ADMIN_COOKIE_OPTIONS);
  return NextResponse.json({ ok: true });
}
