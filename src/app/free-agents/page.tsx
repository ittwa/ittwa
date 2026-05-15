export const dynamic = "force-dynamic";

import {
  getContracts,
  getRosters,
  buildRosterOwnerMap,
  getNFLPlayers,
  getLatestActiveContracts,
  getLeagueUsers,
  getMatchups,
  getSeasonPosRanks,
} from "@/lib/data";
import { resolveOwnerName } from "@/lib/contracts";
import { getDisplayName } from "@/lib/sleeper";
import { SEASON_LEAGUE_IDS, ALL_OWNERS } from "@/lib/config";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";
import { FreeAgentsClient } from "./free-agents-client";
import type { ContractWithValue } from "@/types/contracts";

export const revalidate = 600;

export interface FreeAgentRow {
  playerId: string;
  player: string;
  pos: string;
  lastTeam: string;
  lastOwner: string | null;
  lastSalary: number;
  lastContractYears: number;
  lastPoints: number;
  posRank: number | null;
  status: "UFA" | "RFA" | "ROOKIE" | "CUT" | "IR";
  exp: number;
  age: number;
  lastYear: string;
}

function deriveFreeAgentStatus(
  player: { years_exp?: number; injury_status?: string },
  contract: ContractWithValue | undefined
): FreeAgentRow["status"] {
  if ((player.years_exp ?? 0) === 0) return "ROOKIE";
  if (player.injury_status === "IR" || player.injury_status === "PUP") return "IR";
  if (contract) return "CUT";
  if ((player.years_exp ?? 0) <= 4) return "RFA";
  return "UFA";
}

export default async function FreeAgentsPage() {
  const season = Object.keys(SEASON_LEAGUE_IDS).sort().reverse()[0];
  const leagueId = SEASON_LEAGUE_IDS[season];

  const [rawContracts, nflPlayers, rosters, rosterOwnerMap, users] =
    await Promise.all([
      getContracts(),
      getNFLPlayers(),
      getRosters(leagueId),
      buildRosterOwnerMap(leagueId),
      getLeagueUsers().catch(() => []),
    ]);

  const activeContracts = getLatestActiveContracts(rawContracts);

  const availableSeasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();
  const rankSeasonId = availableSeasons.length > 1
    ? SEASON_LEAGUE_IDS[availableSeasons[1]]
    : leagueId;

  const [posRanks, playerPoints] = await Promise.all([
    getSeasonPosRanks(rankSeasonId, nflPlayers).catch(() => new Map<string, number>()),
    (async () => {
      const pts = new Map<string, number>();
      const fetches = [];
      for (let w = 1; w <= 18; w++) {
        fetches.push(
          getMatchups(w, rankSeasonId)
            .then((matchups) => {
              for (const m of matchups) {
                if (m.players_points) {
                  for (const [pid, p] of Object.entries(m.players_points)) {
                    pts.set(pid, (pts.get(pid) || 0) + p);
                  }
                }
              }
            })
            .catch(() => {}),
        );
      }
      await Promise.all(fetches);
      return pts;
    })(),
  ]);

  const contractedPlayerIds = new Set<string>();
  const contractByPlayerId = new Map<string, ContractWithValue>();
  const contractByName = new Map<string, ContractWithValue>();
  for (const c of activeContracts) {
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      contractedPlayerIds.add(c.playerId);
      contractByPlayerId.set(c.playerId, c);
    }
    if (c.player) {
      contractByName.set(c.player.toLowerCase().trim(), c);
    }
  }

  const rosteredPlayerIds = new Set<string>();
  for (const roster of rosters) {
    for (const pid of roster.players || []) {
      rosteredPlayerIds.add(pid);
    }
  }

  const freeAgents: FreeAgentRow[] = [];
  const validPositions = new Set(["QB", "RB", "WR", "TE"]);

  for (const [pid, p] of Object.entries(nflPlayers)) {
    if (!validPositions.has(p.position)) continue;
    if (rosteredPlayerIds.has(pid)) continue;
    if (p.sport !== "nfl") continue;
    if (!p.team) continue;

    const name = p.full_name || `${p.first_name} ${p.last_name}`;
    const nameLower = name.toLowerCase().trim();

    let lastContract = contractByPlayerId.get(pid) || contractByName.get(nameLower);

    const status = deriveFreeAgentStatus(p, lastContract);

    freeAgents.push({
      playerId: pid,
      player: name,
      pos: p.position,
      lastTeam: p.team || "—",
      lastOwner: lastContract ? resolveOwnerName(lastContract.owner) : null,
      lastSalary: lastContract?.salary ?? 0,
      lastContractYears: lastContract?.years ?? 0,
      lastPoints: Math.round((playerPoints.get(pid) || 0) * 10) / 10,
      posRank: posRanks.get(pid) ?? null,
      status,
      exp: p.years_exp ?? 0,
      age: p.age ?? 0,
      lastYear: lastContract?.season ?? "—",
    });
  }

  freeAgents.sort((a, b) => b.lastSalary - a.lastSalary);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
      <FreeAgentsClient
        players={freeAgents}
        season={season}
        ownerAvatars={ownerAvatars}
        owners={ALL_OWNERS}
      />
    </OwnerAvatarsProvider>
  );
}
