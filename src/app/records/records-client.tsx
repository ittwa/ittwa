"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SleeperMatchup } from "@/types/sleeper";

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

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading font-bold uppercase tracking-widest text-sm">{label}</span>
    </div>
  );
}

export function RecordsClient({
  matchupsArray,
  rosterOwnerMap,
  teamRecords,
  season,
  currentWeek,
}: RecordsClientProps) {
  const [activeYear] = useState(season);

  // Single-game records
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">Records</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {season} season · Through week {weeksPlayed}
        </p>
      </div>

      {/* Year filter tabs */}
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center rounded-full bg-secondary border border-border/50 px-4 py-1.5 text-xs text-muted-foreground/50 cursor-not-allowed">
          All Time
        </button>
        <button className="inline-flex items-center rounded-full bg-gold/10 border border-gold/40 text-gold px-4 py-1.5 text-xs font-medium">
          {season}
        </button>
      </div>

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

      {/* Season Records */}
      <div>
        <SectionTick label="Season Leaders" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {[
            { label: "Most Points For", name: sortedByPF[0]?.displayName, value: sortedByPF[0]?.pointsFor.toFixed(1), color: "text-gold" },
            { label: "Fewest Points For", name: sortedByPF[sortedByPF.length-1]?.displayName, value: sortedByPF[sortedByPF.length-1]?.pointsFor.toFixed(1) },
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
                <p className={`font-heading text-3xl font-black tabular-nums ${item.color || ""}`}>{item.value ?? "—"}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.name ?? "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* All-Time Standings */}
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
                          <span className={`font-semibold tabular-nums text-sm ${i === 0 ? "text-gold" : i <= 2 ? "text-ittwa" : "text-muted-foreground"}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium">{t.displayName}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-emerald-400 font-semibold">{t.wins}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-red-400 font-semibold">{t.losses}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-green-400 hidden sm:table-cell">{pct}%</td>
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

      {/* Trophy Room placeholder */}
      <div>
        <SectionTick label="Trophy Room" />
        <Card className="mt-4">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground italic text-center">
              Full trophy room with champions from 2014–present coming soon.
            </p>
          </CardContent>
        </Card>
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
        const s = streaksByRoster.get(me.roster_id) || { current: 0, type: "W", best: { w: 0, l: 0 } };
        const won = me.points > opp.points;
        const type = won ? "W" : "L";

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
