export const dynamic = "force-dynamic";

import { getDrafts, buildRosterOwnerMap, getLeagueUsers } from "@/lib/data";
import { getDraftPicks, getTradedPicks, getDisplayName, getNFLState } from "@/lib/sleeper";
import { DraftsClient } from "./drafts-client";
import { SEASON_LEAGUE_IDS, OWNER_DIVISION, ROOKIE_PICK_CONTRACTS } from "@/lib/config";

export const revalidate = 3600;

export default async function DraftsPage() {
  const allSeasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();
  const users = await getLeagueUsers();
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const allDrafts = await Promise.all(
    allSeasons.map(async (season) => {
      const leagueId = SEASON_LEAGUE_IDS[season];
      const [drafts, rosterOwnerMap] = await Promise.all([
        getDrafts(leagueId),
        buildRosterOwnerMap(leagueId),
      ]);
      return { season, drafts, rosterOwnerMap };
    })
  );

  const draftsWithPicks = await Promise.all(
    allDrafts.flatMap(({ season, drafts, rosterOwnerMap }) =>
      drafts.map(async (draft) => {
        try {
          const picks = await getDraftPicks(draft.draft_id);
          const numTeams = Object.keys(rosterOwnerMap).length || 12;

          const slotToOwner: Record<number, string> = {};
          if (draft.slot_to_roster_id) {
            for (const [slot, rosterId] of Object.entries(draft.slot_to_roster_id)) {
              slotToOwner[Number(slot)] = rosterOwnerMap[rosterId] || `Team ${rosterId}`;
            }
          }

          return {
            draftId: draft.draft_id,
            season: draft.season || season,
            type: draft.type,
            status: draft.status,
            rounds: draft.settings?.rounds || 2,
            numTeams,
            slotToOwner,
            picks: picks.map((p) => {
              const pickInRound = ((p.pick_no - 1) % numTeams) + 1;
              const pickKey = `${p.round}.${pickInRound.toString().padStart(2, "0")}`;
              const contractInfo = ROOKIE_PICK_CONTRACTS[pickKey];
              const ownerName = rosterOwnerMap[p.roster_id] || `Team ${p.roster_id}`;

              return {
                pickNo: p.pick_no,
                round: p.round,
                draftSlot: p.draft_slot || pickInRound,
                rosterId: p.roster_id,
                playerId: p.player_id,
                playerName: `${p.metadata?.first_name || ""} ${p.metadata?.last_name || ""}`.trim(),
                position: p.metadata?.position || "",
                team: p.metadata?.team || "",
                ownerName,
                ownerDivision: OWNER_DIVISION[ownerName] || "",
                contractYears: contractInfo?.years || 0,
                contractSalary: contractInfo?.salary || 0,
              };
            }),
          };
        } catch {
          return {
            draftId: draft.draft_id,
            season: draft.season || season,
            type: draft.type,
            status: draft.status,
            rounds: draft.settings?.rounds || 2,
            numTeams: 12,
            slotToOwner: {} as Record<number, string>,
            picks: [],
          };
        }
      })
    )
  );

  const sorted = draftsWithPicks
    .filter((d) => d.picks.length > 0)
    .sort((a, b) => b.season.localeCompare(a.season));

  // --- Future picks data ---
  const nflState = await getNFLState();
  const currentSeason = Number(nflState.season);
  const futureSeasons = [currentSeason + 1, currentSeason + 2].map(String);

  const currentLeagueId = SEASON_LEAGUE_IDS[String(currentSeason)] || Object.values(SEASON_LEAGUE_IDS)[0];
  const [tradedPicks, rosterOwnerMap] = await Promise.all([
    getTradedPicks(currentLeagueId),
    buildRosterOwnerMap(currentLeagueId),
  ]);

  const NUM_TEAMS = 12;
  const ROUNDS = 2;
  const owners = Object.entries(rosterOwnerMap).map(([rosterId, name]) => ({
    rosterId: Number(rosterId),
    name,
    division: OWNER_DIVISION[name] || "",
  }));

  const futurePicksBySeason: Record<string, {
    season: string;
    picks: {
      round: number;
      slot: number;
      pickLabel: string;
      originalOwner: string;
      originalOwnerDivision: string;
      originalRosterId: number;
      currentOwner: string;
      currentOwnerDivision: string;
      traded: boolean;
      salary: number;
      years: number;
    }[];
  }> = {};

  for (const season of futureSeasons) {
    const picks: typeof futurePicksBySeason[string]["picks"] = [];

    for (let round = 1; round <= ROUNDS; round++) {
      for (let slot = 1; slot <= NUM_TEAMS; slot++) {
        const pickLabel = `${round}.${String(slot).padStart(2, "0")}`;
        const contractInfo = ROOKIE_PICK_CONTRACTS[pickLabel];
        const owner = owners.find((o) => o.rosterId === slot) || owners[slot - 1];
        const originalName = owner?.name || `Team ${slot}`;
        const originalDiv = OWNER_DIVISION[originalName] || "";

        const trade = tradedPicks.find(
          (tp) => tp.season === season && tp.round === round && tp.owner_id === slot
        );

        const currentRosterId = trade ? trade.roster_id : slot;
        const currentOwner = rosterOwnerMap[currentRosterId] || `Team ${currentRosterId}`;
        const currentDiv = OWNER_DIVISION[currentOwner] || "";

        picks.push({
          round,
          slot,
          pickLabel,
          originalOwner: originalName,
          originalOwnerDivision: originalDiv,
          originalRosterId: slot,
          currentOwner,
          currentOwnerDivision: currentDiv,
          traded: currentOwner !== originalName,
          salary: contractInfo?.salary || 0,
          years: contractInfo?.years || 0,
        });
      }
    }

    futurePicksBySeason[season] = { season, picks };
  }

  return (
    <DraftsClient
      drafts={sorted}
      ownerAvatars={ownerAvatars}
      futurePicksBySeason={futurePicksBySeason}
      futureSeasons={futureSeasons}
    />
  );
}
