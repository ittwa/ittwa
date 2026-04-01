"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { MatchupPair } from "@/types/sleeper";

interface ScheduleClientProps {
  allPairs: Record<number, MatchupPair[]>;
  season: string;
  currentWeek: number;
  teamNames: string[];
}

export function ScheduleClient({ allPairs, season, currentWeek, teamNames }: ScheduleClientProps) {
  const [selectedWeek, setSelectedWeek] = useState(Math.min(Math.max(currentWeek - 1, 1), 13));
  const [filterTeam, setFilterTeam] = useState("");

  const pairs = allPairs[selectedWeek] || [];
  const filtered = filterTeam
    ? pairs.filter((p) => p.team1.displayName === filterTeam || p.team2.displayName === filterTeam)
    : pairs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">{season} &middot; 13-week regular season</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Week tabs */}
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 13 }, (_, i) => i + 1).map((w) => (
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
              {w}
            </button>
          ))}
        </div>

        {/* Team filter */}
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Teams</option>
          {teamNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Matchups */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground italic">
                No matchups found for this week.
              </div>
            ) : (
              filtered.map((pair) => {
                const t1Won = pair.completed && pair.team1.points > pair.team2.points;
                const t2Won = pair.completed && pair.team2.points > pair.team1.points;
                return (
                  <div key={pair.matchupId} className="flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors">
                    <div className={cn("flex-1 text-right text-sm font-medium truncate", t1Won ? "text-foreground" : "text-muted-foreground")}>
                      {pair.team1.displayName}
                    </div>
                    <div className="flex items-center gap-2 px-4 shrink-0 font-mono text-sm tabular-nums">
                      {pair.completed ? (
                        <>
                          <span className={t1Won ? "text-foreground font-semibold" : "text-muted-foreground"}>
                            {pair.team1.points.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground text-xs">-</span>
                          <span className={t2Won ? "text-foreground font-semibold" : "text-muted-foreground"}>
                            {pair.team2.points.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">vs</span>
                      )}
                    </div>
                    <div className={cn("flex-1 text-left text-sm font-medium truncate", t2Won ? "text-foreground" : "text-muted-foreground")}>
                      {pair.team2.displayName}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
