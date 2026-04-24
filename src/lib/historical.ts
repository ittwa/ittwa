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
  icon: string;
}

export interface GameRecordItem {
  label: string;
  value: string;
  detail: string;
  colorType: "gold" | "red" | "muted";
  icon: string;
}

export interface SeasonRecordItem {
  label: string;
  value: string;
  detail: string;
  colorType: "gold" | "red" | "emerald" | "muted";
}

export interface SeasonSummary {
  highScore: { value: string; detail: string };
  lowScore: { value: string; detail: string };
  leaders: { label: string; name: string; value: string; colorType: string }[];
}

function resolveOwner(raw: string): string {
  return OWNER_LAST_NAME_MAP[raw] || raw;
}

export function computeChampions(scores: ScoreRow[]): HistoricalChampion[] {
  const seasons = [...new Set(scores.map((s) => s.season))].sort().reverse();
  const champions: HistoricalChampion[] = [];

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

export function computeGameRecords(scores: ScoreRow[]): GameRecordItem[] {
  const regSeason = scores.filter((s) => !s.playoffType && s.points > 0);

  let high = { pts: 0, owner: "", week: 0, season: "" };
  let low = { pts: Infinity, owner: "", week: 0, season: "" };
  let highLosing = { pts: 0, owner: "", week: 0, season: "" };
  let lowWinning = { pts: Infinity, owner: "", week: 0, season: "" };

  for (const r of regSeason) {
    if (r.points > high.pts)
      high = { pts: r.points, owner: r.owner, week: r.week, season: r.season };
    if (r.points < low.pts)
      low = { pts: r.points, owner: r.owner, week: r.week, season: r.season };
    if (r.points < r.opponentPoints && r.points > highLosing.pts)
      highLosing = { pts: r.points, owner: r.owner, week: r.week, season: r.season };
    if (r.points > r.opponentPoints && r.points < lowWinning.pts)
      lowWinning = { pts: r.points, owner: r.owner, week: r.week, season: r.season };
  }

  return [
    {
      label: "Highest Single-Game Score",
      value: high.pts.toFixed(1),
      detail: `${resolveOwner(high.owner)} · Wk ${high.week}, ${high.season}`,
      colorType: "gold",
      icon: "↑",
    },
    {
      label: "Lowest Single-Game Score",
      value: low.pts === Infinity ? "—" : low.pts.toFixed(1),
      detail: low.pts === Infinity ? "—" : `${resolveOwner(low.owner)} · Wk ${low.week}, ${low.season}`,
      colorType: "red",
      icon: "↓",
    },
    {
      label: "Highest Losing Score",
      value: highLosing.pts > 0 ? highLosing.pts.toFixed(1) : "—",
      detail: highLosing.pts > 0 ? `${resolveOwner(highLosing.owner)} · Wk ${highLosing.week}, ${highLosing.season}` : "—",
      colorType: "muted",
      icon: "↑",
    },
    {
      label: "Lowest Winning Score",
      value: lowWinning.pts < Infinity ? lowWinning.pts.toFixed(1) : "—",
      detail: lowWinning.pts < Infinity ? `${resolveOwner(lowWinning.owner)} · Wk ${lowWinning.week}, ${lowWinning.season}` : "—",
      colorType: "muted",
      icon: "↓",
    },
  ];
}

export function computeSeasonRecords(scores: ScoreRow[]): SeasonRecordItem[] {
  const regSeason = scores.filter((s) => !s.playoffType && s.points > 0);

  const seasonPF = new Map<string, number>();
  const seasonPA = new Map<string, number>();
  const seasonWL = new Map<string, { wins: number; losses: number }>();

  for (const r of regSeason) {
    const key = `${r.season}:${r.owner}`;
    seasonPF.set(key, (seasonPF.get(key) || 0) + r.points);
    seasonPA.set(key, (seasonPA.get(key) || 0) + r.opponentPoints);
    if (!seasonWL.has(key)) seasonWL.set(key, { wins: 0, losses: 0 });
    const wl = seasonWL.get(key)!;
    if (r.points > r.opponentPoints) wl.wins++;
    else if (r.points < r.opponentPoints) wl.losses++;
  }

  const pfArr = [...seasonPF.entries()]
    .map(([k, pf]) => {
      const [season, owner] = k.split(":");
      return { season, owner, pf };
    })
    .sort((a, b) => b.pf - a.pf);

  const paArr = [...seasonPA.entries()]
    .map(([k, pa]) => {
      const [season, owner] = k.split(":");
      return { season, owner, pa };
    })
    .sort((a, b) => b.pa - a.pa);

  const wlArr = [...seasonWL.entries()]
    .map(([k, wl]) => {
      const [season, owner] = k.split(":");
      return { season, owner, ...wl };
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  const bestPF = pfArr[0];
  const worstPF = pfArr[pfArr.length - 1];
  const bestRec = wlArr[0];
  const worstRec = wlArr[wlArr.length - 1];
  const mostPA = paArr[0];
  const leastPA = paArr[paArr.length - 1];

  return [
    {
      label: "Most Points in a Season",
      value: bestPF ? bestPF.pf.toFixed(1) : "—",
      detail: bestPF ? `${resolveOwner(bestPF.owner)} · ${bestPF.season}` : "—",
      colorType: "gold",
    },
    {
      label: "Fewest Points in a Season",
      value: worstPF ? worstPF.pf.toFixed(1) : "—",
      detail: worstPF ? `${resolveOwner(worstPF.owner)} · ${worstPF.season}` : "—",
      colorType: "red",
    },
    {
      label: "Best Season Record",
      value: bestRec ? `${bestRec.wins}–${bestRec.losses}` : "—",
      detail: bestRec ? `${resolveOwner(bestRec.owner)} · ${bestRec.season}` : "—",
      colorType: "emerald",
    },
    {
      label: "Worst Season Record",
      value: worstRec ? `${worstRec.wins}–${worstRec.losses}` : "—",
      detail: worstRec ? `${resolveOwner(worstRec.owner)} · ${worstRec.season}` : "—",
      colorType: "red",
    },
    {
      label: "Most Points Against",
      value: mostPA ? mostPA.pa.toFixed(1) : "—",
      detail: mostPA ? `${resolveOwner(mostPA.owner)} · ${mostPA.season}` : "—",
      colorType: "muted",
    },
    {
      label: "Fewest Points Against",
      value: leastPA ? leastPA.pa.toFixed(1) : "—",
      detail: leastPA ? `${resolveOwner(leastPA.owner)} · ${leastPA.season}` : "—",
      colorType: "muted",
    },
  ];
}

export function computeMilestones(scores: ScoreRow[]): HistoricalMilestone[] {
  const regSeason = scores.filter((s) => !s.playoffType && s.points > 0);

  let blowout = { margin: 0, winner: "", loser: "", week: 0, season: "" };
  let closest = { margin: Infinity, winner: "", loser: "", week: 0, season: "" };
  let highMatchup = { total: 0, owner: "", opp: "", week: 0, season: "" };
  let lowMatchup = { total: Infinity, owner: "", opp: "", week: 0, season: "" };

  for (const r of regSeason) {
    const margin = Math.abs(r.points - r.opponentPoints);
    if (r.points > r.opponentPoints && margin > blowout.margin)
      blowout = { margin, winner: r.owner, loser: r.opponent, week: r.week, season: r.season };
    if (margin > 0 && margin < closest.margin)
      closest = { margin, winner: r.points > r.opponentPoints ? r.owner : r.opponent, loser: r.points < r.opponentPoints ? r.owner : r.opponent, week: r.week, season: r.season };

    const total = r.points + r.opponentPoints;
    if (total > highMatchup.total)
      highMatchup = { total, owner: r.owner, opp: r.opponent, week: r.week, season: r.season };
    if (total < lowMatchup.total)
      lowMatchup = { total, owner: r.owner, opp: r.opponent, week: r.week, season: r.season };
  }

  const gamesByOwner = new Map<string, { season: string; week: number; won: boolean }[]>();
  for (const r of regSeason) {
    if (!gamesByOwner.has(r.owner)) gamesByOwner.set(r.owner, []);
    gamesByOwner.get(r.owner)!.push({ season: r.season, week: r.week, won: r.points > r.opponentPoints });
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

  return [
    {
      label: "Biggest Blowout",
      value: `+${blowout.margin.toFixed(1)}`,
      detail: `${resolveOwner(blowout.winner)} vs ${resolveOwner(blowout.loser)} · Wk ${blowout.week}, ${blowout.season}`,
      icon: "💥",
    },
    {
      label: "Closest Game",
      value: closest.margin < Infinity ? closest.margin.toFixed(2) : "—",
      detail: closest.margin < Infinity ? `${resolveOwner(closest.winner)} def. ${resolveOwner(closest.loser)} · Wk ${closest.week}, ${closest.season}` : "—",
      icon: "⚖️",
    },
    {
      label: "Longest Win Streak",
      value: `${bestStreak.count}W`,
      detail: resolveOwner(bestStreak.owner),
      icon: "🔥",
    },
    {
      label: "Longest Losing Streak",
      value: `${worstStreak.count}L`,
      detail: resolveOwner(worstStreak.owner),
      icon: "💀",
    },
    {
      label: "Highest Scoring Matchup",
      value: highMatchup.total.toFixed(1),
      detail: `${resolveOwner(highMatchup.owner)} vs ${resolveOwner(highMatchup.opp)} · Wk ${highMatchup.week}, ${highMatchup.season}`,
      icon: "📊",
    },
    {
      label: "Lowest Scoring Matchup",
      value: lowMatchup.total < Infinity ? lowMatchup.total.toFixed(1) : "—",
      detail: lowMatchup.total < Infinity ? `${resolveOwner(lowMatchup.owner)} vs ${resolveOwner(lowMatchup.opp)} · Wk ${lowMatchup.week}, ${lowMatchup.season}` : "—",
      icon: "📉",
    },
  ];
}

export function computeSeasonSummaries(scores: ScoreRow[]): Record<string, SeasonSummary> {
  const seasons = [...new Set(scores.map((s) => s.season))].filter(Boolean);
  const result: Record<string, SeasonSummary> = {};

  for (const season of seasons) {
    const regSeason = scores.filter((s) => s.season === season && !s.playoffType && s.points > 0);
    if (regSeason.length === 0) continue;

    let high = { pts: 0, owner: "", week: 0 };
    let low = { pts: Infinity, owner: "", week: 0 };
    const pf = new Map<string, number>();
    const wl = new Map<string, { w: number; l: number }>();

    for (const r of regSeason) {
      if (r.points > high.pts) high = { pts: r.points, owner: r.owner, week: r.week };
      if (r.points < low.pts) low = { pts: r.points, owner: r.owner, week: r.week };
      pf.set(r.owner, (pf.get(r.owner) || 0) + r.points);
      if (!wl.has(r.owner)) wl.set(r.owner, { w: 0, l: 0 });
      const rec = wl.get(r.owner)!;
      if (r.points > r.opponentPoints) rec.w++;
      else if (r.points < r.opponentPoints) rec.l++;
    }

    const pfArr = [...pf.entries()].sort((a, b) => b[1] - a[1]);
    const wlArr = [...wl.entries()]
      .map(([owner, rec]) => ({ owner, ...rec }))
      .sort((a, b) => b.w - a.w || a.l - b.l);
    const best = wlArr[0];
    const worst = wlArr[wlArr.length - 1];

    const gamesByOwner = new Map<string, boolean[]>();
    for (const r of regSeason) {
      if (!gamesByOwner.has(r.owner)) gamesByOwner.set(r.owner, []);
      gamesByOwner.get(r.owner)!.push(r.points > r.opponentPoints);
    }

    let bestWin = { owner: "", count: 0 };
    let bestLoss = { owner: "", count: 0 };
    for (const [owner, games] of gamesByOwner) {
      let wc = 0, lc = 0;
      for (const won of games) {
        if (won) { wc++; lc = 0; if (wc > bestWin.count) bestWin = { owner, count: wc }; }
        else { lc++; wc = 0; if (lc > bestLoss.count) bestLoss = { owner, count: lc }; }
      }
    }

    result[season] = {
      highScore: { value: high.pts.toFixed(1), detail: `${resolveOwner(high.owner)} · Week ${high.week}` },
      lowScore: { value: low.pts === Infinity ? "—" : low.pts.toFixed(1), detail: low.pts === Infinity ? "—" : `${resolveOwner(low.owner)} · Week ${low.week}` },
      leaders: [
        { label: "Points Leader", name: resolveOwner(pfArr[0]?.[0] || ""), value: pfArr[0]?.[1]?.toFixed(1) || "—", colorType: "gold" },
        { label: "Best Record", name: resolveOwner(best?.owner || ""), value: best ? `${best.w}–${best.l}` : "—", colorType: "emerald" },
        { label: "Worst Record", name: resolveOwner(worst?.owner || ""), value: worst ? `${worst.w}–${worst.l}` : "—", colorType: "red" },
        { label: "Win Streak", name: `${resolveOwner(bestWin.owner)} · ${bestWin.count}W`, value: "", colorType: "emerald" },
        { label: "Loss Streak", name: `${resolveOwner(bestLoss.owner)} · ${bestLoss.count}L`, value: "", colorType: "red" },
      ],
    };
  }

  return result;
}
