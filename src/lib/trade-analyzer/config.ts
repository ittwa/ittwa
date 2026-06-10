// Tunable parameters for the Trade Analyzer algorithm.
//
// Everything the engine uses lives here so the Tweaks panel can override a copy
// at runtime (e.g. SURPLUS_PER_DOLLAR, FAIR_PCT) without touching engine code.
// Values are first-pass calibrations — adjust here if trades feel off.

export type Strategy = "neutral" | "rebuilding" | "competing";

export interface TradeAnalyzerConfig {
  // Auction price curve: marketPrice = SAL_COEF * (rawValue/1000) ^ SAL_EXP
  // — what a given production level typically costs at our auction.
  SAL_COEF: number;
  SAL_EXP: number;

  // Display scale: surplus dollars → points shown in the UI.
  SURPLUS_PER_DOLLAR: number;

  // Years multiplier on contract surplus. Amplifies BOTH directions: good
  // deals gain value with term, bad deals get more painful.
  YEARS_FACTOR: Record<number, number>;

  // Scarcity premium: fraction of market price that survives as value even on
  // a perfectly fair contract (rostered production beats an empty spot).
  SCARCITY_PCT: number;

  // Verdict thresholds, as a fraction of total trade value.
  FAIR_PCT: number;
  SLIGHT_PCT: number;

  // Badge thresholds, in surplus dollars.
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

  YEARS_FACTOR: { 0: 0.75, 1: 1.0, 2: 1.25, 3: 1.45, 4: 1.6, 5: 1.7 },

  SCARCITY_PCT: 0.12,

  FAIR_PCT: 0.06,
  SLIGHT_PCT: 0.14,

  VALUE_BADGE: 10,
  OVERPAY_BADGE: 5,

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
