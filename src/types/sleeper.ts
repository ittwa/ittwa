// Sleeper API type definitions

export interface NFLState {
  season: string;
  season_type: string;
  week: number;
  display_week: number;
  leg: number;
  season_start_date: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  status: string;
  total_rosters: number;
  settings: {
    wins_league?: number;
    losses_league?: number;
    playoff_week_start: number;
    playoff_teams: number;
    num_teams: number;
    [key: string]: unknown;
  };
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  previous_league_id: string | null;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
    [key: string]: unknown;
  };
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    ppts?: number;
    ppts_decimal?: number;
    division?: number;
    [key: string]: unknown;
  };
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters_points: number[];
  starters: string[];
  players: string[];
  players_points: Record<string, number>;
  custom_points: number | null;
}

export interface SleeperTransaction {
  type: string;
  transaction_id: string;
  status: string;
  status_updated: number;
  created: number;
  week: number;
  leg: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: SleeperTradePick[];
  consenter_ids: number[];
  settings: Record<string, unknown> | null;
  metadata?: Record<string, string>;
}

export interface SleeperTradePick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  type: string;
  status: string;
  settings: {
    rounds: number;
    pick_timer: number;
    [key: string]: unknown;
  };
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
}

export interface SleeperDraftPick {
  round: number;
  pick_no: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  metadata: {
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    [key: string]: string;
  };
  draft_slot: number;
  draft_id: string;
  is_keeper: boolean | null;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  team: string | null;
  age?: number;
  years_exp?: number;
  fantasy_positions?: string[];
  status?: string;
  injury_status?: string;
  number?: number;
  depth_chart_position?: string;
  sport?: string;
  search_full_name?: string;
}

// Map of player_id -> SleeperPlayer
export type SleeperPlayersMap = Record<string, SleeperPlayer>;

// Processed types used across the app
export interface TeamInfo {
  rosterId: number;
  ownerId: string;
  username: string;
  displayName: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  optimalPoints: number;
  streak: string;
  divisionRecord: string;
  players: string[];
}

export interface MatchupPair {
  week: number;
  matchupId: number;
  team1: {
    rosterId: number;
    displayName: string;
    points: number;
  };
  team2: {
    rosterId: number;
    displayName: string;
    points: number;
  };
  completed: boolean;
}

export interface TradeInfo {
  transactionId: string;
  date: Date;
  week: number;
  season: string;
  teams: {
    displayName: string;
    rosterId: number;
    received: {
      players: { id: string; name: string; position: string }[];
      picks: SleeperTradePick[];
    };
  }[];
}
