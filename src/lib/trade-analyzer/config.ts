// Tunable parameters for the Trade Analyzer valuation model.
//
// Everything the engine uses lives here so it can be tuned WITHOUT touching
// engine logic, and so the Tweaks panel can override a copy at runtime.
//
// Design principle (see engine.ts for the full walkthrough): all contract math
// stays in DOLLAR-SPACE. The only place dollars and production-value points
// touch is the final cross-scale step, via LEAGUE_VALUE_PER_DOLLAR — an
// exchange rate derived from the league's own economy at load time (with the
// fallback constant below used for tests / when live data is unavailable).

export type Strategy = "neutral" | "rebuilding" | "competing";

// A single expected-salary tier: players at or below `maxRank` within their
// position are "expected" to cost `dollars`. Tiers are evaluated in order.
export interface SalaryTier {
  maxRank: number;
  dollars: number;
}

export interface TradeAnalyzerConfig {
  // ── Cross-scale exchange rate ─────────────────────────────────────────────
  // LEAGUE_VALUE_PER_DOLLAR = (Σ production value of rostered players) ÷
  //                           (Σ salaries of rostered players).
  // i.e. what one league dollar actually buys in production at market. Computed
  // live in data.ts and injected here; this field holds the fallback default.
  LEAGUE_VALUE_PER_DOLLAR: number;

  // ── Display scaling ───────────────────────────────────────────────────────
  // The engine's canonical output is in production-value points. SURPLUS_PER_DOLLAR
  // is the Tweaks-panel "surplus weight" knob; display = points × (SURPLUS_PER_DOLLAR
  // / SURPLUS_PER_DOLLAR_BASE), so the default leaves values on the points scale
  // and the slider just zooms the displayed magnitude up/down.
  SURPLUS_PER_DOLLAR: number;
  SURPLUS_PER_DOLLAR_BASE: number;

  // ── Expected salary by position + production rank (DOLLARS) ───────────────
  // Calibrated against the league's real salary distribution: a top-5 positional
  // player should cost ~$40-60, a fringe starter ~$5-15, deep bench ~$1-2.
  EXPECTED_SALARY: Record<string, SalaryTier[]>;
  EXPECTED_SALARY_DEFAULT: SalaryTier[]; // used when position is unknown

  // ── Term-risk multipliers on OVERPAY (dollars) ────────────────────────────
  // Short deals are low-commitment rentals, so an overpay hurts less; 3+ years
  // of an expensive deal carries the full dead-cap risk.
  TERM_RISK_OVERPAY: Record<number, number>;
  // Term multiplier on a DISCOUNT (negative overpay): a bargain locked up longer
  // is MORE valuable, so discounts scale UP with years.
  TERM_DISCOUNT: Record<number, number>;

  // ── Startability (production rank within position) ────────────────────────
  // A player ranked at/inside this threshold projects as a weekly starter.
  STARTABLE_RANK: Record<string, number>;
  STARTABLE_RANK_DEFAULT: number;
  // Bench production is hard to trade for real value — a rostered non-starter's
  // production is credited at this fraction, so an expensive non-starter's
  // contract cost can dominate (the Hockenson/Najee case).
  BENCH_PRODUCTION_FACTOR: number;

  // ── Floors (production-value points) ──────────────────────────────────────
  // Soft floor: a projected weekly starter lands at worst slightly negative.
  SOFT_FLOOR_POINTS: number;
  // Elite-asset floor: a top-ELITE_RANK positional player under ELITE_MAX_AGE
  // never drops below roughly a mid-1st-round rookie pick, regardless of contract.
  ELITE_RANK: number;
  ELITE_MAX_AGE: number;
  ELITE_FLOOR_POINTS: number;

  // ── Verdict thresholds, as a fraction of total trade value ────────────────
  FAIR_PCT: number;
  SLIGHT_PCT: number;

  // ── Badge thresholds, in overpay dollars ──────────────────────────────────
  VALUE_BADGE: number; // discount (negative overpay) of this many $ → "value"
  OVERPAY_BADGE: number; // overpay of this many $ → "overpay"

