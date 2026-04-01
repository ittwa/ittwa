export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getTeamsData, calculateStandings, getContracts, getCapHits, getMatchupPairs, getAllTransactions, buildRosterOwnerMap } from "@/lib/data";
import { getActiveContractsForSeason, calculateCapSummary, resolveOwnerName } from "@/lib/contracts";
import { OWNER_LAST_NAME_MAP } from "@/lib/config";

export const revalidate = 300;

// Reverse lookup: display name → owner last name (for Sheets)
function getOwnerLastName(displayName: string): string {
  for (const [lastName, fullName] of Object.entries(OWNER_LAST_NAME_MAP)) {
    if (fullName === displayName) return lastName;
  }
  return displayName.split(" ").pop() || displayName;
}

export default async function TeamDetailPage({ params }: { params: Promise<{ owner: string }> }) {
  const { owner: rawOwner } = await params;
  const ownerName = decodeURIComponent(rawOwner);

  const [teamsData, contracts, capHits, rosterOwnerMap] = await Promise.all([
    getTeamsData(),
    getContracts(),
    getCapHits(),
    buildRosterOwnerMap(),
  ]);

  const { teams, season, currentWeek, allMatchups } = teamsData;
  const standings = calculateStandings(teams, allMatchups);

  const team = standings.find((t) => t.displayName === ownerName);
  if (!team) return notFound();

  const ownerLastName = getOwnerLastName(ownerName);
  const activeContracts = getActiveContractsForSeason(contracts, season).filter(
    (c) => c.owner === ownerLastName
  );
  const capSummary = calculateCapSummary(activeContracts, capHits, ownerLastName, season);

  // Schedule: get matchups for each week
  const schedule: { week: number; opponent: string; myScore: number; oppScore: number; completed: boolean }[] = [];
  for (let w = 1; w <= 13; w++) {
    const weekMatchups = allMatchups.get(w);
    if (!weekMatchups) {
      schedule.push({ week: w, opponent: "TBD", myScore: 0, oppScore: 0, completed: false });
      continue;
    }
    const myMatchup = weekMatchups.find((m) => m.roster_id === team.rosterId);
    if (!myMatchup) {
      schedule.push({ week: w, opponent: "TBD", myScore: 0, oppScore: 0, completed: false });
      continue;
    }
    const oppMatchup = weekMatchups.find(
      (m) => m.matchup_id === myMatchup.matchup_id && m.roster_id !== team.rosterId
    );
    const oppName = oppMatchup ? (rosterOwnerMap[oppMatchup.roster_id] || `Team ${oppMatchup.roster_id}`) : "BYE";
    const completed = myMatchup.points > 0 || (oppMatchup?.points ?? 0) > 0;
    schedule.push({
      week: w,
      opponent: oppName,
      myScore: myMatchup.points,
      oppScore: oppMatchup?.points ?? 0,
      completed,
    });
  }

  // Trades
  let trades: { date: string; rosterIds: number[]; type: string }[] = [];
  try {
    const txns = await getAllTransactions();
    trades = txns
      .filter((t) => t.type === "trade" && t.status === "complete" && t.roster_ids.includes(team.rosterId))
      .sort((a, b) => b.created - a.created)
      .map((t) => ({
        date: new Date(t.created).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        rosterIds: t.roster_ids,
        type: t.type,
      }));
  } catch {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{team.displayName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{team.division}</Badge>
            <span className="text-sm text-muted-foreground">
              {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ""} &middot; #{team.rank} overall
            </span>
          </div>
        </div>
        <Badge variant="ittwa">{season}</Badge>
      </div>

      {/* Cap Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Salary Cap</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={capSummary.totalSalary} max={capSummary.salaryCap} label={`$${capSummary.totalSalary.toFixed(1)} / $${capSummary.salaryCap}`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Years Cap</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={capSummary.totalYears} max={capSummary.yearsCap} label={`${capSummary.totalYears} / ${capSummary.yearsCap}`} />
          </CardContent>
        </Card>
      </div>

      {/* Roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roster ({activeContracts.length} players)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  <th className="px-4 py-3 text-left font-medium">Pos</th>
                  <th className="px-4 py-3 text-right font-medium">Salary</th>
                  <th className="px-4 py-3 text-center font-medium">Years</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">DP Original Owner</th>
                </tr>
              </thead>
              <tbody>
                {activeContracts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                      No active contracts found. Either the season hasn&apos;t started or the data is still loading.
                    </td>
                  </tr>
                ) : (
                  activeContracts.map((c, i) => (
                    <tr key={`${c.playerId}-${i}`} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{c.player}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.position}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {c.isMidSeasonPickup ? (
                          <Badge variant="warning">Mid-Season Pickup</Badge>
                        ) : (
                          `$${c.salary.toFixed(1)}`
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{c.years}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{c.dpOriginalOwner || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cap Penalties */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cap Penalties</CardTitle>
        </CardHeader>
        <CardContent>
          {capSummary.capPenalties.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No cap penalties. Remarkable financial discipline from this franchise.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Player</th>
                    <th className="px-4 py-2 text-right font-medium">Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {capSummary.capPenalties.map((cp, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-2">{cp.player}</td>
                      <td className="px-4 py-2 text-right text-ittwa font-medium tabular-nums">${cp.penalty.toFixed(1)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-4 py-2 font-semibold">Total</td>
                    <td className="px-4 py-2 text-right text-ittwa font-bold tabular-nums">${capSummary.totalPenalty.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Season Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-muted-foreground">
                  <th className="px-4 py-2 text-center font-medium w-16">Week</th>
                  <th className="px-4 py-2 text-left font-medium">Opponent</th>
                  <th className="px-4 py-2 text-center font-medium">Score</th>
                  <th className="px-4 py-2 text-center font-medium w-12">Result</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((g) => {
                  const won = g.completed && g.myScore > g.oppScore;
                  const lost = g.completed && g.myScore < g.oppScore;
                  return (
                    <tr key={g.week} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2 text-center text-muted-foreground">{g.week}</td>
                      <td className="px-4 py-2">{g.opponent}</td>
                      <td className="px-4 py-2 text-center tabular-nums">
                        {g.completed ? `${g.myScore.toFixed(2)} - ${g.oppScore.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {won && <span className="text-emerald-400 font-semibold">W</span>}
                        {lost && <span className="text-red-400 font-semibold">L</span>}
                        {g.completed && !won && !lost && <span className="text-muted-foreground">T</span>}
                        {!g.completed && <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No trades this season. Either everyone is happy or nobody has leverage.
            </p>
          ) : (
            <div className="space-y-2">
              {trades.map((t, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <Badge variant="ittwa">Trade</Badge>
                  <span className="text-sm text-muted-foreground">
                    {t.rosterIds.map((id) => rosterOwnerMap[id] || `Team ${id}`).join(" ↔ ")}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{t.date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
