"use client";

import { useState, useMemo, Fragment } from "react";
import { StandingsEntry } from "@/lib/standings";
import { DIVISIONS } from "@/lib/config";
import { getDivisionColor, getDivisionColorAlpha } from "@/lib/ui-utils";

const PLAYOFF_SPOTS = 4;

function DivisionBadge({ division }: { division: string }) {
  const color = getDivisionColor(division);
  return (
    <span
      className="inline-flex items-center rounded-[5px] px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap"
      style={{
        background: getDivisionColorAlpha(division, 0.1),
        color,
        border: `1px solid ${getDivisionColorAlpha(division, 0.25)}`,
      }}
    >
      {division}
    </span>
  );
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak || streak === "-") return <span className="text-muted-foreground text-xs">—</span>;
  const isWin = streak.startsWith("W");
  const color = isWin ? "#4ade80" : "#f87171";
  const bg = isWin ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)";
  const borderColor = isWin ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)";
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold px-[7px] py-0.5 rounded-[5px]"
      style={{ background: bg, color, border: `1px solid ${borderColor}` }}
    >
      {streak}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const configs: Record<number, { bg: string; border: string; color: string }> = {
    1: { bg: "rgba(232,184,75,0.18)", border: "rgba(232,184,75,0.4)", color: "#E8B84B" },
    2: { bg: "rgba(148,163,184,0.15)", border: "rgba(148,163,184,0.35)", color: "#94a3b8" },
    3: { bg: "rgba(251,146,60,0.15)", border: "rgba(251,146,60,0.35)", color: "#cd7c3a" },
  };
  const cfg = configs[rank];
  if (cfg) {
    return (
      <div
        className="w-[26px] h-[26px] rounded-[7px] shrink-0 flex items-center justify-center"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <span className="font-heading font-black text-sm" style={{ color: cfg.color }}>{rank}</span>
      </div>
    );
  }
  return (
    <div className="w-[26px] text-center">
      <span className="font-mono text-xs text-muted-foreground">{rank}</span>
    </div>
  );
}

function OwnerAvatar({ name, division }: { name: string; division: string }) {
  const color = getDivisionColor(division);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center"
      style={{
        background: getDivisionColorAlpha(division, 0.1),
        border: `1px solid ${getDivisionColorAlpha(division, 0.2)}`,
      }}
    >
      <span className="font-heading font-extrabold text-xs" style={{ color }}>{initials}</span>
    </div>
  );
}

