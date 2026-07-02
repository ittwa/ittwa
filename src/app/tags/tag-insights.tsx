"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { getPositionColors } from "@/lib/ui-utils";
import type { TagInsights } from "@/types/tags";

// Fixed categorical order — matches the site's existing position badge colors
// everywhere else (contracts, cap hits, rosters). Never reassigned by rank.
const POSITION_ORDER = ["QB", "RB", "WR", "TE"];

const CHART_BAR_MAX_PX = 36;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-black tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </Card>
  );
}

function CalloutStatsRow({ callouts }: { callouts: TagInsights["callouts"] }) {
  const deadlineDate = new Date(callouts.nextDeadline);
  const deadlineLabel = deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard
        label="Largest Tag Ever"
        value={callouts.largestTag ? `$${callouts.largestTag.salary.toFixed(1)}` : "—"}
        sub={callouts.largestTag ? `${callouts.largestTag.player} · ${callouts.largestTag.season}` : "No tags yet"}
      />
      <StatCard
        label="Cheapest Tag Ever"
        value={callouts.cheapestTag ? `$${callouts.cheapestTag.salary.toFixed(1)}` : "—"}
        sub={callouts.cheapestTag ? `${callouts.cheapestTag.player} · ${callouts.cheapestTag.season}` : "No tags yet"}
      />
      <StatCard
        label="Most-Tagged Player"
        value={callouts.mostTaggedPlayer ? String(callouts.mostTaggedPlayer.count) : "—"}
        sub={callouts.mostTaggedPlayer ? `${callouts.mostTaggedPlayer.player} · franchise tags` : "No repeats yet"}
      />
      <StatCard
        label="Next Tag Deadline"
        value={callouts.daysUntilDeadline >= 0 ? `${callouts.daysUntilDeadline}d` : "Passed"}
        sub={deadlineLabel}
      />
    </div>
  );
}

