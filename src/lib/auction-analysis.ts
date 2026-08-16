import type { AuctionResultRow } from "@/types/auction";
import { calculateContractValue } from "./contracts";

// Auction performance analytics, derived purely from the awarded results (and,
// for the market comparison, a per-player market value). Kept out of the React
// component so the math is unit-testable and never drifts from the league's
// value formula (calculateContractValue is the same helper used everywhere).

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Positions we break spending out by, in display order. Anything else (rare
// write-in positions) is bucketed under "OTHER" so totals still reconcile.
export const ANALYSIS_POSITIONS = ["QB", "RB", "WR", "TE", "DEF"] as const;
function bucketPosition(pos: string): string {
  return (ANALYSIS_POSITIONS as readonly string[]).includes(pos) ? pos : "OTHER";
}

export interface OwnerPerformance {
  owner: string;
  picks: number;
  salarySpent: number;
  contractValue: number; // Σ calculateContractValue(salary, years)
  surplus: number; // contractValue − salarySpent (higher = more value per $)
  avgYears: number;
  spendByPosition: Record<string, number>;
  // Market comparison, over this owner's picks that have a market value:
  //   expectedSpend = that player's share of total market value, scaled to the
  //   total $ actually spent on covered players. marketDelta = actual − expected
  //   (negative = paid under market share = deals; positive = reaches).
  // null when none of the owner's picks have a market value.
  expectedSpend: number | null;
  marketDelta: number | null;
}

export interface PositionTrend {
  position: string;
  picks: number;
  totalSalary: number;
  avgSalary: number;
  avgYears: number;
  avgValue: number; // avg contract value
}

// League-wide averages per position, for the "how did the market price each
// position" view. Positions with no picks are omitted.
export function computePositionTrends(results: AuctionResultRow[]): PositionTrend[] {
  const byPos = new Map<string, AuctionResultRow[]>();
  for (const r of results) {
    const pos = bucketPosition(r.position);
    const arr = byPos.get(pos) ?? [];
    arr.push(r);
    byPos.set(pos, arr);
  }

  const order = [...ANALYSIS_POSITIONS, "OTHER"];
  const trends: PositionTrend[] = [];
  for (const pos of order) {
    const picks = byPos.get(pos);
    if (!picks || picks.length === 0) continue;
    const totalSalary = picks.reduce((s, r) => s + r.salary, 0);
    const totalYears = picks.reduce((s, r) => s + r.years, 0);
    const totalValue = picks.reduce((s, r) => s + calculateContractValue(r.salary, r.years), 0);
    trends.push({
      position: pos,
      picks: picks.length,
      totalSalary: round1(totalSalary),
      avgSalary: round1(totalSalary / picks.length),
      avgYears: round1(totalYears / picks.length),
      avgValue: round1(totalValue / picks.length),
    });
  }
  return trends;
}

// Per-owner performance. `marketValueByPlayer` maps player_id → a market value
// (e.g. FantasyCalc dynasty value); players missing from it are simply excluded
// from the market comparison (their spend still counts everywhere else).
export function computeOwnerPerformance(
  results: AuctionResultRow[],
  marketValueByPlayer: Map<string, number>,
): OwnerPerformance[] {
  // Market benchmark is computed over only the picks that have a positive
  // market value, then redistributed across that same covered spend — so
  // "expected" and "actual" are compared on identical footing.
  const covered = results.filter((r) => (marketValueByPlayer.get(r.playerId) ?? 0) > 0);
  const totalMarket = covered.reduce((s, r) => s + (marketValueByPlayer.get(r.playerId) as number), 0);
  const coveredSpend = covered.reduce((s, r) => s + r.salary, 0);
  const expectedFor = (r: AuctionResultRow): number | null => {
    const mv = marketValueByPlayer.get(r.playerId) ?? 0;
    if (mv <= 0 || totalMarket <= 0) return null;
    return (mv / totalMarket) * coveredSpend;
  };

  const byOwner = new Map<string, AuctionResultRow[]>();
  for (const r of results) {
    const arr = byOwner.get(r.winner) ?? [];
    arr.push(r);
    byOwner.set(r.winner, arr);
  }

  const out: OwnerPerformance[] = [];
  for (const [owner, picks] of byOwner) {
    const salarySpent = picks.reduce((s, r) => s + r.salary, 0);
    const contractValue = picks.reduce((s, r) => s + calculateContractValue(r.salary, r.years), 0);
    const totalYears = picks.reduce((s, r) => s + r.years, 0);

    const spendByPosition: Record<string, number> = {};
    for (const r of picks) {
      const pos = bucketPosition(r.position);
      spendByPosition[pos] = round1((spendByPosition[pos] ?? 0) + r.salary);
    }

    // Expected/actual only over this owner's covered picks.
    let expectedSpend: number | null = null;
    let actualCovered = 0;
    let hasCovered = false;
    for (const r of picks) {
      const exp = expectedFor(r);
      if (exp === null) continue;
      hasCovered = true;
      expectedSpend = (expectedSpend ?? 0) + exp;
      actualCovered += r.salary;
    }

    out.push({
      owner,
      picks: picks.length,
      salarySpent: round1(salarySpent),
      contractValue: round1(contractValue),
      surplus: round1(contractValue - salarySpent),
      avgYears: round1(totalYears / picks.length),
      spendByPosition,
      expectedSpend: hasCovered ? round1(expectedSpend as number) : null,
      marketDelta: hasCovered ? round1(actualCovered - (expectedSpend as number)) : null,
    });
  }

  // Most value-per-dollar first by default.
  out.sort((a, b) => b.surplus - a.surplus);
  return out;
}
