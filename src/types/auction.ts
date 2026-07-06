// Type definitions for the Free Agent Auction feature.
// See CLAUDE.md and lib/auction.ts for the rules these types support.

export type AuctionStatus = "setup" | "live" | "paused" | "complete";
export type RosterSource = "import" | "manual" | "auction";
export type PoolStatus = "available" | "nominated" | "drafted";

// ── Derivation inputs/outputs (used both pre-auction and to recompute live) ──

export interface DerivedRosterEntry {
  owner: string;
  playerId: string;
  player: string;
  position: string;
  years: number;
  salary: number;
  source: RosterSource;
}

export interface DerivedOwnerCap {
  owner: string;
  salaryRostered: number;
  yearsRostered: number;
  playersRostered: number;
  capHit: number;
  capHitOverridden: boolean;
  cash: number;
  needToSpend: number;
  spotsRemaining: number;
  yearsRemaining: number;
  maxBid: number | null; // null when spotsRemaining <= 0 -> display "-"
  maxYears: number | null;
}

export interface DerivedFreeAgent {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  rfa: boolean;
  previousOwner: string | null;
  status: PoolStatus;
}

export interface DerivationResult {
  season: string;
  roster: DerivedRosterEntry[];
  owners: DerivedOwnerCap[];
  pool: DerivedFreeAgent[];
  warnings: string[];
}

// ── Live auction state (mirrors DB tables) ──

export interface AuctionRecord {
  id: number;
  season: string;
  status: AuctionStatus;
  nominationOrder: string[];
  currentNominatorIndex: number;
  createdAt: string;
}

export interface AuctionCurrentNomination {
  playerId: string;
  player: string;
  position: string;
  rfa: boolean;
  previousOwner: string | null;
  highBidSalary: number | null;
  highBidYears: number | null;
  highBidder: string | null;
  timerEndsAt: string | null;
}

export interface AuctionResultRow {
  id: number;
  pickNumber: number;
  nominator: string;
  winner: string;
  playerId: string;
  player: string;
  position: string;
  years: number;
  salary: number;
  createdAt: string;
}

export interface BidToBeatRow {
  years: number;
  salary: number;
  value: number;
}

// ── Consolidated public state payload (polled by /auction) ──

export interface AuctionPublicState {
  auction: AuctionRecord | null;
  owners: DerivedOwnerCap[];
  current: AuctionCurrentNomination | null;
  bidToBeat: BidToBeatRow[];
  onClock: string | null;
  onDeck: string | null;
  results: AuctionResultRow[];
  pool: DerivedFreeAgent[];
  roster: DerivedRosterEntry[];
  generatedAt: string;
}
