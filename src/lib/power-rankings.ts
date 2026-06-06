import { SleeperMatchup } from "@/types/sleeper";
import { ScoreRow } from "./sheets";
import { OWNER_LAST_NAME_MAP } from "./config";

const RECENCY_FACTOR = 0.92;

export interface PowerRankingEntry {
  rosterId: number;
  displayName: string;
  division: string;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  allPlayWinPct: number;
  avgPointsPerWeek: number;
  totalPoints: number;
  weeksPlayed: number;
  actualWins: number;
  actualLosses: number;
  actualWinPct: number;
  luckIndex: number;
  rankChange: number;
  rank: number;
  powerScore: number;
}

export interface PowerHistoryEntry {
  year: string;
  powerOne: string;
  champ: string;
  matched: boolean;
}

interface WeeklyAllPlay {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
}

function calculateWeeklyAllPlay(weekMatchups: SleeperMatchup[]): WeeklyAllPlay[] {
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

function calculateWeeklyAllPlayFromScores(
  weekScores: { id: number; points: number }[],
): WeeklyAllPlay[] {
  const valid = weekScores.filter((s) => s.points > 0);
  if (valid.length === 0) return [];

  const results: WeeklyAllPlay[] = [];
  for (const team of valid) {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (const opp of valid) {
      if (opp.id === team.id) continue;
      if (team.points > opp.points) wins++;
      else if (team.points < opp.points) losses++;
      else ties++;
    }
    results.push({ rosterId: team.id, wins, losses, ties, points: team.points });
  }
  return results;
}

function computePowerScore(
  entries: PowerRankingEntry[],
  weeklyScores: Map<number, number[]>,
): void {
  if (entries.length === 0) return;

  const ppgSorted = [...entries].sort((a, b) => b.avgPointsPerWeek - a.avgPointsPerWeek);
  const ppgPctile = new Map<number, number>();
  ppgSorted.forEach((e, i) => ppgPctile.set(e.rosterId, 1 - i / (entries.length - 1 || 1)));

  const stdDevs: { rosterId: number; stdDev: number }[] = [];
  for (const entry of entries) {
    const scores = weeklyScores.get(entry.rosterId) || [];
    if (scores.length < 2) {
      stdDevs.push({ rosterId: entry.rosterId, stdDev: 0 });
      continue;
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    stdDevs.push({ rosterId: entry.rosterId, stdDev: Math.sqrt(variance) });
  }
  stdDevs.sort((a, b) => a.stdDev - b.stdDev);
  const consistPctile = new Map<number, number>();
  stdDevs.forEach((s, i) => consistPctile.set(s.rosterId, 1 - i / (entries.length - 1 || 1)));

  for (const entry of entries) {
    const apPctile = 1 - (entry.rank - 1) / (entries.length - 1 || 1);
    const ppg = ppgPctile.get(entry.rosterId) ?? 0;
    const consist = consistPctile.get(entry.rosterId) ?? 0;
    const raw = 0.55 * apPctile + 0.25 * ppg + 0.20 * consist;
    entry.powerScore = Math.round(raw * 100 * 10) / 10;
  }
}

export function calculatePowerRankings(
  allMatchups: Map<number, SleeperMatchup[]>,
  rosterInfo: Map<number, { displayName: string; division: string; wins: number; losses: number }>,
  upToWeek?: number,
  recencyWeighting = false,
): PowerRankingEntry[] {
  const accumulated = new Map<
    number,
    { wins: number; losses: number; ties: number; totalPoints: number; weeksPlayed: number }
  >();
  const weeklyScores = new Map<number, number[]>();

  const maxWeek = upToWeek ?? Math.max(...Array.from(allMatchups.keys()));

  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = allMatchups.get(week);
    if (!weekMatchups) continue;

    const weekResults = calculateWeeklyAllPlay(weekMatchups);
    if (weekResults.length === 0) continue;

    const weight = recencyWeighting
      ? Math.pow(RECENCY_FACTOR, maxWeek - week)
      : 1;

    for (const result of weekResults) {
      const existing = accumulated.get(result.rosterId) || {
        wins: 0, losses: 0, ties: 0, totalPoints: 0, weeksPlayed: 0,
      };

      accumulated.set(result.rosterId, {
        wins: existing.wins + result.wins * weight,
        losses: existing.losses + result.losses * weight,
        ties: existing.ties + result.ties * weight,
        totalPoints: existing.totalPoints + result.points * weight,
        weeksPlayed: existing.weeksPlayed + weight,
      });

      const scores = weeklyScores.get(result.rosterId) || [];
      scores.push(result.points);
      weeklyScores.set(result.rosterId, scores);
    }
  }

  const entries: PowerRankingEntry[] = [];

  for (const [rosterId, stats] of accumulated) {
    const info = rosterInfo.get(rosterId);
    if (!info) continue;

    const allPlayGames = stats.wins + stats.losses + stats.ties;
    const allPlayWinPct =
      allPlayGames > 0 ? (stats.wins + stats.ties * 0.5) / allPlayGames : 0;

    const avgPoints = stats.weeksPlayed > 0 ? stats.totalPoints / stats.weeksPlayed : 0;

    const totalActualGames = info.wins + info.losses;
    const actualWinPct = totalActualGames > 0 ? info.wins / totalActualGames : 0;
    const luckIndex = actualWinPct - allPlayWinPct;

    entries.push({
      rosterId,
      displayName: info.displayName,
      division: info.division,
      allPlayWins: Math.round(stats.wins * 100) / 100,
      allPlayLosses: Math.round(stats.losses * 100) / 100,
      allPlayTies: Math.round(stats.ties * 100) / 100,
      allPlayWinPct,
      avgPointsPerWeek: Math.round(avgPoints * 100) / 100,
      totalPoints: Math.round(stats.totalPoints * 100) / 100,
      weeksPlayed: Math.round(stats.weeksPlayed * 100) / 100,
      actualWins: info.wins,
      actualLosses: info.losses,
      actualWinPct,
      luckIndex: Math.round(luckIndex * 1000) / 1000,
      rankChange: 0,
      rank: 0,
      powerScore: 0,
    });
  }

  entries.sort((a, b) => {
    if (Math.abs(a.allPlayWinPct - b.allPlayWinPct) > 0.0001) {
      return b.allPlayWinPct - a.allPlayWinPct;
    }
    return b.avgPointsPerWeek - a.avgPointsPerWeek;
  });

  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  computePowerScore(entries, weeklyScores);

  return entries;
}

export function calculateRankChanges(
  currentRankings: PowerRankingEntry[],
  previousRankings: PowerRankingEntry[],
): PowerRankingEntry[] {
  const previousRankMap = new Map<number, number>();
  for (const entry of previousRankings) {
    previousRankMap.set(entry.rosterId, entry.rank);
  }

  return currentRankings.map((entry) => {
    const prevRank = previousRankMap.get(entry.rosterId);
    const rankChange = prevRank ? prevRank - entry.rank : 0;
    return { ...entry, rankChange };
  });
}

function resolveOwner(raw: string): string {
  return OWNER_LAST_NAME_MAP[raw] || raw;
}

export function calculatePowerRankingsFromScores(
  scores: ScoreRow[],
  season: string,
  upToWeek?: number,
): {
  weeklyRankings: Record<number, PowerRankingEntry[]>;
  allPlayByWeek: Record<number, Record<number, [number, number]>>;
  weeklyRankHistory: Record<number, number[]>;
  ownerIdMap: Map<string, number>;
  completedWeeks: number;
} {
  const seasonScores = scores.filter((s) => s.season === season && !s.playoffType && s.points > 0);
  if (seasonScores.length === 0) {
    return { weeklyRankings: {}, allPlayByWeek: {}, weeklyRankHistory: {}, ownerIdMap: new Map(), completedWeeks: 0 };
  }

  const owners = [...new Set(seasonScores.map((s) => resolveOwner(s.owner)))];
  const ownerIdMap = new Map<string, number>();
  owners.forEach((owner, idx) => ownerIdMap.set(owner, idx + 1));

  const weeks = [...new Set(seasonScores.map((s) => s.week))].sort((a, b) => a - b);
  const maxWeek = upToWeek ?? Math.max(...weeks);

  const rosterInfo = new Map<number, { displayName: string; division: string; wins: number; losses: number }>();
  const wlAccum = new Map<string, { wins: number; losses: number }>();
  for (const s of seasonScores) {
    const owner = resolveOwner(s.owner);
    const wl = wlAccum.get(owner) || { wins: 0, losses: 0 };
    if (s.week <= maxWeek) {
      if (s.points > s.opponentPoints) wl.wins++;
      else if (s.points < s.opponentPoints) wl.losses++;
    }
    wlAccum.set(owner, wl);
  }
  for (const [owner, wl] of wlAccum) {
    const id = ownerIdMap.get(owner)!;
    rosterInfo.set(id, { displayName: owner, division: "", ...wl });
  }

  const matchupsByWeek = new Map<number, { id: number; points: number }[]>();
  for (const s of seasonScores) {
    if (s.week > maxWeek) continue;
    const arr = matchupsByWeek.get(s.week) || [];
    const owner = resolveOwner(s.owner);
    const id = ownerIdMap.get(owner)!;
    if (!arr.some((a) => a.id === id)) {
      arr.push({ id, points: s.points });
    }
    matchupsByWeek.set(s.week, arr);
  }

  const weeklyRankings: Record<number, PowerRankingEntry[]> = {};
  const allPlayByWeek: Record<number, Record<number, [number, number]>> = {};
  const weeklyRankHistory: Record<number, number[]> = {};

  for (let w = 1; w <= maxWeek; w++) {
    if (!matchupsByWeek.has(w)) continue;

    const accumulated = new Map<number, { wins: number; losses: number; ties: number; totalPoints: number; weeksPlayed: number }>();
    const weeklyScores = new Map<number, number[]>();

    for (let ww = 1; ww <= w; ww++) {
      const weekData = matchupsByWeek.get(ww);
      if (!weekData) continue;
      const weekResults = calculateWeeklyAllPlayFromScores(weekData);
      for (const result of weekResults) {
        const existing = accumulated.get(result.rosterId) || { wins: 0, losses: 0, ties: 0, totalPoints: 0, weeksPlayed: 0 };
        accumulated.set(result.rosterId, {
          wins: existing.wins + result.wins,
          losses: existing.losses + result.losses,
          ties: existing.ties + result.ties,
          totalPoints: existing.totalPoints + result.points,
          weeksPlayed: existing.weeksPlayed + 1,
        });
        const sc = weeklyScores.get(result.rosterId) || [];
        sc.push(result.points);
        weeklyScores.set(result.rosterId, sc);
      }
    }

    const wlByWeek = new Map<string, { wins: number; losses: number }>();
    for (const s of seasonScores) {
      if (s.week > w) continue;
      const owner = resolveOwner(s.owner);
      const wl = wlByWeek.get(owner) || { wins: 0, losses: 0 };
      if (s.points > s.opponentPoints) wl.wins++;
      else if (s.points < s.opponentPoints) wl.losses++;
      wlByWeek.set(owner, wl);
    }
    const weekRosterInfo = new Map<number, { displayName: string; division: string; wins: number; losses: number }>();
    for (const [owner, wl] of wlByWeek) {
      const id = ownerIdMap.get(owner)!;
      weekRosterInfo.set(id, { displayName: owner, division: "", ...wl });
    }

    const entries: PowerRankingEntry[] = [];
    for (const [rosterId, stats] of accumulated) {
      const info = weekRosterInfo.get(rosterId);
      if (!info) continue;
      const allPlayGames = stats.wins + stats.losses + stats.ties;
      const allPlayWinPct = allPlayGames > 0 ? (stats.wins + stats.ties * 0.5) / allPlayGames : 0;
      const avgPoints = stats.weeksPlayed > 0 ? stats.totalPoints / stats.weeksPlayed : 0;
      const totalActualGames = info.wins + info.losses;
      const actualWinPct = totalActualGames > 0 ? info.wins / totalActualGames : 0;

      entries.push({
        rosterId,
        displayName: info.displayName,
        division: "",
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
        luckIndex: Math.round((actualWinPct - allPlayWinPct) * 1000) / 1000,
        rankChange: 0,
        rank: 0,
        powerScore: 0,
      });
    }

    entries.sort((a, b) => {
      if (Math.abs(a.allPlayWinPct - b.allPlayWinPct) > 0.0001) return b.allPlayWinPct - a.allPlayWinPct;
      return b.avgPointsPerWeek - a.avgPointsPerWeek;
    });
    entries.forEach((e, i) => { e.rank = i + 1; });
    computePowerScore(entries, weeklyScores);

    if (w > 1 && weeklyRankings[w - 1]) {
      weeklyRankings[w] = calculateRankChanges(entries, weeklyRankings[w - 1]);
    } else {
      weeklyRankings[w] = entries;
    }

    const weekData = matchupsByWeek.get(w);
    if (weekData) {
      const weekAllPlay: Record<number, [number, number]> = {};
      const results = calculateWeeklyAllPlayFromScores(weekData);
      for (const r of results) {
        weekAllPlay[r.rosterId] = [r.wins, r.losses];
      }
      allPlayByWeek[w] = weekAllPlay;
    }

    for (const entry of (weeklyRankings[w] || [])) {
      (weeklyRankHistory[entry.rosterId] ??= []).push(entry.rank);
    }
  }

  return {
    weeklyRankings,
    allPlayByWeek,
    weeklyRankHistory,
    ownerIdMap,
    completedWeeks: Math.max(...weeks.filter((w) => w <= maxWeek)),
  };
}

export function computeHistoricalPowerOnes(scores: ScoreRow[]): PowerHistoryEntry[] {
  const seasons = [...new Set(scores.map((s) => s.season))].filter(Boolean).sort().reverse();
  const results: PowerHistoryEntry[] = [];

  const champsByYear = new Map<string, string>();
  for (const year of seasons) {
    const seasonRows = scores.filter((s) => s.season === year);
    const hasChampionship = seasonRows.some((s) => s.playoffType === "Championship");
    if (!hasChampionship) continue;
    const bestByOwner = new Map<string, number>();
    for (const r of seasonRows) {
      const cur = bestByOwner.get(r.owner);
      if (cur === undefined || r.finalStanding < cur) {
        bestByOwner.set(r.owner, r.finalStanding);
      }
    }
    const sorted = [...bestByOwner.entries()].sort((a, b) => a[1] - b[1]);
    if (sorted[0]) champsByYear.set(year, resolveOwner(sorted[0][0]));
  }

  for (const year of seasons) {
    const regSeason = scores.filter((s) => s.season === year && !s.playoffType && s.points > 0);
    if (regSeason.length === 0) continue;

    const owners = [...new Set(regSeason.map((s) => s.owner))];
    const weeks = [...new Set(regSeason.map((s) => s.week))].sort((a, b) => a - b);

    const accumulated = new Map<string, { wins: number; losses: number; ties: number; totalPoints: number; weeksPlayed: number }>();

    for (const week of weeks) {
      const weekScores = regSeason.filter((s) => s.week === week);
      const ownerPoints = new Map<string, number>();
      for (const s of weekScores) {
        ownerPoints.set(s.owner, s.points);
      }

      for (const owner of owners) {
        const pts = ownerPoints.get(owner);
        if (pts === undefined || pts === 0) continue;

        let wins = 0, losses = 0, ties = 0;
        for (const [opp, oppPts] of ownerPoints) {
          if (opp === owner || oppPts === 0) continue;
          if (pts > oppPts) wins++;
          else if (pts < oppPts) losses++;
          else ties++;
        }

        const existing = accumulated.get(owner) || { wins: 0, losses: 0, ties: 0, totalPoints: 0, weeksPlayed: 0 };
        accumulated.set(owner, {
          wins: existing.wins + wins,
          losses: existing.losses + losses,
          ties: existing.ties + ties,
          totalPoints: existing.totalPoints + pts,
          weeksPlayed: existing.weeksPlayed + 1,
        });
      }
    }

    const ranked = [...accumulated.entries()]
      .map(([owner, stats]) => {
        const games = stats.wins + stats.losses + stats.ties;
        return { owner, winPct: games > 0 ? (stats.wins + stats.ties * 0.5) / games : 0, avgPts: stats.weeksPlayed > 0 ? stats.totalPoints / stats.weeksPlayed : 0 };
      })
      .sort((a, b) => {
        if (Math.abs(a.winPct - b.winPct) > 0.0001) return b.winPct - a.winPct;
        return b.avgPts - a.avgPts;
      });

    const powerOne = ranked[0] ? resolveOwner(ranked[0].owner) : "—";
    const champ = champsByYear.get(year) || "—";

    results.push({
      year,
      powerOne,
      champ,
      matched: powerOne === champ && powerOne !== "—",
    });
  }

  return results;
}
