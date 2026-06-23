import { SleeperMatchup } from "@/types/sleeper";

// ── Luck Index ────────────────────────────────────────────────────────────────
//
// For each completed regular-season week we compute every team's "all-play"
// record — their score measured against EVERY other team's score that week
// (win if higher, loss if lower, tie if equal). A team's all-play win% over the
// season is the win% they "deserved" given how they scored; their real win%
// (from actual head-to-head matchups) is what they got. The gap between them is
// luck:
//
//   luck = realWinPct − allPlayWinPct   (positive = lucky, negative = robbed)
//
// Both real and all-play records are derived from the same matchup blobs, so the
// function is fully self-contained and unit-testable: pass it a map of
// week → matchups (regular season only) and it returns one record per team.

export interface AllPlayRecord {
  rosterId: number;
  allPlayW: number;
  allPlayL: number;
  allPlayT: number;
  allPlayPct: number;
  realW: number;
  realL: number;
  realT: number;
  realWinPct: number;
  luck: number;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function computeLuckIndex(
  weeklyMatchups: Map<number, SleeperMatchup[]>,
): AllPlayRecord[] {
  interface Accum {
    apW: number; apL: number; apT: number;
    rW: number; rL: number; rT: number;
  }
  const acc = new Map<number, Accum>();
  const ensure = (id: number): Accum => {
    let e = acc.get(id);
    if (!e) {
      e = { apW: 0, apL: 0, apT: 0, rW: 0, rL: 0, rT: 0 };
      acc.set(id, e);
    }
    return e;
  };

  for (const [, matchups] of weeklyMatchups) {
    // Only count teams that actually played (points > 0); a 0 means a bye or a
    // not-yet-scored week and would poison the all-play comparison.
    const scored = matchups.filter((m) => m.points > 0);
    if (scored.length < 2) continue;

    // All-play: each team vs every other team that scored this week.
    for (const team of scored) {
      const e = ensure(team.roster_id);
      for (const opp of scored) {
        if (opp.roster_id === team.roster_id) continue;
        if (team.points > opp.points) e.apW++;
        else if (team.points < opp.points) e.apL++;
        else e.apT++;
      }
    }

    // Real head-to-head: pair teams by matchup_id and award the actual result.
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of scored) {
      const arr = byMatchup.get(m.matchup_id) ?? [];
      arr.push(m);
      byMatchup.set(m.matchup_id, arr);
    }
    for (const [, pair] of byMatchup) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      const ea = ensure(a.roster_id);
      const eb = ensure(b.roster_id);
      if (a.points > b.points) { ea.rW++; eb.rL++; }
      else if (a.points < b.points) { ea.rL++; eb.rW++; }
      else { ea.rT++; eb.rT++; }
    }
  }

  const results: AllPlayRecord[] = [];
  for (const [rosterId, e] of acc) {
    const apGames = e.apW + e.apL + e.apT;
    const allPlayPct = apGames > 0 ? (e.apW + e.apT * 0.5) / apGames : 0;
    const rGames = e.rW + e.rL + e.rT;
    const realWinPct = rGames > 0 ? (e.rW + e.rT * 0.5) / rGames : 0;
    results.push({
      rosterId,
      allPlayW: e.apW,
      allPlayL: e.apL,
      allPlayT: e.apT,
      allPlayPct: round3(allPlayPct),
      realW: e.rW,
      realL: e.rL,
      realT: e.rT,
      realWinPct: round3(realWinPct),
      luck: round3(realWinPct - allPlayPct),
    });
  }

  // Luckiest first.
  results.sort((a, b) => b.luck - a.luck);
  return results;
}
