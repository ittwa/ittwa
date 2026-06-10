// The contract-adjusted trade valuation engine — pure functions, no React.
//
// Surplus-value model: a player's trade value is what their production would
// cost at auction MINUS what their contract actually costs, in dollars:
//
//   marketPrice($) = SAL_COEF * (rawValue/1000) ^ SAL_EXP
//   surplus$       = marketPrice - salary            (negative = bad contract)
//   scarcity$      = SCARCITY_PCT * marketPrice      (rostered production keeps
//                                                     some value at a fair price)
//   value$         = surplus$ * yearsFactor(years) + scarcity$
//   value$         = max(strategy(value$), -(0.5 * salary * years))
//   adjusted       = value$ * SURPLUS_PER_DOLLAR     (display points)
//
// Years amplify both directions: a good contract locked up longer is more
// valuable, a bad contract locked up longer is more painful. The floor mirrors
// the league cut penalty (50% of the remaining salary commitment) — the worst
// case for an owner is cutting the player, so trade value bottoms out there.
// Players with no NFL team (free agents / retired) carry no expected
// production, so their value is just the negative of their contract burden.
//
// A trade compares the total adjusted value each side RECEIVES, evaluated
// under the receiving side's strategy.

import { SALARY_CAP, YEARS_CAP } from "@/lib/config";
import { DEFAULT_CONFIG, type Strategy, type TradeAnalyzerConfig } from "./config";
import type { TradeAsset, TradeTeam } from "./types";

export type { Strategy } from "./config";

export interface AssetEvaluation {
  asset: TradeAsset;
  marketPrice: number; // $ the production would cost at auction
  surplusDollars: number; // marketPrice - salary
  scarcityDollars: number; // residual value of rostered production
  valueDollars: number; // final surplus value in $ (post-strategy, post-floor)
  multiplier: number;
  adjusted: number; // valueDollars scaled to display points
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

function yearsFactor(years: number, config: TradeAnalyzerConfig): number {
  if (years <= 0) return config.YEARS_FACTOR[0] ?? 0;
  return config.YEARS_FACTOR[years] ?? config.YEARS_FACTOR[5];
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
  // No NFL team = no expected production (cut/retired vets still under
  // contract). Picks are exempt — they have no team by nature.
  const effectiveValue =
    asset.type === "player" && !asset.nflTeam ? 0 : Math.max(asset.rawValue, 0);

  const marketPrice = config.SAL_COEF * Math.pow(effectiveValue / 1000, config.SAL_EXP);
  const surplusDollars = marketPrice - asset.salary;
  const scarcityDollars = config.SCARCITY_PCT * marketPrice;
  const rawDollars = surplusDollars * yearsFactor(asset.years, config) + scarcityDollars;

  const multiplier = strategyMultiplier(asset, strategy, config);
  // Negative values divide instead of multiply, so a strategy that likes this
  // asset type finds its bad contract less painful — not more.
  const strategic = rawDollars >= 0 ? rawDollars * multiplier : rawDollars / multiplier;

  // Cut-penalty floor: 50% of the remaining salary commitment (the league cut
  // penalty). The worst case is cutting the player, so value can't sink lower.
  const cutPenalty = 0.5 * asset.salary * asset.years;
  const valueDollars = Math.max(strategic, -cutPenalty);

  const adjusted = valueDollars * config.SURPLUS_PER_DOLLAR;

  let badge: AssetEvaluation["badge"] = null;
  if (valueDollars >= config.VALUE_BADGE) badge = "value";
  else if (valueDollars <= -config.OVERPAY_BADGE) badge = "overpay";

  return {
    asset,
    marketPrice: round1(marketPrice),
    surplusDollars: round1(surplusDollars),
    scarcityDollars: round1(scarcityDollars),
    valueDollars: round1(valueDollars),
    multiplier,
    adjusted: round1(adjusted),
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
  const total = totalA + totalB;
  if (total <= 0) {
    return { kind: "empty", favored: null, diff: 0, pct: 0, headline: "Add players to compare" };
  }
  const diff = round1(totalA - totalB);
  const pct = Math.abs(diff) / total;
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
