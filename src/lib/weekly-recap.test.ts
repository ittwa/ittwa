import { describe, it, expect } from "vitest";
import { computeWeeklyRecaps, type PlayerLookup } from "./weekly-recap";
import type { SleeperMatchup } from "@/types/sleeper";

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

const owners: Record<number, string> = {
  1: "Clancy",
  2: "Durkin",
  3: "Katz",
  4: "Brown",
};

describe("computeWeeklyRecaps", () => {
  const weeks = new Map<number, SleeperMatchup[]>([
    [1, [
      m(1, 100, 130.5), // top scorer overall, wins big
      m(4, 100, 80.0),  // toilet, loses big
      m(2, 200, 120.2), // wins a nail-biter
      m(3, 200, 119.8), // unlucky: 2nd highest score but loses
    ]],
  ]);

  it("identifies the week's storylines", () => {
    const [recap] = computeWeeklyRecaps(weeks, owners);
    expect(recap.week).toBe(1);

    // Manager of the Week = highest scorer.
    expect(recap.motw.owner).toBe("Clancy");
    expect(recap.motw.points).toBeCloseTo(130.5, 3);

    // Average of 130.5, 80, 120.2, 119.8 = 112.625 → delta ~17.875.
    expect(recap.average).toBeCloseTo(112.63, 1);
    expect(recap.motw.delta).toBeCloseTo(130.5 - 112.625, 1);

    // Toilet = lowest scorer.
    expect(recap.toilet.owner).toBe("Brown");

    // Blowout = Clancy over Brown (130.5 - 80 = 50.5).
    expect(recap.blowout.winner.owner).toBe("Clancy");
    expect(recap.blowout.loser.owner).toBe("Brown");
    expect(recap.blowout.margin).toBeCloseTo(50.5, 2);

    // Closest = Durkin over Katz (0.4).
    expect(recap.close.winner.owner).toBe("Durkin");
    expect(recap.close.loser.owner).toBe("Katz");
    expect(recap.close.margin).toBeCloseTo(0.4, 2);

    // Unlucky = highest-scoring loser = Katz (119.8).
    expect(recap.unlucky?.owner).toBe("Katz");
  });

  it("generates deterministic prose led by the Manager of the Week", () => {
    const [recap] = computeWeeklyRecaps(weeks, owners);
    // Lead sentence always names the MOTW and their score.
    expect(recap.body).toContain("Clancy");
    expect(recap.body).toContain("130.5");
    // Big blowout (50.5) and a 0.4-point nail-biter both make the cut.
    expect(recap.body).toContain("Brown");
    expect(recap.body).toContain("Durkin");
    expect(recap.headline.length).toBeGreaterThan(0);
    // Same input → identical output.
    const [again] = computeWeeklyRecaps(weeks, owners);
    expect(again.body).toBe(recap.body);
    expect(again.headline).toBe(recap.headline);
  });

  it("skips weeks with no scored games and falls back to Team N names", () => {
    const empties = new Map<number, SleeperMatchup[]>([
      [1, [m(1, 1, 0), m(2, 1, 0)]],
      [2, [m(1, 1, 100), m(2, 1, 90)]],
    ]);
    const recaps = computeWeeklyRecaps(empties, {});
    expect(recaps).toHaveLength(1);
    expect(recaps[0].week).toBe(2);
    expect(recaps[0].motw.owner).toBe("Team 1");
  });
});

// ── Player-level + season-context storylines ────────────────────────────────

function mp(
  roster_id: number,
  matchup_id: number,
  starters: [string, number][],
  bench: [string, number][] = [],
): SleeperMatchup {
  const players_points: Record<string, number> = {};
  for (const [id, p] of [...starters, ...bench]) players_points[id] = p;
  return {
    roster_id,
    matchup_id,
    points: Math.round(starters.reduce((s, [, p]) => s + p, 0) * 100) / 100,
    starters: starters.map(([id]) => id),
    starters_points: starters.map(([, p]) => p),
    players: [...starters, ...bench].map(([id]) => id),
    players_points,
    custom_points: null,
  };
}

