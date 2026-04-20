import { NextResponse } from "next/server";
import { getContracts } from "@/lib/sheets";

export async function GET() {
  const contracts = await getContracts();

  const draftPicks = contracts.filter((c) =>
    c.position.toLowerCase() === "draft pick"
  );

  // All draft picks with season >= 2026 (across ALL owners)
  const futurePicksAllOwners = draftPicks.filter((c) =>
    parseInt(c.season, 10) >= 2026
  );

  // All draft picks that mention "2026" or "2027" in the player name (across ALL owners)
  const picksWithFutureYear = draftPicks.filter((c) =>
    c.player.includes("2026") || c.player.includes("2027")
  );

  // All ACTIVE draft picks across ALL owners
  const activePicksAll = draftPicks.filter((c) =>
    c.contractStatus.toLowerCase() === "active"
  );

  // All draft picks where dpOriginalOwner or player mentions Clancy
  const picksRelatedToClancy = draftPicks.filter((c) =>
    c.owner.toLowerCase() === "clancy" ||
    c.dpOriginalOwner.toLowerCase() === "clancy" ||
    c.player.toLowerCase().includes("clancy")
  );

  return NextResponse.json({
    totalDraftPicks: draftPicks.length,
    futurePicksAllOwners,
    picksWithFutureYear,
    activePicksAllCount: activePicksAll.length,
    activePicksAll,
    picksRelatedToClancy,
  });
}
