"use client";

import { useMemo } from "react";
import { ruleChanges, type RuleChange } from "@/lib/rule-changes";
import { SectionLabel } from "@/components/section-label";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";

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

  // Per-owner-per-season matrix
  const ownerSeasonMap = new Map<string, Map<number, { passed: number; denied: number; pending: number }>>();
  for (const r of data) {
    if (r.proposedBy === "—" || r.proposedBy === "Everyone") continue;
    const names = r.proposedBy.split(",").map((s) => s.trim());
    for (const name of names) {
      if (!ownerSeasonMap.has(name)) ownerSeasonMap.set(name, new Map());
      const sm = ownerSeasonMap.get(name)!;
      if (!sm.has(r.season)) sm.set(r.season, { passed: 0, denied: 0, pending: 0 });
      const cell = sm.get(r.season)!;
      if (r.result === "Passed") cell.passed++;
      else if (r.result === "Denied") cell.denied++;
      else cell.pending++;
    }
  }

  return {
    minYear, maxYear, cutoffYear,
    owners, seasons, busiest,
    leaguePassRate, totalPassed, totalDecided, totalDenied,
    topCloser, longestGap, uniqueOwners,
    totalProposals: data.length,
    ownerSeasonMap,
  };
}

// ─── Owner Avatar ───────────────────────────────────────────────────────────

