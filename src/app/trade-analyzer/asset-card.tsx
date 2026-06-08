"use client";

import { cn } from "@/lib/utils";
import type { AssetEvaluation } from "@/lib/trade-analyzer/engine";
import { AssetAvatar, PosBadge, ContractChip, DealBadge } from "./ui";

export function TradeAssetCard({
  evaluation,
  valueMode,
  onRemove,
}: {
  evaluation: AssetEvaluation;
  valueMode: "adjusted" | "raw";
  onRemove: () => void;
}) {
  const { asset, adjusted, badge } = evaluation;
  const isPick = asset.type === "pick";
  const delta = adjusted - asset.rawValue;
  const adjColor = delta > 1 ? "#4ade80" : delta < -1 ? "#f87171" : "#e5e7eb";
  const shown = valueMode === "adjusted" ? adjusted : asset.rawValue;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-secondary/60 border border-border hover:border-ittwa/30 transition-colors">
      <AssetAvatar name={asset.name} position={asset.position} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold truncate">{asset.name}</span>
          {badge && <DealBadge badge={badge} />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <PosBadge pos={asset.position} />
          <ContractChip salary={asset.salary} years={asset.years} isPick={isPick} />
          {!isPick && asset.nflTeam && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {asset.nflTeam}
              {asset.age != null && ` · ${asset.age}y`}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm font-bold tabular-nums" style={{ color: valueMode === "adjusted" ? adjColor : "#e5e7eb" }}>
          {Math.round(shown)}
        </div>
        {valueMode === "adjusted" && (
          <div className="font-mono text-[10px] text-muted-foreground tabular-nums">raw {Math.round(asset.rawValue)}</div>
        )}
      </div>
      <button
        onClick={onRemove}
        className={cn(
          "shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 transition-colors",
        )}
        aria-label="Remove"
      >
        ✕
      </button>
    </div>
  );
}
