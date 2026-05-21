export const dynamic = "force-dynamic";

import { getDrafts, buildRosterOwnerMap, getLeagueUsers } from "@/lib/data";
import { getDraftPicks, getDisplayName, getNFLState } from "@/lib/sleeper";
import { getContracts } from "@/lib/sheets";
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

  // --- Future picks data from Contracts sheet ---
  const [nflState, allContracts] = await Promise.all([
    getNFLState(),
    getContracts(),
  ]);
  const currentSeason = Number(nflState.season);
  const futureSeasons = [currentSeason + 1, currentSeason + 2].map(String);

  const draftPickContracts = allContracts.filter(
    (c) => c.position === "Draft Pick" && c.contractStatus === "Active" && futureSeasons.includes(c.season)
  );

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
    const seasonPicks = draftPickContracts.filter((c) => c.season === season);
    const picks = seasonPicks.map((c, i) => {
      const roundMatch = c.player.match(/(\d+)(?:st|nd|rd|th)/);
      const round = roundMatch ? Number(roundMatch[1]) : 1;
      const originalOwner = c.dpOriginalOwner || c.owner;
      const currentOwner = c.owner;
      return {
        round,
        slot: i + 1,
        pickLabel: `${round}.${String(i + 1).padStart(2, "0")}`,
        originalOwner,
        originalOwnerDivision: OWNER_DIVISION[originalOwner] || "",
        originalRosterId: i + 1,
        currentOwner,
        currentOwnerDivision: OWNER_DIVISION[currentOwner] || "",
        traded: currentOwner !== originalOwner,
        salary: c.salary,
        years: c.years,
      };
    });

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
