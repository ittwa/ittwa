"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SleeperMatchup } from "@/types/sleeper";

interface RosterInfo {
  rosterId: number;
  displayName: string;
}

interface RivalryClientProps {
  matchupsArray: [number, SleeperMatchup[]][];
  rosterNames: RosterInfo[];
}

interface H2HResult {
  wins: number;
  losses: number;
  ties: number;
  avgScoreA: number;
  avgScoreB: number;
  biggestWinMargin: number;
  biggestLossMargin: number;
  games: number;
}

function calculateH2H(
  rosterA: number,
  rosterB: number,
  matchupsArray: [number, SleeperMatchup[]][]
): H2HResult {
  let wins = 0, losses = 0, ties = 0;
  let totalA = 0, totalB = 0, games = 0;
  let biggestWinMargin = 0, biggestLossMargin = 0;

  for (const [, matchups] of matchupsArray) {
    const a = matchups.find((m) => m.roster_id === rosterA);
    const b = matchups.find((m) => m.roster_id === rosterB);
    if (!a || !b || a.matchup_id !== b.matchup_id) continue;
    if (a.points <= 0 && b.points <= 0) continue;

    games++;
    totalA += a.points;
    totalB += b.points;
    const margin = a.points - b.points;

    if (a.points > b.points) {
      wins++;
      if (margin > biggestWinMargin) biggestWinMargin = margin;
    } else if (b.points > a.points) {
      losses++;
      if (-margin > biggestLossMargin) biggestLossMargin = -margin;
    } else {
      ties++;
    }
  }

  return {
    wins, losses, ties, games,
    avgScoreA: games > 0 ? totalA / games : 0,
    avgScoreB: games > 0 ? totalB / games : 0,
    biggestWinMargin,
    biggestLossMargin,
  };
}

export function RivalryClient({ matchupsArray, rosterNames }: RivalryClientProps) {
  const [teamA, setTeamA] = useState<number>(rosterNames[0]?.rosterId ?? 0);
  const [teamB, setTeamB] = useState<number>(rosterNames[1]?.rosterId ?? 0);

  const nameA = rosterNames.find((r) => r.rosterId === teamA)?.displayName || "";
  const nameB = rosterNames.find((r) => r.rosterId === teamB)?.displayName || "";

  const h2h = useMemo(() => {
    if (teamA === teamB || !teamA || !teamB) return null;
    return calculateH2H(teamA, teamB, matchupsArray);
  }, [teamA, teamB, matchupsArray]);

  // Full H2H matrix
  const matrix = useMemo(() => {
    const result: Record<number, Record<number, { wins: number; losses: number }>> = {};
    for (const a of rosterNames) {
      result[a.rosterId] = {};
      for (const b of rosterNames) {
        if (a.rosterId === b.rosterId) continue;
        const h = calculateH2H(a.rosterId, b.rosterId, matchupsArray);
        result[a.rosterId][b.rosterId] = { wins: h.wins, losses: h.losses };
      }
    }
    return result;
  }, [rosterNames, matchupsArray]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Head-to-Head Rivalry</h1>
        <p className="text-sm text-muted-foreground mt-1">Select two owners to compare</p>
      </div>

      {/* Selectors */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={teamA}
          onChange={(e) => setTeamA(Number(e.target.value))}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground"
        >
          {rosterNames.map((r) => (
            <option key={r.rosterId} value={r.rosterId}>{r.displayName}</option>
          ))}
        </select>
        <span className="text-muted-foreground text-sm text-center">vs</span>
        <select
          value={teamB}
          onChange={(e) => setTeamB(Number(e.target.value))}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground"
        >
          {rosterNames.map((r) => (
            <option key={r.rosterId} value={r.rosterId}>{r.displayName}</option>
          ))}
        </select>
      </div>

      {/* H2H Result */}
      {h2h && h2h.games > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{nameA} vs {nameB}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-2xl font-bold text-emerald-400">{h2h.wins}</p>
                <p className="text-xs text-muted-foreground">{nameA} Wins</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{h2h.ties}</p>
                <p className="text-xs text-muted-foreground">Ties</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{h2h.losses}</p>
                <p className="text-xs text-muted-foreground">{nameB} Wins</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Avg Score ({nameA})</p>
                <p className="font-bold tabular-nums">{h2h.avgScoreA.toFixed(2)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Avg Score ({nameB})</p>
                <p className="font-bold tabular-nums">{h2h.avgScoreB.toFixed(2)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Biggest Win Margin</p>
                <p className="font-bold tabular-nums text-emerald-400">{h2h.biggestWinMargin.toFixed(2)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Biggest Loss Margin</p>
                <p className="font-bold tabular-nums text-red-400">{h2h.biggestLossMargin.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : teamA !== teamB ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground italic">No head-to-head matchups found between these teams.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* H2H Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full H2H Matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left font-medium sticky left-0 bg-card z-10">Owner</th>
                  {rosterNames.map((r) => (
                    <th key={r.rosterId} className="px-2 py-2 text-center font-medium min-w-[60px]">
                      {r.displayName.split(" ").pop()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rosterNames.map((rowTeam) => (
                  <tr key={rowTeam.rosterId} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-2 py-2 font-medium sticky left-0 bg-card whitespace-nowrap">
                      {rowTeam.displayName}
                    </td>
                    {rosterNames.map((colTeam) => {
                      if (rowTeam.rosterId === colTeam.rosterId) {
                        return <td key={colTeam.rosterId} className="px-2 py-2 text-center bg-secondary/30">—</td>;
                      }
                      const rec = matrix[rowTeam.rosterId]?.[colTeam.rosterId];
                      return (
                        <td key={colTeam.rosterId} className="px-2 py-2 text-center tabular-nums">
                          {rec ? (
                            <span className={rec.wins > rec.losses ? "text-emerald-400" : rec.wins < rec.losses ? "text-red-400" : "text-muted-foreground"}>
                              {rec.wins}-{rec.losses}
                            </span>
                          ) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
