"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StandingsEntry } from "@/lib/standings";
import { DIVISIONS } from "@/lib/config";

// ─── Division badge palette ────────────────────────────────────────────────
// Each division gets a stable color so the badge is visually distinct.
const DIVISION_COLORS: Record<string, string> = {
  Concussion: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
  "Hey Arnold": "bg-violet-500/20 text-violet-400 border border-violet-500/30",
  Replacements: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  "Dark Knight Rises": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
};

function DivisionBadge({ division }: { division: string }) {
  const colorClass = DIVISION_COLORS[division] ?? "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        colorClass
      )}
    >
      {division}
    </span>
  );
}

// ─── Streak badge ──────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: string }) {
  if (!streak || streak === "-") {
    return <span className="text-muted-foreground">—</span>;
  }
  const isWin = streak.startsWith("W");
  return (
    <Badge
      variant={isWin ? "success" : "destructive"}
      className={cn(
        isWin
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30"
      )}
    >
      {streak}
    </Badge>
  );
}

// ─── Shared table ──────────────────────────────────────────────────────────
function StandingsTable({
  rows,
  showDivision = true,
}: {
  rows: StandingsEntry[];
  showDivision?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
            <th className="px-3 py-3 text-center font-medium w-10">#</th>
            <th className="px-3 py-3 text-left font-medium">Owner</th>
            {showDivision && (
              <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Division</th>
            )}
            <th className="px-3 py-3 text-center font-medium">W‑L</th>
            <th className="px-3 py-3 text-center font-medium hidden md:table-cell">Win%</th>
            <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">PF</th>
            <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">PA</th>
            <th className="px-3 py-3 text-center font-medium hidden lg:table-cell">Div Rec</th>
            <th className="px-3 py-3 text-center font-medium">Streak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr
              key={entry.rosterId}
              className="border-b border-border/50 transition-colors hover:bg-accent/50"
            >
              {/* Rank */}
              <td className="px-3 py-3 text-center">
                {entry.rank <= 3 ? (
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      entry.rank === 1
                        ? "bg-amber-400/20 text-amber-400"
                        : entry.rank === 2
                        ? "bg-zinc-400/20 text-zinc-300"
                        : "bg-orange-400/20 text-orange-400"
                    )}
                  >
                    {entry.rank}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{entry.rank}</span>
                )}
              </td>

              {/* Owner */}
              <td className="px-3 py-3 font-medium text-foreground">
                {entry.displayName}
                {/* Show division inline on mobile when not in its own column */}
                {showDivision && (
                  <div className="sm:hidden mt-0.5">
                    <DivisionBadge division={entry.division} />
                  </div>
                )}
              </td>

              {/* Division column (desktop) */}
              {showDivision && (
                <td className="px-3 py-3 hidden sm:table-cell">
                  <DivisionBadge division={entry.division} />
                </td>
              )}

              {/* W-L */}
              <td className="px-3 py-3 text-center tabular-nums">
                <span className="text-foreground font-medium">{entry.wins}</span>
                <span className="text-muted-foreground">‑</span>
                <span className="text-foreground font-medium">{entry.losses}</span>
                {entry.ties > 0 && (
                  <>
                    <span className="text-muted-foreground">‑</span>
                    <span className="text-foreground font-medium">{entry.ties}</span>
                  </>
                )}
              </td>

              {/* Win% */}
              <td className="px-3 py-3 text-center tabular-nums hidden md:table-cell text-muted-foreground">
                {(entry.winPct * 100).toFixed(1)}%
              </td>

              {/* PF */}
              <td className="px-3 py-3 text-center tabular-nums hidden sm:table-cell text-foreground">
                {entry.pointsFor.toFixed(2)}
              </td>

              {/* PA */}
              <td className="px-3 py-3 text-center tabular-nums hidden sm:table-cell text-muted-foreground">
                {entry.pointsAgainst.toFixed(2)}
              </td>

              {/* Div Record */}
              <td className="px-3 py-3 text-center tabular-nums hidden lg:table-cell text-muted-foreground">
                {entry.divisionRecord || "—"}
              </td>

              {/* Streak */}
              <td className="px-3 py-3 text-center">
                <StreakBadge streak={entry.streak} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  const divisionOrder = Object.keys(DIVISIONS);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Standings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {season} season &middot; through week {currentWeek - 1}
          </p>
        </div>
        <Badge variant="ittwa" className="self-start sm:self-auto">
          {standings.length} Teams
        </Badge>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {(["overall", "division"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors",
              activeTab === tab
                ? "border-ittwa text-ittwa"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab === "overall" ? "Overall" : "By Division"}
          </button>
        ))}
      </div>

      {/* ── Overall tab ── */}
      {activeTab === "overall" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">League Standings</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <StandingsTable rows={standings} showDivision />
          </CardContent>
        </Card>
      )}

      {/* ── By Division tab ── */}
      {activeTab === "division" && (
        <div className="space-y-6">
          {divisionOrder.map((divName) => {
            const divRows = standingsByDivision[divName] ?? [];
            if (divRows.length === 0) return null;
            return (
              <Card key={divName}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DivisionBadge division={divName} />
                    <span className="text-muted-foreground font-normal text-sm">
                      {divRows.length} teams
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  <StandingsTable rows={divRows} showDivision={false} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
