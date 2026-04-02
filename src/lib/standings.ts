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
