"use client";

import { useState, useMemo } from "react";
import { SleeperMatchup } from "@/types/sleeper";
import {
  HistoricalChampion,
  AllTimeStanding,
  HistoricalMilestone,
  GameRecordItem,
  SeasonRecordItem,
  SeasonSummary,
} from "@/lib/historical";
import { cn } from "@/lib/utils";

interface TeamRecord {
  rosterId: number;
  displayName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface RecordsClientProps {
  matchupsArray: [number, SleeperMatchup[]][];
  rosterOwnerMap: Record<number, string>;
  teamRecords: TeamRecord[];
  season: string;
  currentWeek: number;
  champions: HistoricalChampion[];
  allTimeStandings: AllTimeStanding[];
  milestones: HistoricalMilestone[];
  gameRecords: GameRecordItem[];
  seasonRecords: SeasonRecordItem[];
  seasonSummaries: Record<string, SeasonSummary>;
  availableSeasons: string[];
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function RCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-[10px] overflow-hidden",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

type SortKey = "owner" | "wins" | "losses" | "winPct" | "pf" | "rings" | "playoffs";

export function RecordsClient({
  matchupsArray,
  rosterOwnerMap,
  teamRecords,
  season,
  currentWeek,
  champions,
  allTimeStandings,
  milestones,
  gameRecords,
  seasonRecords,
  seasonSummaries,
  availableSeasons,
}: RecordsClientProps) {
  const [activeTab, setActiveTab] = useState("all-time");
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const showAllTime = activeTab === "all-time";
  const showCurrentSeason = activeTab === season;

  const yearTabs = useMemo(() => {
    const set = new Set(availableSeasons);
    if (!set.has(season)) set.add(season);
    return [...set].sort().reverse();
  }, [availableSeasons, season]);

  const ringCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of champions) map.set(c.champion, (map.get(c.champion) || 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [champions]);

  const ringLeaders = useMemo(() => {
    return [...allTimeStandings].sort((a, b) => b.rings - a.rings || b.playoffs - a.playoffs);
  }, [allTimeStandings]);

  const sortedAllTime = useMemo(() => {
    const copy = [...allTimeStandings];
    copy.sort((a, b) => {
      let cmp = 0;
      const wa = a.wins + a.losses, wb = b.wins + b.losses;
      switch (sortKey) {
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "wins": cmp = a.wins - b.wins; break;
        case "losses": cmp = a.losses - b.losses; break;
        case "winPct": cmp = (wa > 0 ? a.wins / wa : 0) - (wb > 0 ? b.wins / wb : 0); break;
        case "pf": cmp = a.pf - b.pf; break;
        case "rings": cmp = a.rings - b.rings; break;
        case "playoffs": cmp = a.playoffs - b.playoffs; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [allTimeStandings, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  // Current season data
  let highestScore = { name: "", points: 0, week: 0 };
  let lowestScore = { name: "", points: Infinity, week: 0 };
  for (const [week, matchups] of matchupsArray) {
    for (const m of matchups) {
      if (m.points <= 0) continue;
      const name = rosterOwnerMap[m.roster_id] || `Team ${m.roster_id}`;
      if (m.points > highestScore.points) highestScore = { name, points: m.points, week };
      if (m.points < lowestScore.points) lowestScore = { name, points: m.points, week };
    }
  }
  if (lowestScore.points === Infinity) lowestScore = { name: "N/A", points: 0, week: 0 };

  const sortedByPF = [...teamRecords].sort((a, b) => b.pointsFor - a.pointsFor);
  const sortedByWins = [...teamRecords].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  const sortedByLosses = [...teamRecords].sort((a, b) => b.losses - a.losses || a.pointsFor - b.pointsFor);
  const sortedByPA = [...teamRecords].sort((a, b) => b.pointsAgainst - a.pointsAgainst);
  const streaks = calculateStreaks(matchupsArray, rosterOwnerMap);

  const selectedChamp = !showAllTime && !showCurrentSeason
    ? champions.find((c) => c.year === activeTab)
    : null;
  const selectedSummary = !showAllTime ? seasonSummaries[activeTab] : null;

  const maxPlayoffs = Math.max(...allTimeStandings.map((s) => s.playoffs), 1);
  const maxRings = ringCounts[0]?.count || 1;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-gold rounded-sm" />
              <h1 className="font-heading text-4xl font-black uppercase tracking-wider">
                Records
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-4">
              {showAllTime
                ? `All-time records across ${champions.length} seasons · `
                : `${activeTab} season records · `}
              <span className="text-gold">
                {showAllTime ? `${allTimeStandings.length} owners` : `Week ${currentWeek}`}
              </span>
            </p>
          </div>
          {showAllTime && (
            <div className="flex gap-4">
              {[
                [String(champions.length), "Seasons"],
                [String(allTimeStandings.length), "Owners"],
                [String(maxRings), `${ringCounts[0]?.name} Rings`],
              ].map(([val, lbl]) => (
                <div key={lbl} className="text-right">
                  <div className="font-heading text-[28px] font-extrabold text-gold leading-none">
                    {val}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase mt-0.5">
                    {lbl}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Year Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setActiveTab("all-time")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all border",
            showAllTime
              ? "bg-gold/10 border-gold/40 text-gold font-bold"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          )}
        >
          All Time
        </button>
        {yearTabs.map((y) => (
          <button
            key={y}
            onClick={() => setActiveTab(y)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all border",
              activeTab === y
                ? "bg-gold/10 border-gold/40 text-gold font-bold"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-9">
        {showAllTime && (
          <>
            {/* Trophy Room */}
            <div>
              <SectionLabel label="Trophy Room" />
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { idx: 0, medal: "🥇", color: "text-gold", size: "text-7xl", bg: "rgba(232,184,75,0.07)", border: "rgba(232,184,75,0.25)" },
                  { idx: 1, medal: "🥈", color: "text-slate-400", size: "text-5xl", bg: undefined, border: undefined },
                  { idx: 2, medal: "🥉", color: "text-orange-400", size: "text-4xl", bg: undefined, border: undefined },
                ].map(({ idx, medal, color, size, bg, border }) => (
                  <RCard
                    key={idx}
                    className="py-5 px-4 text-center"
                    style={{
                      background: bg || undefined,
                      borderColor: border || undefined,
                    }}
                  >
                    <div className="text-3xl mb-2">{medal}</div>
                    <div className={cn("font-heading font-black leading-none", size, color)}>
                      {ringLeaders[idx]?.rings ?? 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">
                      Championship{ringLeaders[idx]?.rings !== 1 ? "s" : ""}
                    </div>
                    <div className="text-sm font-semibold mt-2">{ringLeaders[idx]?.owner}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ringLeaders[idx]?.playoffs} playoff appearances
                    </div>
                  </RCard>
                ))}
              </div>

              <RCard>
                <div
                  className="grid gap-0 px-4 py-2 border-b border-border bg-secondary"
                  style={{ gridTemplateColumns: "56px 1fr 1fr 1fr" }}
                >
                  {["Year", "Champion", "Runner-Up", "3rd Place"].map((h, i) => (
                    <span
                      key={h}
                      className={cn(
                        "text-[10px] font-bold tracking-widest uppercase text-muted-foreground",
                        i === 0 ? "text-center" : "text-left"
                      )}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {champions.map((row, i) => (
                  <div
                    key={row.year}
                    className="grid items-center gap-0 px-4 py-2.5 border-b border-border/50 last:border-0"
                    style={{
                      gridTemplateColumns: "56px 1fr 1fr 1fr",
                      background: i % 2 === 1 ? "rgba(22,22,22,0.3)" : undefined,
                    }}
                  >
                    <span className="font-mono text-[13px] font-bold text-gold text-center">{row.year}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🏆</span>
                      <span className="text-[13px] font-semibold">{row.champion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">🥈</span>
                      <span className="text-[13px] text-[#aaa]">{row.runnerUp}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">🥉</span>
                      <span className="text-[13px] text-muted-foreground">{row.third}</span>
                    </div>
                  </div>
                ))}
              </RCard>
            </div>
            {/* Game Records */}
            <div>
              <SectionLabel label="Game Records" />
              <div className="grid grid-cols-2 gap-3">
                {gameRecords.map((r) => (
                  <RCard key={r.label} className="p-5">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2.5">
                      {r.label}
                    </div>
                    <div
                      className="font-heading text-[42px] font-black leading-none"
                      style={{
                        color: r.colorType === "gold" ? "#E8B84B" : r.colorType === "red" ? "#FD4A48" : "#777",
                      }}
                    >
                      {r.value}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">{r.detail}</div>
                  </RCard>
                ))}
              </div>
            </div>
            {/* Season Records */}
            <div>
              <SectionLabel label="Season Records" />
              <div className="grid grid-cols-3 gap-3">
                {seasonRecords.map((r) => (
                  <RCard key={r.label} className="p-4">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                      {r.label}
                    </div>
                    <div
                      className="font-heading text-[30px] font-black leading-none"
                      style={{
                        color: r.colorType === "gold" ? "#E8B84B" : r.colorType === "red" ? "#FD4A48" : r.colorType === "emerald" ? "#4ade80" : "#777",
                      }}
                    >
                      {r.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2">{r.detail}</div>
                  </RCard>
                ))}
              </div>
            </div>
            {/* All-Time Standings */}
            <div>
              <SectionLabel label="All-Time Standings" />
              <RCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th className="px-3.5 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border bg-secondary">Owner</th>
                        {(["wins","losses","winPct","pf","rings","playoffs"] as SortKey[]).map((k) => {
                          const labels: Record<string, string> = { wins: "W", losses: "L", winPct: "Win%", pf: "PF", rings: "Rings", playoffs: "Playoffs" };
                          const aligns: Record<string, string> = { pf: "text-right", wins: "text-center", losses: "text-center", winPct: "text-center", rings: "text-center", playoffs: "text-center" };
                          const active = sortKey === k;
                          return (
                            <th
                              key={k}
                              onClick={() => onSort(k)}
                              className={cn("px-3.5 py-2.5 text-[10px] font-bold tracking-widest uppercase cursor-pointer select-none border-b border-border bg-secondary whitespace-nowrap", active ? "text-gold" : "text-muted-foreground", aligns[k])}
                            >
                              {labels[k]}{active && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAllTime.map((t, i) => {
                        const total = t.wins + t.losses;
                        const pct = total > 0 ? (t.wins / total * 100).toFixed(1) : "0.0";
                        return (
                          <tr
                            key={t.owner}
                            style={{ background: i === 0 ? "rgba(232,184,75,0.04)" : i % 2 === 1 ? "rgba(22,22,22,0.3)" : undefined }}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="px-3.5 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="text-[11px] text-muted-foreground font-mono min-w-[16px]">{i + 1}</span>
                                <span className={cn("text-[13px]", i === 0 ? "font-semibold" : "")}>{t.owner}</span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px] text-emerald-400 font-semibold">{t.wins}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px] text-red-400">{t.losses}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px]">{pct}%</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-muted-foreground">{t.pf.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td className="px-3.5 py-2.5 text-center">
                              {t.rings > 0 ? (
                                <span className="font-heading text-lg font-extrabold text-gold">{"🏆".repeat(t.rings)}</span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <span className="font-mono text-[13px]">{t.playoffs}</span>
                                <div className="w-10 h-1 rounded-sm" style={{ background: "#222" }}>
                                  <div className="h-full rounded-sm bg-gold" style={{ width: `${(t.playoffs / maxPlayoffs) * 100}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </RCard>
            </div>
            {/* Notable Milestones */}
            <div>
              <SectionLabel label="Notable Milestones" />
              <div className="grid grid-cols-3 gap-3">
                {milestones.map((m) => (
                  <RCard key={m.label} className="p-4">
                    <div className="text-[22px] mb-2">{m.icon}</div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
                      {m.label}
                    </div>
                    <div className="font-heading text-[28px] font-black leading-none">
                      {m.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                      {m.detail}
                    </div>
                  </RCard>
                ))}
              </div>
            </div>
            {/* TODO: ChampionshipCount */}
          </>
        )}

        {showCurrentSeason && (
          <>
            {/* TODO: CurrentSeasonView */}
          </>
        )}

        {!showAllTime && !showCurrentSeason && (
          <>
            {/* TODO: PastSeasonView */}
          </>
        )}
      </div>
    </div>
  );
}

function calculateStreaks(
  matchupsArray: [number, SleeperMatchup[]][],
  rosterOwnerMap: Record<number, string>
) {
  const sorted = [...matchupsArray].sort(([a], [b]) => a - b);
  const streaksByRoster = new Map<number, { current: number; type: "W" | "L"; best: { w: number; l: number } }>();

  for (const [, matchups] of sorted) {
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of matchups) {
      const arr = byMatchup.get(m.matchup_id) || [];
      arr.push(m);
      byMatchup.set(m.matchup_id, arr);
    }
    for (const [, pair] of byMatchup) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      if (a.points <= 0 && b.points <= 0) continue;
      for (const [me, opp] of [[a, b], [b, a]] as [SleeperMatchup, SleeperMatchup][]) {
        const s = streaksByRoster.get(me.roster_id) || { current: 0, type: "W" as const, best: { w: 0, l: 0 } };
        const won = me.points > opp.points;
        const type = won ? "W" as const : "L" as const;
        if (type === s.type) s.current++;
        else { s.current = 1; s.type = type; }
        if (type === "W" && s.current > s.best.w) s.best.w = s.current;
        if (type === "L" && s.current > s.best.l) s.best.l = s.current;
        streaksByRoster.set(me.roster_id, s);
      }
    }
  }

  let longestWin = { name: "N/A", count: 0 };
  let longestLoss = { name: "N/A", count: 0 };
  for (const [rosterId, s] of streaksByRoster) {
    const name = rosterOwnerMap[rosterId] || `Team ${rosterId}`;
    if (s.best.w > longestWin.count) longestWin = { name, count: s.best.w };
    if (s.best.l > longestLoss.count) longestLoss = { name, count: s.best.l };
  }
  return { longestWin, longestLoss };
}
