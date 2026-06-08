// Tunable parameters for the Trade Analyzer algorithm.
//
// Everything the engine uses lives here so the Tweaks panel can override a copy
// at runtime (e.g. SURPLUS_PER_DOLLAR, FAIR_PCT) without touching engine code.
// Values are first-pass calibrations — adjust here if trades feel off.

export type Strategy = "neutral" | "rebuilding" | "competing";

export interface TradeAnalyzerConfig {
  // Expected-salary curve: expectedSalary = SAL_COEF * (rawValue/1000) ^ SAL_EXP
  SAL_COEF: number;
  SAL_EXP: number;

  // Surplus: each $1 of (expectedSalary - actualSalary) is worth this many
  // value points, scaled by the contract-length factor below.
  SURPLUS_PER_DOLLAR: number;
  YEARS_FACTOR: Record<number, number>;

  // Dead-cap risk kicks in only above both floors (expensive AND aging).
  DEADCAP_SALARY_FLOOR: number;
  DEADCAP_AGE_FLOOR: number;
  DEADCAP_SALARY_W: number;
  DEADCAP_AGE_W: number;
  DEADCAP_SCALE: number;

  // Verdict thresholds, as a fraction of total trade value.
  FAIR_PCT: number;
  SLIGHT_PCT: number;

  // Badge thresholds: adjusted vs raw delta.
  VALUE_BADGE: number;
  OVERPAY_BADGE: number;

  // Player-profile thresholds used by strategy multipliers.
  YOUNG_AGE: number;
  AGING_AGE: number;
  SHORT_DEAL_YEARS: number;
  LONG_DEAL_YEARS: number;
  CHEAP_SALARY: number;

  // Strategy multipliers.
  REBUILD_PICK: number;
  REBUILD_YOUNG: number;
  REBUILD_CHEAP_LONG: number;
  REBUILD_AGING_SHORT: number;
  COMPETE_PICK: number;
  COMPETE_YOUNG: number;
  COMPETE_AGING_SHORT: number;
}

export const DEFAULT_CONFIG: TradeAnalyzerConfig = {
  SAL_COEF: 2.55,
  SAL_EXP: 1.5,

  SURPLUS_PER_DOLLAR: 34,
  YEARS_FACTOR: { 0: 0, 1: 0.85, 2: 1.0, 3: 1.12, 4: 1.2, 5: 1.25 },

  DEADCAP_SALARY_FLOOR: 30,
  DEADCAP_AGE_FLOOR: 27,
  DEADCAP_SALARY_W: 0.6,
  DEADCAP_AGE_W: 0.5,
  DEADCAP_SCALE: 1,

  FAIR_PCT: 0.06,
  SLIGHT_PCT: 0.14,

  VALUE_BADGE: 8,
  OVERPAY_BADGE: 10,

  YOUNG_AGE: 24,
  AGING_AGE: 28,
  SHORT_DEAL_YEARS: 2,
  LONG_DEAL_YEARS: 3,
  CHEAP_SALARY: 15,

  REBUILD_PICK: 1.22,
  REBUILD_YOUNG: 1.12,
  REBUILD_CHEAP_LONG: 1.1,
  REBUILD_AGING_SHORT: 0.82,
  COMPETE_PICK: 0.8,
  COMPETE_YOUNG: 0.94,
  COMPETE_AGING_SHORT: 1.1,
};
