export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTeamsData, calculateStandings, getContracts, getCapHits, getAllTransactions, buildRosterOwnerMap } from "@/lib/data";
import { getLatestActiveContracts } from "@/lib/contracts";
import { getNFLPlayers } from "@/lib/sleeper";
import { OWNER_LAST_NAME_MAP, AUCTION_DATE } from "@/lib/config";
import { getDivisionVariant, getDivisionColor, getDivisionColorAlpha, getPositionVariant, getSalaryBarColor } from "@/lib/ui-utils";
import { ContractWithValue } from "@/types/contracts";
import { SleeperPlayersMap } from "@/types/sleeper";
import { PlayerAvatar } from "@/components/player-avatar";

export const revalidate = 300;

function getOwnerLastName(displayName: string): string {
  for (const [lastName, fullName] of Object.entries(OWNER_LAST_NAME_MAP)) {
    if (fullName === displayName) return lastName;
  }
  return displayName.split(" ").pop() || displayName;
}

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
  const contractByPlayerId = new Map<string, ContractWithValue>();
  const contractByName = new Map<string, ContractWithValue>();
  for (const c of contracts) {
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      contractByPlayerId.set(c.playerId, c);
    }
    if (c.player) {
      contractByName.set(c.player.toLowerCase().trim(), c);
    }
  }

  return sleeperPlayerIds.map((pid) => {
    const sleeperPlayer = nflPlayers[pid];
    let contract = contractByPlayerId.get(pid);
    if (!contract && sleeperPlayer) {
      const fullName = (sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`).toLowerCase().trim();
      contract = contractByName.get(fullName);
    }

    const name = sleeperPlayer
      ? (sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`)
      : contract?.player || `Unknown (${pid})`;

    return {
      playerId: pid,
      name,
      position: sleeperPlayer?.position || contract?.position || "—",
      nflTeam: sleeperPlayer?.team || "FA",
      salary: contract ? contract.salary : null,
      years: contract ? contract.years : null,
      dpOriginalOwner: contract?.dpOriginalOwner || "",
      isMidSeasonPickup: contract?.isMidSeasonPickup || false,
      hasContract: !!contract,
    };
  });
}