  // ── Player-profile thresholds used by strategy multipliers ────────────────
  YOUNG_AGE: number;
  AGING_AGE: number;
  SHORT_DEAL_YEARS: number;
  LONG_DEAL_YEARS: number;
  CHEAP_SALARY: number;

  // ── Strategy multipliers ──────────────────────────────────────────────────
  REBUILD_PICK: number;
  REBUILD_YOUNG: number;
  REBUILD_CHEAP_LONG: number;
  REBUILD_AGING_SHORT: number;
  COMPETE_PICK: number;
  COMPETE_YOUNG: number;
  COMPETE_AGING_SHORT: number;
}

export const DEFAULT_CONFIG: TradeAnalyzerConfig = {
  // Fallback only — replaced at runtime by the value derived from live rosters
  // (logged in data.ts). ~90 pts/$ ≈ a mid roster of ~$2,900 salary backing
  // ~260k of FantasyCalc production.
  LEAGUE_VALUE_PER_DOLLAR: 90,

  SURPLUS_PER_DOLLAR: 34,
  SURPLUS_PER_DOLLAR_BASE: 34,

  // Tiers are calibrated to ITTWA's $270 cap / 12-team salary distribution.
  EXPECTED_SALARY: {
    QB: [
      { maxRank: 3, dollars: 42 },
      { maxRank: 6, dollars: 30 },
      { maxRank: 12, dollars: 16 },
      { maxRank: 24, dollars: 6 },
      { maxRank: Infinity, dollars: 2 },
    ],
    RB: [
      { maxRank: 3, dollars: 52 },
      { maxRank: 6, dollars: 40 },
      { maxRank: 12, dollars: 24 },
      { maxRank: 24, dollars: 10 },
      { maxRank: 36, dollars: 4 },
      { maxRank: Infinity, dollars: 1 },
    ],
    WR: [
      { maxRank: 3, dollars: 55 },
      { maxRank: 6, dollars: 46 },
      { maxRank: 12, dollars: 32 },
      { maxRank: 24, dollars: 16 },
      { maxRank: 36, dollars: 7 },
      { maxRank: Infinity, dollars: 2 },
    ],
    TE: [
      { maxRank: 3, dollars: 34 },
      { maxRank: 6, dollars: 24 },
      { maxRank: 12, dollars: 12 },
      { maxRank: 24, dollars: 4 },
      { maxRank: Infinity, dollars: 1 },
    ],
  },
  EXPECTED_SALARY_DEFAULT: [
    { maxRank: 12, dollars: 14 },
    { maxRank: 24, dollars: 6 },
    { maxRank: Infinity, dollars: 2 },
  ],

  // 1yr ≈ 0.4× (happily rented), 2yr ≈ 0.7×, 3+yr = full dead-cap risk.
  TERM_RISK_OVERPAY: { 0: 0.4, 1: 0.4, 2: 0.7, 3: 1.0, 4: 1.0, 5: 1.0 },
  // Discounts gain value with term; a 0-year (mid-season) deal has no future,
  // so its "discount" is only half-credited.
  TERM_DISCOUNT: { 0: 0.5, 1: 1.0, 2: 1.25, 3: 1.45, 4: 1.6, 5: 1.7 },

  // "roughly top-12 QB/TE, top-24 RB, top-36 WR by recent production"
  STARTABLE_RANK: { QB: 12, RB: 24, WR: 36, TE: 12 },
  STARTABLE_RANK_DEFAULT: 24,
  // A rostered non-starter still has real (if hard-to-trade) production, so it is
  // credited at this fraction. High enough that only genuinely expensive
  // non-starters go clearly negative (Hockenson/Najee), not cheap depth.
  BENCH_PRODUCTION_FACTOR: 0.55,

  SOFT_FLOOR_POINTS: -250,
  ELITE_RANK: 3,
  ELITE_MAX_AGE: 26,
  ELITE_FLOOR_POINTS: 3000, // ≈ mid-1st-round rookie pick value

  FAIR_PCT: 0.06,
  SLIGHT_PCT: 0.14,

  VALUE_BADGE: 8,
  OVERPAY_BADGE: 8,

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
