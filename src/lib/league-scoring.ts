/**
 * League-specific fantasy scoring.
 *
 * Sleeper's stats feed carries raw stat lines (pass_yd, pass_td, pass_int,
 * rec, bonus_rec_yd_100, pts_allow_7_13, …) plus precomputed *generic*
 * totals (pts_half_ppr, pts_ppr, pts_std). Our league has custom scoring, so
 * the generic totals rank players differently than Sleeper's in-league
 * Players view does. That view scores every stat key with the league's
 * `scoring_settings` — this reproduces it.
 */

export type StatLine = Record<string, unknown>;

// Points = Σ stat × league weight, over every scoring key the line carries.
// Season stat lines are sums of the weekly lines (bonus/bucket keys are
// counts), and scoring is linear, so this equals summing the weekly scores.
export function scoreStatLine(stats: StatLine, scoring: Record<string, number>): number {
  let pts = 0;
  for (const [key, weight] of Object.entries(scoring)) {
    const v = stats[key];
    if (typeof v === "number" && typeof weight === "number") pts += v * weight;
  }
  return Math.round(pts * 100) / 100;
}

/**
 * Fantasy points for one stat line: league scoring when available, else
 * Sleeper's generic half-PPR total (e.g. a season with no league ID).
 */
export function fantasyPoints(
  stats: StatLine,
  scoring: Record<string, number> | null,
): number | undefined {
  if (scoring && Object.keys(scoring).length > 0) return scoreStatLine(stats, scoring);
  const half = stats.pts_half_ppr;
  return typeof half === "number" ? half : undefined;
}

/**
 * Ranks every player within his position by points, descending (1 = best).
 * Players with no position or ≤0 points are left unranked, matching Sleeper.
 */
export function rankByPosition(
  points: Record<string, number>,
  positionOf: (pid: string) => string | undefined,
): Record<string, number> {
  const byPosition = new Map<string, { pid: string; pts: number }[]>();
  for (const [pid, pts] of Object.entries(points)) {
    const pos = positionOf(pid);
    if (!pos || !(pts > 0)) continue;
    const arr = byPosition.get(pos) || [];
    arr.push({ pid, pts });
    byPosition.set(pos, arr);
  }
  const ranks: Record<string, number> = {};
  for (const [, players] of byPosition) {
    players.sort((a, b) => b.pts - a.pts);
    players.forEach((p, i) => { ranks[p.pid] = i + 1; });
  }
  return ranks;
}
