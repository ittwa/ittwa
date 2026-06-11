import { TeamInfo, SleeperMatchup } from "@/types/sleeper";

export interface StandingsEntry extends TeamInfo {
  rank: number;
  winPct: number;
}

// Tiebreaker logic — implement exactly per ITTWA rules:
//
// Step 1: Overall wins (descending)
// Step 2: Head-to-head record among ONLY the tied teams (aggregate across all matchup weeks)
// Step 3: Division record — ONLY if ALL tied teams share the same division
// Step 4: Points For (descending)

export function calculateStandings(
  teams: TeamInfo[],
  allMatchups: Map<number, SleeperMatchup[]>
): StandingsEntry[] {
  // Sort teams using tiebreaker cascade
  const sorted = [...teams].sort((a, b) => {
    // Step 1: Overall wins (descending)
    if (a.wins !== b.wins) return b.wins - a.wins;

    // If wins are equal, we need to check head-to-head among ALL tied teams
    // For pairwise comparison, check H2H between these two teams
    const h2h = getHeadToHeadRecord(a.rosterId, b.rosterId, allMatchups);
    // Step 2: Head-to-head record between tied teams
    if (h2h.wins !== h2h.losses) return h2h.losses - h2h.wins; // more H2H wins = higher rank

    // Step 3: Division record — only if both teams share the same division
    // Use the division field from TeamInfo (resolved from Sleeper's roster.settings.division)
    if (a.division && b.division && a.division === b.division) {
      const aDivWins = parseDivRecord(a.divisionRecord).wins;
      const bDivWins = parseDivRecord(b.divisionRecord).wins;
      if (aDivWins !== bDivWins) return bDivWins - aDivWins;
    }

    // Step 4: Points For (descending)
    return b.pointsFor - a.pointsFor;
  });

  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
    winPct: team.wins + team.losses + team.ties > 0
      ? team.wins / (team.wins + team.losses + team.ties)
      : 0,
  }));
}

// Calculate head-to-head record between two teams across all matchup weeks
function getHeadToHeadRecord(
  rosterId1: number,
  rosterId2: number,
  allMatchups: Map<number, SleeperMatchup[]>
): { wins: number; losses: number; ties: number } {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const [, weekMatchups] of allMatchups) {
    const team1 = weekMatchups.find((m) => m.roster_id === rosterId1);
    const team2 = weekMatchups.find((m) => m.roster_id === rosterId2);

    if (!team1 || !team2) continue;
    // Only count if they played each other (same matchup_id)
    if (team1.matchup_id !== team2.matchup_id) continue;

    if (team1.points > team2.points) wins++;
    else if (team1.points < team2.points) losses++;
    else ties++;
  }

  return { wins, losses, ties };
}

function parseDivRecord(record: string): { wins: number; losses: number } {
  const parts = record.split("-").map(Number);
  return { wins: parts[0] || 0, losses: parts[1] || 0 };
}

// Calculate standings by division
export function getStandingsByDivision(
  standings: StandingsEntry[]
): Record<string, StandingsEntry[]> {
  const byDivision: Record<string, StandingsEntry[]> = {};

  for (const entry of standings) {
    const division = entry.division || "Unknown";
    if (!byDivision[division]) byDivision[division] = [];
    byDivision[division].push(entry);
  }

  // Re-rank within each division
  for (const div of Object.keys(byDivision)) {
    byDivision[div] = byDivision[div].map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }

  return byDivision;
}

// Has at least one game been played? A game counts the moment any team has a
// win, loss, or tie on the books. Used to gate preseason-only UI (playoff
// seeds, the playoff cutoff line, and stat-leader summary cards) so we don't
// show arbitrary rankings when every team is 0-0.
export function hasSeasonStarted(
  standings: { wins: number; losses: number; ties: number }[],
): boolean {
  return standings.some((t) => t.wins > 0 || t.losses > 0 || t.ties > 0);
}

export type PlayoffSlotType = "division" | "wildcard";
export interface PlayoffSlot {
  rosterId: number;
  seed: number;
  type: PlayoffSlotType;
}

// ITTWA playoff field: the 4 division winners qualify, plus the 2 best
// non-division-winners as wildcards. Division winners are seeded 1-4 (ordered
// by overall standing), wildcards take seeds 5-6.
//
// `standings` MUST be passed in overall-rank order (best→worst), as produced by
// calculateStandings — the first team seen in each division is that division's
// leader, and the first remaining teams are the wildcards.
export function computePlayoffPicture(
  standings: StandingsEntry[],
  divisionWinnerCount = 4,
  wildcardCount = 2,
): Map<number, PlayoffSlot> {
  const seenDivisions = new Set<string>();
  const divisionWinners: StandingsEntry[] = [];
  const rest: StandingsEntry[] = [];

  for (const entry of standings) {
    const div = entry.division || "Unknown";
    if (!seenDivisions.has(div)) {
      seenDivisions.add(div);
      divisionWinners.push(entry);
    } else {
      rest.push(entry);
    }
  }

  const slots = new Map<number, PlayoffSlot>();
  divisionWinners.slice(0, divisionWinnerCount).forEach((entry, i) => {
    slots.set(entry.rosterId, { rosterId: entry.rosterId, seed: i + 1, type: "division" });
  });
  rest.slice(0, wildcardCount).forEach((entry, i) => {
    slots.set(entry.rosterId, {
      rosterId: entry.rosterId,
      seed: divisionWinnerCount + i + 1,
      type: "wildcard",
    });
  });

  return slots;
}

// Calculate win/loss streak
export function calculateStreak(
  rosterId: number,
  allMatchups: Map<number, SleeperMatchup[]>,
  totalWeeks: number
): string {
  let streak = 0;
  let streakType: "W" | "L" | "" = "";

  for (let week = totalWeeks; week >= 1; week--) {
    const weekMatchups = allMatchups.get(week);
    if (!weekMatchups) continue;

    const team = weekMatchups.find((m) => m.roster_id === rosterId);
    if (!team) continue;

    const opponent = weekMatchups.find(
      (m) => m.matchup_id === team.matchup_id && m.roster_id !== rosterId
    );
    if (!opponent) continue;

    const won = team.points > opponent.points;
    const currentType = won ? "W" : "L";

    if (streakType === "") {
      streakType = currentType;
      streak = 1;
    } else if (currentType === streakType) {
      streak++;
    } else {
      break;
    }
  }

  return streakType ? `${streakType}${streak}` : "-";
}
