// The contract-adjusted trade valuation engine — pure functions, no React.
//
// Surplus-value model, kept in DOLLAR-SPACE until the last possible step:
//
//   1. production  = FantasyCalc value (the player's market production).
//                    Bench (non-starter) production is discounted, and a player
//                    with no NFL team carries none.
//   2. expectedSalary($) = what a player of this position + production rank
//                          SHOULD cost, from the league's salary distribution.
//   3. overpay($)   = actualSalary - expectedSalary   (negative = bargain)
//   4. adjustedOverpay($) = overpay × termMultiplier  (short rentals hurt less;
//                          bargains gain value with term)
//   5. value(points) = production - adjustedOverpay × LEAGUE_VALUE_PER_DOLLAR
//                      └─ the ONLY place the two scales touch ─┘
//   6. floors (in points), in order: soft floor for startable players,
//      elite-asset floor, then the absolute hard floor at the cut penalty
//      −(0.5 × salary × years × LEAGUE_VALUE_PER_DOLLAR): trading a player away
//      can never be worth more than what cutting him would cost.
//
// `adjusted` (display) = value × SURPLUS_PER_DOLLAR / SURPLUS_PER_DOLLAR_BASE,
// so by default it equals the points value and the Tweaks slider just scales it.
//
// A trade compares the total adjusted value each side RECEIVES, evaluated under
// the receiving side's strategy.

import { SALARY_CAP, YEARS_CAP } from "@/lib/config";
import { DEFAULT_CONFIG, type SalaryTier, type Strategy, type TradeAnalyzerConfig } from "./config";
import type { TradeAsset, TradeTeam } from "./types";

export type { Strategy } from "./config";

export interface AssetEvaluation {
  asset: TradeAsset;
  production: number; // effective production points (bench-discounted, 0 if no team)
  expectedSalary: number; // $ a player of this rank/position should cost
  overpayDollars: number; // actualSalary - expectedSalary (negative = bargain)
  adjustedOverpayDollars: number; // overpay after the term-risk multiplier
  valueDollars: number; // canonical value in production-value points (post-floor)
  multiplier: number; // strategy multiplier applied
  adjusted: number; // value scaled to display points
  badge: "value" | "overpay" | null;
}

export interface VerdictResult {
  kind: "empty" | "fair" | "slight" | "heavy";
  favored: "A" | "B" | null;
  diff: number; // teamA received value - teamB received value
  pct: number; // |diff| / total
  headline: string;
}

export interface TeamCapImpact {
  rosterId: number;
  owner: string;
  salaryDelta: number;
  yearsDelta: number;
  newSalary: number;
  newYears: number;
  capSpaceAfter: number;
  yearsSpaceAfter: number;
  overCap: boolean;
  overYears: boolean;
}

