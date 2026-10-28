import { connection } from "next/server";

export const metadata = { title: "Playoff Odds" };

import { getTeamsData, calculateStandings, getLeagueUsers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { getScores } from "@/lib/sheets";
import { computeHistoricalRecordOdds, type HistoryTable } from "@/lib/playoff-odds";
import { PlayoffOddsClient, type OddsTeam } from "./playoff-odds-client";

export default async function PlayoffOddsPage() {
  await connection();
  const [{ teams, season, allMatchups }, users, history] = await Promise.all([
    getTeamsData(),
    getLeagueUsers(),
    // History is a side column — a Sheets hiccup shouldn't take the page down.
    getScores()
      .then(computeHistoricalRecordOdds)
      .catch((err): HistoryTable => {
        console.error("[playoff-odds] Scores sheet unavailable:", err);
        return {};
      }),
  ]);

  const standings = calculateStandings(teams, allMatchups);
  const oddsTeams: OddsTeam[] = standings.map((t) => ({
    rosterId: t.rosterId,
    displayName: t.displayName,
    division: t.division,
    rank: t.rank,
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
  }));

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return (
    <PlayoffOddsClient
      teams={oddsTeams}
      history={history}
      season={season}
      ownerAvatars={ownerAvatars}
    />
  );
}
