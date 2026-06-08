"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SALARY_CAP, YEARS_CAP } from "@/lib/config";
import { getDivisionColor } from "@/lib/ui-utils";
import type { TeamCapImpact } from "@/lib/trade-analyzer/engine";
import type { TradeTeam } from "@/lib/trade-analyzer/types";
import { OwnerAvatar } from "./ui";

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const color = value > 0 ? "#f87171" : value < 0 ? "#4ade80" : "#9ca3af";
  return (
    <span className="font-mono font-bold tabular-nums" style={{ color }}>
      {value > 0 ? "+" : ""}
      {value % 1 === 0 ? value : value.toFixed(1)}
      {suffix}
    </span>
  );
}

export function CapImpactCard({ impact, team, ownerAvatars }: { impact: TeamCapImpact; team: TradeTeam; ownerAvatars: Record<string, string> }) {
  const accent = getDivisionColor(team.division);
  return (
    <div className="bg-card border border-border rounded-[14px] p-4" style={{ borderTopColor: accent, borderTopWidth: 2 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 font-heading font-extrabold text-base tracking-wide">
          <OwnerAvatar name={team.owner} avatarId={ownerAvatars[team.owner]} division={team.division} size={22} />
          <Link href={`/teams/${encodeURIComponent(team.owner)}`} className="hover:underline underline-offset-2">
            {team.owner}
          </Link>
        </span>
        {(impact.overCap || impact.overYears) && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-400/15 text-rose-400 border border-rose-400/30">
            {impact.overCap && impact.overYears ? "OVER CAP & YEARS" : impact.overCap ? "OVER CAP" : "OVER YEARS"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Salary Δ</span>
          <Delta value={impact.salaryDelta} suffix="$" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Years Δ</span>
          <Delta value={impact.yearsDelta} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Cap space</span>
          <span className={cn("font-mono tabular-nums", impact.overCap ? "text-rose-400" : "text-foreground")}>
            ${Math.round(impact.capSpaceAfter)} <span className="text-[#555]">/ {SALARY_CAP}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Years space</span>
          <span className={cn("font-mono tabular-nums", impact.overYears ? "text-rose-400" : "text-foreground")}>
            {impact.yearsSpaceAfter} <span className="text-[#555]">/ {YEARS_CAP}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
