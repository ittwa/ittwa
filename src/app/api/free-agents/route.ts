// Free agents in the ITTWA league as a CSV download: every QB/RB/WR/TE that
// isn't on any Sleeper roster, "Player,Position", alphabetical by name.
//
// By default the list is the full unrostered universe (includes team-less
// players, matching a raw Sleeper export); pass ?active=1 to keep only players
// currently on an NFL team.
//
// Runs on the deployment, where Sleeper is reachable — hit
// /api/free-agents (add ?active=1) and save the response.

import { getRosters, getNFLPlayers } from "@/lib/data";
import { buildFreeAgentsCsv } from "@/lib/free-agents-export";

export async function GET(request: Request) {
  const activeOnly = new URL(request.url).searchParams.get("active") === "1";

  let rosters, nflPlayers;
  try {
    [rosters, nflPlayers] = await Promise.all([getRosters(), getNFLPlayers()]);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load Sleeper data" },
      { status: 502 },
    );
  }

  const csv = buildFreeAgentsCsv({ rosters, nflPlayers, activeOnly });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ittwa-free-agents${activeOnly ? "-active" : ""}.csv"`,
      // Rosters shift with every trade/drop; don't serve a stale copy.
      "Cache-Control": "no-store",
    },
  });
}
