"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function RecordsClient({
  matchupsArray,
  rosterOwnerMap,
  teamRecords,
  season,
  currentWeek,
}: RecordsClientProps) {
  // Find single-game records
  let highestScore = { name: "", points: 0, week: 0 };
  let lowestScore = { name: "", points: Infinity, week: 0 };

  for (const [week, matchups] of matchupsArray) {
    for (const m of matchups) {
      if (m.points <= 0) continue;
      const name = rosterOwnerMap[m.roster_id] || `Team ${m.roster_id}`;
      if (m.points > highestScore.points) {
        highestScore = { name, points: m.points, week };
      }
      if (m.points < lowestScore.points) {
        lowestScore = { name, points: m.points, week };
      }
    }
  }

  if (lowestScore.points === Infinity) lowestScore = { name: "N/A", points: 0, week: 0 };

  // Season bests
  const sortedByPF = [...teamRecords].sort((a, b) => b.pointsFor - a.pointsFor);
  const sortedByWins = [...teamRecords].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  const sortedByLosses = [...teamRecords].sort((a, b) => b.losses - a.losses || a.pointsFor - b.pointsFor);

  // Win/loss streaks
  const streaks = calculateStreaks(matchupsArray, rosterOwnerMap);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Records</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {season} season records &middot; Through week {currentWeek - 1}
        </p>
      </div>

      <p className="text-sm text-muted-foreground italic bg-secondary/50 rounded-lg p-3">
        Historical records across all ITTWA seasons coming soon. Showing {season} season data.
      </p>

      {/* Trophy Room placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>🏆</span> Trophy Room
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Full trophy room with champions, runners-up, and 3rd place finishers from 2014–present coming soon.
          </p>
        </CardContent>
      </Card>

      {/* Single-game records */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Highest Single-Game Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-ittwa tabular-nums">{highestScore.points.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{highestScore.name} &middot; Week {highestScore.week}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lowest Single-Game Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{lowestScore.points.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{lowestScore.name} &middot; Week {lowestScore.week}</p>
          </CardContent>
        </Card>
      </div>

      {/* Season bests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>📊</span> Season Leaders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="px-6 py-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Most Points For</p>
                <p className="font-medium">{sortedByPF[0]?.displayName}</p>
              </div>
              <span className="text-ittwa font-bold tabular-nums">{sortedByPF[0]?.pointsFor.toFixed(2)}</span>
            </div>
            <div className="px-6 py-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Best Record</p>
                <p className="font-medium">{sortedByWins[0]?.displayName}</p>
              </div>
              <span className="font-bold tabular-nums">{sortedByWins[0]?.wins}-{sortedByWins[0]?.losses}</span>
            </div>
            <div className="px-6 py-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Worst Record</p>
                <p className="font-medium">{sortedByLosses[0]?.displayName}</p>
              </div>
              <span className="font-bold tabular-nums">{sortedByLosses[0]?.wins}-{sortedByLosses[0]?.losses}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Streaks */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <span>🔥</span> Longest Win Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{streaks.longestWin.count}W</p>
            <p className="text-sm text-muted-foreground">{streaks.longestWin.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <span>🔥</span> Longest Losing Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{streaks.longestLoss.count}L</p>
            <p className="text-sm text-muted-foreground">{streaks.longestLoss.name}</p>
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
