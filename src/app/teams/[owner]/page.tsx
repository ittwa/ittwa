export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getTeamsData, calculateStandings, getContracts, getCapHits, getAllTransactions, buildRosterOwnerMap } from "@/lib/data";
import { getLatestActiveContracts } from "@/lib/contracts";
import { getNFLPlayers } from "@/lib/sleeper";
import { OWNER_LAST_NAME_MAP, AUCTION_DATE } from "@/lib/config";
import { ContractWithValue } from "@/types/contracts";
import { SleeperPlayersMap } from "@/types/sleeper";

export const revalidate = 300;

// Reverse lookup: display name → owner last name (for Sheets)
function getOwnerLastName(displayName: string): string {
  for (const [lastName, fullName] of Object.entries(OWNER_LAST_NAME_MAP)) {
    if (fullName === displayName) return lastName;
  }
  return displayName.split(" ").pop() || displayName;
}

// Build a merged roster: Sleeper players as source of truth, contract data merged in
interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string;
  salary: number | null;
  years: number | null;
  dpOriginalOwner: string;
  isMidSeasonPickup: boolean;
  hasContract: boolean;
}

function buildMergedRoster(
  sleeperPlayerIds: string[],
  nflPlayers: SleeperPlayersMap,
  contracts: ContractWithValue[]
): RosterPlayer[] {
  // Index contracts by player_id for quick lookup.
  // Use ALL active contracts (not just for one owner) so we can match by player_id
  // regardless of any owner-name mismatches in the spreadsheet.
  const contractByPlayerId = new Map<string, ContractWithValue>();
  const contractByName = new Map<string, ContractWithValue>();
  for (const c of contracts) {
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      contractByPlayerId.set(c.playerId, c);
    }
    // Also index by normalized player name as fallback
    if (c.player) {
      contractByName.set(c.player.toLowerCase().trim(), c);
    }
  }

  return sleeperPlayerIds.map((pid) => {
    const sleeperPlayer = nflPlayers[pid];
    // Try matching by player_id first, then by name as fallback
    let contract = contractByPlayerId.get(pid);
    if (!contract && sleeperPlayer) {
      const fullName = (sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`).toLowerCase().trim();
      contract = contractByName.get(fullName);
    }

    const name = sleeperPlayer
      ? (sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`)
      : contract?.player || `Unknown (${pid})`;

    const position = sleeperPlayer?.position || contract?.position || "—";
    const nflTeam = sleeperPlayer?.team || "FA";

    return {
      playerId: pid,
      name,
      position,
      nflTeam,
      salary: contract ? contract.salary : null,
      years: contract ? contract.years : null,
      dpOriginalOwner: contract?.dpOriginalOwner || "",
      isMidSeasonPickup: contract?.isMidSeasonPickup || false,
      hasContract: !!contract,
    };
  });
}

// Sort roster: starters-friendly order (QB, RB, WR, TE, K, DEF, then rest)
const POS_ORDER: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6, "D/ST": 6 };
function sortRoster(players: RosterPlayer[]): RosterPlayer[] {
  return [...players].sort((a, b) => {
    const posA = POS_ORDER[a.position] || 99;
    const posB = POS_ORDER[b.position] || 99;
    if (posA !== posB) return posA - posB;
    return a.name.localeCompare(b.name);
  });
}

export default async function TeamDetailPage({ params }: { params: Promise<{ owner: string }> }) {
  const { owner: rawOwner } = await params;
  const ownerName = decodeURIComponent(rawOwner);

  const [teamsData, contracts, capHits, rosterOwnerMap, nflPlayers] = await Promise.all([
    getTeamsData(),
    getContracts(),
    getCapHits(),
    buildRosterOwnerMap(),
    getNFLPlayers(),
  ]);

  const { teams, season, currentWeek, allMatchups } = teamsData;
  const standings = calculateStandings(teams, allMatchups);

  const team = standings.find((t) => t.displayName === ownerName);
  if (!team) return notFound();

  const ownerLastName = getOwnerLastName(ownerName);
  // Get ALL active contracts for the season (not filtered by owner) so we can
  // match against Sleeper roster player IDs regardless of owner-name quirks.
  const allActiveContracts = getLatestActiveContracts(contracts);

  // Build roster from Sleeper player IDs (source of truth) merged with contract data.
  const rosterPlayers = sortRoster(
    buildMergedRoster(team.players, nflPlayers, allActiveContracts)
  );

  // Totals from the actual roster (not raw spreadsheet) so only on-roster players count.
  const rosterSalary = rosterPlayers.reduce((sum, p) => sum + (p.salary ?? 0), 0);
  const rosterYears = rosterPlayers.reduce((sum, p) => sum + (p.years ?? 0), 0);
  const currentSeasonNum = parseInt(season, 10);
  const isBeforeAuction = new Date() < AUCTION_DATE;
  const displaySeason = isBeforeAuction ? currentSeasonNum : currentSeasonNum + 1;
  const ownerCapHits = capHits.filter((ch) => {
    if (ch.owner !== ownerLastName) return false;
    return Object.entries(ch.yearlyHits).some(([year, value]) => {
      const y = parseInt(year, 10);
      return (isBeforeAuction ? y >= currentSeasonNum : y > currentSeasonNum) && value > 0;
    });
  });

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
            <CardTitle className="text-sm">Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={rosterSalary} max={270} label={`$${rosterSalary.toFixed(1)} / $270`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Years</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={rosterYears} max={60} label={`${rosterYears} / 60`} />
          </CardContent>
        </Card>
      </div>

      {/* Roster — Sleeper is source of truth, contract data merged in */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roster ({rosterPlayers.length} players)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  <th className="px-4 py-3 text-left font-medium">Pos</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Team</th>
                  <th className="px-4 py-3 text-right font-medium">Salary</th>
                  <th className="px-4 py-3 text-center font-medium">Years</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">DP Original Owner</th>
                </tr>
              </thead>
              <tbody>
                {rosterPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                      No players on this roster. Rebuild season, apparently.
                    </td>
                  </tr>
                ) : (
                  rosterPlayers.map((p) => (
                    <tr key={p.playerId} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.position}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.nflTeam}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {p.isMidSeasonPickup ? (
                          <Badge variant="warning">Mid-Season Pickup</Badge>
                        ) : p.salary !== null ? (
                          `$${p.salary.toFixed(1)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        {p.years !== null ? p.years : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{p.dpOriginalOwner || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cap Hits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cap Hits</CardTitle>
        </CardHeader>
        <CardContent>
          {ownerCapHits.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No open cap hits. Remarkable financial discipline from this franchise.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Player</th>
                    <th className="px-4 py-2 text-left font-medium">Pos</th>
                    <th className="px-4 py-2 text-right font-medium">Salary</th>
                    <th className="px-4 py-2 text-center font-medium">Years</th>
                    <th className="px-4 py-2 text-right font-medium">Cap Hit</th>
                    <th className="px-4 py-2 text-right font-medium">{displaySeason} Cap Hit</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerCapHits.map((ch, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-2 font-medium">{ch.player}</td>
                      <td className="px-4 py-2 text-muted-foreground">{ch.position}</td>
                      <td className="px-4 py-2 text-right tabular-nums">${ch.salary.toFixed(1)}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{ch.years}</td>
                      <td className="px-4 py-2 text-right text-ittwa font-medium tabular-nums">${ch.capHit.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-ittwa font-medium tabular-nums">${(ch.yearlyHits[displaySeason] || 0).toFixed(1)}</td>
                    </tr>
                  ))}
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
