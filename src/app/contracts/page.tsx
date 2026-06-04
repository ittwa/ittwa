import { connection } from "next/server";

import {
  getRosters,
  buildRosterOwnerMap,
  getNFLPlayers,
  getContracts,
  getNFLState,
  getLatestActiveContracts,
  getActiveContractsForSeason,
  getLeagueUsers,
} from "@/lib/data";
import { getCachedSeasonPosRanks } from "@/lib/cached-stats";
import { resolveOwnerName } from "@/lib/contracts";
import { getDisplayName } from "@/lib/sleeper";
import { SEASON_LEAGUE_IDS } from "@/lib/config";
import { ContractsClient } from "./contracts-client";
import type { ContractEntry } from "./contracts-client";
import type { ContractWithValue } from "@/types/contracts";


export default async function ContractsPage() {
  await connection();
  const [nflPlayers, rawContracts, nflState, users] = await Promise.all([
    getNFLPlayers(),
    getContracts(),
    getNFLState(),
    getLeagueUsers(),
  ]);

  const season = nflState.season;
  const availableSeasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();

  const seasonResults = await Promise.all(
    availableSeasons.map(async (yr) => {
      const leagueId = SEASON_LEAGUE_IDS[yr];
      const [rosters, rosterOwnerMap] = await Promise.all([
        getRosters(leagueId),
        buildRosterOwnerMap(leagueId),
      ]);
      return { season: yr, rosters, rosterOwnerMap };
    })
  );

  const seasonRanks = new Map<string, Record<string, number>>();
  await Promise.all(
    availableSeasons.map(async (yr) => {
      const leagueId = SEASON_LEAGUE_IDS[yr];
      const ranks = await getCachedSeasonPosRanks(leagueId, nflPlayers, yr === season);
      seasonRanks.set(yr, ranks);
    })
  );

  for (const yr of [...availableSeasons].sort()) {
    const ranks = seasonRanks.get(yr);
    if (!ranks || Object.keys(ranks).length === 0) {
      const prevYr = String(parseInt(yr) - 1);
      const prevRanks = seasonRanks.get(prevYr);
      if (prevRanks && Object.keys(prevRanks).length > 0) {
        seasonRanks.set(yr, prevRanks);
      }
    }
  }

  const allContracts: ContractEntry[] = [];

  for (const { season: yr, rosters, rosterOwnerMap } of seasonResults) {
    const isCurrentSeason = yr === season;
    const sheetContracts = isCurrentSeason
      ? getLatestActiveContracts(rawContracts)
      : getActiveContractsForSeason(rawContracts, yr);

    const contractByPlayerId = new Map<string, ContractWithValue>();
    const contractByName = new Map<string, ContractWithValue>();
    for (const c of sheetContracts) {
      if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
        contractByPlayerId.set(c.playerId, c);
      }
      if (c.player) {
        contractByName.set(c.player.toLowerCase().trim(), c);
      }
    }

    const seenPlayerIds = new Set<string>();

    for (const roster of rosters) {
      const ownerDisplayName = rosterOwnerMap[roster.roster_id] || `Team ${roster.roster_id}`;
      const players = roster.players || [];

      for (const pid of players) {
        if (seenPlayerIds.has(pid)) continue;
        seenPlayerIds.add(pid);

        const sleeperPlayer = nflPlayers[pid];
        let contract = contractByPlayerId.get(pid);
        if (!contract && sleeperPlayer) {
          const fullName = (sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`).toLowerCase().trim();
          contract = contractByName.get(fullName);
        }

        const name = sleeperPlayer
          ? (sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`)
          : contract?.player || `Unknown (${pid})`;
        const pos = sleeperPlayer?.position || contract?.position || "—";

        const rankMap = seasonRanks.get(yr);
        const posRank = rankMap?.[pid] ?? undefined;

        if (contract) {
          allContracts.push({
            ...contract,
            playerId: pid,
            player: name,
            position: pos,
            owner: resolveOwnerName(contract.owner),
            rosterSeason: yr,
            posRank,
          });
        } else {
          allContracts.push({
            playerId: pid,
            season: yr,
            owner: ownerDisplayName,
            player: name,
            position: pos,
            years: 0,
            salary: 0,
            dpOriginalOwner: "",
            draftPickId: "",
            contractStatus: "Active",
            contractStartYear: "",
            originalPick: "",
            franchiseTag: false,
            fifthYearTag: false,
            fifthYearTagAmount: "",
            contractValue: 0,
            isMidSeasonPickup: true,
            rosterSeason: yr,
            posRank,
          });
        }
      }
    }
  }

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return <ContractsClient contracts={allContracts} season={season} availableSeasons={availableSeasons} ownerAvatars={ownerAvatars} />;
}
