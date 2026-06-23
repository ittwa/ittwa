import { describe, it, expect } from "vitest";
import { computeLuckIndex } from "./luck-index";
import type { SleeperMatchup } from "@/types/sleeper";

// Minimal matchup factory — only the fields computeLuckIndex reads.
function m(roster_id: number, matchup_id: number, points: number): SleeperMatchup {
  return {
    roster_id,
    matchup_id,
    points,
    starters_points: [],
    starters: [],
    players: [],
    players_points: {},
    custom_points: null,
  };
}

describe("computeLuckIndex", () => {
  it("flags a team that wins despite a poor all-play record as lucky", () => {
    // One week, 4 teams. Team 1 scores second-LOWEST (90) yet is paired against
    // the only team it can beat (team 4, 80), so it wins its matchup. All-play
    // it goes 1-2 (beats only 80). Real record: 1-0. → lucky.
    const weeks = new Map<number, SleeperMatchup[]>([
      [1, [
        m(1, 100, 90),  // beats team 4 head-to-head
        m(4, 100, 80),
        m(2, 200, 120), // both high scorers play each other
        m(3, 200, 110),
      ]],
    ]);

    const res = computeLuckIndex(weeks);
    const t1 = res.find((r) => r.rosterId === 1)!;

    expect(t1.allPlayW).toBe(1); // only beats the 80
    expect(t1.allPlayL).toBe(2); // loses to 120 and 110
    expect(t1.allPlayPct).toBeCloseTo(1 / 3, 2);
    expect(t1.realW).toBe(1);
    expect(t1.realL).toBe(0);
    expect(t1.realWinPct).toBe(1);
    expect(t1.luck).toBeCloseTo(1 - 1 / 3, 3); // positive → lucky
    expect(t1.luck).toBeGreaterThan(0);
  });

  it("flags a high scorer that loses as robbed (negative luck)", () => {
    // Team 3 is the second-highest scorer (110) but loses to the top scorer.
    const weeks = new Map<number, SleeperMatchup[]>([
      [1, [
        m(1, 100, 90),
        m(4, 100, 80),
        m(2, 200, 120),
        m(3, 200, 110),
      ]],
    ]);

    const res = computeLuckIndex(weeks);
    const t3 = res.find((r) => r.rosterId === 3)!;

    expect(t3.allPlayW).toBe(2); // beats 90 and 80
    expect(t3.allPlayL).toBe(1); // loses only to 120
    expect(t3.realW).toBe(0);
    expect(t3.realL).toBe(1);
    expect(t3.luck).toBeLessThan(0); // robbed
  });

  it("accumulates across multiple weeks and sorts luckiest first", () => {
    const weeks = new Map<number, SleeperMatchup[]>([
      [1, [m(1, 1, 90), m(2, 1, 80), m(3, 2, 70), m(4, 2, 60)]],
      [2, [m(1, 1, 95), m(2, 1, 85), m(3, 2, 75), m(4, 2, 65)]],
    ]);
    const res = computeLuckIndex(weeks);
    // Team 1 is the top scorer both weeks → all-play perfect, real perfect → luck 0.
    const t1 = res.find((r) => r.rosterId === 1)!;
    expect(t1.allPlayPct).toBe(1);
    expect(t1.realWinPct).toBe(1);
    expect(t1.luck).toBe(0);
    // Sorted descending by luck.
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].luck).toBeGreaterThanOrEqual(res[i].luck);
    }
  });

  it("ignores unplayed (zero-point) weeks", () => {
    const weeks = new Map<number, SleeperMatchup[]>([
      [1, [m(1, 1, 100), m(2, 1, 90)]],
      [2, [m(1, 1, 0), m(2, 1, 0)]], // not yet scored
    ]);
    const res = computeLuckIndex(weeks);
    const t1 = res.find((r) => r.rosterId === 1)!;
    expect(t1.allPlayW + t1.allPlayL + t1.allPlayT).toBe(1); // only week 1 counted
    expect(t1.realW).toBe(1);
  });
});
