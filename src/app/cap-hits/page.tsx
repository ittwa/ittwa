export const dynamic = "force-dynamic";

import { getCapHits, getLeagueUsers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { OWNER_DIVISION, ALL_OWNERS, SEASON_LEAGUE_IDS } from "@/lib/config";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";
import { CapHitsClient } from "./cap-hits-client";
import type { CapHitRow } from "@/types/contracts";

export const revalidate = 300;

export interface CapHitClientRow {
  id: number;
  owner: string;
  player: string;
  pos: string;
  cutYear: string;
  total: number;
  yearlyHits: Record<number, number>;
}

function buildClientRows(capHits: CapHitRow[]): CapHitClientRow[] {
  return capHits.map((ch, i) => {
    const total = Object.values(ch.yearlyHits).reduce((s, v) => s + v, 0);
    return {
      id: i,
      owner: ch.owner,
      player: ch.player,
      pos: ch.position,
      cutYear: ch.season,
      total: Math.round(total * 10) / 10,
      yearlyHits: ch.yearlyHits,
    };
  });
}

export default async function CapHitsPage() {
  const season = Object.keys(SEASON_LEAGUE_IDS).sort().reverse()[0];

  const [capHits, users] = await Promise.all([
    getCapHits(),
    getLeagueUsers().catch(() => []),
  ]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const ownerDivisions: Record<string, string> = {};
  for (const owner of ALL_OWNERS) {
    ownerDivisions[owner] = OWNER_DIVISION[owner] || "";
  }

  const rows = buildClientRows(capHits);

  const allSeasons = [
    ...new Set(rows.flatMap((r) => Object.keys(r.yearlyHits).map(Number))),
  ].sort((a, b) => b - a);

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
      <CapHitsClient
        rows={rows}
        season={season}
        allSeasons={allSeasons}
        ownerDivisions={ownerDivisions}
        ownerAvatars={ownerAvatars}
        owners={ALL_OWNERS}
      />
    </OwnerAvatarsProvider>
  );
}
