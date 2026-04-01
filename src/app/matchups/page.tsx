export const dynamic = 'force-dynamic';

import { getTeamsData, getMatchupPairs, buildRosterOwnerMap } from "@/lib/data";
import { MatchupPair } from "@/types/sleeper";
import { MatchupsClient } from "./matchups-client";

export const revalidate = 300;

export default async function MatchupsPage() {
  const [teamsData, rosterOwnerMap] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
  ]);

  const { season, currentWeek } = teamsData;

  // Fetch matchups for all 18 possible weeks
  const allPairs: Record<number, MatchupPair[]> = {};
  const promises = [];
  for (let w = 1; w <= 18; w++) {
    promises.push(
      getMatchupPairs(w, rosterOwnerMap)
        .then((pairs) => { allPairs[w] = pairs; })
        .catch(() => { allPairs[w] = []; })
    );
  }
  await Promise.all(promises);

  return (
    <MatchupsClient
      allPairs={allPairs}
      season={season}
      currentWeek={currentWeek}
    />
  );
}
