"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SleeperMatchup } from "@/types/sleeper";
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
}

const CHAMPIONS: { year: string; champion: string; runnerUp: string; third: string }[] = [
  { year: "2025", champion: "Clancy", runnerUp: "Chapman", third: "Collins" },
  { year: "2024", champion: "Collins", runnerUp: "Albarran", third: "Cummings" },
  { year: "2023", champion: "Clancy", runnerUp: "Cummings", third: "Chapman" },
  { year: "2022", champion: "Cummings", runnerUp: "Clancy", third: "Peterson" },
  { year: "2021", champion: "Albarran", runnerUp: "Cummings", third: "Clancy" },
  { year: "2020", champion: "Chapman", runnerUp: "Collins", third: "Katz" },
  { year: "2019", champion: "Peterson", runnerUp: "Chapman", third: "Albarran" },
  { year: "2018", champion: "Katz", runnerUp: "Peterson", third: "Collins" },
  { year: "2017", champion: "Clancy", runnerUp: "Katz", third: "Cummings" },
  { year: "2016", champion: "Durkin", runnerUp: "HoganLamb", third: "Brown" },
  { year: "2015", champion: "Bohne", runnerUp: "Clancy", third: "Albarran" },
  { year: "2014", champion: "Cummings", runnerUp: "Bohne", third: "Durkin" },
];

const ALL_TIME_STANDINGS: { owner: string; wins: number; losses: number; pf: number; rings: number; playoffs: number }[] = [
  { owner: "Clancy", wins: 89, losses: 67, pf: 14832, rings: 3, playoffs: 9 },
  { owner: "Cummings", wins: 82, losses: 74, pf: 13940, rings: 2, playoffs: 8 },
  { owner: "Collins", wins: 79, losses: 77, pf: 13580, rings: 1, playoffs: 7 },
  { owner: "Chapman", wins: 76, losses: 80, pf: 13210, rings: 1, playoffs: 7 },
  { owner: "Albarran", wins: 74, losses: 82, pf: 13050, rings: 1, playoffs: 6 },
  { owner: "Peterson", wins: 71, losses: 85, pf: 12870, rings: 1, playoffs: 5 },
  { owner: "Katz", wins: 69, losses: 87, pf: 12640, rings: 1, playoffs: 5 },
  { owner: "Bohne", wins: 67, losses: 89, pf: 12420, rings: 1, playoffs: 4 },
  { owner: "Durkin", wins: 65, losses: 91, pf: 12180, rings: 1, playoffs: 4 },
  { owner: "HoganLamb", wins: 62, losses: 94, pf: 11950, rings: 0, playoffs: 3 },
  { owner: "Brown", wins: 58, losses: 98, pf: 11620, rings: 0, playoffs: 2 },
  { owner: "Williams", wins: 54, losses: 102, pf: 11340, rings: 0, playoffs: 2 },
];

const MILESTONES: { label: string; value: string; detail: string }[] = [
  { label: "Most Points (Season)", value: "1,842.3", detail: "Clancy · 2023" },
  { label: "Fewest Points (Season)", value: "987.1", detail: "Williams · 2016" },
  { label: "Highest Score (Game)", value: "198.42", detail: "Cummings · Wk 12, 2022" },
  { label: "Lowest Score (Game)", value: "42.10", detail: "Brown · Wk 8, 2018" },
  { label: "Longest Win Streak", value: "9W", detail: "Clancy · 2023" },
  { label: "Most Trades (Season)", value: "14", detail: "Albarran · 2021" },
];

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading font-bold uppercase tracking-widest text-sm">{label}</span>
    </div>
  );
}

