export const dynamic = 'force-dynamic';

import Link from "next/link";
import Image from "next/image";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getTeamsData,
  getMatchupPairs,
  getAllTransactions,
  calculateStandings,
  calculatePowerRankings,
  buildRosterOwnerMap,
  getNFLState,
} from "@/lib/data";
import { getDivisionVariant } from "@/lib/ui-utils";
import { SleeperTransaction, MatchupPair } from "@/types/sleeper";
import { StandingsEntry } from "@/lib/standings";
import { PowerRankingEntry } from "@/lib/power-rankings";

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchDashboardData(): Promise<{
  leagueName: string;
  currentWeek: number;
  season: string;
  matchupPairs: MatchupPair[];
  standings: StandingsEntry[];
  powerRankings: PowerRankingEntry[];
  transactions: SleeperTransaction[];
}> {
  let leagueName = "ITTWA";
  let currentWeek = 1;
  let season = new Date().getFullYear().toString();
  let matchupPairs: MatchupPair[] = [];
  let standings: StandingsEntry[] = [];
  let powerRankings: PowerRankingEntry[] = [];
  let transactions: SleeperTransaction[] = [];

  try {
    const [teamsData, nflState] = await Promise.all([
      getTeamsData(),
      getNFLState(),
    ]);

    season = teamsData.season;
    currentWeek = teamsData.currentWeek;

    const rosterInfo = new Map<
      number,
      { displayName: string; division: string; wins: number; losses: number }
    >();
    for (const team of teamsData.teams) {
      rosterInfo.set(team.rosterId, {
        displayName: team.displayName,
        division: team.division,
        wins: team.wins,
        losses: team.losses,
      });
    }

    const weekToShow = Math.max(currentWeek - 1, 1);
    const [pairs, txns, ownerMap] = await Promise.all([
      getMatchupPairs(weekToShow).catch(() => [] as MatchupPair[]),
      getAllTransactions().catch(() => [] as SleeperTransaction[]),
      buildRosterOwnerMap().catch(() => ({} as Record<number, string>)),
    ]);

    matchupPairs = pairs;
    transactions = txns;
    standings = calculateStandings(teamsData.teams, teamsData.allMatchups);
    powerRankings = calculatePowerRankings(teamsData.allMatchups, rosterInfo);
  } catch (err) {
    console.error("[dashboard] data fetch error:", err);
  }

  return { leagueName, currentWeek, season, matchupPairs, standings, powerRankings, transactions };
}

function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function transactionLabel(tx: SleeperTransaction): string {
  if (tx.type === "trade") return "Trade";
  if (tx.type === "free_agent") return "FA Pickup";
  if (tx.type === "waiver") return "Waiver Claim";
  return tx.type;
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading font-bold uppercase tracking-widest text-sm">{label}</span>
    </div>
  );
}

// ─── Section components ────────────────────────────────────────────────────────

