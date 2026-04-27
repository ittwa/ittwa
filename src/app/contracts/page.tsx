export const dynamic = "force-dynamic";

import {
  getRosters,
  buildRosterOwnerMap,
  getNFLPlayers,
  getContracts,
  getNFLState,
  getLatestActiveContracts,
} from "@/lib/data";
import { resolveOwnerName } from "@/lib/contracts";
import { ContractsClient } from "./contracts-client";
import type { ContractWithValue } from "@/types/contracts";

export const revalidate = 600;

export default async function ContractsPage() {
  const [rosters, rosterOwnerMap, nflPlayers, rawContracts, nflState] = await Promise.all([
    getRosters(),
    buildRosterOwnerMap(),
    getNFLPlayers(),
    getContracts(),
    getNFLState(),
  ]);

  const season = nflState.season;
  const sheetContracts = getLatestActiveContracts(rawContracts);

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

  const allContracts: ContractWithValue[] = [];
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

      if (contract) {
        allContracts.push({
          ...contract,
          playerId: pid,
          player: name,
          position: pos,
          owner: resolveOwnerName(contract.owner),
        });
      } else {
        allContracts.push({
          playerId: pid,
          season,
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
        });
      }
    }
  }

  return <ContractsClient contracts={allContracts} season={season} />;
}
