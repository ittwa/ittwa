import { ScoreRow } from "./sheets";
import { OWNER_LAST_NAME_MAP } from "./config";

export interface HistoricalChampion {
  year: string;
  champion: string;
  runnerUp: string;
  third: string;
}

export interface AllTimeStanding {
  owner: string;
  wins: number;
  losses: number;
  pf: number;
  rings: number;
  playoffs: number;
}

export interface HistoricalMilestone {
  label: string;
  value: string;
  detail: string;
}

function resolveOwner(raw: string): string {
  return OWNER_LAST_NAME_MAP[raw] || raw;
}

export function computeChampions(scores: ScoreRow[]): HistoricalChampion[] {
  const seasons = [...new Set(scores.map((s) => s.season))].sort().reverse();
  const champions: HistoricalChampion[] = [];

  for (const year of seasons) {
    const seasonRows = scores.filter((s) => s.season === year);
    const bestByOwner = new Map<string, number>();

    for (const r of seasonRows) {
      const cur = bestByOwner.get(r.owner);
      if (cur === undefined || r.finalStanding < cur) {
        bestByOwner.set(r.owner, r.finalStanding);
      }
    }

    const sorted = [...bestByOwner.entries()].sort((a, b) => a[1] - b[1]);
    champions.push({
      year,
      champion: resolveOwner(sorted[0]?.[0] || "—"),
      runnerUp: resolveOwner(sorted[1]?.[0] || "—"),
      third: resolveOwner(sorted[2]?.[0] || "—"),
    });
  }

  return champions;
}

export function computeAllTimeStandings(
  scores: ScoreRow[],
  champions: HistoricalChampion[]
): AllTimeStanding[] {
  const ringsByOwner = new Map<string, number>();
  for (const c of champions) {
    ringsByOwner.set(c.champion, (ringsByOwner.get(c.champion) || 0) + 1);
  }

  const stats = new Map<
    string,
    { wins: number; losses: number; pf: number; playoffSeasons: Set<string> }
  >();

  for (const r of scores) {
    const owner = resolveOwner(r.owner);
    if (!stats.has(owner)) {
      stats.set(owner, { wins: 0, losses: 0, pf: 0, playoffSeasons: new Set() });
    }
    const s = stats.get(owner)!;

    if (!r.playoffType) {
      if (r.points > r.opponentPoints) s.wins++;
      else if (r.points < r.opponentPoints) s.losses++;
      s.pf += r.points;
    }

    if (r.playoffType && r.playoffType !== "Consolation") {
      s.playoffSeasons.add(r.season);
    }
  }

  return [...stats.entries()]
    .map(([owner, s]) => ({
      owner,
      wins: s.wins,
      losses: s.losses,
      pf: Math.round(s.pf * 10) / 10,
      rings: ringsByOwner.get(owner) || 0,
      playoffs: s.playoffSeasons.size,
    }))
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);
}

export function computeMilestones(scores: ScoreRow[]): HistoricalMilestone[] {
  const regSeason = scores.filter((s) => !s.playoffType && s.points > 0);

  let highGame = { pts: 0, owner: "", week: 0, season: "" };
  let lowGame = { pts: Infinity, owner: "", week: 0, season: "" };

  for (const r of regSeason) {
    if (r.points > highGame.pts) {
      highGame = { pts: r.points, owner: r.owner, week: r.week, season: r.season };
    }
    if (r.points < lowGame.pts) {
      lowGame = { pts: r.points, owner: r.owner, week: r.week, season: r.season };
    }
  }

  const seasonPF = new Map<string, number>();
  for (const r of regSeason) {
    const key = `${r.season}:${r.owner}`;
    seasonPF.set(key, (seasonPF.get(key) || 0) + r.points);
  }
  const pfArr = [...seasonPF.entries()]
    .map(([k, pf]) => {
      const [season, owner] = k.split(":");
      return { season, owner, pf };
    })
    .sort((a, b) => b.pf - a.pf);

  const bestSeason = pfArr[0];
  const worstSeason = pfArr[pfArr.length - 1];

  // Win/loss streaks
  const gamesByOwner = new Map<string, { season: string; week: number; won: boolean }[]>();
  for (const r of regSeason) {
    if (!gamesByOwner.has(r.owner)) gamesByOwner.set(r.owner, []);
    gamesByOwner.get(r.owner)!.push({
      season: r.season,
      week: r.week,
      won: r.points > r.opponentPoints,
    });
  }

  let bestStreak = { owner: "", count: 0 };
  let worstStreak = { owner: "", count: 0 };

  for (const [owner, games] of gamesByOwner) {
    games.sort((a, b) => (a.season === b.season ? a.week - b.week : a.season.localeCompare(b.season)));
    let wc = 0;
    let lc = 0;
    for (const g of games) {
      if (g.won) { wc++; lc = 0; if (wc > bestStreak.count) bestStreak = { owner, count: wc }; }
      else { lc++; wc = 0; if (lc > worstStreak.count) worstStreak = { owner, count: lc }; }
    }
  }

  // Highest-scoring matchup (combined points)
  let highMatchup = { total: 0, owner: "", opp: "", week: 0, season: "" };
  for (const r of regSeason) {
    const total = r.points + r.opponentPoints;
    if (total > highMatchup.total) {
      highMatchup = { total, owner: r.owner, opp: r.opponent, week: r.week, season: r.season };
    }
  }

  return [
    {
      label: "Highest Score (Game)",
      value: highGame.pts.toFixed(1),
      detail: `${resolveOwner(highGame.owner)} · Wk ${highGame.week}, ${highGame.season}`,
    },
    {
      label: "Lowest Score (Game)",
      value: lowGame.pts === Infinity ? "—" : lowGame.pts.toFixed(1),
      detail: lowGame.pts === Infinity ? "—" : `${resolveOwner(lowGame.owner)} · Wk ${lowGame.week}, ${lowGame.season}`,
    },
    {
      label: "Most Points (Season)",
      value: bestSeason ? bestSeason.pf.toFixed(1) : "—",
      detail: bestSeason ? `${resolveOwner(bestSeason.owner)} · ${bestSeason.season}` : "—",
    },
    {
      label: "Fewest Points (Season)",
      value: worstSeason ? worstSeason.pf.toFixed(1) : "—",
      detail: worstSeason ? `${resolveOwner(worstSeason.owner)} · ${worstSeason.season}` : "—",
    },
    {
      label: "Longest Win Streak",
      value: `${bestStreak.count}W`,
      detail: resolveOwner(bestStreak.owner),
    },
    {
      label: "Longest Losing Streak",
      value: `${worstStreak.count}L`,
      detail: resolveOwner(worstStreak.owner),
    },
    {
      label: "Highest Scoring Matchup",
      value: highMatchup.total.toFixed(1),
      detail: `${resolveOwner(highMatchup.owner)} vs ${resolveOwner(highMatchup.opp)} · Wk ${highMatchup.week}, ${highMatchup.season}`,
    },
  ];
}
