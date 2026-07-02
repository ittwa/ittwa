// Tag Tracker — derived data shapes. Everything here is computed from
// ContractRow[] (the Contracts sheet) by src/lib/tags-data.ts; nothing is
// fetched directly by page/client components.

export type TagType = "franchise" | "fifth-year";

export type FranchiseBasis = "Top-5 Positional Average" | "120% of Previous Salary" | "Consecutive Tag Formula" | "Unknown";

export interface DraftPickInfo {
  season: string; // 4-digit draft season, e.g. "2021"
  overallPick: number; // 1-36
  round: 1 | 2 | 3;
}

export interface TagHistoryEntry {
  key: string; // stable react key
  playerId: string;
  player: string;
  position: string;
  owner: string;
  season: string;
  salary: number;
  tagType: TagType;
  // Franchise-only:
  consecutiveLabel: string | null; // e.g. "2nd Consecutive" — null for a standalone/first tag
  basis: FranchiseBasis | null;
  // Fifth-year-only:
  pickSlot: DraftPickInfo | null;
  incompleteData: boolean; // true if we couldn't fully resolve this entry's context (e.g. no prior-season row to compute basis from)
}

export interface PositionSeasonPoint {
  season: string;
  position: string;
  avgSalary: number;
  count: number;
}

export interface PositionAverage {
  position: string;
  avgSalary: number;
  count: number;
}

export interface OwnerTagStat {
  owner: string;
  franchiseCount: number;
  fifthYearCount: number;
}

export interface BasisBreakdown {
  topN: number;
  pct120: number;
  unknown: number;
}

export interface CalloutStats {
  largestTag: { player: string; season: string; salary: number; tagType: TagType } | null;
  cheapestTag: { player: string; season: string; salary: number; tagType: TagType } | null;
  mostTaggedPlayer: { player: string; count: number } | null;
  nextDeadline: string; // ISO date string
  daysUntilDeadline: number;
}

export interface TagInsights {
  positionOverTime: PositionSeasonPoint[];
  avgFranchiseTagByPosition: PositionAverage[];
  tagsByOwner: OwnerTagStat[];
  basisBreakdown: BasisBreakdown;
  callouts: CalloutStats;
}

export interface EligibleFranchisePlayer {
  playerId: string;
  player: string;
  position: string;
  owner: string;
  expiringSalary: number;
  projectedTagSalary: number;
  projectionLabel: string; // "New Tag" | "2nd Consecutive Tag" | "3rd Consecutive Tag" etc.
  incompleteData: boolean;
}

export interface EligibleFifthYearPlayer {
  playerId: string;
  player: string;
  position: string;
  owner: string;
  pickSlot: DraftPickInfo;
  currentSalary: number;
  projectedOptionSalary: number;
  averagedFewerThanRequired: boolean; // true if the position had fewer than the required top-N players
}

export interface OwnerEligibility {
  owner: string;
  franchiseEligible: EligibleFranchisePlayer[];
  fifthYearEligible: EligibleFifthYearPlayer[];
}

export interface TagEligibility {
  currentSeason: string;
  upcomingOffseasonYear: string; // currentSeason + 1
  deadline: string; // ISO date, third Friday in June of upcomingOffseasonYear
  byOwner: OwnerEligibility[];
}

export interface TagTrackerData {
  history: TagHistoryEntry[];
  insights: TagInsights;
  eligibility: TagEligibility;
  usingSampleData: boolean;
  dataWarnings: string[]; // human-readable, for an optional dev-facing note; console.warn already fires per-row
}
