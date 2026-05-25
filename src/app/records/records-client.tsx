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
import { OwnerAvatarsProvider, SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";
import { SectionLabel } from "@/components/section-label";

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
  ownerAvatars: Record<string, string>;
  ownerFinancials: {
    owner: string;
    seasons: number;
    totalDues: number;
    totalWinnings: number;
    net: number;
    roi: number;
  }[];
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

function OwnerAvatar({ name, size = 24 }: { name: string; size?: number }) {
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

type SortKey = "owner" | "wins" | "losses" | "winPct" | "pf" | "rings" | "playoffs";
type HardwareSortKey = "owner" | "golds" | "silvers" | "bronzes" | "total";
type PayoutSortKey = "owner" | "seasons" | "dues" | "winnings" | "net" | "roi";

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
  ownerAvatars,
  ownerFinancials,
}: RecordsClientProps) {
  const [activeTab, setActiveTab] = useState("all-time");
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hwSortKey, setHwSortKey] = useState<HardwareSortKey>("total");
  const [hwSortDir, setHwSortDir] = useState<"asc" | "desc">("desc");
  const [payoutSortKey, setPayoutSortKey] = useState<PayoutSortKey>("net");
  const [payoutSortDir, setPayoutSortDir] = useState<"asc" | "desc">("desc");

  const showAllTime = activeTab === "all-time";
  const showCurrentSeason = activeTab === season;

  const yearTabs = useMemo(() => {
    const set = new Set(availableSeasons);
    if (!set.has(season)) set.add(season);
    return [...set].sort().reverse();
  }, [availableSeasons, season]);

  const ringLeaders = useMemo(() => {
    return [...allTimeStandings].sort((a, b) => b.rings - a.rings || b.playoffs - a.playoffs);
  }, [allTimeStandings]);

  const hardwareData = useMemo(() => {
    const map = new Map<string, { golds: string[]; silvers: string[]; bronzes: string[] }>();
    for (const c of champions) {
      for (const [name, key] of [
        [c.champion, "golds"], [c.runnerUp, "silvers"], [c.third, "bronzes"],
      ] as [string, "golds" | "silvers" | "bronzes"][]) {
        if (!name || name === "—") continue;
        if (!map.has(name)) map.set(name, { golds: [], silvers: [], bronzes: [] });
        map.get(name)![key].push(c.year);
      }
    }
    const rows = [...map.entries()].map(([name, hw]) => ({
      name,
      golds: hw.golds,
      silvers: hw.silvers,
      bronzes: hw.bronzes,
      total: hw.golds.length + hw.silvers.length + hw.bronzes.length,
    }));
    rows.sort((a, b) => {
      let cmp = 0;
      switch (hwSortKey) {
        case "owner": cmp = a.name.localeCompare(b.name); break;
        case "golds": cmp = a.golds.length - b.golds.length; break;
        case "silvers": cmp = a.silvers.length - b.silvers.length; break;
        case "bronzes": cmp = a.bronzes.length - b.bronzes.length; break;
        case "total": cmp = a.total - b.total; break;
      }
      if (cmp === 0) cmp = b.total - a.total;
      return hwSortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [champions, hwSortKey, hwSortDir]);

  function onHwSort(k: HardwareSortKey) {
    if (hwSortKey === k) setHwSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setHwSortKey(k); setHwSortDir("desc"); }
  }

  const payoutData = useMemo(() => {
    const rows = ownerFinancials.map(f => ({ ...f }));

    rows.sort((a, b) => {
      let cmp: number;
      switch (payoutSortKey) {
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "seasons": cmp = a.seasons - b.seasons; break;
        case "dues": cmp = a.totalDues - b.totalDues; break;
        case "winnings": cmp = a.totalWinnings - b.totalWinnings; break;
        case "net": cmp = a.net - b.net; break;
        case "roi": cmp = a.roi - b.roi; break;
        default: cmp = 0;
      }
      if (cmp === 0) cmp = b.net - a.net;
      return payoutSortDir === "asc" ? cmp : -cmp;
    });

    const totals = rows.reduce((acc, r) => ({
      dues: acc.dues + r.totalDues,
      winnings: acc.winnings + r.totalWinnings,
      net: acc.net + r.net,
    }), { dues: 0, winnings: 0, net: 0 });

    const maxAbsNet = Math.max(...rows.map(r => Math.abs(r.net)), 1);

    return { rows, totals, maxAbsNet };
  }, [ownerFinancials, payoutSortKey, payoutSortDir]);

  function onPayoutSort(k: PayoutSortKey) {
    if (payoutSortKey === k) setPayoutSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPayoutSortKey(k); setPayoutSortDir(k === "owner" ? "asc" : "desc"); }
  }

  const fmtMoney = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US");

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

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
    <div>
      {/* Page Header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black uppercase tracking-[0.04em]">
                Records
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground ml-4">
              {showAllTime
                ? `All-time records across ${champions.length} seasons · `
                : `${activeTab} season records · `}
              <span className="text-gold">
                {showAllTime ? `${allTimeStandings.length} owners` : currentWeek <= 1 ? "Preseason" : `Week ${currentWeek}`}
              </span>
            </p>
          </div>
          {showAllTime && (
            <div className="flex gap-4">
              {[
                [String(champions.length), "Seasons"],
                [String(allTimeStandings.length), "Owners"],
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
                    <div className="text-sm font-semibold mt-2">{ringLeaders[idx]?.owner ? <OwnerLink name={ringLeaders[idx].owner} className="hover:underline underline-offset-2">{ringLeaders[idx].owner}</OwnerLink> : "—"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ringLeaders[idx]?.playoffs} playoff appearances
                    </div>
                  </RCard>
                ))}
              </div>

              <RCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 520 }}>
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
                          background: i % 2 === 1 ? "var(--secondary)" : undefined,
                        }}
                      >
                        <span className="font-mono text-[13px] font-bold text-gold text-center">{row.year}</span>
                        <OwnerLink name={row.champion} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                          <span className="text-sm">🏆</span>
                          <OwnerAvatar name={row.champion} size={20} />
                          <span className="text-[13px] font-semibold">{row.champion}</span>
                        </OwnerLink>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🥈</span>
                          {row.runnerUp && row.runnerUp !== "—" ? <OwnerLink name={row.runnerUp} className="text-[13px] text-[#aaa] hover:underline underline-offset-2">{row.runnerUp}</OwnerLink> : <span className="text-[13px] text-[#aaa]">—</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🥉</span>
                          {row.third && row.third !== "—" ? <OwnerLink name={row.third} className="text-[13px] text-muted-foreground hover:underline underline-offset-2">{row.third}</OwnerLink> : <span className="text-[13px] text-muted-foreground">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                            style={{ background: i === 0 ? "rgba(232,184,75,0.04)" : i % 2 === 1 ? "var(--secondary)" : undefined }}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="px-3.5 py-2.5">
                              <OwnerLink name={t.owner} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                                <span className="text-[11px] text-muted-foreground font-mono min-w-[16px]">{i + 1}</span>
                                <OwnerAvatar name={t.owner} />
                                <span className={cn("text-[13px]", i === 0 ? "font-semibold" : "")}>{t.owner}</span>
                              </OwnerLink>
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
            <div>
              <SectionLabel label="Hardware" />
              <RCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th
                          onClick={() => onHwSort("owner")}
                          className={cn(
                            "px-3.5 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase cursor-pointer select-none border-b border-border bg-secondary whitespace-nowrap",
                            hwSortKey === "owner" ? "text-gold" : "text-muted-foreground"
                          )}
                        >
                          Owner{hwSortKey === "owner" && <span className="ml-1">{hwSortDir === "asc" ? "↑" : "↓"}</span>}
                        </th>
                        {([["golds", "🏆"], ["silvers", "🥈"], ["bronzes", "🥉"], ["total", "Total"]] as [HardwareSortKey, string][]).map(([k, label]) => (
                          <th
                            key={k}
                            onClick={() => onHwSort(k)}
                            className={cn(
                              "px-3.5 py-2.5 text-center text-[10px] font-bold tracking-widest uppercase cursor-pointer select-none border-b border-border bg-secondary whitespace-nowrap",
                              hwSortKey === k ? "text-gold" : "text-muted-foreground"
                            )}
                          >
                            {label}{hwSortKey === k && <span className="ml-1">{hwSortDir === "asc" ? "↑" : "↓"}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hardwareData.filter((r) => r.total > 0).map((row, i) => (
                        <tr
                          key={row.name}
                          className="border-b border-border/50 last:border-0"
                          style={{ background: i === 0 ? "rgba(232,184,75,0.04)" : i % 2 === 1 ? "var(--secondary)" : undefined }}
                        >
                          <td className="px-3.5 py-2.5">
                            <OwnerLink name={row.name} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                              <span className="text-[11px] text-muted-foreground font-mono min-w-[16px]">{i + 1}</span>
                              <OwnerAvatar name={row.name} />
                              <span className={cn("text-[13px]", i === 0 ? "font-semibold" : "")}>{row.name}</span>
                            </OwnerLink>
                          </td>
                          <td className="px-3.5 py-2.5 text-center align-top">
                            {row.golds.length > 0 ? (
                              <div>
                                <span className="font-heading text-lg font-extrabold text-gold">{row.golds.length}</span>
                                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                                  {row.golds.map((y) => `'${y.slice(2)}`).join(", ")}
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-3.5 py-2.5 text-center align-top">
                            {row.silvers.length > 0 ? (
                              <div>
                                <span className="font-heading text-lg font-extrabold text-slate-400">{row.silvers.length}</span>
                                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                                  {row.silvers.map((y) => `'${y.slice(2)}`).join(", ")}
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-3.5 py-2.5 text-center align-top">
                            {row.bronzes.length > 0 ? (
                              <div>
                                <span className="font-heading text-lg font-extrabold text-orange-400">{row.bronzes.length}</span>
                                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                                  {row.bronzes.map((y) => `'${y.slice(2)}`).join(", ")}
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <span className="font-heading text-[22px] font-extrabold text-gold">{row.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </RCard>
            </div>
            {/* Finances */}
            <div>
              <SectionLabel label="Finances" />
              <RCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {([["owner", "Owner", "text-left"], ["seasons", "Yrs", "text-center"], ["dues", "Dues", "text-right"], ["winnings", "Winnings", "text-right"], ["net", "Net", "text-right"], ["roi", "ROI", "text-right"]] as [PayoutSortKey, string, string][]).map(([k, label, align]) => (
                          <th
                            key={k}
                            onClick={() => onPayoutSort(k)}
                            className={cn(
                              "px-3.5 py-2.5 text-[10px] font-bold tracking-widest uppercase cursor-pointer select-none border-b border-border bg-secondary whitespace-nowrap",
                              payoutSortKey === k ? "text-gold" : "text-muted-foreground",
                              align
                            )}
                          >
                            {label}{payoutSortKey === k && <span className="ml-1">{payoutSortDir === "asc" ? "↑" : "↓"}</span>}
                          </th>
                        ))}
                        <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border bg-secondary whitespace-nowrap text-center">
                          P/L
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutData.rows.map((r, i) => {
                        const positive = r.net > 0;
                        const netColor = r.net > 0 ? "#4ade80" : r.net < 0 ? "#FD4A48" : undefined;
                        const widthPct = (Math.abs(r.net) / payoutData.maxAbsNet) * 50;
                        return (
                          <tr
                            key={r.owner}
                            className="border-b border-border/50 last:border-0"
                            style={{ background: i % 2 === 1 ? "var(--secondary)" : undefined }}
                          >
                            <td className="px-3.5 py-2.5">
                              <OwnerLink name={r.owner} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                                <span className="text-[11px] text-muted-foreground font-mono min-w-[16px]">{i + 1}</span>
                                <OwnerAvatar name={r.owner} />
                                <span className={cn("text-[13px]", positive ? "font-semibold" : "")}>{r.owner}</span>
                              </OwnerLink>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px] text-muted-foreground">
                              {r.seasons}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-muted-foreground">
                              ${r.totalDues.toLocaleString("en-US")}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[13px]">
                              ${r.totalWinnings.toLocaleString("en-US")}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-sm font-bold" style={{ color: netColor }}>
                              {fmtMoney(r.net)}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[13px]" style={{ color: netColor }}>
                              {r.roi > 0 ? "+" : ""}{r.roi.toFixed(0)}%
                            </td>
                            <td className="px-3.5 py-2.5">
                              <div className="relative h-2 mx-auto rounded-sm" style={{ width: 200, background: "#1a1a1a" }}>
                                <div className="absolute top-[-2px] bottom-[-2px] left-1/2" style={{ width: 1, background: "#333" }} />
                                {r.net !== 0 && (
                                  <div
                                    className="absolute top-0 bottom-0 rounded-sm"
                                    style={{
                                      ...(positive
                                        ? { left: "50%", width: `${widthPct}%`, background: "#4ade80" }
                                        : { right: "50%", width: `${widthPct}%`, background: "#FD4A48" }),
                                    }}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-secondary border-t-2 border-border">
                        <td colSpan={2} className="px-3.5 py-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">League Totals</td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-muted-foreground font-semibold">
                          ${payoutData.totals.dues.toLocaleString("en-US")}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-[13px] font-semibold">
                          ${payoutData.totals.winnings.toLocaleString("en-US")}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-muted-foreground font-semibold">
                          {fmtMoney(payoutData.totals.net)}
                        </td>
                        <td colSpan={2} className="px-3.5 py-2.5 text-left text-[11px] text-muted-foreground italic">
                          {payoutData.totals.net < 0 && `${season} pot (${fmtMoney(-payoutData.totals.net)}) still in play`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </RCard>
              <div className="text-[11px] text-muted-foreground mt-2.5 pl-1">
                Source: league financial ledger. Includes all owners past and present.
              </div>
            </div>
          </>
        )}

        {showCurrentSeason && (
          <>
            {/* Current Season View */}
            <div>
              <SectionLabel label="Game Records" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Highest Single-Game Score", value: highestScore.points.toFixed(2), detail: `${highestScore.name} · Week ${highestScore.week}`, color: "#E8B84B" },
                  { label: "Lowest Single-Game Score", value: lowestScore.points.toFixed(2), detail: `${lowestScore.name} · Week ${lowestScore.week}`, color: "#FD4A48" },
                  { label: "Longest Win Streak", value: `${streaks.longestWin.count}W`, detail: streaks.longestWin.name, color: "#4ade80" },
                  { label: "Longest Losing Streak", value: `${streaks.longestLoss.count}L`, detail: streaks.longestLoss.name, color: "#FD4A48" },
                ].map((r) => (
                  <RCard key={r.label} className="p-5">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2.5">{r.label}</div>
                    <div className="font-heading text-[42px] font-black leading-none" style={{ color: r.color }}>{r.value}</div>
                    <div className="text-xs text-muted-foreground mt-2">{r.detail}</div>
                  </RCard>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel label="Season Leaders" />
              <RCard>
                {[
                  { label: "Most Points For", name: sortedByPF[0]?.displayName, value: sortedByPF[0]?.pointsFor.toFixed(1), colorType: "gold" },
                  { label: "Best Record", name: sortedByWins[0]?.displayName, value: `${sortedByWins[0]?.wins}–${sortedByWins[0]?.losses}`, colorType: "emerald" },
                  { label: "Worst Record", name: sortedByLosses[0]?.displayName, value: `${sortedByLosses[0]?.wins}–${sortedByLosses[0]?.losses}`, colorType: "red" },
                  { label: "Most Points Against", name: sortedByPA[0]?.displayName, value: sortedByPA[0]?.pointsAgainst.toFixed(1), colorType: "muted" },
                  { label: "Fewest Points For", name: sortedByPF[sortedByPF.length - 1]?.displayName, value: sortedByPF[sortedByPF.length - 1]?.pointsFor.toFixed(1), colorType: "red" },
                ].map((row, i, arr) => (
                  <div key={row.label} className={cn("flex items-center justify-between px-5 py-3", i < arr.length - 1 ? "border-b border-border/50" : "")}>
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">{row.label}</div>
                      <div className="text-sm font-medium">{row.name && row.name !== "—" ? <OwnerLink name={row.name} className="hover:underline underline-offset-2">{row.name}</OwnerLink> : "—"}</div>
                    </div>
                    <span
                      className="font-heading text-2xl font-extrabold"
                      style={{ color: row.colorType === "gold" ? "#E8B84B" : row.colorType === "emerald" ? "#4ade80" : row.colorType === "red" ? "#FD4A48" : "#777" }}
                    >
                      {row.value ?? "—"}
                    </span>
                  </div>
                ))}
              </RCard>
            </div>

            <div>
              <SectionLabel label="Season Standings" />
              <RCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["#", "Owner", "W", "L", "Win%", "PF", "PA"].map((h, i) => (
                          <th key={h} className={cn("px-3.5 py-2.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border bg-secondary", i === 0 ? "text-center w-10" : i >= 2 ? (i >= 5 ? "text-right" : "text-center") : "text-left")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedByWins.map((t, i) => {
                        const total = t.wins + t.losses;
                        const pct = total > 0 ? (t.wins / total * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={t.rosterId} className="border-b border-border/50 last:border-0" style={{ background: i === 0 ? "rgba(232,184,75,0.04)" : i % 2 === 1 ? "var(--secondary)" : undefined }}>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[11px] text-muted-foreground">{i + 1}</td>
                            <td className="px-3.5 py-2.5 text-[13px] font-medium">{t.displayName && t.displayName !== "—" ? <OwnerLink name={t.displayName} className="hover:underline underline-offset-2">{t.displayName}</OwnerLink> : "—"}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px] text-emerald-400 font-semibold">{t.wins}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px] text-red-400">{t.losses}</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-[13px]">{pct}%</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-muted-foreground">{t.pointsFor.toFixed(1)}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[13px] text-muted-foreground">{t.pointsAgainst.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </RCard>
            </div>
          </>
        )}

        {!showAllTime && !showCurrentSeason && (
          <>
            {/* Past Season View */}
            {selectedChamp && (
              <div>
                <SectionLabel label="Trophy Room" />
                <RCard className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: 520 }}>
                      <div
                        className="grid items-center gap-0 px-4 py-2 border-b border-border bg-secondary"
                        style={{ gridTemplateColumns: "56px 1fr 1fr 1fr" }}
                      >
                        {["Year", "Champion", "Runner-Up", "3rd Place"].map((h, i) => (
                          <span key={h} className={cn("text-[10px] font-bold tracking-widest uppercase text-muted-foreground", i === 0 ? "text-center" : "text-left")}>{h}</span>
                        ))}
                      </div>
                      <div className="grid items-center gap-0 px-4 py-2.5" style={{ gridTemplateColumns: "56px 1fr 1fr 1fr" }}>
                        <span className="font-mono text-[13px] font-bold text-gold text-center">{selectedChamp.year}</span>
                        <OwnerLink name={selectedChamp.champion} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                          <span className="text-sm">🏆</span>
                          <OwnerAvatar name={selectedChamp.champion} size={20} />
                          <span className="text-[13px] font-semibold">{selectedChamp.champion}</span>
                        </OwnerLink>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🥈</span>
                          {selectedChamp.runnerUp && selectedChamp.runnerUp !== "—" ? <OwnerLink name={selectedChamp.runnerUp} className="text-[13px] text-[#aaa] hover:underline underline-offset-2">{selectedChamp.runnerUp}</OwnerLink> : <span className="text-[13px] text-[#aaa]">—</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🥉</span>
                          {selectedChamp.third && selectedChamp.third !== "—" ? <OwnerLink name={selectedChamp.third} className="text-[13px] text-muted-foreground hover:underline underline-offset-2">{selectedChamp.third}</OwnerLink> : <span className="text-[13px] text-muted-foreground">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </RCard>
              </div>
            )}

            {selectedSummary && (
              <>
                <div>
                  <SectionLabel label="Game Records" />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Season High Score", ...selectedSummary.highScore, color: "#E8B84B" },
                      { label: "Season Low Score", ...selectedSummary.lowScore, color: "#FD4A48" },
                    ].map((r) => (
                      <RCard key={r.label} className="p-5">
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2.5">{r.label}</div>
                        <div className="font-heading text-[42px] font-black leading-none" style={{ color: r.color }}>{r.value}</div>
                        <div className="text-xs text-muted-foreground mt-2">{r.detail}</div>
                      </RCard>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel label={`${activeTab} Season Leaders`} />
                  <RCard>
                    {selectedSummary.leaders.map((row, i, arr) => (
                      <div
                        key={row.label}
                        className={cn("flex items-center justify-between px-5 py-3", i < arr.length - 1 ? "border-b border-border/50" : "")}
                      >
                        <div>
                          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">{row.label}</div>
                          <div className="text-sm font-medium">{row.name && row.name !== "—" ? <OwnerLink name={row.name} className="hover:underline underline-offset-2">{row.name}</OwnerLink> : "—"}</div>
                        </div>
                        {row.value && (
                          <span
                            className="font-heading text-2xl font-extrabold"
                            style={{ color: row.colorType === "gold" ? "#E8B84B" : row.colorType === "emerald" ? "#4ade80" : "#FD4A48" }}
                          >
                            {row.value}
                          </span>
                        )}
                      </div>
                    ))}
                  </RCard>
                </div>
              </>
            )}

            {!selectedChamp && !selectedSummary && (
              <RCard className="py-8">
                <p className="text-sm text-muted-foreground italic text-center">
                  No records found for {activeTab}.
                </p>
              </RCard>
            )}
          </>
        )}
      </div>
    </div>
    </OwnerAvatarsProvider>
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
