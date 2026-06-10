import type { SleeperDraft, SleeperDraftPick } from "@/types/sleeper";
import type { EnrichedTrade, TradeGrade, SideGrade, AssetGrade, GradeVerdict, GradeConfidence } from "@/components/trade-card";
import { DEFAULT_CONFIG, type TradeAnalyzerConfig } from "@/lib/trade-analyzer/config";

export type { TradeGrade, SideGrade, AssetGrade, GradeVerdict, GradeConfidence };

// Resolved pick info keyed by "${season}-${round}-${originalRosterId}".
// originalRosterId = the roster that owned the slot from day 1 of the season
// (matches SleeperDraft.slot_to_roster_id and SleeperTradePick.roster_id).
export type ResolvedPickMap = Map<string, { playerId: string; name: string; pos: string }>;

// Build the resolved-pick map from completed drafts. For each draft pick, the
// original owner is derived from slot_to_roster_id[draft_slot], which is
// stable regardless of how many times the pick was subsequently traded.
export function buildResolvedPickMap(
  drafts: SleeperDraft[],
  draftPicksByDraftId: Map<string, SleeperDraftPick[]>,
): ResolvedPickMap {
  const map: ResolvedPickMap = new Map();

  for (const draft of drafts) {
    if (draft.status !== "complete") continue;
    if (!draft.slot_to_roster_id) continue;

    const picks = draftPicksByDraftId.get(draft.draft_id);
    if (!picks?.length) continue;

    for (const pick of picks) {
      if (!pick.player_id || !pick.metadata) continue;
      const originalRosterId = draft.slot_to_roster_id[String(pick.draft_slot)];
      if (originalRosterId == null) continue;

      const key = `${draft.season}-${pick.round}-${originalRosterId}`;
      if (!map.has(key)) {
        map.set(key, {
          playerId: pick.player_id,
          name: `${pick.metadata.first_name} ${pick.metadata.last_name}`.trim(),
          pos: pick.metadata.position || "—",
        });
      }
    }
  }

  return map;
}

function verdictFromPct(pct: number, config: TradeAnalyzerConfig): GradeVerdict {
  if (pct <= config.GRADE_EVEN_PCT) return "even";
  if (pct <= config.GRADE_EDGE_PCT) return "edge";
  if (pct <= config.GRADE_WIN_PCT) return "win";
  return "heist";
}

export function gradeTrade(
  trade: EnrichedTrade,
  valueByPlayerId: Map<string, number>,
  resolvedPickMap: ResolvedPickMap,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
): TradeGrade | null {
  if (trade.sides.length < 2) return null;

  const sideGrades: SideGrade[] = trade.sides.map((side) => {
    const assetGrades: AssetGrade[] = side.received.map((item): AssetGrade => {
      if (item.type === "player") {
        return { currentValue: valueByPlayerId.get(item.sleeperId) ?? null };
      }

      // Pick: try to resolve using originalRosterId → completed draft
      if (item.originalRosterId != null) {
        const key = `${item.pickSeason}-${item.round}-${item.originalRosterId}`;
        const resolved = resolvedPickMap.get(key);
        if (resolved) {
          return {
            currentValue: valueByPlayerId.get(resolved.playerId) ?? null,
            resolvedPlayerId: resolved.playerId,
            resolvedPlayerName: resolved.name,
            resolvedPlayerPos: resolved.pos,
          };
        }
      }

      return { currentValue: null };
    });

    const resolvedCount = assetGrades.filter((g) => g.currentValue !== null).length;
    const totalValue = assetGrades.reduce((sum, g) => sum + (g.currentValue ?? 0), 0);

    return { assetGrades, resolvedCount, totalValue };
  });

  const totalAssets = trade.sides.reduce((sum, s) => sum + s.received.length, 0);
  const resolvedAssets = sideGrades.reduce((sum, sg) => sum + sg.resolvedCount, 0);
  const resolvedFraction = totalAssets > 0 ? resolvedAssets / totalAssets : 0;

  const confidence: GradeConfidence =
    resolvedFraction >= config.GRADE_HIGH_CONF ? "high" :
    resolvedFraction >= config.GRADE_MED_CONF ? "medium" : "low";

  const valA = sideGrades[0].totalValue;
  const valB = sideGrades[1].totalValue;
  const diff = valA - valB;
  const scale = Math.abs(valA) + Math.abs(valB);
  const pct = scale > 0 ? Math.abs(diff) / scale : 0;

  const verdict = verdictFromPct(pct, config);
  const favoredSideIndex = verdict === "even" ? null : diff > 0 ? 0 : 1;

  return {
    sides: sideGrades,
    verdict,
    favoredSideIndex,
    confidence,
    diff: Math.round(diff),
    pct,
  };
}
