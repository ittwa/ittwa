export const dynamic = "force-dynamic";

import { getCapHits, getLeagueUsers, getNFLPlayers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { OWNER_DIVISION, ALL_OWNERS, SEASON_LEAGUE_IDS } from "@/lib/config";
import { resolveOwnerName } from "@/lib/contracts";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";
import { CapHitsClient } from "./cap-hits-client";
import type { CapHitRow } from "@/types/contracts";

export const revalidate = 300;

export interface CapHitClientRow {
  id: number;
  owner: string;
  player: string;
  playerId: string;
  pos: string;
  cutYear: string;
  total: number;
  yearlyHits: Record<number, number>;
}

function buildClientRows(capHits: CapHitRow[], nameToPlayerId: Map<string, string>): CapHitClientRow[] {
  return capHits.map((ch, i) => {
    const total = Object.values(ch.yearlyHits).reduce((s, v) => s + v, 0);
    return {
      id: i,
      owner: resolveOwnerName(ch.owner),
      player: ch.player,
      playerId: nameToPlayerId.get(ch.player.toLowerCase().trim()) || "",
      pos: ch.position,
      cutYear: ch.season,
      total: Math.round(total * 10) / 10,
      yearlyHits: ch.yearlyHits,
    };
  });
}

export default async function CapHitsPage() {
  const season = Object.keys(SEASON_LEAGUE_IDS).sort().reverse()[0];

  const [capHits, users, nflPlayers] = await Promise.all([
    getCapHits(),
    getLeagueUsers().catch(() => []),
    getNFLPlayers().catch(() => ({} as Record<string, { full_name?: string; first_name: string; last_name: string }>)),
  ]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const ownerDivisions: Record<string, string> = {};
  for (const owner of ALL_OWNERS) {
    ownerDivisions[owner] = OWNER_DIVISION[owner] || "";
  }

  const nameToPlayerId = new Map<string, string>();
  for (const [pid, p] of Object.entries(nflPlayers)) {
    const name = p.full_name || `${p.first_name} ${p.last_name}`;
    nameToPlayerId.set(name.toLowerCase().trim(), pid);
  }

  const rows = buildClientRows(capHits, nameToPlayerId);

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
