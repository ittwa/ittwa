import type { TeamMeta } from "./matchups-client";

export interface GotwMatchup {
  aName: string;
  bName: string;
  aMeta: TeamMeta | null;
  bMeta: TeamMeta | null;
  spread: number;
  aProj: number;
  bProj: number;
  status: "live" | "final" | "upcoming";
}

interface Weights {
  competitiveness: number;
  combinedRecord: number;
  divisionalRivalry: number;
  playoffImplications: number;
  scoringUpside: number;
  streakMomentum: number;
}

function getWeights(week: number, playoffWeekStart: number): Weights {
  if (week >= playoffWeekStart)
    return { competitiveness: 0.20, combinedRecord: 0.15, divisionalRivalry: 0.15, playoffImplications: 0.30, scoringUpside: 0.10, streakMomentum: 0.10 };
  if (week >= 11)
    return { competitiveness: 0.30, combinedRecord: 0.15, divisionalRivalry: 0.15, playoffImplications: 0.25, scoringUpside: 0.15, streakMomentum: 0.10 };
  if (week >= 6)
    return { competitiveness: 0.30, combinedRecord: 0.20, divisionalRivalry: 0.15, playoffImplications: 0.15, scoringUpside: 0.15, streakMomentum: 0.15 };
  return { competitiveness: 0.30, combinedRecord: 0.25, divisionalRivalry: 0.15, playoffImplications: 0.00, scoringUpside: 0.15, streakMomentum: 0.15 };
}

function normalizeScores(values: number[], higherIsBetter: boolean): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 10);
  return values.map(v => {
    const ratio = (v - min) / (max - min);
    return 10 * (higherIsBetter ? ratio : 1 - ratio);
  });
}

function parseStreak(streak: string): { type: "W" | "L" | "none"; length: number } {
  if (!streak || streak === "-" || streak === "—") return { type: "none", length: 0 };
  const match = streak.match(/^([WL])(\d+)$/);
  if (!match) return { type: "none", length: 0 };
  return { type: match[1] as "W" | "L", length: parseInt(match[2], 10) };
}

// Factor 1: closest projected spread = most competitive
function scoreCompetitiveness(matchups: GotwMatchup[]): number[] {
  const gaps = matchups.map(m => Math.abs(m.spread));
  return normalizeScores(gaps, false);
}

// Factor 2: more combined wins = better quality matchup
function scoreCombinedRecord(matchups: GotwMatchup[]): number[] {
  const combined = matchups.map(m => (m.aMeta?.wins ?? 0) + (m.bMeta?.wins ?? 0));
  return normalizeScores(combined, true);
}

// Factor 3: same division = 10, different = 0
function scoreDivisionalRivalry(matchups: GotwMatchup[]): number[] {
  return matchups.map(m => {
    const aDiv = m.aMeta?.division;
    const bDiv = m.bMeta?.division;
    return (aDiv && bDiv && aDiv === bDiv) ? 10 : 0;
  });
}

// Factor 4: playoff bubble proximity, bye race, division title race
function scorePlayoffImplications(
  matchups: GotwMatchup[],
  allTeams: TeamMeta[],
  week: number,
  playoffWeekStart: number,
  playoffTeams: number,
): number[] {
  if (week >= playoffWeekStart) {
    // Playoff weeks: score by round importance
    const playoffRound = week - playoffWeekStart;
    return matchups.map(m => {
      const aSeed = m.aMeta?.seed;
      const bSeed = m.bMeta?.seed;
      if (aSeed && bSeed) {
        if (playoffRound >= 2) return 10; // Championship
        if (playoffRound === 1) return 8; // Semifinals
        return 6; // Wild card
      }
      return 2; // Consolation (3rd place game is worth $150)
    });
  }

  if (week <= 5) return matchups.map(() => 0);

  const sorted = [...allTeams].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);

  // Build division leaders map
  const divisionTeams = new Map<string, TeamMeta[]>();
  for (const t of sorted) {
    const arr = divisionTeams.get(t.division) || [];
    arr.push(t);
    divisionTeams.set(t.division, arr);
  }

  function teamBubbleScore(meta: TeamMeta | null): number {
    if (!meta) return 0;
    let score = 0;

    // Bubble proximity: peaks for teams ranked 6th-7th
    score += Math.max(0, 3 - Math.abs(meta.rank - (playoffTeams + 0.5)));

    // Fighting for a bye (seeds 1-2): bonus if 3rd place is within 1 game
    if (meta.rank <= 2 && sorted[2]) {
      if (meta.wins - sorted[2].wins <= 1) score += 2;
    }

    // Division title race: bonus if top 2 in division are within 1 game
    const divTeams = divisionTeams.get(meta.division);
    if (divTeams && divTeams.length >= 2) {
      const leader = divTeams[0];
      const runnerUp = divTeams[1];
      if (leader.wins - runnerUp.wins <= 1) {
        if (meta.displayName === leader.displayName || meta.displayName === runnerUp.displayName) {
          score += 2;
        }
      }
    }

    return score;
  }

  const rawScores = matchups.map(m =>
    Math.min(10, teamBubbleScore(m.aMeta) + teamBubbleScore(m.bMeta))
  );
  return normalizeScores(rawScores, true);
}

