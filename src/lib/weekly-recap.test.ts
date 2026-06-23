import { describe, it, expect } from "vitest";
import { computeWeeklyRecaps } from "./weekly-recap";
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

  it("generates deterministic prose mentioning every award", () => {
    const [recap] = computeWeeklyRecaps(weeks, owners);
    expect(recap.headline).toBe("Clancy is your Week 1 Manager of the Week");
    expect(recap.body).toContain("Clancy took Manager of the Week with 130.5 points");
    expect(recap.body).toContain("buried Brown");
    expect(recap.body).toContain("survived Katz");
    expect(recap.body).toContain("clean the toilet: Brown");
    expect(recap.body).toContain("Spare a thought for Katz");
    // Same input → identical output.
    const [again] = computeWeeklyRecaps(weeks, owners);
    expect(again.body).toBe(recap.body);
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
