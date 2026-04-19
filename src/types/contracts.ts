// TypeScript interfaces for Google Sheets contract and cap data

export interface ContractRow {
  playerId: string;        // Sleeper player ID (may be "#N/A")
  season: string;          // Season year
  owner: string;           // Owner last name
  player: string;          // Player display name
  position: string;        // NFL position
  years: number;           // Years remaining on contract
  salary: number;          // Contract salary (parsed float)
  dpOriginalOwner: string; // Original owner of the draft pick
  draftPickId: string;     // Draft pick identifier
  contractStatus: string;  // "Active" or other
  contractStartYear: string; // Year contract began
  originalPick: string;    // Y/N — internal, not displayed
  franchiseTag: boolean;   // Whether player is franchise tagged
  fifthYearTag: boolean;   // Whether 5th year tag is applied
  fifthYearTagAmount: string; // Dollar value of 5th year tag
}

export interface CapHitRow {
  season: string;
  owner: string;
  player: string;
  position: string;
  years: number;
  salary: number;
  capHit: number;
  yearsRemaining: number;
  yearlyHits: Record<number, number>;
}

export interface ContractWithValue extends ContractRow {
  contractValue: number;
  isMidSeasonPickup: boolean;
}
