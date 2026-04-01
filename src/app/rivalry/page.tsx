export const dynamic = 'force-dynamic';

import { getTeamsData, buildRosterOwnerMap } from "@/lib/data";
import { RivalryClient } from "./rivalry-client";
import { SleeperMatchup } from "@/types/sleeper";

export const revalidate = 300;

export default async function RivalryPage() {
  const [teamsData, rosterOwnerMap] = await Promise.all([
    getTeamsData(),
    buildRosterOwnerMap(),
  ]);

  const { allMatchups } = teamsData;
  const matchupsArray: [number, SleeperMatchup[]][] = Array.from(allMatchups.entries());

  // Build roster ID → name map
  const rosterNames: { rosterId: number; displayName: string }[] = [];
  for (const [id, name] of Object.entries(rosterOwnerMap)) {
    rosterNames.push({ rosterId: Number(id), displayName: name });
  }
  rosterNames.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <RivalryClient
      matchupsArray={matchupsArray}
      rosterNames={rosterNames}
    />
  );
}
