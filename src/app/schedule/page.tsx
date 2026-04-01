export const dynamic = 'force-dynamic';

import { getTeamsData, getMatchupPairs, buildRosterOwnerMap } from "@/lib/data";
import { MatchupPair } from "@/types/sleeper";
import { ScheduleClient } from "./schedule-client";

export const revalidate = 300;

export default async function SchedulePage() {
  const [teamsData, rosterOwnerMap] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
  ]);

  const { season, currentWeek } = teamsData;

  // Fetch all 13 weeks
  const allPairs: Record<number, MatchupPair[]> = {};
  const promises = [];
  for (let w = 1; w <= 13; w++) {
    promises.push(
      getMatchupPairs(w, rosterOwnerMap)
        .then((pairs) => { allPairs[w] = pairs; })
        .catch(() => { allPairs[w] = []; })
    );
  }
  await Promise.all(promises);

  const teamNames = Object.values(rosterOwnerMap).sort();

  return (
    <ScheduleClient
      allPairs={allPairs}
      season={season}
      currentWeek={currentWeek}
      teamNames={teamNames}
    />
  );
}
