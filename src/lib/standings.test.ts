import { describe, it, expect } from "vitest";
import {
  computePlayoffPicture,
  computeProjectedDraftOrder,
  type StandingsEntry,
} from "./standings";

// Minimal standings row — only the fields the playoff/draft helpers read.
function team(
  rosterId: number,
  rank: number,
  division: string,
  optimalPoints: number,
): StandingsEntry {
  return {
    rosterId,
    ownerId: `o${rosterId}`,
    username: `T${rosterId}`,
    displayName: `T${rosterId}`,
    division,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    optimalPoints,
    streak: "-",
    divisionRecord: "0-0",
    players: [],
    rank,
    winPct: 0,
  };
}

// 12 teams in rank order, 3 per division. Ranks 1-4 are division leaders
// (A, B, C, D) and ranks 5-6 are wildcards, so ranks 7-12 miss the playoffs.
const DIVS = ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B", "C", "D"];
const MAX_PF = [1500, 1490, 1480, 1470, 1460, 1450, 1300, 1250, 1400, 1100, 1350, 1200];
const standings = DIVS.map((d, i) => team(i + 1, i + 1, d, MAX_PF[i]));

describe("computeProjectedDraftOrder", () => {
  it("orders only non-playoff teams by Max PF, fewest first", () => {
    const seeding = computePlayoffPicture(standings);
    const order = computeProjectedDraftOrder(standings, seeding);

    expect(order).toHaveLength(6);
    // Non-playoff ranks 7-12 have Max PF 1300, 1250, 1400, 1100, 1350, 1200.
    expect(order.map((p) => p.rosterId)).toEqual([10, 12, 8, 7, 11, 9]);
    expect(order.map((p) => p.pick)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("ignores record: a playoff team with low Max PF never gets a top pick", () => {
    const lowMaxLeader = standings.map((t) =>
      t.rosterId === 1 ? { ...t, optimalPoints: 900 } : t,
    );
    const order = computeProjectedDraftOrder(lowMaxLeader, computePlayoffPicture(lowMaxLeader));
    expect(order.some((p) => p.rosterId === 1)).toBe(false);
  });

  it("breaks an exact Max PF tie in favor of the worse standing", () => {
    const tied = standings.map((t) =>
      t.rosterId === 7 || t.rosterId === 12 ? { ...t, optimalPoints: 1000 } : t,
    );
    const order = computeProjectedDraftOrder(tied, computePlayoffPicture(tied));
    expect(order[0].rosterId).toBe(12); // rank 12 beats rank 7 for the 1st pick
    expect(order[1].rosterId).toBe(7);
  });
});
