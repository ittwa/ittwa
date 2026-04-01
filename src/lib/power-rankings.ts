import { SleeperMatchup } from "@/types/sleeper";

export interface PowerRankingEntry {
  rosterId: number;
  displayName: string;
  division: string;
  // All-Play record: each week, count wins against all other 11 teams
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  allPlayWinPct: number;
  avgPointsPerWeek: number;
  totalPoints: number;
  weeksPlayed: number;
  // Actual record from the real schedule
  actualWins: number;
  actualLosses: number;
  actualWinPct: number;
  // Luck Index = Actual Win% - All-Play Win%
  // Positive = lucky (winning more than scoring suggests)
  // Negative = unlucky (outscoring opponents who keep beating you)
  luckIndex: number;
  // Week-over-week rank movement
  rankChange: number; // positive = moved up, negative = moved down
  rank: number;
}

// --- Step 1: Weekly All-Play ---
// For each completed week, calculate how each team would have fared
// against all other 11 teams. The highest scorer goes 11-0; the lowest
// goes 0-11. Ties count as 0.5 wins and 0.5 losses.

interface WeeklyAllPlay {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
}

function calculateWeeklyAllPlay(weekMatchups: SleeperMatchup[]): WeeklyAllPlay[] {
  // Filter out matchups with 0 points (week hasn't happened)
  const validMatchups = weekMatchups.filter((m) => m.points > 0);
  if (validMatchups.length === 0) return [];

  const results: WeeklyAllPlay[] = [];

  for (const team of validMatchups) {
    let wins = 0;
    let losses = 0;
    let ties = 0;

    for (const opponent of validMatchups) {
      if (opponent.roster_id === team.roster_id) continue;

      if (team.points > opponent.points) {
        wins++;
      } else if (team.points < opponent.points) {
        losses++;
      } else {
        // Ties count as 0.5 wins and 0.5 losses
        ties++;
      }
    }

    results.push({
      rosterId: team.roster_id,
      wins,
      losses,
      ties,
      points: team.points,
    });
  }

  return results;
}

// --- Step 2 & 3: Accumulate and sort ---
// Sort by All-Play Win% descending; tiebreaker = season Points For average

export function calculatePowerRankings(
  allMatchups: Map<number, SleeperMatchup[]>,
  rosterInfo: Map<number, { displayName: string; division: string; wins: number; losses: number }>,
  upToWeek?: number
): PowerRankingEntry[] {
  // Accumulate all-play results across all completed weeks
  const accumulated = new Map<
    number,
    { wins: number; losses: number; ties: number; totalPoints: number; weeksPlayed: number }
  >();

  const maxWeek = upToWeek ?? Math.max(...Array.from(allMatchups.keys()));

  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = allMatchups.get(week);
    if (!weekMatchups) continue;

    const weekResults = calculateWeeklyAllPlay(weekMatchups);
    if (weekResults.length === 0) continue;

    for (const result of weekResults) {
      const existing = accumulated.get(result.rosterId) || {
        wins: 0,
        losses: 0,
        ties: 0,
        totalPoints: 0,
        weeksPlayed: 0,
      };

      accumulated.set(result.rosterId, {
        wins: existing.wins + result.wins,
        losses: existing.losses + result.losses,
        ties: existing.ties + result.ties,
        totalPoints: existing.totalPoints + result.points,
        weeksPlayed: existing.weeksPlayed + 1,
      });
    }
  }

  // Build entries
  const entries: PowerRankingEntry[] = [];

  for (const [rosterId, stats] of accumulated) {
    const info = rosterInfo.get(rosterId);
    if (!info) continue;

    // All-Play Win%: wins + (ties * 0.5) divided by total all-play games
    const allPlayGames = stats.wins + stats.losses + stats.ties;
    const allPlayWinPct =
      allPlayGames > 0 ? (stats.wins + stats.ties * 0.5) / allPlayGames : 0;

    const avgPoints = stats.weeksPlayed > 0 ? stats.totalPoints / stats.weeksPlayed : 0;

    // Actual Win% from real schedule
    const totalActualGames = info.wins + info.losses;
    const actualWinPct = totalActualGames > 0 ? info.wins / totalActualGames : 0;

    // Luck Index = Actual Win% - All-Play Win%
    // Positive means lucky: winning more than the scoring suggests
    // Negative means unlucky: outscoring opponents who keep beating you
    const luckIndex = actualWinPct - allPlayWinPct;

    entries.push({
      rosterId,
      displayName: info.displayName,
      division: info.division,
      allPlayWins: stats.wins,
      allPlayLosses: stats.losses,
      allPlayTies: stats.ties,
      allPlayWinPct,
      avgPointsPerWeek: Math.round(avgPoints * 100) / 100,
      totalPoints: Math.round(stats.totalPoints * 100) / 100,
      weeksPlayed: stats.weeksPlayed,
      actualWins: info.wins,
      actualLosses: info.losses,
      actualWinPct,
      luckIndex: Math.round(luckIndex * 1000) / 1000,
      rankChange: 0, // calculated after sorting
      rank: 0,
    });
  }

  // Sort by All-Play Win% descending; tiebreaker: average PF/week
  entries.sort((a, b) => {
    if (Math.abs(a.allPlayWinPct - b.allPlayWinPct) > 0.0001) {
      return b.allPlayWinPct - a.allPlayWinPct;
    }
    return b.avgPointsPerWeek - a.avgPointsPerWeek;
  });

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}

// --- Step 3: Week-over-week movement ---
// Compare current week's rankings to prior week's rankings.
// ▲N (green) = moved up, ▼N (red) = moved down, — (gray) = no change

export function calculateRankChanges(
  currentRankings: PowerRankingEntry[],
  previousRankings: PowerRankingEntry[]
): PowerRankingEntry[] {
  const previousRankMap = new Map<number, number>();
  for (const entry of previousRankings) {
    previousRankMap.set(entry.rosterId, entry.rank);
  }

  return currentRankings.map((entry) => {
    const prevRank = previousRankMap.get(entry.rosterId);
    // rankChange > 0 means moved UP (was ranked lower/higher number, now ranked higher/lower number)
    const rankChange = prevRank ? prevRank - entry.rank : 0;
    return { ...entry, rankChange };
  });
}