function MatchupsSection({ pairs, week }: { pairs: MatchupPair[]; week: number }) {
  if (pairs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3"><SectionTick label={`Week ${week} Matchups`} /></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No matchup data found. The NFL is probably on a bye.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3"><SectionTick label={`Week ${week} Matchups`} /></CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {pairs.map((pair) => {
            const t1Winning = pair.team1.points >= pair.team2.points;
            return (
              <div key={pair.matchupId} className="flex items-center justify-between px-6 py-3 gap-4">
                <div className={`flex-1 text-right text-sm font-medium truncate ${pair.completed && t1Winning ? "text-foreground" : "text-muted-foreground"}`}>
                  {pair.team1.displayName}
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono text-sm tabular-nums">
                  <span className={pair.completed && t1Winning ? "text-foreground font-semibold" : "text-muted-foreground"}>
                    {pair.team1.points > 0 ? pair.team1.points.toFixed(2) : "—"}
                  </span>
                  <span className="text-muted-foreground text-xs">vs</span>
                  <span className={pair.completed && !t1Winning ? "text-foreground font-semibold" : "text-muted-foreground"}>
                    {pair.team2.points > 0 ? pair.team2.points.toFixed(2) : "—"}
                  </span>
                </div>
                <div className={`flex-1 text-left text-sm font-medium truncate ${pair.completed && !t1Winning ? "text-foreground" : "text-muted-foreground"}`}>
                  {pair.team2.displayName}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StandingsSection({ standings }: { standings: StandingsEntry[] }) {
  if (standings.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <SectionTick label="Standings" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No standings data. Everyone&apos;s tied at 0-0 in their hearts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <SectionTick label="Standings" />
        <Link href="/standings" className="text-xs text-ittwa hover:underline font-medium">Full Standings →</Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-2 text-left w-8">#</th>
                <th className="px-2 py-2 text-left">Owner</th>
                <th className="px-2 py-2 text-center w-16">W-L</th>
                <th className="px-2 py-2 text-right w-16">PF</th>
                <th className="px-6 py-2 text-right hidden sm:table-cell">Division</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {standings.map((entry) => (
                <tr
                  key={entry.rosterId}
                  className={entry.rank <= 3 ? "bg-ittwa/5" : ""}
                >
                  <td className="px-6 py-2.5">
                    <span className={`font-semibold tabular-nums ${entry.rank <= 3 ? "text-ittwa" : "text-muted-foreground"}`}>
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 font-medium truncate max-w-[140px]">{entry.displayName}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                    {entry.wins}-{entry.losses}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground font-mono text-xs">
                    {entry.pointsFor.toFixed(1)}
                  </td>
                  <td className="px-6 py-2.5 text-right hidden sm:table-cell">
                    <Badge variant={getDivisionVariant(entry.division)} className="text-xs">
                      {entry.division}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PowerRankingsSection({ rankings }: { rankings: PowerRankingEntry[] }) {
  const top5 = rankings.slice(0, 5);

  if (top5.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <SectionTick label="Power Rankings" />
          <Link href="/power-rankings" className="text-xs text-ittwa hover:underline font-medium">Full Rankings →</Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">Not enough data yet. Check back after week 1. Or don&apos;t.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <SectionTick label="Power Rankings" />
        <Link href="/power-rankings" className="text-xs text-ittwa hover:underline font-medium">Full Rankings →</Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {top5.map((entry) => {
            const rankChangeSymbol =
              entry.rankChange > 0 ? `▲${entry.rankChange}` :
              entry.rankChange < 0 ? `▼${Math.abs(entry.rankChange)}` : "—";
            const rankChangeColor =
              entry.rankChange > 0 ? "text-emerald-400" :
              entry.rankChange < 0 ? "text-ittwa" : "text-muted-foreground";

            return (
              <div key={entry.rosterId} className="flex items-center gap-3 px-6 py-3">
                {entry.rank <= 3 ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-ittwa text-white text-xs font-bold shrink-0">{entry.rank}</span>
                ) : (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-border text-muted-foreground text-xs font-medium shrink-0">{entry.rank}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{entry.displayName}</p>
                  <div>
                    <Badge variant={getDivisionVariant(entry.division)} className="text-[10px] px-1.5 py-0">
                      {entry.division}
                    </Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm tabular-nums font-mono">{(entry.allPlayWinPct * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">All-Play</p>
                </div>
                <span className={`w-8 text-right text-xs font-medium tabular-nums shrink-0 ${rankChangeColor}`}>
                  {rankChangeSymbol}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsSection({
  transactions,
  rosterOwnerMap,
}: {
  transactions: SleeperTransaction[];
  rosterOwnerMap: Record<number, string>;
}) {
  const filtered = transactions
    .filter((tx) => tx.status === "complete" && (tx.type === "trade" || (tx.adds !== null && Object.keys(tx.adds).length > 0)))
    .sort((a, b) => b.created - a.created)
    .slice(0, 8);

  const txBadgeClass = (type: string) => {
    if (type === "trade") return "bg-amber-950/60 text-amber-400 border border-amber-800";
    if (type === "free_agent") return "bg-emerald-950/60 text-emerald-400 border border-emerald-800";
    if (type === "waiver") return "bg-red-950/60 text-red-400 border border-red-800";
    return "bg-secondary text-secondary-foreground border border-border";
  };

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3"><SectionTick label="Recent Transactions" /></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No transactions found. Everyone&apos;s standing pat, apparently.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3"><SectionTick label="Recent Transactions" /></CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {filtered.map((tx) => {
            const teams = tx.roster_ids.map((id) => rosterOwnerMap[id] || `Team ${id}`).join(" · ");
            return (
              <div key={tx.transaction_id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${txBadgeClass(tx.type)}`}>
                    {transactionLabel(tx)}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">{teams}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{formatDate(tx.created)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { leagueName, currentWeek, season, matchupPairs, standings, powerRankings, transactions } =
    await fetchDashboardData();

  const rosterOwnerMap: Record<number, string> = {};
  for (const entry of standings) {
    rosterOwnerMap[entry.rosterId] = entry.displayName;
  }

  const weekToShow = Math.max(currentWeek - 1, 1);
  const tradeCount = transactions.filter((t) => t.type === "trade" && t.status === "complete").length;
  const txnCount = transactions.filter((t) => t.status === "complete").length;
  const seasonCount = parseInt(season) - 2013;

  return (
    <div className="space-y-8">
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 rounded-xl border border-border bg-card p-6">
        {/* Left: identity */}
        <div className="flex items-center gap-5">
          <Image
            src="https://www.ittwa.com/badge.png"
            alt="ITTWA League Logo"
            width={64}
            height={64}
            className="rounded-xl border border-border shadow-md shrink-0"
            unoptimized
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-heading text-5xl font-black uppercase tracking-tight leading-none text-foreground">
                ITTWA
              </h1>
              <span className="inline-flex items-center rounded-md bg-gold/20 text-gold border border-gold/40 px-2 py-0.5 text-xs font-medium">
                {season}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Contract dynasty league · Est. 2014</p>
          </div>
        </div>

        {/* Right: stat counters */}
        <div className="flex gap-8 sm:gap-6">
          <div className="text-center">
            <p className="font-heading text-3xl font-black text-gold tabular-nums">{tradeCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Trades</p>
          </div>
          <div className="text-center">
            <p className="font-heading text-3xl font-black text-gold tabular-nums">{txnCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
          </div>
          <div className="text-center">
            <p className="font-heading text-3xl font-black text-gold tabular-nums">{seasonCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Seasons</p>
          </div>
        </div>
      </section>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <MatchupsSection pairs={matchupPairs} week={weekToShow} />
          <PowerRankingsSection rankings={powerRankings} />
        </div>
        <div className="space-y-6">
          <StandingsSection standings={standings} />
          <TransactionsSection transactions={transactions} rosterOwnerMap={rosterOwnerMap} />
        </div>
      </div>
    </div>
  );
}
