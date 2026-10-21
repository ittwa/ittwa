import { describe, it, expect } from "vitest";
import { scoreStatLine, fantasyPoints, rankByPosition } from "./league-scoring";

describe("scoreStatLine", () => {
  it("weights each stat by the league's scoring settings", () => {
    const scoring = { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1 };
    const stats = { pass_yd: 1500, pass_td: 10, pass_int: 3, rush_yd: 50, pts_half_ppr: 999 };
    // 60 + 40 - 6 + 5 = 99 — the generic pts_half_ppr total is ignored
    expect(scoreStatLine(stats, scoring)).toBe(99);
  });
});

describe("fantasyPoints", () => {
  it("falls back to pts_half_ppr without league scoring", () => {
    expect(fantasyPoints({ pts_half_ppr: 12.5 }, null)).toBe(12.5);
    expect(fantasyPoints({}, null)).toBeUndefined();
  });
});

describe("rankByPosition", () => {
  it("ranks within each position by points and skips ≤0 / unknown", () => {
    const pos: Record<string, string> = { a: "QB", b: "QB", c: "QB", d: "RB", e: "QB" };
    const ranks = rankByPosition({ a: 115, b: 161, c: 114, d: 50, e: 0, z: 80 }, (p) => pos[p]);
    expect(ranks).toEqual({ b: 1, a: 2, c: 3, d: 1 });
  });
});
