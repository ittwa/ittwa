// Shared types for the Trade Analyzer.
//
// Phase 1 (this file) covers the live dataset shape produced by the server-side
// loader. Engine-specific types (Evaluation, Verdict, CapImpact) live alongside
// the algorithm in ./engine and ./config.

export type AssetType = "player" | "pick";

export interface TradeAsset {
  id: string; // sleeper player_id, or a synthetic pick id like "2027-1-3"
  type: AssetType;
  name: string;
  position: string; // QB/RB/WR/TE/K/DEF, or "PICK"
  nflTeam: string | null;
  age: number | null;
  rawValue: number; // FantasyCalc dynasty value (0 when unmatched)
  // Positional rank (1 = best): the better of FantasyCalc's dynasty rank and
  // the real fantasy-scoring rank (see data.ts); null when neither is known.
  productionRank: number | null;
  salary: number; // contract salary in $; picks use their rookie-slot salary
  years: number; // contract years remaining; rookie picks = 4
  // Pick-only metadata
  pickRound?: number;
  pickSeason?: string;
  pickOriginalOwner?: string; // display name of the pick's original team
  pickSlot?: string; // estimated rookie slot, e.g. "1.06"
}

export interface TradeTeam {
  rosterId: number;
  owner: string; // ITTWA display name
  division: string;
  totalSalary: number; // sum of rostered-player contract salaries
  totalYears: number; // sum of rostered-player contract years
  capSpace: number; // SALARY_CAP - totalSalary
  yearsSpace: number; // YEARS_CAP - totalYears
  assets: TradeAsset[]; // players + owned future picks
}

export interface TradeAnalyzerData {
  teams: TradeTeam[];
  generatedAt: number;
  unmatchedCount: number; // players with no FantasyCalc value match
  valuePerDollar: number; // LEAGUE_VALUE_PER_DOLLAR derived from live rosters
}
