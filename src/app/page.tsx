export const dynamic = 'force-dynamic';

import Link from "next/link";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  // Defaults for graceful fallback
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

    // Build rosterInfo map for power rankings
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

    // Run all remaining fetches in parallel
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

  return {
    leagueName,
    currentWeek,
    season,
    matchupPairs,
    standings,
    powerRankings,
    transactions,
  };
}

function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function transactionLabel(tx: SleeperTransaction): string {
  if (tx.type === "trade") return "Trade";
  if (tx.type === "free_agent") return "FA Pickup";
  if (tx.type === "waiver") return "Waiver Claim";
  return tx.type;
}

function transactionBadgeVariant(
  type: string
): "ittwa" | "success" | "warning" | "outline" {
  if (type === "trade") return "ittwa";
  if (type === "free_agent") return "success";
  if (type === "waiver") return "warning";
  return "outline";
}

// ─── Section components ────────────────────────────────────────────────────────

function MatchupsSection({
  pairs,
  week,
}: {
  pairs: MatchupPair[];
  week: number;
}) {
  if (pairs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
            Week {week} Matchups
          </CardTitle>
        </CardHeader>
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
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
          Week {week} Matchups
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {pairs.map((pair) => {
            const t1Winning = pair.team1.points >= pair.team2.points;
            return (
              <div
                key={pair.matchupId}
                className="flex items-center justify-between px-6 py-3 gap-4"
              >
                {/* Team 1 */}
                <div
                  className={`flex-1 text-right text-sm font-medium truncate ${
                    pair.completed && t1Winning
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {pair.team1.displayName}
                </div>

                {/* Scores */}
                <div className="flex items-center gap-2 shrink-0 font-mono text-sm tabular-nums">
                  <span
                    className={
                      pair.completed && t1Winning
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {pair.team1.points > 0 ? pair.team1.points.toFixed(2) : "—"}
                  </span>
                  <span className="text-muted-foreground text-xs">vs</span>
                  <span
                    className={
                      pair.completed && !t1Winning
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {pair.team2.points > 0 ? pair.team2.points.toFixed(2) : "—"}
                  </span>
                </div>

                {/* Team 2 */}
                <div
                  className={`flex-1 text-left text-sm font-medium truncate ${
                    pair.completed && !t1Winning
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
            Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No standings data. Everyone&apos;s tied at 0-0 in their hearts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
          Standings
        </CardTitle>
        <Link
          href="/standings"
          className="text-xs text-ittwa hover:underline font-medium"
        >
          Full Standings →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_4rem_5rem_auto] gap-x-3 px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
          <span>#</span>
          <span>Owner</span>
          <span className="text-center">W-L</span>
          <span className="text-right">PF</span>
          <span className="text-right hidden sm:block">Division</span>
        </div>
        <div className="divide-y divide-border">
          {standings.map((entry) => (
            <div
              key={entry.rosterId}
              className="grid grid-cols-[2rem_1fr_4rem_5rem_auto] gap-x-3 items-center px-6 py-2.5 text-sm"
            >
              <span
                className={`font-semibold tabular-nums ${
                  entry.rank <= 3 ? "text-ittwa" : "text-muted-foreground"
                }`}
              >
                {entry.rank}
              </span>
              <span className="font-medium truncate">{entry.displayName}</span>
              <span className="text-center tabular-nums text-muted-foreground">
                {entry.wins}-{entry.losses}
              </span>
              <span className="text-right tabular-nums text-muted-foreground font-mono text-xs">
                {entry.pointsFor.toFixed(1)}
              </span>
              <span className="text-right hidden sm:block">
                <Badge variant="outline" className="text-xs">
                  {entry.division}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PowerRankingsSection({
  rankings,
}: {
  rankings: PowerRankingEntry[];
}) {
  const top5 = rankings.slice(0, 5);

  if (top5.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
            Power Rankings
          </CardTitle>
          <Link
            href="/power-rankings"
            className="text-xs text-ittwa hover:underline font-medium"
          >
            Full Rankings →
          </Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Not enough data yet. Check back after week 1. Or don&apos;t.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
          Power Rankings
        </CardTitle>
        <Link
          href="/power-rankings"
          className="text-xs text-ittwa hover:underline font-medium"
        >
          Full Rankings →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {top5.map((entry) => {
            const rankChangeSymbol =
              entry.rankChange > 0
                ? `▲${entry.rankChange}`
                : entry.rankChange < 0
                ? `▼${Math.abs(entry.rankChange)}`
                : "—";
            const rankChangeColor =
              entry.rankChange > 0
                ? "text-emerald-400"
                : entry.rankChange < 0
                ? "text-ittwa"
                : "text-muted-foreground";

            return (
              <div
                key={entry.rosterId}
                className="flex items-center gap-3 px-6 py-3"
              >
                {/* Rank */}
                <span className="w-6 text-center font-semibold text-ittwa text-sm shrink-0">
                  {entry.rank}
                </span>

                {/* Name + division */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.division}
                  </p>
                </div>

                {/* All-play win% */}
                <div className="text-right shrink-0">
                  <p className="text-sm tabular-nums font-mono">
                    {(entry.allPlayWinPct * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">All-Play</p>
                </div>

                {/* Rank change */}
                <span
                  className={`w-8 text-right text-xs font-medium tabular-nums shrink-0 ${rankChangeColor}`}
                >
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
  // Filter to meaningful transactions, sort newest-first, take up to 8
  const filtered = transactions
    .filter(
      (tx) =>
        tx.status === "complete" &&
        (tx.type === "trade" || (tx.adds !== null && Object.keys(tx.adds).length > 0))
    )
    .sort((a, b) => b.created - a.created)
    .slice(0, 8);

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No transactions found. Everyone&apos;s standing pat, apparently.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-muted-foreground uppercase tracking-wider">
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {filtered.map((tx) => {
            const teams = tx.roster_ids
              .map((id) => rosterOwnerMap[id] || `Team ${id}`)
              .join(" · ");

            return (
              <div
                key={tx.transaction_id}
                className="flex items-center justify-between gap-3 px-6 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant={transactionBadgeVariant(tx.type)}>
                    {transactionLabel(tx)}
                  </Badge>
                  <span className="text-sm text-muted-foreground truncate">
                    {teams}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {formatDate(tx.created)}
                </span>
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
  const {
    leagueName,
    currentWeek,
    season,
    matchupPairs,
    standings,
    powerRankings,
    transactions,
  } = await fetchDashboardData();

  // Build a roster-owner map for transaction display from standings data
  const rosterOwnerMap: Record<number, string> = {};
  for (const entry of standings) {
    rosterOwnerMap[entry.rosterId] = entry.displayName;
  }

  const weekToShow = Math.max(currentWeek - 1, 1);

  return (
    <div className="space-y-8">
      {/* ── Hero / League Header ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <Image
            src="https://www.ittwa.com/badge.png"
            alt="ITTWA League Logo"
            width={72}
            height={72}
            className="rounded-xl border border-border shadow-md"
            unoptimized
          />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              ITTWA
            </h1>
            <Badge variant="ittwa" className="text-xs">
              {season}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Week {currentWeek}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl leading-relaxed">
            Founded in 2014, ITTWA is a contract dynasty league that tries its
            best to ignore Hogan and tolerate Katz.
          </p>
        </div>
      </section>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <MatchupsSection pairs={matchupPairs} week={weekToShow} />
          <PowerRankingsSection rankings={powerRankings} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <StandingsSection standings={standings} />
          <TransactionsSection
            transactions={transactions}
            rosterOwnerMap={rosterOwnerMap}
          />
        </div>
      </div>
    </div>
  );
}
