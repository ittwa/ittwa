import { NextResponse } from "next/server";
import { getContracts } from "@/lib/sheets";

export async function GET() {
  const contracts = await getContracts();

  // Find all draft picks and all Clancy rows for diagnosis
  const draftPicks = contracts.filter((c) =>
    c.position.toLowerCase().includes("draft") || c.position.toLowerCase().includes("pick")
  );

  const clancyAll = contracts.filter((c) =>
    c.owner.toLowerCase().includes("clancy") || c.owner.toLowerCase().includes("tiger")
  );

  const clancyDraftPicks = contracts.filter((c) =>
    c.position.toLowerCase() === "draft pick" && c.owner.toLowerCase() === "clancy"
  );

  // Sample of all unique positions and owners found
  const uniquePositions = [...new Set(contracts.map((c) => c.position))].sort();
  const uniqueOwners = [...new Set(contracts.map((c) => c.owner))].sort();

  return NextResponse.json({
    totalContracts: contracts.length,
    uniquePositions,
    uniqueOwners,
    clancyAll: clancyAll.slice(0, 30),
    draftPicksCount: draftPicks.length,
    draftPickSample: draftPicks.slice(0, 20),
    clancyDraftPicksCount: clancyDraftPicks.length,
    clancyDraftPicks,
  });
}
