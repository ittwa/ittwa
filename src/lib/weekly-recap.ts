import { SleeperMatchup } from "@/types/sleeper";

// ── Weekly Recap generator ──────────────────────────────────────────────────
//
// For each completed week, derive the week's storylines from the matchup blobs
// and turn them into a short, deterministic prose recap (no LLM call). The Home
// page features the most recent week; older weeks are reachable via the selector.
//
//   motw     — Manager of the Week, the highest scorer (+ delta vs the average)
//   toilet   — Toilet Bowl, the lowest scorer
//   blowout  — the matchup with the largest margin of victory
//   close    — the matchup with the smallest non-zero margin
//   unlucky  — the highest-scoring team that still lost its matchup

export interface RecapTeam {
  rosterId: number;
  owner: string;
  points: number;
}

export interface RecapMatchup {
  winner: RecapTeam;
  loser: RecapTeam;
  margin: number;
}

export interface WeeklyRecap {
  week: number;
  average: number;
  motw: RecapTeam & { delta: number };
  toilet: RecapTeam;
  blowout: RecapMatchup;
  close: RecapMatchup;
  unlucky: RecapTeam | null;
  headline: string;
  body: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeWeeklyRecaps(
  weeklyMatchups: Map<number, SleeperMatchup[]>,
  rosterOwnerMap: Record<number, string>,
): WeeklyRecap[] {
  const ownerOf = (id: number) => rosterOwnerMap[id] ?? `Team ${id}`;
  const recaps: WeeklyRecap[] = [];

  const weeks = [...weeklyMatchups.keys()].sort((a, b) => a - b);

  for (const week of weeks) {
    const matchups = weeklyMatchups.get(week) ?? [];
    const scored = matchups.filter((m) => m.points > 0);
    if (scored.length < 2) continue;

    const teams: RecapTeam[] = scored.map((m) => ({
      rosterId: m.roster_id,
      owner: ownerOf(m.roster_id),
      points: m.points,
    }));

    const average = teams.reduce((s, t) => s + t.points, 0) / teams.length;

    // Highest / lowest scorers.
    const sorted = [...teams].sort((a, b) => b.points - a.points);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];

    // Build matchup pairs to find margins + the unlucky loser.
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of scored) {
      const arr = byMatchup.get(m.matchup_id) ?? [];
      arr.push(m);
      byMatchup.set(m.matchup_id, arr);
    }

    const pairs: RecapMatchup[] = [];
    const losers: RecapTeam[] = [];
    for (const [, pair] of byMatchup) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      if (a.points === b.points) continue; // ties produce no winner/loser
      const winRaw = a.points > b.points ? a : b;
      const loseRaw = a.points > b.points ? b : a;
      const winner: RecapTeam = { rosterId: winRaw.roster_id, owner: ownerOf(winRaw.roster_id), points: winRaw.points };
      const loser: RecapTeam = { rosterId: loseRaw.roster_id, owner: ownerOf(loseRaw.roster_id), points: loseRaw.points };
      pairs.push({ winner, loser, margin: round2(winner.points - loser.points) });
      losers.push(loser);
    }

    if (pairs.length === 0) continue; // every game tied — nothing to recap

    const blowout = pairs.reduce((m, p) => (p.margin > m.margin ? p : m));
    const close = pairs.reduce((m, p) => (p.margin < m.margin ? p : m));
    const unlucky = losers.length
      ? losers.reduce((m, t) => (t.points > m.points ? t : m))
      : null;

    const delta = round2(top.points - average);

    const motw = { ...top, delta };
    const toilet = bottom;

    const headline = `${motw.owner} is your Week ${week} Manager of the Week`;

    let body =
      `${motw.owner} took Manager of the Week with ${motw.points.toFixed(1)} points, ` +
      `${delta.toFixed(1)} above the weekly average. ` +
      `The woodshed award goes to ${blowout.winner.owner}, who buried ${blowout.loser.owner} ` +
      `by ${blowout.margin.toFixed(1)}. ` +
      `Closest call: ${close.winner.owner} survived ${close.loser.owner} by ${close.margin.toFixed(2)}. ` +
      `And someone has to clean the toilet: ${toilet.owner} brought up the rear with ${toilet.points.toFixed(1)}.`;

    // The unlucky loser only earns a line when it isn't already the headline name.
    if (unlucky && unlucky.rosterId !== motw.rosterId) {
      body += ` Spare a thought for ${unlucky.owner}, who dropped ${unlucky.points.toFixed(1)} and still lost.`;
    }

    recaps.push({
      week,
      average: round2(average),
      motw,
      toilet,
      blowout,
      close,
      unlucky,
      headline,
      body,
    });
  }

  return recaps;
}
