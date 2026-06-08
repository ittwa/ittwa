// The contract-adjusted trade valuation engine — pure functions, no React.
//
// Per asset:
//   expectedSalary = SAL_COEF * (rawValue/1000) ^ SAL_EXP
//   surplus$       = expectedSalary - actualSalary        (positive = good deal)
//   surplusPoints  = surplus$ * SURPLUS_PER_DOLLAR * yearsFactor(years)
//   deadCap        = risk penalty for expensive + long + aging contracts
//   preStrategy    = rawValue + surplusPoints - deadCap
//   adjusted       = preStrategy * strategyMultiplier
//
// A trade compares the total adjusted value each side RECEIVES, evaluated under
// the receiving side's strategy.

import { SALARY_CAP, YEARS_CAP } from "@/lib/config";
import { DEFAULT_CONFIG, type Strategy, type TradeAnalyzerConfig } from "./config";
import type { TradeAsset, TradeTeam } from "./types";

export type { Strategy } from "./config";

export interface AssetEvaluation {
  asset: TradeAsset;
  expectedSalary: number;
  surplusDollars: number;
  surplusPoints: number;
  deadCap: number;
  preStrategy: number;
  multiplier: number;
  adjusted: number;
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

export function deadCapPenalty(
  salary: number,
  years: number,
  age: number | null,
  config: TradeAnalyzerConfig = DEFAULT_CONFIG,
): number {
  if (age === null) return 0;
  if (salary < config.DEADCAP_SALARY_FLOOR || age < config.DEADCAP_AGE_FLOOR) return 0;
  const overSalary = salary - config.DEADCAP_SALARY_FLOOR;
  const overAge = age - config.DEADCAP_AGE_FLOOR;
  const yearsRemaining = Math.max(years, 1);
  // Risk grows with how far over each floor the contract is, and how many years
  // remain locked in. Scaled into value points by DEADCAP_SCALE.
  const risk =
    (overSalary * config.DEADCAP_SALARY_W + overAge * config.DEADCAP_AGE_W) * yearsRemaining;
  return round1(risk * config.DEADCAP_SCALE);
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
  const expectedSalary = config.SAL_COEF * Math.pow(Math.max(asset.rawValue, 0) / 1000, config.SAL_EXP);
  const surplusDollars = expectedSalary - asset.salary;
  const surplusPoints =
    surplusDollars * config.SURPLUS_PER_DOLLAR * yearsFactor(asset.years, config);
  const deadCap = deadCapPenalty(asset.salary, asset.years, asset.age, config);
  const preStrategy = asset.rawValue + surplusPoints - deadCap;
  const multiplier = strategyMultiplier(asset, strategy, config);
  const adjusted = preStrategy * multiplier;

  const delta = adjusted - asset.rawValue;
  let badge: AssetEvaluation["badge"] = null;
  if (delta >= config.VALUE_BADGE) badge = "value";
  else if (delta <= -config.OVERPAY_BADGE) badge = "overpay";

  return {
    asset,
    expectedSalary: round1(expectedSalary),
    surplusDollars: round1(surplusDollars),
    surplusPoints: round1(surplusPoints),
    deadCap,
    preStrategy: round1(preStrategy),
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
