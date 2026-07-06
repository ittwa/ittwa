import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auction-auth";

export async function GET() {
  const ok = await isAdminRequest();
  return NextResponse.json({ authenticated: ok });
}
