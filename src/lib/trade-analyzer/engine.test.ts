import { describe, it, expect } from "vitest";
import { evaluateAsset, computeVerdict } from "./engine";
import { DEFAULT_CONFIG } from "./config";
import type { TradeAsset } from "./types";

const RATE = DEFAULT_CONFIG.LEAGUE_VALUE_PER_DOLLAR;

function player(over: Partial<TradeAsset>): TradeAsset {
  return {
    id: "test",
    type: "player",
    name: "Test Player",
    position: "WR",
    nflTeam: "DAL",
    age: 25,
    rawValue: 0,
    productionRank: 10, // startable by default
    salary: 0,
    years: 1,
    ...over,
  };
}

describe("contract-adjusted valuation model", () => {
  it("values an expensive non-starter negative (Hockenson case)", () => {
    // TE ranked outside the top 12 → not a weekly starter, so its production is
    // bench-discounted and the contract cost dominates.
    const e = evaluateAsset(
      player({ rawValue: 1800, salary: 26, years: 2, age: 29, position: "TE", productionRank: 16 }),
      "neutral",
    );
    expect(e.valueDollars).toBeLessThan(0);
    expect(e.adjusted).toBeLessThan(0);
    expect(e.badge).toBe("overpay");
  });

  it("treats players with no NFL team as zero production (Najee case)", () => {
    // No team = no production, so value is just the (negative) contract burden.
    const e = evaluateAsset(
      player({ rawValue: 800, nflTeam: null, salary: 18, years: 2, position: "RB", productionRank: 30 }),
      "neutral",
    );
    expect(e.production).toBe(0);
    expect(e.valueDollars).toBeLessThan(0);
  });

  it("never values below the hard floor −(0.5 × salary × years × rate)", () => {
    const cases: Partial<TradeAsset>[] = [
      { rawValue: 200, salary: 30, years: 1, age: 30, position: "RB", productionRank: 40 },
      { rawValue: 0, nflTeam: null, salary: 50, years: 3, position: "WR", productionRank: null },
      { rawValue: 1800, salary: 26, years: 2, age: 29, position: "TE", productionRank: 16 },
    ];
    for (const c of cases) {
      for (const strat of ["neutral", "rebuilding", "competing"] as const) {
        const a = player(c);
        const e = evaluateAsset(a, strat);
        const hardFloor = -(0.5 * a.salary * a.years * RATE);
        expect(e.valueDollars).toBeGreaterThanOrEqual(hardFloor - 0.05);
      }
    }
  });

  it("boosts a productive startable player on a cheap long deal", () => {
    const e = evaluateAsset(
      player({ rawValue: 9000, salary: 8, years: 3, age: 23, position: "WR", productionRank: 1 }),
      "neutral",
    );
    expect(e.valueDollars).toBeGreaterThan(9000); // a bargain ADDS to production value
    expect(e.badge).toBe("value");
  });

  it("keeps a fairly-priced startable player solidly positive (production dominates)", () => {
    const e = evaluateAsset(
      player({ rawValue: 3000, salary: 30, years: 2, position: "WR", productionRank: 18 }),
      "neutral",
    );
    expect(e.valueDollars).toBeGreaterThan(0);
  });

  it("soft-floors a startable player at worst slightly negative", () => {
    // A startable WR with a brutal contract still has buyers → bottoms at the soft floor.
    const e = evaluateAsset(
      player({ rawValue: 1500, salary: 80, years: 3, age: 29, position: "WR", productionRank: 20 }),
      "neutral",
    );
    expect(e.valueDollars).toBe(DEFAULT_CONFIG.SOFT_FLOOR_POINTS);
  });

  it("holds a young elite player at the elite-asset floor regardless of contract", () => {
    // Top-3 WR under 26 on a monster contract — never below a mid-1st pick.
    const e = evaluateAsset(
      player({ rawValue: 500, salary: 90, years: 3, age: 24, position: "WR", productionRank: 2 }),
      "neutral",
    );
    expect(e.valueDollars).toBe(DEFAULT_CONFIG.ELITE_FLOOR_POINTS);
  });

  it("never values a $0 expiring pickup negative", () => {
    const e = evaluateAsset(
      player({ rawValue: 500, salary: 0, years: 0, position: "WR", productionRank: 40 }),
      "neutral",
    );
    expect(e.valueDollars).toBeGreaterThanOrEqual(0);
  });

  it("values a pick at its production, unaffected by contract floors", () => {
    const pick: TradeAsset = {
      id: "2027-1-3",
      type: "pick",
      name: "2027 1st",
      position: "PICK",
      nflTeam: null,
      age: null,
      rawValue: 4000,
      productionRank: null,
      salary: 11,
      years: 4,
    };
    const e = evaluateAsset(pick, "neutral");
    expect(e.valueDollars).toBe(4000);
  });

  it("makes a bad contract less painful (not more) for a strategy that likes the asset", () => {
    const bad = player({ rawValue: 1000, salary: 20, years: 2, age: 22, position: "WR", productionRank: 50 });
    const neutral = evaluateAsset(bad, "neutral");
    const rebuild = evaluateAsset(bad, "rebuilding"); // rebuild likes young players
    expect(neutral.valueDollars).toBeLessThan(0);
    expect(rebuild.valueDollars).toBeGreaterThanOrEqual(neutral.valueDollars);
  });
});

describe("verdict with negative side totals", () => {
  it("favors the side receiving real value when the other receives a liability", () => {
    const v = computeVerdict(-400, 800, "A", "B", undefined);
    expect(v.kind).not.toBe("empty");
    expect(v.favored).toBe("B");
    expect(v.pct).toBeGreaterThan(0);
    expect(v.pct).toBeLessThanOrEqual(1);
  });

  it("handles both sides receiving net-negative hauls", () => {
    const v = computeVerdict(-300, -100, "A", "B", undefined);
    expect(v.kind).not.toBe("empty");
    // B receives the less-negative haul, so the trade favors B.
    expect(v.favored).toBe("B");
    expect(Number.isFinite(v.pct)).toBe(true);
  });

  it("is empty only when both sides have zero value", () => {
    const v = computeVerdict(0, 0, "A", "B", undefined);
    expect(v.kind).toBe("empty");
  });

  it("matches the old math when both totals are positive", () => {
    const close = computeVerdict(1000, 900, "A", "B", undefined);
    expect(close.pct).toBeCloseTo(100 / 1900, 5);
    expect(close.kind).toBe("fair"); // 5.3% gap is within the 6% fair threshold

    const wide = computeVerdict(1000, 600, "A", "B", undefined);
    expect(wide.pct).toBeCloseTo(400 / 1600, 5);
    expect(wide.favored).toBe("A");
  });
});
