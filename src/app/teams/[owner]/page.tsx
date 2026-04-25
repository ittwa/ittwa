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
    <div className="flex items-center gap-2.5">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">{label}</span>
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
      <div className="relative overflow-hidden border-b border-border">
        {/* Division gradient stripe */}
        <div
          className="h-1"
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
            <h1 className="font-heading font-black uppercase tracking-[0.01em] leading-none text-5xl sm:text-[64px]">
              {team.displayName.toUpperCase()}
            </h1>
            <div className="flex items-center gap-3.5 mt-[18px]">
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-[32px] font-extrabold text-emerald-400">{team.wins}</span>
                <span className="font-heading text-xl font-semibold text-muted-foreground">-</span>
                <span className="font-heading text-[32px] font-extrabold text-red-400">{team.losses}</span>
                {team.ties > 0 && <span className="font-heading text-xl text-muted-foreground ml-1">({team.ties}T)</span>}
              </div>
              <span className="font-heading text-sm font-semibold text-muted-foreground tracking-wide pl-2.5 border-l border-border whitespace-nowrap uppercase">Week {currentWeek} · {season}</span>
            </div>
          </div>

          {/* Right: stat boxes */}
          <div className="hidden sm:flex gap-0.5 items-stretch shrink-0">
            {[
              { label: "Salary Used", value: `$${rosterSalary.toFixed(0)}`, sub: "of $270", pct: rosterSalary / 270, color: "#FD4A48" },
              { label: "Years Used", value: String(rosterYears), sub: "of 60", pct: rosterYears / 60, color: "#E8B84B" },
              { label: "Roster Size", value: String(rosterPlayers.length), sub: "players", pct: null as number | null, color: divisionColor },
              { label: "Draft Picks", value: String(ownerDraftPicks.length), sub: "on hand", pct: null as number | null, color: divisionColor },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-secondary px-5 py-4 min-w-[110px] flex flex-col gap-1.5">
                <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground">{s.label}</span>
                <span className="font-heading text-[34px] font-extrabold leading-none" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[11px] text-muted-foreground">{s.sub}</span>
                {s.pct !== null && (
                  <div className="h-[3px] bg-border rounded-sm mt-0.5">
                    <div className="h-full rounded-sm" style={{ width: `${s.pct * 100}%`, backgroundColor: s.color }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile-only stat row */}
        <div className="sm:hidden flex gap-2 px-6 pb-6 overflow-x-auto">
          {[
            { label: "Salary", value: `$${rosterSalary.toFixed(0)}`, color: "#FD4A48" },
            { label: "Years", value: String(rosterYears), color: "#E8B84B" },
            { label: "Roster", value: String(rosterPlayers.length), color: divisionColor },
            { label: "Picks", value: String(ownerDraftPicks.length), color: divisionColor },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-secondary px-4 py-2 text-center shrink-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="font-heading text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
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
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-secondary">
            <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Salary scale</span>
            <div className="flex items-center gap-1">
              <div className="w-8 h-[3px] rounded-sm" style={{ background: "linear-gradient(90deg, #E8B84B, #FD4A48)" }} />
              <span className="text-[10px] text-muted-foreground">{`$1 → $${maxRosterSalary}`}</span>
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto">Total: <span className="text-ittwa font-semibold">{`$${rosterSalary.toFixed(0)}`}</span> / $270</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        {dp.salary > 0 ? <span className="text-gold">{`$${dp.salary.toFixed(1)}`}</span> : <span className="text-muted-foreground">—</span>}
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

      {/* ── Schedule ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <SectionTick label="Season Schedule" />
            <span className="font-heading text-lg font-bold text-muted-foreground">
              <span className="text-emerald-400">{schedule.filter(g => g.completed && g.myScore > g.oppScore).length}W</span>
              {" – "}
              <span className="text-ittwa">{schedule.filter(g => g.completed && g.myScore < g.oppScore).length}L</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-muted-foreground">
                  <th className="px-4 py-2 text-center font-medium w-12">Wk</th>
                  <th className="px-4 py-2 text-left font-medium">Opponent</th>
                  <th className="px-4 py-2 text-center font-medium">Score</th>
                  <th className="px-4 py-2 text-center font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((g) => {
                  const won = g.completed && g.myScore > g.oppScore;
                  const lost = g.completed && g.myScore < g.oppScore;
                  return (
                    <tr key={g.week} className="border-b border-border/50" style={{ background: won ? "rgba(74,222,128,0.03)" : lost ? "rgba(253,74,72,0.03)" : undefined }}>
                      <td className="px-4 py-2 text-center text-muted-foreground tabular-nums">W{g.week}</td>
                      <td className="px-4 py-2">{g.opponent}</td>
                      <td className="px-4 py-2 text-center tabular-nums">
                        {g.completed ? `${g.myScore.toFixed(2)} – ${g.oppScore.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {won && <span className="text-emerald-400 font-bold">W</span>}
                        {lost && <span className="text-red-400 font-bold">L</span>}
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
      </div>

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