function sortRoster(players: RosterPlayer[]): RosterPlayer[] {
  return [...players].sort((a, b) => {
    const salA = a.salary ?? -1;
    const salB = b.salary ?? -1;
    if (salA !== salB) return salB - salA;
    return a.name.localeCompare(b.name);
  });
}

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading font-bold uppercase tracking-widest text-sm">{label}</span>
    </div>
  );
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
  const allActiveContracts = getLatestActiveContracts(contracts);

  const rosterPlayers = sortRoster(buildMergedRoster(team.players, nflPlayers, allActiveContracts));

  const currentSeasonNum = parseInt(season, 10);

  const ownerDraftPicks = contracts
    .filter((c) =>
      c.contractStatus.toLowerCase() === "active" &&
      c.position.toLowerCase() === "draft pick" &&
      c.owner.toLowerCase() === ownerLastName.toLowerCase() &&
      parseInt(c.season, 10) >= currentSeasonNum
    )
    .sort((a, b) => {
      const sd = a.season.localeCompare(b.season);
      if (sd !== 0) return sd;
      return a.player.localeCompare(b.player);
    });

  const draftPickSalary = ownerDraftPicks
    .filter((p) => parseInt(p.season, 10) === currentSeasonNum)
    .reduce((sum, p) => sum + p.salary, 0);
  const draftPickYears = ownerDraftPicks
    .filter((p) => parseInt(p.season, 10) === currentSeasonNum)
    .reduce((sum, p) => sum + p.years, 0);

  const rosterSalary = rosterPlayers.reduce((sum, p) => sum + (p.salary ?? 0), 0) + draftPickSalary;
  const rosterYears = rosterPlayers.reduce((sum, p) => sum + (p.years ?? 0), 0) + draftPickYears;
  const maxRosterSalary = Math.max(...rosterPlayers.map((p) => p.salary ?? 0), 1);

  const isBeforeAuction = new Date() < AUCTION_DATE;
  const displaySeason = isBeforeAuction ? currentSeasonNum : currentSeasonNum + 1;
  const ownerCapHits = capHits.filter((ch) => {
    if (ch.owner !== ownerLastName) return false;
    return Object.entries(ch.yearlyHits).some(([year, value]) => {
      const y = parseInt(year, 10);
      return (isBeforeAuction ? y >= currentSeasonNum : y > currentSeasonNum) && value > 0;
    });
  });

  // Schedule
  const schedule: { week: number; opponent: string; myScore: number; oppScore: number; completed: boolean }[] = [];
  for (let w = 1; w <= 13; w++) {
    const weekMatchups = allMatchups.get(w);
    if (!weekMatchups) { schedule.push({ week: w, opponent: "TBD", myScore: 0, oppScore: 0, completed: false }); continue; }
    const myMatchup = weekMatchups.find((m) => m.roster_id === team.rosterId);
    if (!myMatchup) { schedule.push({ week: w, opponent: "TBD", myScore: 0, oppScore: 0, completed: false }); continue; }
    const oppMatchup = weekMatchups.find((m) => m.matchup_id === myMatchup.matchup_id && m.roster_id !== team.rosterId);
    const oppName = oppMatchup ? (rosterOwnerMap[oppMatchup.roster_id] || `Team ${oppMatchup.roster_id}`) : "BYE";
    const completed = myMatchup.points > 0 || (oppMatchup?.points ?? 0) > 0;
    schedule.push({ week: w, opponent: oppName, myScore: myMatchup.points, oppScore: oppMatchup?.points ?? 0, completed });
  }

  // Trades
  let trades: { date: string; rosterIds: number[]; type: string }[] = [];
  try {
    const txns = await getAllTransactions();
    trades = txns
      .filter((t) => t.type === "trade" && t.status === "complete" && t.roster_ids.includes(team.rosterId))
      .sort((a, b) => b.created - a.created)
      .map((t) => ({ date: new Date(t.created).toLocaleDateString("en-US", { month: "short", day: "numeric" }), rosterIds: t.roster_ids, type: t.type }));
  } catch {}

  // Hero helpers
  const divisionColor = getDivisionColor(team.division);
  const ghostInitials = team.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        {/* Division gradient stripe */}
        <div
          className="h-1.5"
          style={{ background: `linear-gradient(90deg, ${divisionColor} 0%, transparent 60%)` }}
        />

        {/* Ghost initials watermark — division-colored */}
        <div
          className="absolute right-2 top-0 select-none pointer-events-none leading-none font-heading font-black"
          style={{ fontSize: "200px", color: getDivisionColorAlpha(team.division, 0.04) }}
        >
          {ghostInitials}
        </div>

        <div className="p-6 sm:p-8 flex items-start justify-between gap-6">
          {/* Left: identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge variant={getDivisionVariant(team.division)}>{team.division}</Badge>
              <Badge variant="outline">#{team.rank} Overall</Badge>
            </div>
            <h1 className="font-heading font-black uppercase tracking-tight leading-none mb-4 text-5xl sm:text-7xl">
              {team.displayName.toUpperCase()}
            </h1>
            <div className="flex items-center gap-4">
              <span className="font-heading text-2xl sm:text-3xl font-bold tracking-wide">
                <span className="text-emerald-400">{team.wins}</span>
                <span className="text-muted-foreground mx-2">—</span>
                <span className="text-red-400">{team.losses}</span>
                {team.ties > 0 && <span className="text-muted-foreground ml-1">({team.ties}T)</span>}
              </span>
              <span className="text-sm text-muted-foreground">Week {currentWeek} · {season}</span>
            </div>
          </div>

          {/* Right: stat boxes */}
          <div className="hidden sm:flex flex-col gap-2 shrink-0">
            <div className="flex gap-2">
              {[
                { label: "Salary", value: `$${rosterSalary.toFixed(0)}`, sub: "of $270", color: "text-gold" },
                { label: "Years", value: String(rosterYears), sub: "of 60", color: "" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border/50 bg-background/50 p-3 text-center min-w-[80px]">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`font-heading text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {[
                { label: "Roster", value: String(rosterPlayers.length), sub: "players", color: "" },
                { label: "Picks", value: String(ownerDraftPicks.length), sub: "active", color: "" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border/50 bg-background/50 p-3 text-center min-w-[80px]">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`font-heading text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-only stat row */}
        <div className="sm:hidden flex gap-3 px-6 pb-6 overflow-x-auto">
          {[
            { label: "Salary", value: `$${rosterSalary.toFixed(0)}`, color: "text-gold" },
            { label: "Years", value: String(rosterYears), color: "" },
            { label: "Roster", value: String(rosterPlayers.length), color: "" },
            { label: "Picks", value: String(ownerDraftPicks.length), color: "" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-center shrink-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className={`font-heading text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Roster ───────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTick label={`Roster (${rosterPlayers.length} players)`} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  <th className="px-4 py-3 text-left font-medium">Pos</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Team</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">DP Owner</th>
                  <th className="px-4 py-3 text-right font-medium">Salary</th>
                  <th className="px-4 py-3 text-center font-medium">Years</th>
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
                      <td className="px-4 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar playerId={p.playerId} playerName={p.name} position={p.position} />
                          {p.name}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={getPositionVariant(p.position)}>{p.position}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.nflTeam}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">{p.dpOriginalOwner || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {p.isMidSeasonPickup ? (
                          <Badge variant="warning">Pickup</Badge>
                        ) : p.salary !== null ? (
                          <div className="flex flex-col items-end">
                            <span>${p.salary.toFixed(1)}</span>
                            <div className="mt-0.5 rounded-full bg-secondary overflow-hidden" style={{ width: "64px", height: "3px" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max((p.salary / maxRosterSalary) * 100, 6)}%`,
                                  backgroundColor: getSalaryBarColor(p.salary),
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        {p.years !== null ? p.years : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Draft Picks ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTick label="Draft Picks" />
        </CardHeader>
        <CardContent>
          {ownerDraftPicks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No draft picks. Traded them all away, apparently.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">DP Original Owner</th>
                    <th className="px-4 py-2 text-right font-medium">Salary</th>
                    <th className="px-4 py-2 text-center font-medium">Years</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerDraftPicks.map((dp, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2 font-medium">{dp.player}</td>
                      <td className="px-4 py-2 text-muted-foreground">{dp.dpOriginalOwner || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {dp.salary > 0 ? `$${dp.salary.toFixed(1)}` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center tabular-nums">
                        {dp.years > 0 ? dp.years : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cap Hits ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTick label="Cap Hits" />
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

      {/* ── Schedule ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTick label="Season Schedule" />
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

      {/* ── Trade History ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTick label="Trade History" />
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