function AnalyticsAvatar({ name, size = 20 }: { name: string; size?: number }) {
  const avatarId = useOwnerAvatar(name);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={<span className="font-heading font-bold text-[#60a5fa]" style={{ fontSize: size * 0.38 }}>{initials}</span>}
      />
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent, avatar }: { label: string; value: string; sub: string; accent: string; avatar?: string }) {
  return (
    <div className="flex overflow-hidden bg-card border border-border rounded-xl">
      <div className="w-1 shrink-0" style={{ background: accent }} />
      <div className="flex-1 px-4 py-3.5">
        <div className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>{label}</div>
        <div className="flex items-center gap-2 mt-1">
          {avatar && <AnalyticsAvatar name={avatar} size={28} />}
          <span className="font-heading text-[28px] font-extrabold leading-none" style={{ color: accent }}>{value}</span>
        </div>
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

function OwnerLeaderboard({ owners, maxYear, cutoffYear, selectedOwner, onOwnerClick }: { owners: ProposerStat[]; maxYear: number; cutoffYear: number; selectedOwner: string | null; onOwnerClick: (name: string) => void }) {
  const maxTotal = Math.max(...owners.map((o) => o.total), 1);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
        <span className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">Leaderboard</span>
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
        const isSelected = selectedOwner === o.name;
        return (
          <div
            key={o.name}
            onClick={() => onOwnerClick(o.name)}
            className="grid items-center px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors"
            style={{
              gridTemplateColumns: "minmax(80px, 1fr) minmax(100px, 2fr) 60px 70px",
              background: isSelected ? "rgba(232,184,75,0.08)" : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <AnalyticsAvatar name={o.name} size={22} />
              <div>
                <div className="text-[13px] font-semibold">{o.name}</div>
                <div className="font-code text-[10px]" style={{ color: "#555" }}>{o.total} prop{o.total !== 1 ? "s" : ""}</div>
              </div>
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

// ─── Owner × Season Matrix ──────────────────────────────────────────────────

function OwnerSeasonMatrix({ owners, seasons, ownerSeasonMap }: {
  owners: ProposerStat[];
  seasons: SeasonStat[];
  ownerSeasonMap: Map<string, Map<number, { passed: number; denied: number; pending: number }>>;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <span className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">Owner × Season</span>
        <div className="flex items-center gap-3">
          {([["P", EMERALD], ["D", RED], ["?", AMBER]] as const).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1 text-[9px] font-bold" style={{ color: MUTED }}>
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
              {label === "P" ? "Passed" : label === "D" ? "Denied" : "Pending"}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ minWidth: 480 }}>
          <thead>
            <tr className="border-y border-border">
              <th className="text-left text-[10px] font-bold tracking-[0.08em] uppercase px-4 py-2 sticky left-0 bg-card z-10" style={{ color: MUTED }}>Owner</th>
              {seasons.map((s) => (
                <th key={s.season} className="text-center font-code text-[10px] font-bold px-1.5 py-2" style={{ color: MUTED }}>
                  {`'${String(s.season).slice(2)}`}
                </th>
              ))}
              <th className="text-center text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-2" style={{ color: GOLD }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => {
              const sm = ownerSeasonMap.get(o.name);
              return (
                <tr key={o.name} className="border-b border-border/30">
                  <td className="px-4 py-1.5 sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-1.5">
                      <AnalyticsAvatar name={o.name} size={18} />
                      <span className="font-semibold text-[12px] whitespace-nowrap">{o.name}</span>
                    </div>
                  </td>
                  {seasons.map((s) => {
                    const cell = sm?.get(s.season);
                    if (!cell || (cell.passed + cell.denied + cell.pending) === 0) {
                      return <td key={s.season} className="text-center px-1.5 py-1.5"><span style={{ color: "#333" }}>·</span></td>;
                    }
                    return (
                      <td key={s.season} className="text-center px-1.5 py-1.5">
                        <div className="flex items-center justify-center gap-px">
                          {cell.passed > 0 && (
                            <span className="inline-flex items-center justify-center rounded-sm font-bold text-black/80" style={{ background: EMERALD, width: 16, height: 16, fontSize: 9 }}>
                              {cell.passed}
                            </span>
                          )}
                          {cell.denied > 0 && (
                            <span className="inline-flex items-center justify-center rounded-sm font-bold text-white/90" style={{ background: RED, width: 16, height: 16, fontSize: 9 }}>
                              {cell.denied}
                            </span>
                          )}
                          {cell.pending > 0 && (
                            <span className="inline-flex items-center justify-center rounded-sm font-bold text-black/80" style={{ background: AMBER, width: 16, height: 16, fontSize: 9 }}>
                              {cell.pending}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center px-3 py-1.5">
                    <span className="font-code font-bold text-[12px]">{o.total}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="px-4 py-2 sticky left-0 bg-card z-10">
                <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>Total</span>
              </td>
              {seasons.map((s) => (
                <td key={s.season} className="text-center px-1.5 py-2">
                  <span className="font-code font-bold text-[11px]" style={{ color: s.total > 0 ? "var(--foreground)" : "#333" }}>
                    {s.total || "·"}
                  </span>
                </td>
              ))}
              <td className="text-center px-3 py-2">
                <span className="font-code font-bold text-[12px]" style={{ color: GOLD }}>
                  {owners.reduce((sum, o) => sum + o.total, 0)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main Analytics Section ─────────────────────────────────────────────────

export function ProposerAnalytics({ selectedOwner, onOwnerClick }: { selectedOwner: string | null; onOwnerClick: (name: string) => void }) {
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
            avatar={a.topCloser.name}
          />
        )}
        <KPICard
          label="Longest Quiet Stretch"
          value={a.longestGap.gap > 0 ? `${a.longestGap.gap} yr${a.longestGap.gap !== 1 ? "s" : ""}` : "0 yrs"}
          sub={a.longestGap.gap > 0 ? `${a.longestGap.from} → ${a.longestGap.to}` : "No gaps"}
          accent={MUTED}
        />
      </div>

      {/* Two-column: leaderboard + chart + matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-[57%_1fr] gap-2.5">
        <OwnerLeaderboard owners={a.owners} maxYear={a.maxYear} cutoffYear={a.cutoffYear} selectedOwner={selectedOwner} onOwnerClick={onOwnerClick} />
        <div className="flex flex-col gap-2.5">
          <ActivityChart seasons={a.seasons} minYear={a.minYear} maxYear={a.maxYear} />
          <OwnerSeasonMatrix owners={a.owners} seasons={a.seasons} ownerSeasonMap={a.ownerSeasonMap} />
        </div>
      </div>
    </div>
  );
}
