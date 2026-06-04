import { connection } from "next/server";


import { getMatchups, buildRosterOwnerMap, getLeagueUsers, getDisplayName } from "@/lib/sleeper";
import { SEASON_LEAGUE_IDS } from "@/lib/config";
import { RivalryClient, type HistoricalMatchup } from "./rivalry-client";
import type { SleeperMatchup } from "@/types/sleeper";

export default async function RivalryPage() {
  await connection();
  const seasons = Object.keys(SEASON_LEAGUE_IDS).sort();
  const allMatchups: HistoricalMatchup[] = [];

  const users = await getLeagueUsers();
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  await Promise.all(
    seasons.map(async (seasonStr) => {
      const season = Number(seasonStr);
      const leagueId = SEASON_LEAGUE_IDS[seasonStr];

      const [rosterOwnerMap, weekData] = await Promise.all([
        buildRosterOwnerMap(leagueId),
        Promise.all(
          Array.from({ length: 17 }, (_, i) =>
            getMatchups(i + 1, leagueId).catch((): SleeperMatchup[] => [])
          )
        ),
      ]);

      for (let weekIdx = 0; weekIdx < weekData.length; weekIdx++) {
        const week = weekIdx + 1;
        const byId = new Map<number, { roster_id: number; points: number }[]>();

        for (const m of weekData[weekIdx]) {
          if (!m.matchup_id) continue;
          const arr = byId.get(m.matchup_id) ?? [];
          arr.push(m);
          byId.set(m.matchup_id, arr);
        }

        for (const [, pair] of byId) {
          if (pair.length !== 2) continue;
          const [a, b] = pair;
          if (a.points <= 0 && b.points <= 0) continue;

          const ownerA = rosterOwnerMap[a.roster_id];
          const ownerB = rosterOwnerMap[b.roster_id];
          if (!ownerA || !ownerB) continue;

          allMatchups.push({
            season,
            week,
            ownerA,
            ownerB,
            scoreA: a.points,
            scoreB: b.points,
            playoff: week >= 15,
          });
        }
      }
    })
  );

  allMatchups.sort((a, b) => a.season - b.season || a.week - b.week);

  const availableSeasons = seasons.map(Number).sort((a, b) => b - a);

  return <RivalryClient allMatchups={allMatchups} availableSeasons={availableSeasons} ownerAvatars={ownerAvatars} />;
}
