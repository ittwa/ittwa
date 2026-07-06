import { NextResponse } from "next/server";
import { requireAdmin, requireActiveAuctionId } from "@/lib/auction-route-utils";
import { editResult, deleteResult } from "@/lib/auction-db";

interface EditBody {
  winner: string;
  player: string;
  position: string;
  years: number;
  salary: number;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const { id } = await params;
  const resultId = Number(id);
  if (!Number.isFinite(resultId)) {
    return NextResponse.json({ error: "Invalid result id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as EditBody | null;
  if (!body?.winner || !body.player || !body.position || typeof body.years !== "number" || typeof body.salary !== "number") {
    return NextResponse.json({ error: "winner, player, position, years, and salary are required" }, { status: 400 });
  }

  await editResult(auctionId, resultId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const auctionId = await requireActiveAuctionId();
  if (auctionId instanceof NextResponse) return auctionId;

  const { id } = await params;
  const resultId = Number(id);
  if (!Number.isFinite(resultId)) {
    return NextResponse.json({ error: "Invalid result id" }, { status: 400 });
  }

  await deleteResult(auctionId, resultId);
  return NextResponse.json({ ok: true });
}
