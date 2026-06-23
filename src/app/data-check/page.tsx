import { connection } from "next/server";
import {
  getContracts,
  getRosters,
  getLeagueUsers,
  getLeague,
  getNFLPlayers,
} from "@/lib/data";
import { LEAGUE_ID } from "@/lib/config";
import { reconcile } from "@/lib/reconcile";
import { DataCheckClient } from "./data-check-client";

export const metadata = { title: "Data Check" };

// Read-only reconciliation that caches at the full-route level for 10 minutes.
// No `connection()` / `force-dynamic` needed: a fixed `revalidate` defers the
// fetches to request time while keeping the result in the Data Cache (see the
// caching notes in CLAUDE.md).
export const revalidate = 600;

export default async function DataCheckPage() {
  // Defer to request time so this isn't prerendered at build (where the Sheets/
  // Sleeper data is unavailable and reconcile() would throw). Per-fetch
  // revalidate still serves everything from the Data Cache. See CLAUDE.md.
  await connection();

  const [contracts, rosters, users, league, players] = await Promise.all([
    getContracts(),
    getRosters(LEAGUE_ID),
    getLeagueUsers(LEAGUE_ID),
    getLeague(LEAGUE_ID),
    getNFLPlayers(),
  ]);

  const result = reconcile({
    season: league.season,
    contracts,
    rosters,
    users,
    players,
  });

  return <DataCheckClient result={result} />;
}
