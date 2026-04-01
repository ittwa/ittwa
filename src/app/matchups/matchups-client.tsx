"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MatchupPair } from "@/types/sleeper";

interface MatchupsClientProps {
  allPairs: Record<number, MatchupPair[]>;
  season: string;
  currentWeek: number;
}

export function MatchupsClient({ allPairs, season, currentWeek }: MatchupsClientProps) {
  const defaultWeek = Math.max(currentWeek - 1, 1);
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const pairs = allPairs[selectedWeek] || [];
  const completedPairs = pairs.filter((p) => p.completed);

  // Callouts
  let closestGame: MatchupPair | null = null;
  let highestScorer: { name: string; points: number } | null = null;
  let biggestBlowout: MatchupPair | null = null;

  for (const pair of completedPairs) {
    const margin = Math.abs(pair.team1.points - pair.team2.points);

    if (!closestGame || margin < Math.abs(closestGame.team1.points - closestGame.team2.points)) {
      closestGame = pair;
    }
    if (!biggestBlowout || margin > Math.abs(biggestBlowout.team1.points - biggestBlowout.team2.points)) {
      biggestBlowout = pair;
    }

    for (const team of [pair.team1, pair.team2]) {
      if (!highestScorer || team.points > highestScorer.points) {
        highestScorer = { name: team.displayName, points: team.points };
      }
    }
  }

  const availableWeeks = Object.keys(allPairs).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matchups</h1>
        <p className="text-sm text-muted-foreground mt-1">{season} &middot; Week {selectedWeek}</p>
      </div>

      {/* Week selector */}
      <div className="flex gap-1 flex-wrap">
        {availableWeeks.map((w) => (
          <button
            key={w}
            onClick={() => setSelectedWeek(w)}
            className={cn(
              "px-2.5 py-1.5 text-xs rounded-md font-medium transition-colors",
              selectedWeek === w
                ? "bg-ittwa text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            Wk {w}
          </button>
        ))}
      </div>

      {/* Callouts */}
      {completedPairs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {highestScorer && (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Highest Score</p>
                <p className="text-lg font-bold text-ittwa tabular-nums">{highestScorer.points.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{highestScorer.name}</p>
              </CardContent>
            </Card>
          )}
          {closestGame && (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Closest Game</p>
                <p className="text-lg font-bold tabular-nums">{Math.abs(closestGame.team1.points - closestGame.team2.points).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{closestGame.team1.displayName} vs {closestGame.team2.displayName}</p>
              </CardContent>
            </Card>
          )}
          {biggestBlowout && (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Biggest Blowout</p>
                <p className="text-lg font-bold tabular-nums">{Math.abs(biggestBlowout.team1.points - biggestBlowout.team2.points).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{biggestBlowout.team1.displayName} vs {biggestBlowout.team2.displayName}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Matchup cards */}
      {pairs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground italic">There are no games right now. This is a crisis.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairs.map((pair) => {
            const t1Won = pair.completed && pair.team1.points > pair.team2.points;
            const t2Won = pair.completed && pair.team2.points > pair.team1.points;
            return (
              <Card key={pair.matchupId} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className={cn("flex items-center justify-between px-4 py-3 border-b border-border/50", t1Won && "bg-emerald-500/5")}>
                    <span className={cn("text-sm font-medium truncate", t1Won ? "text-foreground" : "text-muted-foreground")}>
                      {pair.team1.displayName}
                    </span>
                    <span className={cn("text-sm tabular-nums font-mono", t1Won ? "text-foreground font-semibold" : "text-muted-foreground")}>
                      {pair.completed ? pair.team1.points.toFixed(2) : "—"}
                    </span>
                  </div>
                  <div className={cn("flex items-center justify-between px-4 py-3", t2Won && "bg-emerald-500/5")}>
                    <span className={cn("text-sm font-medium truncate", t2Won ? "text-foreground" : "text-muted-foreground")}>
                      {pair.team2.displayName}
                    </span>
                    <span className={cn("text-sm tabular-nums font-mono", t2Won ? "text-foreground font-semibold" : "text-muted-foreground")}>
                      {pair.completed ? pair.team2.points.toFixed(2) : "—"}
                    </span>
                  </div>
                  {!pair.completed && (
                    <div className="px-4 py-1.5 text-center text-xs text-muted-foreground bg-secondary/50">
                      Upcoming
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