const players: PlayerLookup = {
  qb1: { name: "Josh Allen", position: "QB" },
  qb2: { name: "Lamar Jackson", position: "QB" },
  qb3: { name: "Jalen Hurts", position: "QB" },
  qb4: { name: "Joe Burrow", position: "QB" },
  wr1: { name: "Ja'Marr Chase", position: "WR" },
  wr2: { name: "CeeDee Lamb", position: "WR" },
  wr3: { name: "Garrett Wilson", position: "WR" },
  wr4: { name: "Puka Nacua", position: "WR" },
  wrB: { name: "Bench Guy", position: "WR" },
};

describe("computeWeeklyRecaps storylines", () => {
  it("calls out the week's top and worst players", () => {
    const wk = new Map<number, SleeperMatchup[]>([
      [1, [
        mp(1, 1, [["qb1", 20], ["wr1", 48.2]]),
        mp(2, 1, [["qb2", 25], ["wr2", 20]]),
        mp(3, 2, [["qb3", 22], ["wr3", 0.8]]),
        mp(4, 2, [["qb4", 18], ["wr4", 15]]),
      ]],
    ]);
    const [recap] = computeWeeklyRecaps(wk, owners, players);
    expect(recap.topPlayer?.name).toBe("Ja'Marr Chase");
    expect(recap.topPlayer?.owner).toBe("Clancy");
    expect(recap.dud?.name).toBe("Garrett Wilson");
    expect(recap.body).toContain("Ja'Marr Chase");
  });

  it("flags a bench blunder that would have flipped the result", () => {
    const wk = new Map<number, SleeperMatchup[]>([
      [1, [
        mp(1, 1, [["qb1", 20], ["wr1", 22]]),
        // Katz loses by 2 with 30 points sitting on the bench at WR.
        mp(3, 1, [["qb3", 30], ["wr3", 10]], [["wrB", 30]]),
        mp(2, 2, [["qb2", 20], ["wr2", 20]]),
        mp(4, 2, [["qb4", 10], ["wr4", 10]]),
      ]],
    ]);
    const [recap] = computeWeeklyRecaps(wk, owners, players);
    expect(recap.body).toContain("Bench Guy");
    expect(recap.body).toMatch(/Katz/);
  });

  it("tracks streaks and first-place changes across weeks", () => {
    // Clancy beats Brown every week (perfect season); Durkin/Katz trade wins.
    const wk = new Map<number, SleeperMatchup[]>();
    for (let w = 1; w <= 4; w++) {
      wk.set(w, [
        m(1, 1, 120 + w), m(4, 1, 90),
        m(2, 2, w % 2 ? 110 : 100), m(3, 2, w % 2 ? 100 : 130),
      ]);
    }
    const recaps = computeWeeklyRecaps(wk, owners);
    expect(recaps).toHaveLength(4);
    const wk4 = recaps[3];
    // By week 3+, Clancy's unbeaten run and Brown's winless run are storylines.
    expect(wk4.body).toMatch(/Clancy/);
    expect(recaps.some((r) => /4-0|3-0/.test(r.body + r.headline))).toBe(true);
    expect(recaps.some((r) => /0-3|0-4/.test(r.body))).toBe(true);
  });

  it("varies the write-up from week to week", () => {
    const wk = new Map<number, SleeperMatchup[]>();
    for (let w = 1; w <= 6; w++) {
      wk.set(w, [m(1, 1, 130 + w), m(4, 1, 80), m(2, 2, 115), m(3, 2, 114)]);
    }
    const recaps = computeWeeklyRecaps(wk, owners);
    const leads = new Set(recaps.map((r) => r.body.split(". ")[0].replace(/\d+(\.\d+)?/g, "#").replace(/Week #/g, "")));
    expect(leads.size).toBeGreaterThan(1);
  });

  it("works without player data (no player callouts)", () => {
    const [recap] = computeWeeklyRecaps(new Map([[1, [m(1, 1, 100), m(2, 1, 90)]]]), owners);
    expect(recap.topPlayer).toBeNull();
    expect(recap.dud).toBeNull();
  });
});
