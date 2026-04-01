"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { PowerRankingEntry } from "@/lib/power-rankings";

interface RankingsClientProps {
  weeklyRankings: Record<number, PowerRankingEntry[]>;
  season: string;
  currentWeek: number;
}

export function RankingsClient({ weeklyRankings, season, currentWeek }: RankingsClientProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const rankings = weeklyRankings[selectedWeek] || [];
  const weeks = Object.keys(weeklyRankings).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Power Rankings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {season} &middot; All-Play Power Rankings through Week {selectedWeek}
        </p>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Week:</span>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>Week {w}</option>
          ))}
        </select>
      </div>

      {rankings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground italic">
              Not enough data yet. Check back after Week 1. Or don&apos;t.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                    <th className="px-3 py-3 text-center font-medium w-12">#</th>
                    <th className="px-3 py-3 text-center font-medium w-12">▲▼</th>
                    <th className="px-3 py-3 text-left font-medium">Owner</th>
                    <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Division</th>
                    <th className="px-3 py-3 text-center font-medium">All-Play</th>
                    <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">AP Win%</th>
                    <th className="px-3 py-3 text-center font-medium hidden md:table-cell">Avg PF</th>
                    <th className="px-3 py-3 text-center font-medium">Record</th>
                    <th className="px-3 py-3 text-center font-medium">Luck</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry, idx) => {
                    const isLast = idx === rankings.length - 1;
                    const luckPct = (entry.luckIndex * 100).toFixed(1);
                    const isLucky = entry.luckIndex > 0.05;
                    const isUnlucky = entry.luckIndex < -0.05;

                    const luckTooltip = isLucky
                      ? "Winning more than the scoring suggests. The football gods are looking the other way."
                      : isUnlucky
                      ? "Outscoring opponents who keep beating you. A tale as old as time."
                      : "Right about where the scoring says they should be.";

                    return (
                      <tr
                        key={entry.rosterId}
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <td className="px-3 py-3 text-center">
                          <span className={cn("font-bold", entry.rank <= 3 ? "text-ittwa" : "text-muted-foreground")}>
                            {entry.rank}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {entry.rankChange > 0 ? (
                            <span className="text-emerald-400 text-xs font-medium">▲{entry.rankChange}</span>
                          ) : entry.rankChange < 0 ? (
                            <span className="text-red-400 text-xs font-medium">▼{Math.abs(entry.rankChange)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {entry.displayName}
                          {isLast && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">
                              Last place. But hey — it&apos;s a long season. (It&apos;s not that long.)
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{entry.division}</Badge>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          {entry.allPlayWins}-{entry.allPlayLosses}
                          {entry.allPlayTies > 0 && `-${entry.allPlayTies}`}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums hidden sm:table-cell">
                          {(entry.allPlayWinPct * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums hidden md:table-cell">
                          {entry.avgPointsPerWeek.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          {entry.actualWins}-{entry.actualLosses}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Tooltip content={luckTooltip}>
                            <span
                              className={cn(
                                "text-xs font-medium tabular-nums cursor-help",
                                isLucky ? "text-emerald-400" : isUnlucky ? "text-red-400" : "text-muted-foreground"
                              )}
                            >
                              {entry.luckIndex > 0 ? "+" : ""}{luckPct}%
                            </span>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footnote */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">What is Luck Index?</strong> Luck Index measures the gap between
            how a team actually performs in the standings versus how they would perform in an All-Play format
            (where every team plays every other team each week). A positive Luck Index means a team is winning
            more than their scoring suggests — they&apos;re benefiting from favorable matchups. A negative Luck Index
            means the opposite: the team is outscoring their opponents on average but losing due to schedule luck.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
