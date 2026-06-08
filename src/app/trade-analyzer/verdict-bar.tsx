"use client";

import { getDivisionColor } from "@/lib/ui-utils";
import type { VerdictResult } from "@/lib/trade-analyzer/engine";
import type { TradeTeam } from "@/lib/trade-analyzer/types";

export function VerdictBar({
  verdict,
  totalA,
  totalB,
  teamA,
  teamB,
}: {
  verdict: VerdictResult;
  totalA: number;
  totalB: number;
  teamA: TradeTeam | null;
  teamB: TradeTeam | null;
}) {
  const total = totalA + totalB;
  const pctA = total > 0 ? (totalA / total) * 100 : 50;
  const colorA = teamA ? getDivisionColor(teamA.division) : "#60a5fa";
  const colorB = teamB ? getDivisionColor(teamB.division) : "#fb923c";

  const headlineColor =
    verdict.kind === "fair" ? "#4ade80" : verdict.kind === "heavy" ? "#f87171" : verdict.kind === "slight" ? "#E8B84B" : "#9ca3af";

  return (
    <div className="bg-card border border-border rounded-[14px] p-5">
      <div className="text-center mb-3">
        <div className="font-heading text-2xl font-black tracking-[0.03em] uppercase" style={{ color: headlineColor }}>
          {verdict.headline}
        </div>
        {verdict.kind !== "empty" && (
          <div className="text-[12px] text-muted-foreground font-mono mt-1">
            differential {Math.abs(verdict.diff).toFixed(0)} pts · {(verdict.pct * 100).toFixed(1)}% imbalance
          </div>
        )}
      </div>

      <div className="relative h-3 rounded-full overflow-hidden bg-[#1a1a1a] flex">
        <div className="h-full transition-all" style={{ width: `${pctA}%`, background: colorA }} />
        <div className="h-full transition-all flex-1" style={{ background: colorB }} />
        <div className="absolute left-1/2 top-0 w-px h-full bg-white/30" />
      </div>

      <div className="flex items-center justify-between mt-2 text-[12px] font-mono">
        <span className="font-bold tabular-nums" style={{ color: colorA }}>
          {teamA ? teamA.owner : "Team A"} · {Math.round(totalA)}
        </span>
        <span className="font-bold tabular-nums" style={{ color: colorB }}>
          {Math.round(totalB)} · {teamB ? teamB.owner : "Team B"}
        </span>
      </div>
    </div>
  );
}
