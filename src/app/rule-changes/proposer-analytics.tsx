"use client";

import { useMemo } from "react";
import { ruleChanges, type RuleChange } from "@/lib/rule-changes";
import { SectionLabel } from "@/components/section-label";

// ─── Types ──────────────────────────────────────────────────────────────────

type ProposerStat = {
  name: string;
  total: number;
  passed: number;
  denied: number;
  pending: number;
  decided: number;
  passRate: number | null;
  seasons: Set<number>;
  recentCount: number;
};

type SeasonStat = {
  season: number;
  total: number;
  passed: number;
  denied: number;
  pending: number;
};

// ─── Colors ─────────────────────────────────────────────────────────────────

const EMERALD = "#4ade80";
const RED = "#FD4A48";
const AMBER = "#f59e0b";
const GOLD = "#E8B84B";
const MUTED = "#777";

// ─── Computation ────────────────────────────────────────────────────────────

function computeAnalytics(data: RuleChange[]) {
  const allSeasons = data.map((r) => r.season);
  const minYear = Math.min(...allSeasons);
  const maxYear = Math.max(...allSeasons);
  const cutoffYear = maxYear - 2;

  // Per-owner stats (split co-proposals, exclude "Everyone" and "—")
  const ownerMap = new Map<string, ProposerStat>();
  for (const r of data) {
    if (r.proposedBy === "—" || r.proposedBy === "Everyone") continue;
    const names = r.proposedBy.split(",").map((s) => s.trim());
    for (const name of names) {
      if (!ownerMap.has(name)) {
        ownerMap.set(name, { name, total: 0, passed: 0, denied: 0, pending: 0, decided: 0, passRate: null, seasons: new Set(), recentCount: 0 });
      }
      const o = ownerMap.get(name)!;
      o.total++;
      if (r.result === "Passed") { o.passed++; o.decided++; }
      else if (r.result === "Denied") { o.denied++; o.decided++; }
      else { o.pending++; }
      o.seasons.add(r.season);
      if (r.season >= cutoffYear) o.recentCount++;
    }
  }
  for (const o of ownerMap.values()) {
    o.passRate = o.decided > 0 ? Math.round((o.passed / o.decided) * 100) : null;
  }

  const owners = [...ownerMap.values()].sort((a, b) =>
    b.total - a.total || b.passed - a.passed || a.name.localeCompare(b.name),
  );

  // Per-season stats (full timeline including quiet years)
  const seasonMap = new Map<number, SeasonStat>();
  for (let y = minYear; y <= maxYear; y++) {
    seasonMap.set(y, { season: y, total: 0, passed: 0, denied: 0, pending: 0 });
  }
  for (const r of data) {
    const s = seasonMap.get(r.season)!;
    s.total++;
    if (r.result === "Passed") s.passed++;
    else if (r.result === "Denied") s.denied++;
    else s.pending++;
  }
  const seasons = [...seasonMap.values()].sort((a, b) => a.season - b.season);

  // KPI: league pass rate (excluding pending)
  const totalDecided = data.filter((r) => r.result !== "Pending").length;
  const totalPassed = data.filter((r) => r.result === "Passed").length;
  const totalDenied = data.filter((r) => r.result === "Denied").length;
  const leaguePassRate = totalDecided > 0 ? Math.round((totalPassed / totalDecided) * 100) : 0;

  // KPI: busiest season
  const busiest = seasons.reduce((a, b) => (b.total > a.total ? b : a), seasons[0]);

  // KPI: top closer (best pass rate among owners with ≥2 decided)
  const closerCandidates = owners.filter((o) => o.decided >= 2);
  closerCandidates.sort((a, b) => {
    const rateA = a.passRate ?? 0;
    const rateB = b.passRate ?? 0;
    return rateB - rateA || b.passed - a.passed;
  });
  const topCloser = closerCandidates[0] ?? null;

  // KPI: longest quiet stretch
  const activeSeasons = seasons.filter((s) => s.total > 0).map((s) => s.season).sort((a, b) => a - b);
  let longestGap = { gap: 0, from: 0, to: 0 };
  for (let i = 1; i < activeSeasons.length; i++) {
    const gap = activeSeasons[i] - activeSeasons[i - 1] - 1;
    if (gap > longestGap.gap) {
      longestGap = { gap, from: activeSeasons[i - 1], to: activeSeasons[i] };
    }
  }

  const uniqueOwners = ownerMap.size;

  return {
    minYear, maxYear, cutoffYear,
    owners, seasons, busiest,
    leaguePassRate, totalPassed, totalDecided, totalDenied,
    topCloser, longestGap, uniqueOwners,
    totalProposals: data.length,
  };
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="flex overflow-hidden bg-card border border-border rounded-xl">
      <div className="w-1 shrink-0" style={{ background: accent }} />
      <div className="flex-1 px-4 py-3.5">
        <div className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>{label}</div>
        <div className="font-heading text-[28px] font-extrabold leading-none mt-1" style={{ color: accent }}>{value}</div>
        <div className="text-[11px] mt-1.5" style={{ color: "#555" }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── Stacked Bar (Leaderboard) ──────────────────────────────────────────────

function StackedBar({ passed, denied, pending, maxTotal }: { passed: number; denied: number; pending: number; maxTotal: number }) {
  const total = passed + denied + pending;
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  return (
    <div className="flex items-center h-[22px] rounded-[4px] overflow-hidden" style={{ width: `${Math.max(pct, 12)}%`, minWidth: 40 }}>
      {passed > 0 && (
        <div className="h-full flex items-center justify-center text-[10px] font-bold text-black/80" style={{ background: EMERALD, width: `${(passed / total) * 100}%`, minWidth: 18 }}>
          {passed}
        </div>
      )}
      {denied > 0 && (
        <div className="h-full flex items-center justify-center text-[10px] font-bold text-white/90" style={{ background: RED, width: `${(denied / total) * 100}%`, minWidth: 18 }}>
          {denied}
        </div>
      )}
      {pending > 0 && (
        <div className="h-full flex items-center justify-center text-[10px] font-bold text-black/80" style={{ background: AMBER, width: `${(pending / total) * 100}%`, minWidth: 18 }}>
          {pending}
        </div>
      )}
    </div>
  );
}

// ─── Activity Chart ─────────────────────────────────────────────────────────

function ActivityChart({ seasons, minYear, maxYear }: { seasons: SeasonStat[]; minYear: number; maxYear: number }) {
  const maxTotal = Math.max(...seasons.map((s) => s.total), 1);

  // Busiest season insight
  const busiest = seasons.reduce((a, b) => (b.total > a.total ? b : a), seasons[0]);
  const busiestDeniedPct = busiest.total > 0 ? Math.round((busiest.denied / busiest.total) * 100) : 0;

  // Longest gap insight
  const activeSeasons = seasons.filter((s) => s.total > 0).map((s) => s.season).sort((a, b) => a - b);
  let longestGap = { gap: 0, from: 0, to: 0 };
  for (let i = 1; i < activeSeasons.length; i++) {
    const gap = activeSeasons[i] - activeSeasons[i - 1] - 1;
    if (gap > longestGap.gap) longestGap = { gap, from: activeSeasons[i - 1], to: activeSeasons[i] };
  }

  let footerText = `${busiest.season} was the league's most contentious offseason — ${busiest.total} proposals, ${busiestDeniedPct}% denied.`;
  if (longestGap.gap >= 2) {
    footerText += ` ${longestGap.from + 1}–${longestGap.to - 1} sat quiet (${longestGap.gap} seasons).`;
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <span className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">Activity By Season</span>
        <span className="font-code text-[11px]" style={{ color: MUTED }}>{minYear}–{maxYear}</span>
      </div>
      <div className="px-4 pb-3">
        <div className="flex items-end gap-[3px]" style={{ height: 140 }}>
          {seasons.map((s) => {
            const h = s.total > 0 ? Math.max((s.total / maxTotal) * 120, 4) : 2;
            const passedH = s.total > 0 ? (s.passed / s.total) * h : 0;
            const deniedH = s.total > 0 ? (s.denied / s.total) * h : 0;
            const pendingH = s.total > 0 ? (s.pending / s.total) * h : 0;
            return (
              <div key={s.season} className="flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }}>
                {s.total > 0 && (
                  <span className="font-code text-[9px] font-bold mb-0.5" style={{ color: MUTED }}>{s.total}</span>
                )}
                <div className="w-full flex flex-col-reverse rounded-t-[3px] overflow-hidden">
                  {s.total === 0 ? (
                    <div className="w-full rounded-[2px]" style={{ height: 2, background: "#333" }} />
                  ) : (
                    <>
                      {passedH > 0 && <div style={{ height: passedH, background: EMERALD }} />}
                      {deniedH > 0 && <div style={{ height: deniedH, background: RED }} />}
                      {pendingH > 0 && <div style={{ height: pendingH, background: AMBER }} />}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-[3px] mt-1.5">
          {seasons.map((s) => (
            <div key={s.season} className="flex-1 text-center font-code text-[9px]" style={{ color: "#555" }}>
              {`'${String(s.season).slice(2)}`}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 text-[11px] leading-relaxed" style={{ color: "#555", borderTop: "1px dashed var(--border)" }}>
        {footerText}
      </div>
    </div>
  );
}

// ─── Owner Leaderboard ──────────────────────────────────────────────────────

function OwnerLeaderboard({ owners, maxYear, cutoffYear }: { owners: ProposerStat[]; maxYear: number; cutoffYear: number }) {
  const maxTotal = Math.max(...owners.map((o) => o.total), 1);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
        <span className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">Owner Leaderboard</span>
        <div className="flex items-center gap-3">
          {([["Passed", EMERALD], ["Denied", RED], ["Pending", AMBER]] as const).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px]" style={{ color: MUTED }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid items-center px-4 py-2 border-y border-border" style={{ gridTemplateColumns: "minmax(80px, 1fr) minmax(100px, 2fr) 60px 70px" }}>
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>Owner</span>
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>Record</span>
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-right" style={{ color: MUTED }}>Pass %</span>
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-right" style={{ color: MUTED }}>Activity</span>
      </div>

      {/* Rows */}
      {owners.map((o) => {
        const isActive = o.recentCount > 0;
        return (
          <div
            key={o.name}
            className="grid items-center px-4 py-2.5 border-b border-border/50"
            style={{ gridTemplateColumns: "minmax(80px, 1fr) minmax(100px, 2fr) 60px 70px" }}
          >
            <div>
              <div className="text-[13px] font-semibold">{o.name}</div>
              <div className="font-code text-[10px]" style={{ color: "#555" }}>{o.total} prop{o.total !== 1 ? "s" : ""}</div>
            </div>
            <StackedBar passed={o.passed} denied={o.denied} pending={o.pending} maxTotal={maxTotal} />
            <div className="font-code text-[13px] font-bold text-right" style={{ color: o.passRate === null ? MUTED : o.passRate >= 50 ? EMERALD : RED }}>
              {o.passRate === null ? "—" : `${o.passRate}%`}
            </div>
            <div className="flex justify-end">
              {isActive ? (
                <span
                  className="inline-flex items-center rounded-[5px] px-2 py-0.5 text-[10px] font-bold tracking-wide"
                  style={{ background: "rgba(232,184,75,0.12)", color: GOLD, border: "1px solid rgba(232,184,75,0.25)" }}
                >
                  Active
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-[5px] px-2 py-0.5 text-[10px] font-bold tracking-wide"
                  style={{ background: "rgba(119,119,119,0.1)", color: MUTED, border: "1px solid rgba(119,119,119,0.2)" }}
                >
                  Dormant
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="px-4 py-3 text-[11px] leading-relaxed" style={{ color: "#555", borderTop: "1px dashed var(--border)" }}>
        Pass rate excludes pending proposals. &ldquo;Recent&rdquo; covers the last three seasons ({cutoffYear}–{maxYear}).
      </div>
    </div>
  );
}

// ─── Main Analytics Section ─────────────────────────────────────────────────

export function ProposerAnalytics() {
  const a = useMemo(() => computeAnalytics(ruleChanges), []);

  return (
    <div className="mb-8">
      {/* Section label */}
      <SectionLabel
        label="Proposer Analytics"
        count={`${a.uniqueOwners} owners · ${a.totalProposals} proposals · ${a.minYear}–${a.maxYear}`}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <KPICard
          label="League Pass Rate"
          value={`${a.leaguePassRate}%`}
          sub={`${a.totalPassed} passed of ${a.totalDecided} decided`}
          accent={a.leaguePassRate >= 50 ? EMERALD : RED}
        />
        <KPICard
          label="Busiest Season"
          value={String(a.busiest.season)}
          sub={`${a.busiest.total} proposals · ${a.busiest.passed}–${a.busiest.denied}`}
          accent={GOLD}
        />
        {a.topCloser && (
          <KPICard
            label="Top Closer"
            value={a.topCloser.name}
            sub={`${a.topCloser.passed}/${a.topCloser.decided} passed · ${a.topCloser.passRate}%`}
            accent={EMERALD}
          />
        )}
        <KPICard
          label="Longest Quiet Stretch"
          value={a.longestGap.gap > 0 ? `${a.longestGap.gap} yr${a.longestGap.gap !== 1 ? "s" : ""}` : "0 yrs"}
          sub={a.longestGap.gap > 0 ? `${a.longestGap.from} → ${a.longestGap.to}` : "No gaps"}
          accent={MUTED}
        />
      </div>

      {/* Two-column: leaderboard + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[57%_1fr] gap-2.5">
        <OwnerLeaderboard owners={a.owners} maxYear={a.maxYear} cutoffYear={a.cutoffYear} />
        <ActivityChart seasons={a.seasons} minYear={a.minYear} maxYear={a.maxYear} />
      </div>
    </div>
  );
}