// Factor 5: higher combined projections = more exciting shootout potential
function scoreScoringUpside(matchups: GotwMatchup[]): number[] {
  const combined = matchups.map(m => m.aProj + m.bProj);
  return normalizeScores(combined, true);
}

// Factor 6: teams on 3+ game streaks generate narrative interest
function scoreStreakMomentum(matchups: GotwMatchup[]): number[] {
  return matchups.map(m => {
    const aStreak = parseStreak(m.aMeta?.streak || "");
    const bStreak = parseStreak(m.bMeta?.streak || "");

    let aScore = 0, bScore = 0;
    if (aStreak.length >= 3) aScore = Math.min(5, aStreak.length - 1);
    if (bStreak.length >= 3) bScore = Math.min(5, bStreak.length - 1);

    let total = aScore + bScore;

    // Clash of trajectories: one hot, one cold
    if (aStreak.length >= 3 && bStreak.length >= 3 && aStreak.type !== bStreak.type) {
      total += 2;
    }

    return Math.min(10, total);
  });
}

function isDisqualified(
  m: GotwMatchup,
  allTeams: TeamMeta[],
  week: number,
  playoffWeekStart: number,
  playoffTeams: number,
): boolean {
  const regularSeasonWeeks = playoffWeekStart - 1;

  // Both teams eliminated from playoff contention (week 10+)
  if (week >= 10 && week < playoffWeekStart) {
    const sorted = [...allTeams].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
    const cutoffWins = sorted[playoffTeams - 1]?.wins ?? 0;

    function isEliminated(meta: TeamMeta | null): boolean {
      if (!meta) return false;
      const gamesPlayed = meta.wins + meta.losses + meta.ties;
      const remaining = Math.max(0, regularSeasonWeeks - gamesPlayed);
      return (meta.wins + remaining) < cutoffWins;
    }

    if (isEliminated(m.aMeta) && isEliminated(m.bMeta)) return true;
  }

  // Consolation bracket in playoffs: neither team has a playoff seed
  if (week >= playoffWeekStart) {
    if (!m.aMeta?.seed && !m.bMeta?.seed) return true;
  }

  return false;
}

export function calculateGameOfTheWeek(
  matchups: GotwMatchup[],
  teamMeta: Record<string, TeamMeta>,
  week: number,
  playoffWeekStart: number,
  playoffTeams: number = 6,
): number {
  if (matchups.length === 0) return -1;

  const allTeams = Object.values(teamMeta);

  // Filter disqualified matchups
  const eligible: number[] = [];
  for (let i = 0; i < matchups.length; i++) {
    if (!isDisqualified(matchups[i], allTeams, week, playoffWeekStart, playoffTeams)) {
      eligible.push(i);
    }
  }
  if (eligible.length === 0) return -1;

  const subset = eligible.map(i => matchups[i]);
  const weights = getWeights(week, playoffWeekStart);

  const f1 = scoreCompetitiveness(subset);
  const f2 = scoreCombinedRecord(subset);
  const f3 = scoreDivisionalRivalry(subset);
  const f4 = scorePlayoffImplications(subset, allTeams, week, playoffWeekStart, playoffTeams);
  const f5 = scoreScoringUpside(subset);
  const f6 = scoreStreakMomentum(subset);

  const composites = subset.map((_, i) =>
    f1[i] * weights.competitiveness +
    f2[i] * weights.combinedRecord +
    f3[i] * weights.divisionalRivalry +
    f4[i] * weights.playoffImplications +
    f5[i] * weights.scoringUpside +
    f6[i] * weights.streakMomentum
  );

  let bestLocal = 0;
  for (let i = 1; i < composites.length; i++) {
    if (composites[i] > composites[bestLocal]) {
      bestLocal = i;
    } else if (composites[i] === composites[bestLocal]) {
      // Tiebreaker 1: higher competitiveness
      if (f1[i] > f1[bestLocal]) {
        bestLocal = i;
      } else if (f1[i] === f1[bestLocal] && f3[i] > f3[bestLocal]) {
        // Tiebreaker 2: divisional matchup
        bestLocal = i;
      }
    }
  }

  return eligible[bestLocal];
}
