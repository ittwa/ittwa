export const dynamic = 'force-dynamic';

import { getDrafts, buildRosterOwnerMap } from "@/lib/data";
import { getDraftPicks } from "@/lib/sleeper";
import { DraftsClient } from "./drafts-client";
import { ROOKIE_PICK_CONTRACTS } from "@/lib/config";

export const revalidate = 3600;

export default async function DraftsPage() {
  const [drafts, rosterOwnerMap] = await Promise.all([getDrafts(), buildRosterOwnerMap()]);

  // Sort drafts by season descending
  const sortedDrafts = drafts.sort((a, b) => b.season.localeCompare(a.season));

  // Fetch picks for all drafts
  const draftsWithPicks = await Promise.all(
    sortedDrafts.map(async (draft) => {
      try {
        const picks = await getDraftPicks(draft.draft_id);
        return {
          draftId: draft.draft_id,
          season: draft.season,
          type: draft.type,
          status: draft.status,
          rounds: draft.settings?.rounds || 2,
          picks: picks.map((p) => {
            // Format pick slot for contract lookup: "round.XX" where XX is 1-indexed within round
            const pickInRound = ((p.pick_no - 1) % 12) + 1;
            const pickKey = `${p.round}.${pickInRound.toString().padStart(2, "0")}`;
            const contractInfo = ROOKIE_PICK_CONTRACTS[pickKey];

            return {
              pickNo: p.pick_no,
              round: p.round,
              rosterId: p.roster_id,
              playerId: p.player_id,
              playerName: `${p.metadata?.first_name || ""} ${p.metadata?.last_name || ""}`.trim(),
              position: p.metadata?.position || "",
              team: p.metadata?.team || "",
              ownerName: rosterOwnerMap[p.roster_id] || `Team ${p.roster_id}`,
              contractYears: contractInfo?.years || 0,
              contractSalary: contractInfo?.salary || 0,
            };
          }),
        };
      } catch {
        return {
          draftId: draft.draft_id,
          season: draft.season,
          type: draft.type,
          status: draft.status,
          rounds: draft.settings?.rounds || 2,
          picks: [],
        };
      }
    })
  );

  return <DraftsClient drafts={draftsWithPicks} />;
}