function WinBar({ wins, total }: { wins: number; total: number }) {
  const pct = total > 0 ? wins / total : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs w-[38px]">{(pct * 100).toFixed(1)}%</span>
      <div className="flex-1 h-[3px] bg-[#1e1e1e] rounded-sm min-w-[48px]">
        <div className="h-full bg-ittwa rounded-sm transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function StatSummary({ standings }: { standings: StandingsEntry[] }) {
  const topScorer = [...standings].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  const topWins = standings[0];
  const hotStreak = [...standings]
    .filter(t => t.streak.startsWith("W"))
    .sort((a, b) => parseInt(b.streak.slice(1)) - parseInt(a.streak.slice(1)))[0];
  const tightest = [...standings]
    .sort((a, b) => Math.abs(a.pointsFor - a.pointsAgainst) - Math.abs(b.pointsFor - b.pointsAgainst))[0];

  const stats = [
    { label: "Points Leader", value: topScorer?.displayName || "—", sub: `${topScorer?.pointsFor.toFixed(1)} PF`, color: "#E8B84B" },
    { label: "Most Wins", value: topWins?.displayName || "—", sub: `${topWins?.wins}-${topWins?.losses} record`, color: "#4ade80" },
    { label: "Hot Streak", value: hotStreak?.displayName || "—", sub: hotStreak?.streak || "—", color: "#FD4A48" },
    { label: "Most Balanced", value: tightest?.displayName || "—", sub: `±${Math.abs((tightest?.pointsFor || 0) - (tightest?.pointsAgainst || 0)).toFixed(1)}`, color: "#60a5fa" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} className="bg-card border border-border rounded-[10px] px-4 py-3.5">
          <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground mb-1.5">{s.label}</div>
          <div className="font-heading text-[22px] font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

type SortKey = "wins" | "pf" | "pa";

// ─── Props ─────────────────────────────────────────────────────────────────
export interface StandingsClientProps {
  standings: StandingsEntry[];
  standingsByDivision: Record<string, StandingsEntry[]>;
  season: string;
  currentWeek: number;
}

// ─── Main client component ─────────────────────────────────────────────────
export function StandingsClient({
  standings,
  standingsByDivision,
  season,
  currentWeek,
}: StandingsClientProps) {
  const [activeTab, setActiveTab] = useState<"overall" | "division">("overall");
  const [sortCol, setSortCol] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState(-1);

  const sorted = useMemo(() => {
    return [...standings].sort((a, b) => {
      if (sortCol === "wins") return sortDir * (b.wins - a.wins || b.pointsFor - a.pointsFor);
      if (sortCol === "pf") return sortDir * (b.pointsFor - a.pointsFor);
      if (sortCol === "pa") return sortDir * (b.pointsAgainst - a.pointsAgainst);
      return 0;
    });
  }, [standings, sortCol, sortDir]);

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(-1); }
  }

  const thCls = "px-4 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground whitespace-nowrap";
  const divisionOrder = Object.keys(DIVISIONS);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-1 h-7 rounded-sm bg-gold shrink-0" />
            <h1 className="font-heading text-4xl font-black uppercase tracking-wide">Standings</h1>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-mono">{season} season</span>
            <span className="text-border">·</span>
            <span>Through week {currentWeek - 1}</span>
          </p>
        </div>
        <div
          className="px-3 py-1.5 rounded-md text-[11px] font-bold"
          style={{ background: "rgba(253,74,72,0.12)", color: "#FD4A48", border: "1px solid rgba(253,74,72,0.25)" }}
        >
          {standings.length} Teams
        </div>
      </div>

      {/* Stat summary */}
      <StatSummary standings={standings} />

      {/* Tab bar */}
      <div className="flex gap-1">
        {([["overall", "Overall"], ["division", "By Division"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="px-[18px] py-[7px] rounded-[7px] text-[13px] font-semibold transition-colors cursor-pointer"
            style={{
              background: activeTab === key ? "rgba(253,74,72,0.12)" : "transparent",
              color: activeTab === key ? "#FD4A48" : "#555",
              border: activeTab === key ? "1px solid rgba(253,74,72,0.3)" : "1px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overall tab ── */}
      {activeTab === "overall" && (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border bg-secondary">
            <span className="font-heading text-lg font-extrabold tracking-wide">League Standings</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thCls} w-[50px] text-center`}>#</th>
                  <th className={`${thCls} w-[6px] !p-0`}></th>
                  <th className={`${thCls} text-left pl-2`}>Owner</th>
                  <th className={`${thCls} text-left hidden md:table-cell`}>Division</th>
                  <th
                    className={`${thCls} text-center cursor-pointer select-none`}
                    style={{ color: sortCol === "wins" ? "#FD4A48" : undefined }}
                    onClick={() => handleSort("wins")}
                  >
                    W-L{sortCol === "wins" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                  </th>
                  <th className={`${thCls} text-left hidden sm:table-cell`} style={{ minWidth: 120 }}>Win%</th>
                  <th
                    className={`${thCls} text-right cursor-pointer select-none hidden sm:table-cell`}
                    style={{ color: sortCol === "pf" ? "#FD4A48" : undefined }}
                    onClick={() => handleSort("pf")}
                  >
                    PF{sortCol === "pf" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                  </th>
                  <th
                    className={`${thCls} text-right cursor-pointer select-none hidden sm:table-cell`}
                    style={{ color: sortCol === "pa" ? "#FD4A48" : undefined }}
                    onClick={() => handleSort("pa")}
                  >
                    PA{sortCol === "pa" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                  </th>
                  <th className={`${thCls} text-center hidden lg:table-cell`}>Div Rec</th>
                  <th className={`${thCls} text-center`}>Streak</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => {
                  const rank = i + 1;
                  const total = entry.wins + entry.losses;
                  const isPlayoff = rank <= PLAYOFF_SPOTS;
                  const isPlayoffLine = rank === PLAYOFF_SPOTS;
                  return (
                    <Fragment key={entry.rosterId}>
                      <tr className="border-b border-border/50 hover:bg-[#141414] transition-colors">
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center"><RankBadge rank={rank} /></div>
                        </td>
                        <td className="px-1 w-[6px]">
                          {isPlayoff && <div className="w-0.5 h-7 bg-ittwa rounded-sm opacity-70" />}
                        </td>
                        <td className="px-4 py-3 pl-2">
                          <div className="flex items-center gap-2.5">
                            <OwnerAvatar name={entry.displayName} division={entry.division} />
                            <div>
                              <div className="text-[13px] font-semibold">{entry.displayName}</div>
                              {isPlayoff && (
                                <div className="text-[10px] font-bold text-ittwa mt-0.5">Playoff Seed #{rank}</div>
                              )}
                              <div className="md:hidden mt-0.5">
                                <DivisionBadge division={entry.division} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <DivisionBadge division={entry.division} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-[13px] font-bold">
                            <span className="text-emerald-400">{entry.wins}</span>
                            <span className="text-muted-foreground">–</span>
                            <span className="text-red-400">{entry.losses}</span>
                            {entry.ties > 0 && <><span className="text-muted-foreground">–</span><span>{entry.ties}</span></>}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell" style={{ minWidth: 120 }}>
                          <WinBar wins={entry.wins} total={total} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold hidden sm:table-cell">
                          {entry.pointsFor.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                          {entry.pointsAgainst.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[11px] text-muted-foreground hidden lg:table-cell">
                          {entry.divisionRecord || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StreakBadge streak={entry.streak} />
                        </td>
                      </tr>
                      {isPlayoffLine && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <div className="mx-4 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(253,74,72,0.33), transparent)" }} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-border flex items-center gap-2">
            <div className="w-0.5 h-3 bg-ittwa rounded-sm" />
            <span className="text-[11px] text-muted-foreground">Top {PLAYOFF_SPOTS} teams qualify for playoffs</span>
          </div>
        </div>
      )}

      {/* ── By Division tab ── */}
      {activeTab === "division" && (
        <div className="space-y-4">
          {divisionOrder.map((divName) => {
            const divRows = standingsByDivision[divName] ?? [];
            if (divRows.length === 0) return null;
            const divColor = getDivisionColor(divName);
            return (
              <div key={divName} className="bg-secondary border border-border rounded-[10px] overflow-hidden">
                <div
                  className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border"
                  style={{ background: `linear-gradient(90deg, ${getDivisionColorAlpha(divName, 0.1)}, transparent)` }}
                >
                  <div className="w-[3px] h-4 rounded-sm" style={{ background: divColor }} />
                  <span className="font-heading font-extrabold text-base tracking-wide" style={{ color: divColor }}>
                    {divName.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{divRows.length} teams</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="border-b border-border">
                        <th className={`${thCls} text-center`}>#</th>
                        <th className={`${thCls} text-left pl-2`} style={{ paddingRight: 80 }}>Owner</th>
                        <th className={`${thCls} text-center`}>W-L</th>
                        <th className={`${thCls} text-left hidden sm:table-cell`} style={{ minWidth: 130 }}>Win%</th>
                        <th className={`${thCls} text-right hidden sm:table-cell`}>PF</th>
                        <th className={`${thCls} text-right hidden sm:table-cell`}>PA</th>
                        <th className={`${thCls} text-center hidden lg:table-cell`}>Div Rec</th>
                        <th className={`${thCls} text-center`}>Streak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divRows.map((entry) => {
                        const total = entry.wins + entry.losses;
                        return (
                          <tr key={entry.rosterId} className="border-b border-border/50 hover:bg-[#141414] transition-colors last:border-0">
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center"><RankBadge rank={entry.rank} /></div>
                            </td>
                            <td className="px-4 py-3 pl-2">
                              <div className="flex items-center gap-2.5">
                                <OwnerAvatar name={entry.displayName} division={entry.division} />
                                <span className="text-[13px] font-semibold">{entry.displayName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-[13px] font-bold">
                                <span className="text-emerald-400">{entry.wins}</span>
                                <span className="text-muted-foreground">–</span>
                                <span className="text-red-400">{entry.losses}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell" style={{ minWidth: 130 }}>
                              <WinBar wins={entry.wins} total={total} />
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold hidden sm:table-cell">
                              {entry.pointsFor.toFixed(1)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                              {entry.pointsAgainst.toFixed(1)}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-[11px] text-muted-foreground hidden lg:table-cell">
                              {entry.divisionRecord || "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StreakBadge streak={entry.streak} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
