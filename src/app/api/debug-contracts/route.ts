import { NextResponse } from "next/server";
import { getContracts } from "@/lib/sheets";
import { filterActiveContracts } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const contracts = await getContracts();
  const active = filterActiveContracts(contracts);

  const uniqueStatuses = [...new Set(contracts.map((c) => c.contractStatus))];
  const uniqueSeasons = [...new Set(contracts.map((c) => c.season))];

  return NextResponse.json({
    totalRows: contracts.length,
    totalActive: active.length,
    uniqueStatuses,
    uniqueSeasons,
    sampleRawRows: contracts.slice(0, 5).map((c) => ({
      playerId: c.playerId,
      season: c.season,
      owner: c.owner,
      player: c.player,
      position: c.position,
      years: c.years,
      salary: c.salary,
      contractStatus: c.contractStatus,
    })),
    activeContracts: active.slice(0, 20).map((c) => ({
      playerId: c.playerId,
      player: c.player,
      owner: c.owner,
      season: c.season,
      salary: c.salary,
      years: c.years,
    })),
  });
}