// Small multiples: one compact strip per position, all on a shared $ scale, so
// bar heights are comparable across positions at a glance. Bars are hollow
// ticks where a position had no tag that season — sparse data stays honest
// rather than interpolating a misleading line through gaps.
function PositionOverTimeChart({ points }: { points: TagInsights["positionOverTime"] }) {
  const seasons = useMemo(() => [...new Set(points.map((p) => p.season))].sort(), [points]);
  const maxSalary = useMemo(() => Math.max(...points.map((p) => p.avgSalary), 1), [points]);
  const byKey = useMemo(() => {
    const m = new Map<string, { avgSalary: number; count: number }>();
    for (const p of points) m.set(`${p.season}|${p.position}`, p);
    return m;
  }, [points]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-1">No franchise tag history yet to chart.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        {POSITION_ORDER.map((pos) => {
          const pc = getPositionColors(pos);
          return (
            <div key={pos} className="flex items-center gap-3 py-1.5">
              <span
                className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded w-9 text-center shrink-0"
                style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
              >
                {pos}
              </span>
              <div className="flex items-center gap-1.5 flex-1">
                {seasons.map((season) => {
                  const point = byKey.get(`${season}|${pos}`);
                  // Fixed pixel height (not a %) — Tooltip's own wrapper renders
                  // inline-flex with no explicit height, so a percentage height
                  // nested inside it can't resolve against anything and collapses
                  // to ~0px. A pixel value sidesteps that entirely.
                  const heightPx = point ? Math.max(Math.round((point.avgSalary / maxSalary) * CHART_BAR_MAX_PX), 4) : 2;
                  return (
                    <Tooltip
                      key={season}
                      content={point ? `${pos} · ${season}: $${point.avgSalary.toFixed(1)} avg (${point.count} tag${point.count === 1 ? "" : "s"})` : `${pos} · ${season}: no tag`}
                    >
                      <div
                        className="flex-1 min-w-[10px] flex flex-col justify-end cursor-help"
                        style={{ height: CHART_BAR_MAX_PX }}
                      >
                        <div
                          className="w-full rounded-t-sm transition-opacity hover:opacity-80"
                          style={{ height: heightPx, background: point ? pc.text : "var(--border)" }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1">
          <span className="w-9 shrink-0" />
          <div className="flex gap-1.5 flex-1">
            {seasons.map((season) => (
              <span key={season} className="flex-1 text-center text-[10px] text-muted-foreground font-mono min-w-[10px]">
                {season.slice(2)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AvgByPositionChart({ data }: { data: TagInsights["avgFranchiseTagByPosition"] }) {
  const maxSalary = useMemo(() => Math.max(...data.map((d) => d.avgSalary), 1), [data]);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-1">No franchise tags yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => {
        const pc = getPositionColors(d.position);
        const pct = (d.avgSalary / maxSalary) * 100;
        return (
          <div key={d.position} className="flex items-center gap-3">
            <span
              className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded w-9 text-center shrink-0"
              style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
            >
              {d.position}
            </span>
            <div className="flex-1 h-5 rounded-sm bg-secondary overflow-hidden">
              <div className="h-full rounded-sm flex items-center justify-end px-2" style={{ width: `${Math.max(pct, 14)}%`, background: pc.text }}>
                <span className="text-[11px] font-mono font-bold text-[#0a0a0a]">${d.avgSalary.toFixed(1)}</span>
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono w-16 text-right shrink-0">{d.count} tag{d.count === 1 ? "" : "s"}</span>
          </div>
        );
      })}
    </div>
  );
}

function TagsByOwnerChart({ data }: { data: TagInsights["tagsByOwner"] }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.franchiseCount + d.fifthYearCount), 1), [data]);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-1">No tags recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => {
        const total = d.franchiseCount + d.fifthYearCount;
        const franchisePct = (d.franchiseCount / max) * 100;
        const fifthYearPct = (d.fifthYearCount / max) * 100;
        return (
          <div key={d.owner} className="flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground w-24 truncate shrink-0">{d.owner}</span>
            <div className="flex-1 h-4 rounded-sm bg-secondary overflow-hidden flex">
              {/* Sizing lives on these divs directly (not inside Tooltip) so the
                  width/height percentages resolve against this definite-size
                  track. Tooltip only wraps an absolutely-positioned, already-
                  sized overlay — its own inline-flex wrapper never has to size
                  anything, avoiding the same collapse bug fixed above. */}
              {d.franchiseCount > 0 && (
                <div className="h-full relative cursor-help" style={{ width: `${franchisePct}%`, background: "#FD4A48" }}>
                  <Tooltip content={`${d.owner}: ${d.franchiseCount} franchise tag${d.franchiseCount === 1 ? "" : "s"}`}>
                    <div className="absolute inset-0" />
                  </Tooltip>
                </div>
              )}
              {d.fifthYearCount > 0 && (
                <div className="h-full relative cursor-help" style={{ width: `${fifthYearPct}%`, background: "#E8B84B" }}>
                  <Tooltip content={`${d.owner}: ${d.fifthYearCount} 5th-year option${d.fifthYearCount === 1 ? "" : "s"}`}>
                    <div className="absolute inset-0" />
                  </Tooltip>
                </div>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono w-6 text-right shrink-0">{total}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-1.5 pl-[108px]">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#FD4A48" }} /> Franchise
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#E8B84B" }} /> 5th Year
        </span>
      </div>
    </div>
  );
}

function BasisBreakdown({ breakdown }: { breakdown: TagInsights["basisBreakdown"] }) {
  const total = breakdown.topN + breakdown.pct120 + breakdown.unknown;
  if (total === 0) {
    return <p className="text-sm text-muted-foreground italic px-1">No standalone franchise tags yet to compare.</p>;
  }
  const topNPct = (breakdown.topN / total) * 100;
  const pct120Pct = (breakdown.pct120 / total) * 100;
  const unknownPct = (breakdown.unknown / total) * 100;

  return (
    <div>
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <div className="font-heading text-2xl font-black tabular-nums" style={{ color: "#FD4A48" }}>{breakdown.topN}</div>
          <div className="text-[11px] text-muted-foreground">Top-5 Avg used</div>
        </div>
        <div className="flex-1">
          <div className="font-heading text-2xl font-black tabular-nums" style={{ color: "#E8B84B" }}>{breakdown.pct120}</div>
          <div className="text-[11px] text-muted-foreground">120% Rule used</div>
        </div>
        {breakdown.unknown > 0 && (
          <div className="flex-1">
            <div className="font-heading text-2xl font-black tabular-nums text-muted-foreground">{breakdown.unknown}</div>
            <div className="text-[11px] text-muted-foreground">Unclear</div>
          </div>
        )}
      </div>
      <div className="h-3 rounded-sm bg-secondary overflow-hidden flex">
        <div style={{ width: `${topNPct}%`, background: "#FD4A48" }} />
        <div style={{ width: `${pct120Pct}%`, background: "#E8B84B" }} />
        {unknownPct > 0 && <div style={{ width: `${unknownPct}%`, background: "var(--muted-foreground)", opacity: 0.4 }} />}
      </div>
    </div>
  );
}

const INSIGHT_TABS = [
  { key: "position", label: "By Position Over Time" },
  { key: "avg", label: "Avg Franchise Tag" },
  { key: "owner", label: "Tags By Owner" },
  { key: "basis", label: "Basis Breakdown" },
] as const;

export function TagInsightsSection({ insights }: { insights: TagInsights }) {
  const [tab, setTab] = useState<(typeof INSIGHT_TABS)[number]["key"]>("position");

  return (
    <div>
      <CalloutStatsRow callouts={insights.callouts} />

      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="flex flex-wrap gap-1.5 p-3 border-b border-border bg-secondary/50">
          {INSIGHT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                background: tab === t.key ? "rgba(232,184,75,0.1)" : "transparent",
                color: tab === t.key ? "#E8B84B" : "var(--muted-foreground)",
                border: `1px solid ${tab === t.key ? "rgba(232,184,75,0.3)" : "transparent"}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "position" && <PositionOverTimeChart points={insights.positionOverTime} />}
          {tab === "avg" && <AvgByPositionChart data={insights.avgFranchiseTagByPosition} />}
          {tab === "owner" && <TagsByOwnerChart data={insights.tagsByOwner} />}
          {tab === "basis" && <BasisBreakdown breakdown={insights.basisBreakdown} />}
        </div>
      </div>
    </div>
  );
}
