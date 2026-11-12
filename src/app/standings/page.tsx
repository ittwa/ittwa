import { connection } from "next/server";

export const metadata = { title: "Standings" };

import { getTeamsData, calculateStandings, getLeagueUsers } from "@/lib/data";
import { getDisplayName, getTradedPicks } from "@/lib/sleeper";
import { getStandingsByDivision } from "@/lib/standings";
import { StandingsClient } from "./standings-client";

// Rookie draft is 3 rounds, same order every round (Constitution §6).
const ROOKIE_ROUNDS = 3;

export default async function StandingsPage() {
  await connection();
  const [{ teams, season, currentWeek, allMatchups }, users, tradedPicks] = await Promise.all([
    getTeamsData(),
    getLeagueUsers(),
    // Pick ownership is a nice-to-have on the Draft Order tab — never let a
    // traded_picks failure take down the standings page.
    getTradedPicks().catch(() => []),
  ]);

  const standings = calculateStandings(teams, allMatchups);
  const standingsByDivision = getStandingsByDivision(standings);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  // Next season's rookie draft: for each original team's pick, who holds it
  // now, by round. Sleeper's traded_picks: roster_id = original team,
  // owner_id = current holder (both roster ids).
  const draftSeason = String(Number(season) + 1);
  const nameByRosterId = new Map(teams.map((t) => [t.rosterId, t.displayName]));
  const pickHolders: Record<number, string[]> = {};
  for (const t of teams) {
    pickHolders[t.rosterId] = Array.from({ length: ROOKIE_ROUNDS }, () => t.displayName);
  }
  for (const tp of tradedPicks) {
    if (tp.season !== draftSeason || tp.round < 1 || tp.round > ROOKIE_ROUNDS) continue;
    const holder = nameByRosterId.get(tp.owner_id);
    if (holder && pickHolders[tp.roster_id]) pickHolders[tp.roster_id][tp.round - 1] = holder;
  }

  return (
    <StandingsClient
      standings={standings}
      standingsByDivision={standingsByDivision}
      season={season}
      currentWeek={currentWeek}
      ownerAvatars={ownerAvatars}
      draftSeason={draftSeason}
      pickHolders={pickHolders}
    />
  );
}
