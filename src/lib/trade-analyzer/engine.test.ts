import { describe, it, expect } from "vitest";
import { evaluateAsset, computeVerdict } from "./engine";
import type { TradeAsset } from "./types";

function player(over: Partial<TradeAsset>): TradeAsset {
  return {
    id: "test",
    type: "player",
    name: "Test Player",
    position: "WR",
    nflTeam: "DAL",
    age: 25,
    rawValue: 0,
    salary: 0,
    years: 1,
    ...over,
  };
}

describe("surplus-value model", () => {
  it("values a bad contract negative, floored at the cut penalty (Hockenson case)", () => {
    // ~1200 production is worth ~$3.4 at auction but costs $24 → deep negative,
    // floored at the cut penalty: -(0.5 × 24 × 1) = -$12.
    const e = evaluateAsset(player({ rawValue: 1200, salary: 24, years: 1, age: 28 }), "neutral");
    expect(e.valueDollars).toBe(-12);
    expect(e.adjusted).toBeLessThan(0);
    expect(e.badge).toBe("overpay");
  });

  it("treats players with no NFL team as zero production (Najee case)", () => {
    // FantasyCalc may still list residual value, but no team = no production.
    // -(9 × 1.25) = -$11.25, floored at -(0.5 × 9 × 2) = -$9.
    const e = evaluateAsset(player({ rawValue: 800, nflTeam: null, salary: 9, years: 2 }), "neutral");
    expect(e.valueDollars).toBe(-9);
  });

  it("never values below -(0.5 × salary × years)", () => {
    // Near-zero production at $40/1yr: raw surplus ≈ -$40, floor binds at -$20.
    const e = evaluateAsset(player({ rawValue: 100, salary: 40, years: 1 }), "neutral");
    expect(e.valueDollars).toBe(-20);
  });

  it("boosts productive players on cheap long deals", () => {
    // market(9000) ≈ $68.9 at $8 salary × 3yr factor + scarcity ≈ +$96.
    const e = evaluateAsset(player({ rawValue: 9000, salary: 8, years: 3, age: 23 }), "neutral");
    expect(e.valueDollars).toBeGreaterThan(60);
    expect(e.badge).toBe("value");
  });

  it("gives fairly-priced production a small positive value (scarcity premium)", () => {
    // market(3000) ≈ $13.3 vs $14 salary: surplus ≈ -$0.9, scarcity ≈ +$1.6.
    const e = evaluateAsset(player({ rawValue: 3000, salary: 14, years: 2 }), "neutral");
    expect(e.valueDollars).toBeGreaterThan(0);
    expect(e.valueDollars).toBeLessThan(5);
  });

  it("never values a $0 expiring pickup negative", () => {
    const e = evaluateAsset(player({ rawValue: 500, salary: 0, years: 0 }), "neutral");
    expect(e.valueDollars).toBeGreaterThanOrEqual(0);
  });

  it("does not zero pick value despite null nflTeam", () => {
    const pick: TradeAsset = {
      id: "2027-1-3",
      type: "pick",
      name: "2027 1st",
      position: "PICK",
      nflTeam: null,
      age: null,
      rawValue: 4000,
      salary: 11,
      years: 4,
    };
    const e = evaluateAsset(pick, "neutral");
    expect(e.valueDollars).toBeGreaterThan(0);
  });

  it("makes a bad contract less painful (not more) for a strategy that likes the asset", () => {
    const bad = player({ rawValue: 1000, salary: 20, years: 2, age: 22 });
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