function getRingCounts(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const c of CHAMPIONS) {
    map.set(c.champion, (map.get(c.champion) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

type AllTimeSortKey = "owner" | "wins" | "losses" | "pf" | "rings" | "playoffs";

export function RecordsClient({
  matchupsArray,
  rosterOwnerMap,
  teamRecords,
  season,
  currentWeek,
}: RecordsClientProps) {
  const [activeTab, setActiveTab] = useState<string>("all-time");
  const [atSortKey, setAtSortKey] = useState<AllTimeSortKey>("wins");
  const [atSortDir, setAtSortDir] = useState<"asc" | "desc">("desc");

  const allSeasons = useMemo(() => {
    const years: string[] = [];
    for (let y = parseInt(season); y >= 2014; y--) years.push(String(y));
    return years;
  }, [season]);

  const showAllTime = activeTab === "all-time";
  const showCurrentSeason = activeTab === season;

  // Current season computed data
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
  const weeksPlayed = currentWeek - 1;

  const ringCounts = useMemo(getRingCounts, []);
  const maxRings = ringCounts[0]?.count || 1;

  const sortedAllTime = useMemo(() => {
    const copy = [...ALL_TIME_STANDINGS];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (atSortKey) {
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "wins": cmp = a.wins - b.wins; break;
        case "losses": cmp = a.losses - b.losses; break;
        case "pf": cmp = a.pf - b.pf; break;
        case "rings": cmp = a.rings - b.rings; break;
        case "playoffs": cmp = a.playoffs - b.playoffs; break;
      }
      return atSortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [atSortKey, atSortDir]);

  function toggleAtSort(key: AllTimeSortKey) {
    if (atSortKey === key) {
      setAtSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setAtSortKey(key);
      setAtSortDir("desc");
    }
  }

  function AtSortTh({ label, field, className }: { label: string; field: AllTimeSortKey; className?: string }) {
    const active = atSortKey === field;
    return (
      <th
        className={cn("px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none transition-colors", active ? "text-gold" : "", className)}
        onClick={() => toggleAtSort(field)}
      >
        {label}
        {active && <span className="ml-1">{atSortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  const selectedYearChamp = !showAllTime && !showCurrentSeason
    ? CHAMPIONS.find((c) => c.year === activeTab)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">Records</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historical records from 2014–{season} · Stub data — integration in progress
        </p>
      </div>

      {/* Year filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveTab("all-time")}
          className={cn(
            "inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium shrink-0 transition-colors border",
            showAllTime
              ? "bg-gold/10 border-gold/40 text-gold"
              : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
          )}
        >
          All Time
        </button>
        {allSeasons.map((y) => (
          <button
            key={y}
            onClick={() => setActiveTab(y)}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium shrink-0 transition-colors border",
              activeTab === y
                ? "bg-gold/10 border-gold/40 text-gold"
                : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ── All Time View ──────────────────────────────────────────────────── */}
      {showAllTime && (
        <>
          {/* Trophy Room — Podium */}
          <div>
            <SectionTick label="Trophy Room" />
            <Card className="mt-4">
              <CardContent className="py-8">
                <div className="flex items-end justify-center gap-4 sm:gap-8 mb-8">
                  {/* 2nd place */}
                  <div className="text-center">
                    <p className="text-3xl mb-2">🥈</p>
                    <div className="w-20 sm:w-24 rounded-t-lg bg-secondary border border-border/50 pt-6 pb-3 px-2">
                      <p className="font-heading font-bold text-sm truncate">{ringCounts[1]?.name}</p>
                      <p className="text-xs text-muted-foreground">{ringCounts[1]?.count} rings</p>
                    </div>
                  </div>
                  {/* 1st place */}
                  <div className="text-center">
                    <p className="text-4xl mb-2">🥇</p>
                    <div className="w-24 sm:w-28 rounded-t-lg border pt-8 pb-3 px-2" style={{ backgroundColor: "rgba(232,184,75,0.08)", borderColor: "rgba(232,184,75,0.3)" }}>
                      <p className="font-heading font-bold text-base text-gold truncate">{ringCounts[0]?.name}</p>
                      <p className="text-xs text-gold/70">{ringCounts[0]?.count} rings</p>
                    </div>
                  </div>
                  {/* 3rd place */}
                  <div className="text-center">
                    <p className="text-2xl mb-2">🥉</p>
                    <div className="w-20 sm:w-24 rounded-t-lg bg-secondary border border-border/50 pt-4 pb-3 px-2">
                      <p className="font-heading font-bold text-sm truncate">{ringCounts[2]?.name}</p>
                      <p className="text-xs text-muted-foreground">{ringCounts[2]?.count} rings</p>
                    </div>
                  </div>
                </div>

                {/* Champion history table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Year</th>
                        <th className="px-4 py-2 text-left font-medium">Champion</th>
                        <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Runner-Up</th>
                        <th className="px-4 py-2 text-left font-medium hidden md:table-cell">3rd Place</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHAMPIONS.map((c) => (
                        <tr key={c.year} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                          <td className="px-4 py-2 tabular-nums text-muted-foreground">{c.year}</td>
                          <td className="px-4 py-2 font-medium">
                            <span className="mr-1.5">🏆</span>{c.champion}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{c.runnerUp}</td>
                          <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{c.third}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ring Leaderboard */}
          <div>
            <SectionTick label="Ring Leaderboard" />
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="space-y-3">
                  {ringCounts.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className={cn("w-6 text-center font-bold text-sm tabular-nums", i === 0 ? "text-gold" : i <= 2 ? "text-ittwa" : "text-muted-foreground")}>
                        {i + 1}
                      </span>
                      <span className="w-32 sm:w-40 font-medium text-sm truncate">{r.name}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(r.count / maxRings) * 100}%`,
                              backgroundColor: i === 0 ? "#E8B84B" : i <= 2 ? "#FD4A48" : "#52525b",
                            }}
                          />
                        </div>
                        <span className="text-sm font-heading font-bold tabular-nums w-6 text-right">{r.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All-Time Standings */}
          <div>
            <SectionTick label="All-Time Standings" />
            <Card className="mt-4">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card text-muted-foreground">
                        <th className="px-4 py-3 text-center font-medium w-12">#</th>
                        <AtSortTh label="Owner" field="owner" className="text-left" />
                        <AtSortTh label="W" field="wins" className="text-center" />
                        <AtSortTh label="L" field="losses" className="text-center" />
                        <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">Win%</th>
                        <AtSortTh label="PF" field="pf" className="text-right" />
                        <AtSortTh label="Rings" field="rings" className="text-center" />
                        <AtSortTh label="Playoffs" field="playoffs" className="text-center hidden md:table-cell" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAllTime.map((t, i) => {
                        const total = t.wins + t.losses;
                        const pct = total > 0 ? (t.wins / total * 100).toFixed(1) : "0.0";
                        const maxPlayoffs = Math.max(...ALL_TIME_STANDINGS.map((s) => s.playoffs), 1);
                        return (
                          <tr key={t.owner} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn("font-semibold tabular-nums text-sm", i === 0 ? "text-gold" : i <= 2 ? "text-ittwa" : "text-muted-foreground")}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium">{t.owner}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums text-emerald-400 font-semibold">{t.wins}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums text-red-400 font-semibold">{t.losses}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums hidden sm:table-cell">{pct}%</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground font-mono text-xs">{t.pf.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-center">
                              {t.rings > 0 ? "🏆".repeat(t.rings) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center hidden md:table-cell">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="tabular-nums text-xs w-4 text-right">{t.playoffs}</span>
                                <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full rounded-full bg-gold/60" style={{ width: `${(t.playoffs / maxPlayoffs) * 100}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Milestones */}
          <div>
            <SectionTick label="Milestones" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {MILESTONES.map((m) => (
                <Card key={m.label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-heading text-3xl font-black tabular-nums">{m.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{m.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Current Season View ────────────────────────────────────────────── */}
      {showCurrentSeason && (
        <>
          {/* Game Records */}
          <div>
            <SectionTick label="Game Records" />
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Highest Single-Game Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-4xl font-black text-ittwa tabular-nums">{highestScore.points.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{highestScore.name} · Week {highestScore.week}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Lowest Single-Game Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-4xl font-black tabular-nums">{lowestScore.points.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{lowestScore.name} · Week {lowestScore.week}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Longest Win Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-4xl font-black text-emerald-400">{streaks.longestWin.count}W</p>
                  <p className="text-sm text-muted-foreground mt-1">{streaks.longestWin.name}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Longest Losing Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-4xl font-black text-red-400">{streaks.longestLoss.count}L</p>
                  <p className="text-sm text-muted-foreground mt-1">{streaks.longestLoss.name}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Season Leaders */}
          <div>
            <SectionTick label="Season Leaders" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {[
                { label: "Most Points For", name: sortedByPF[0]?.displayName, value: sortedByPF[0]?.pointsFor.toFixed(1), color: "text-gold" },
                { label: "Fewest Points For", name: sortedByPF[sortedByPF.length - 1]?.displayName, value: sortedByPF[sortedByPF.length - 1]?.pointsFor.toFixed(1) },
                { label: "Most Points Against", name: sortedByPA[0]?.displayName, value: sortedByPA[0]?.pointsAgainst.toFixed(1) },
                { label: "Best Record", name: sortedByWins[0]?.displayName, value: `${sortedByWins[0]?.wins}-${sortedByWins[0]?.losses}`, color: "text-emerald-400" },
                { label: "Worst Record", name: sortedByLosses[0]?.displayName, value: `${sortedByLosses[0]?.wins}-${sortedByLosses[0]?.losses}`, color: "text-red-400" },
                { label: "Highest Win %", name: sortedByWins[0]?.displayName, value: sortedByWins[0] ? `${((sortedByWins[0].wins / (sortedByWins[0].wins + sortedByWins[0].losses)) * 100).toFixed(0)}%` : "—" },
              ].map((item) => (
                <Card key={item.label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={cn("font-heading text-3xl font-black tabular-nums", item.color)}>{item.value ?? "—"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.name ?? "—"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Season Standings */}
          <div>
            <SectionTick label="Season Standings" />
            <Card className="mt-4">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card text-muted-foreground">
                        <th className="px-4 py-3 text-center font-medium w-12">#</th>
                        <th className="px-4 py-3 text-left font-medium">Owner</th>
                        <th className="px-4 py-3 text-center font-medium">W</th>
                        <th className="px-4 py-3 text-center font-medium">L</th>
                        <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">Win%</th>
                        <th className="px-4 py-3 text-right font-medium">PF</th>
                        <th className="px-4 py-3 text-right font-medium hidden md:table-cell">PA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedByWins.map((t, i) => {
                        const total = t.wins + t.losses;
                        const pct = total > 0 ? (t.wins / total * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={t.rosterId} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn("font-semibold tabular-nums text-sm", i === 0 ? "text-gold" : i <= 2 ? "text-ittwa" : "text-muted-foreground")}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium">{t.displayName}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums text-emerald-400 font-semibold">{t.wins}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums text-red-400 font-semibold">{t.losses}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums hidden sm:table-cell">{pct}%</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground font-mono text-xs">{t.pointsFor.toFixed(1)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground font-mono text-xs hidden md:table-cell">{t.pointsAgainst.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── Past Year View ─────────────────────────────────────────────────── */}
      {selectedYearChamp && (
        <div>
          <SectionTick label={`${activeTab} Champion`} />
          <Card className="mt-4">
            <CardContent className="py-6">
              <div className="text-center">
                <p className="text-4xl mb-3">🏆</p>
                <p className="font-heading text-2xl font-black text-gold">{selectedYearChamp.champion}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Runner-up: {selectedYearChamp.runnerUp} · 3rd: {selectedYearChamp.third}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground italic text-center">
                Detailed {activeTab} season stats — data integration in progress.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Past year not found */}
      {!showAllTime && !showCurrentSeason && !selectedYearChamp && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground italic text-center">
              No records found for {activeTab}.
            </p>
          </CardContent>
        </Card>
      )}
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

        if (type === s.type) {
          s.current++;
        } else {
          s.current = 1;
          s.type = type;
        }

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