export interface BalancingSuggestion {
  asset: TradeAsset;
  adjusted: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Term multiplier on an overpay (≥0) or a discount (<0). Overpays on short
// deals hurt less (cheap to escape); discounts gain value the longer they run.
function termMultiplier(overpay: number, years: number, config: TradeAnalyzerConfig): number {
  const table = overpay >= 0 ? config.TERM_RISK_OVERPAY : config.TERM_DISCOUNT;
  if (years <= 0) return table[0] ?? table[1] ?? 1;
  return table[years] ?? table[5] ?? 1;
}

// Walk the position's expected-salary tiers (ordered by ascending maxRank) and
// return the dollar figure for a player at `rank`. A null rank (unmatched / no
// FantasyCalc rank) is treated as deep bench → the last (cheapest) tier.
function expectedSalary(
  position: string,
  rank: number | null,
  config: TradeAnalyzerConfig,
): number {
  const tiers: SalaryTier[] = config.EXPECTED_SALARY[position] ?? config.EXPECTED_SALARY_DEFAULT;
  const effectiveRank = rank ?? Infinity;
  for (const tier of tiers) {
    if (effectiveRank <= tier.maxRank) return tier.dollars;
  }
  return tiers[tiers.length - 1]?.dollars ?? 0;
}

function startableThreshold(position: string, config: TradeAnalyzerConfig): number {
  return config.STARTABLE_RANK[position] ?? config.STARTABLE_RANK_DEFAULT;
}

export function strategyMultiplier(
  asset: TradeAsset,
  strategy: Strategy,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
): number {
  if (strategy === "neutral") return 1;

  const isPick = asset.type === "pick";
  const age = asset.age;
  const young = age !== null && age <= config.YOUNG_AGE;
  const aging = age !== null && age >= config.AGING_AGE;
  const shortDeal = asset.years > 0 && asset.years <= config.SHORT_DEAL_YEARS;
  const longDeal = asset.years >= config.LONG_DEAL_YEARS;
  const cheap = asset.salary <= config.CHEAP_SALARY;

  if (strategy === "rebuilding") {
    if (isPick) return config.REBUILD_PICK;
    if (young) return config.REBUILD_YOUNG;
    if (cheap && longDeal) return config.REBUILD_CHEAP_LONG;
    if (aging && shortDeal) return config.REBUILD_AGING_SHORT;
    return 1;
  }

  // competing
  if (isPick) return config.COMPETE_PICK;
  if (young) return config.COMPETE_YOUNG;
  if (aging && shortDeal) return config.COMPETE_AGING_SHORT;
  return 1;
}

export function evaluateAsset(
  asset: TradeAsset,
  strategy: Strategy,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
): AssetEvaluation {
  const rate = config.LEAGUE_VALUE_PER_DOLLAR;
  const toDisplay = (points: number) =>
    points * (config.SURPLUS_PER_DOLLAR / config.SURPLUS_PER_DOLLAR_BASE);

  // ── Picks: no contract overpay (rookie deals are league-standard cheap), so
  // a pick's value is simply its production, tilted by strategy. Pick valuation
  // is intentionally left as-is in this pass. ───────────────────────────────
  if (asset.type === "pick") {
    const multiplier = strategyMultiplier(asset, strategy, config);
    const valueDollars = round1(Math.max(asset.rawValue, 0) * multiplier);
    return {
      asset,
      production: round1(Math.max(asset.rawValue, 0)),
      expectedSalary: 0,
      overpayDollars: 0,
      adjustedOverpayDollars: 0,
      valueDollars,
      multiplier,
      adjusted: round1(toDisplay(valueDollars)),
      badge: null,
    };
  }

  // ── 1. Production ──────────────────────────────────────────────────────────
  // No NFL team = no production (cut/retired vets still under contract). A
  // rostered non-starter's production is hard to trade for full value, so it is
  // credited at BENCH_PRODUCTION_FACTOR — this lets an expensive non-starter's
  // contract dominate and land negative (the Hockenson/Najee case).
  const rawValue = Math.max(asset.rawValue, 0);
  const startable =
    !!asset.nflTeam &&
    asset.productionRank != null &&
    asset.productionRank <= startableThreshold(asset.position, config);
  const production = !asset.nflTeam
    ? 0
    : startable
      ? rawValue
      : rawValue * config.BENCH_PRODUCTION_FACTOR;

  // ── 2-4. Contract cost, all in DOLLAR-SPACE ─────────────────────────────────
  const expSalary = expectedSalary(asset.position, asset.productionRank ?? null, config);
  const overpayDollars = asset.salary - expSalary; // negative = bargain
  const adjustedOverpayDollars = overpayDollars * termMultiplier(overpayDollars, asset.years, config);

  // ── 5. The only cross-scale step: dollars → production-value points ─────────
  let value = production - adjustedOverpayDollars * rate;

  // Strategy tilt (applied before floors so floors stay absolute guarantees).
  // Negative values divide instead of multiply, so a strategy that likes this
  // asset finds its bad contract less painful — not more.
  const multiplier = strategyMultiplier(asset, strategy, config);
  value = value >= 0 ? value * multiplier : value / multiplier;

  // ── 6. Floors, in order ─────────────────────────────────────────────────────
  // Soft floor: a projected weekly starter always has buyers, so it bottoms out
  // only slightly negative — clearly negative values are reserved for
  // non-starters carrying real salary.
  if (startable) value = Math.max(value, config.SOFT_FLOOR_POINTS);

  // Elite-asset floor: a young top-of-position player is a premium dynasty asset
  // regardless of contract — never below a mid-1st-round rookie pick.
  const elite =
    !!asset.nflTeam &&
    asset.productionRank != null &&
    asset.productionRank <= config.ELITE_RANK &&
    asset.age != null &&
    asset.age <= config.ELITE_MAX_AGE;
  if (elite) value = Math.max(value, config.ELITE_FLOOR_POINTS);

  // Hard floor (absolute): the league cut penalty is 50% of the remaining
  // contract, so trading a player away can never be worth more than cutting him.
  const hardFloor = -(0.5 * asset.salary * asset.years * rate);
  value = Math.max(value, hardFloor);

  let badge: AssetEvaluation["badge"] = null;
  if (overpayDollars <= -config.VALUE_BADGE) badge = "value";
  else if (overpayDollars >= config.OVERPAY_BADGE) badge = "overpay";

  return {
    asset,
    production: round1(production),
    expectedSalary: round1(expSalary),
    overpayDollars: round1(overpayDollars),
    adjustedOverpayDollars: round1(adjustedOverpayDollars),
    valueDollars: round1(value),
    multiplier,
    adjusted: round1(toDisplay(value)),
    badge,
  };
}

export function evaluateSide(
  assets: TradeAsset[],
  strategy: Strategy,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
): { evals: AssetEvaluation[]; total: number } {
  const evals = assets.map((a) => evaluateAsset(a, strategy, config));
  const total = round1(evals.reduce((sum, e) => sum + e.adjusted, 0));
  return { evals, total };
}

export function computeVerdict(
  totalA: number,
  totalB: number,
  ownerA: string,
  ownerB: string,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
): VerdictResult {
  // Scale by total absolute value so the math holds when a side's haul is
  // net-negative (cap liabilities). Equals totalA+totalB when both positive.
  const scale = Math.abs(totalA) + Math.abs(totalB);
  if (scale === 0) {
    return { kind: "empty", favored: null, diff: 0, pct: 0, headline: "Add players to compare" };
  }
  const diff = round1(totalA - totalB);
  const pct = Math.abs(diff) / scale;
  const favored = diff > 0 ? "A" : "B";
  const winner = diff > 0 ? ownerA : ownerB;

  if (pct <= config.FAIR_PCT) {
    return { kind: "fair", favored: null, diff, pct, headline: "Fair Trade" };
  }
  if (pct <= config.SLIGHT_PCT) {
    return { kind: "slight", favored, diff, pct, headline: `Slightly favors ${winner}` };
  }
  return { kind: "heavy", favored, diff, pct, headline: `Heavily favors ${winner}` };
}

// Cap impact for one team given what it RECEIVES (incoming) and GIVES (outgoing).
export function computeCapImpact(
  team: TradeTeam,
  incoming: TradeAsset[],
  outgoing: TradeAsset[],
): TeamCapImpact {
  const sum = (arr: TradeAsset[], k: "salary" | "years") =>
    arr.reduce((s, a) => s + a[k], 0);
  const salaryDelta = round1(sum(incoming, "salary") - sum(outgoing, "salary"));
  const yearsDelta = sum(incoming, "years") - sum(outgoing, "years");
  const newSalary = round1(team.totalSalary + salaryDelta);
  const newYears = team.totalYears + yearsDelta;
  return {
    rosterId: team.rosterId,
    owner: team.owner,
    salaryDelta,
    yearsDelta,
    newSalary,
    newYears,
    capSpaceAfter: round1(SALARY_CAP - newSalary),
    yearsSpaceAfter: YEARS_CAP - newYears,
    overCap: newSalary > SALARY_CAP,
    overYears: newYears > YEARS_CAP,
  };
}

// Suggest up to `limit` assets from the favored team's remaining roster whose
// adjusted value (under the unfavored team's strategy) is closest to the gap.
export function balancingSuggestions(
  favoredTeam: TradeTeam,
  assetsAlreadyInTrade: Set<string>,
  gap: number,
  unfavoredStrategy: Strategy,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
  limit = 4,
): BalancingSuggestion[] {
  if (gap <= 0) return [];
  return favoredTeam.assets
    .filter((a) => !assetsAlreadyInTrade.has(a.id))
    .map((a) => ({ asset: a, adjusted: evaluateAsset(a, unfavoredStrategy, config).adjusted }))
    .sort((x, y) => Math.abs(x.adjusted - gap) - Math.abs(y.adjusted - gap))
    .slice(0, limit);
}
