import {
  NFLState,
  SleeperLeague,
  SleeperUser,
  SleeperRoster,
  SleeperMatchup,
  SleeperTransaction,
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayersMap,
} from "@/types/sleeper";
import { LEAGUE_ID, SLEEPER_API_BASE, REVALIDATE, USERNAME_OVERRIDES } from "./config";

// --- Fetcher utility ---

async function fetchSleeper<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${SLEEPER_API_BASE}${path}`, {
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`Sleeper API error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

// --- NFL State ---

export async function getNFLState(): Promise<NFLState> {
  return fetchSleeper<NFLState>("/state/nfl", REVALIDATE.matchups);
}

// --- League Metadata ---

export async function getLeague(leagueId: string = LEAGUE_ID): Promise<SleeperLeague> {
  return fetchSleeper<SleeperLeague>(`/league/${leagueId}`, REVALIDATE.roster);
}

// --- League Users ---

export async function getLeagueUsers(leagueId: string = LEAGUE_ID): Promise<SleeperUser[]> {
  return fetchSleeper<SleeperUser[]>(`/league/${leagueId}/users`, REVALIDATE.roster);
}

// --- Rosters ---

export async function getRosters(leagueId: string = LEAGUE_ID): Promise<SleeperRoster[]> {
  return fetchSleeper<SleeperRoster[]>(`/league/${leagueId}/rosters`, REVALIDATE.roster);
}

// --- Matchups for a given week ---

export async function getMatchups(
  week: number,
  leagueId: string = LEAGUE_ID
): Promise<SleeperMatchup[]> {
  return fetchSleeper<SleeperMatchup[]>(
    `/league/${leagueId}/matchups/${week}`,
    REVALIDATE.matchups
  );
}

// --- Transactions for a given week ---

export async function getTransactions(
  week: number,
  leagueId: string = LEAGUE_ID
): Promise<SleeperTransaction[]> {
  return fetchSleeper<SleeperTransaction[]>(
    `/league/${leagueId}/transactions/${week}`,
    REVALIDATE.matchups
  );
}

// --- All transactions for all weeks in a season ---

export async function getAllTransactions(
  leagueId: string = LEAGUE_ID
): Promise<SleeperTransaction[]> {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const results = await Promise.all(
    weeks.map((w) => getTransactions(w, leagueId).catch(() => [] as SleeperTransaction[]))
  );
  return results.flat();
}

// --- Drafts ---

export async function getDrafts(leagueId: string = LEAGUE_ID): Promise<SleeperDraft[]> {
  return fetchSleeper<SleeperDraft[]>(`/league/${leagueId}/drafts`, REVALIDATE.roster);
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return fetchSleeper<SleeperDraftPick[]>(`/draft/${draftId}/picks`, REVALIDATE.roster);
}

// --- NFL Players (very large — cache 24 hours) ---

let playersCache: { data: SleeperPlayersMap; timestamp: number } | null = null;
const PLAYERS_CACHE_MS = REVALIDATE.players * 1000;

export async function getNFLPlayers(): Promise<SleeperPlayersMap> {
  if (playersCache && Date.now() - playersCache.timestamp < PLAYERS_CACHE_MS) {
    return playersCache.data;
  }
  const data = await fetchSleeper<SleeperPlayersMap>("/players/nfl", REVALIDATE.players);
  playersCache = { data, timestamp: Date.now() };
  return data;
}

// --- Helper: Build roster_id → display name map ---

export async function buildRosterOwnerMap(
  leagueId: string = LEAGUE_ID
): Promise<Record<number, string>> {
  const [users, rosters] = await Promise.all([
    getLeagueUsers(leagueId),
    getRosters(leagueId),
  ]);

  const userMap: Record<string, string> = {};
  for (const user of users) {
    const displayName = USERNAME_OVERRIDES[user.display_name] ?? user.display_name;
    userMap[user.user_id] = displayName;
  }

  const rosterOwnerMap: Record<number, string> = {};
  for (const roster of rosters) {
    rosterOwnerMap[roster.roster_id] = userMap[roster.owner_id] || `Team ${roster.roster_id}`;
  }

  return rosterOwnerMap;
}

// --- Helper: Get display name for a Sleeper user ---

export function getDisplayName(user: SleeperUser): string {
  return USERNAME_OVERRIDES[user.display_name] ?? user.display_name;
}

// --- Helper: Get player name from player ID ---

export function getPlayerName(playerId: string, players: SleeperPlayersMap): string {
  const player = players[playerId];
  if (!player) return `Unknown (${playerId})`;
  return player.full_name || `${player.first_name} ${player.last_name}`;
}

// --- Historical league IDs (traverse previous_league_id chain) ---

export async function getLeagueHistory(leagueId: string = LEAGUE_ID): Promise<SleeperLeague[]> {
  const leagues: SleeperLeague[] = [];
  let currentId: string | null = leagueId;

  while (currentId) {
    const league = await getLeague(currentId);
    leagues.push(league);
    currentId = league.previous_league_id;
  }

  return leagues;
}
