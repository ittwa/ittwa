"use client";

import { getDivisionColor } from "@/lib/ui-utils";
import type { Strategy } from "@/lib/trade-analyzer/config";
import type { AssetEvaluation } from "@/lib/trade-analyzer/engine";
import type { TradeAsset, TradeTeam } from "@/lib/trade-analyzer/types";
import { StrategyToggle, TeamSelect, SearchBar } from "./ui";
import { TradeAssetCard } from "./asset-card";

export function TeamPanel({
  teams,
  selectedTeam,
  sourceTeam,
  onSelectTeam,
  disabledTeamId,
  ownerAvatars,
  strategy,
  onStrategyChange,
  evaluations,
  total,
  valueMode,
  excludeIds,
  valueOf,
  onAdd,
  onRemove,
}: {
  teams: TradeTeam[];
  selectedTeam: TradeTeam | null;
  sourceTeam: TradeTeam | null;
  onSelectTeam: (rosterId: number) => void;
  disabledTeamId: number | null;
  ownerAvatars: Record<string, string>;
  strategy: Strategy;
  onStrategyChange: (s: Strategy) => void;
  evaluations: AssetEvaluation[];
  total: number;
  valueMode: "adjusted" | "raw";
  excludeIds: Set<string>;
  valueOf: (a: TradeAsset) => number;
  onAdd: (a: TradeAsset) => void;
  onRemove: (id: string) => void;
}) {
  const accent = selectedTeam ? getDivisionColor(selectedTeam.division) : "#FD4A48";
  const incomingSalary = evaluations.reduce((s, e) => s + e.asset.salary, 0);
  const incomingYears = evaluations.reduce((s, e) => s + e.asset.years, 0);

  return (
    <div className="bg-card border border-border rounded-[14px] overflow-hidden flex flex-col" style={{ borderTopColor: accent, borderTopWidth: 2 }}>
      <div className="p-3 space-y-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TeamSelect
              teams={teams}
              value={selectedTeam?.rosterId ?? null}
              onChange={onSelectTeam}
              disabledTeamId={disabledTeamId}
              ownerAvatars={ownerAvatars}
            />
          </div>
          <StrategyToggle value={strategy} onChange={onStrategyChange} />
        </div>
        <SearchBar sourceTeam={sourceTeam} excludeIds={excludeIds} valueOf={valueOf} onAdd={onAdd} />
      </div>

      <div className="p-3 space-y-2 flex-1 min-h-[120px]">
        {evaluations.length === 0 ? (
          <div className="h-full flex items-center justify-center py-8 text-center text-[13px] text-muted-foreground italic">
            {selectedTeam ? `Add what ${selectedTeam.owner} receives` : "Select a team to start"}
          </div>
        ) : (
          evaluations.map((e) => (
            <TradeAssetCard key={e.asset.id} evaluation={e} valueMode={valueMode} onRemove={() => onRemove(e.asset.id)} />
          ))
        )}
      </div>

      <div className="px-4 py-3 border-t border-border bg-secondary flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-mono">
          {evaluations.length} asset{evaluations.length === 1 ? "" : "s"} · +${Math.round(incomingSalary)} · +{incomingYears}yr
        </span>
        <span className="font-mono text-base font-bold tabular-nums" style={{ color: accent }}>
          {Math.round(total)}
        </span>
      </div>
    </div>
  );
}
