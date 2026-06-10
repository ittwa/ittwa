"use client";

import Link from "next/link";
import { getDivisionColor } from "@/lib/ui-utils";
import type { VerdictResult } from "@/lib/trade-analyzer/engine";
import type { TradeTeam } from "@/lib/trade-analyzer/types";
import { OwnerAvatar } from "./ui";

// Two distinguishable colors for the bar when teams share a division.
const SAME_DIV_A = "#60a5fa";
const SAME_DIV_B = "#fb923c";

export function VerdictBar({
  verdict,
  totalA,
  totalB,
  teamA,
  teamB,
  ownerAvatars,
  fairPct,
  liabilityNotes = [],
}: {
  verdict: VerdictResult;
  totalA: number;
  totalB: number;
  teamA: TradeTeam | null;
  teamB: TradeTeam | null;
  ownerAvatars: Record<string, string>;
  fairPct: number;
  liabilityNotes?: string[];
}) {
  // Bar splits the POSITIVE value mass only: a side whose haul is net-negative
  // (cap liabilities) renders at 0 width — all visible value flows one way.
  const posA = Math.max(totalA, 0);
  const posB = Math.max(totalB, 0);
  const posTotal = posA + posB;
  const pctA = posTotal > 0 ? (posA / posTotal) * 100 : 50;
  const hasValue = Math.abs(totalA) + Math.abs(totalB) > 0;

  const sameDivision = teamA && teamB && teamA.division === teamB.division;
  const colorA = sameDivision ? SAME_DIV_A : (teamA ? getDivisionColor(teamA.division) : "#60a5fa");
  const colorB = sameDivision ? SAME_DIV_B : (teamB ? getDivisionColor(teamB.division) : "#fb923c");

  const headlineColor =
    verdict.kind === "fair" ? "#4ade80" : verdict.kind === "heavy" ? "#f87171" : verdict.kind === "slight" ? "#E8B84B" : "#9ca3af";

  const fairLeft = 50 - fairPct * 100;
  const fairRight = 50 + fairPct * 100;

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
        {hasValue && (
          <>
            <div className="absolute top-0 h-full w-px bg-emerald-400/40" style={{ left: `${fairLeft}%` }} />
            <div className="absolute top-0 h-full w-px bg-emerald-400/40" style={{ left: `${fairRight}%` }} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-[12px] font-mono">
        <span className="flex items-center gap-1.5 font-bold tabular-nums" style={{ color: colorA }}>
          {teamA && (
            <OwnerAvatar name={teamA.owner} avatarId={ownerAvatars[teamA.owner]} division={teamA.division} size={20} />
          )}
          <Link href={teamA ? `/teams/${encodeURIComponent(teamA.owner)}` : "#"} className="hover:underline underline-offset-2">
            {teamA ? teamA.owner : "Team A"}
          </Link>
          <span>
            {" · "}
            <span style={totalA < 0 ? { color: "#f87171" } : undefined}>{Math.round(totalA)}</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 font-bold tabular-nums" style={{ color: colorB }}>
          <span>
            <span style={totalB < 0 ? { color: "#f87171" } : undefined}>{Math.round(totalB)}</span>
            {" · "}
          </span>
          <Link href={teamB ? `/teams/${encodeURIComponent(teamB.owner)}` : "#"} className="hover:underline underline-offset-2">
            {teamB ? teamB.owner : "Team B"}
          </Link>
          {teamB && (
            <OwnerAvatar name={teamB.owner} avatarId={ownerAvatars[teamB.owner]} division={teamB.division} size={20} />
          )}
        </span>
      </div>

      {liabilityNotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border text-center space-y-0.5">
          {liabilityNotes.map((note) => (
            <p key={note} className="text-[11px] text-rose-300/90">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
