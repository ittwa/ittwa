import { describe, it, expect } from "vitest";
import { evaluateAsset } from "./engine";
import { DEFAULT_CONFIG } from "./config";
import type { TradeAsset } from "./types";

// Calibration fixtures for the named players in the tuning brief. FantasyCalc
// value + positional rank are representative snapshots (1QB, ½-PPR, 12-team
// dynasty); market data drifts, so these tests assert SIGN and rough TIER, not
// exact numbers. Contracts are the league's real salary/years.
//
// NOTE: production rank here uses FantasyCalc's positional value rank, which
// blends recent production with age. For older players (e.g. Adams) the value
// rank sits below their pure scoring rank; the directional targets still hold.
interface Fixture {
  name: string;
  position: string;
  age: number;
  rawValue: number;
  productionRank: number;
  salary: number;
  years: number;
}

const FIXTURES: Fixture[] = [
  { name: "Puka Nacua", position: "WR", age: 25, rawValue: 7200, productionRank: 2, salary: 64, years: 3 },
  { name: "CeeDee Lamb", position: "WR", age: 27, rawValue: 5200, productionRank: 6, salary: 95, years: 3 },
  { name: "Christian McCaffrey", position: "RB", age: 30, rawValue: 3200, productionRank: 6, salary: 69, years: 2 },
  { name: "Jonathan Taylor", position: "RB", age: 27, rawValue: 5200, productionRank: 2, salary: 50, years: 1 },
  { name: "Saquon Barkley", position: "RB", age: 29, rawValue: 4000, productionRank: 5, salary: 42, years: 1 },
  { name: "George Pickens", position: "WR", age: 25, rawValue: 4400, productionRank: 11, salary: 43, years: 1 },
  { name: "Davante Adams", position: "WR", age: 33, rawValue: 1900, productionRank: 26, salary: 24, years: 2 },
  { name: "Travis Etienne", position: "RB", age: 27, rawValue: 2800, productionRank: 12, salary: 17, years: 2 },
  { name: "Tucker Kraft", position: "TE", age: 25, rawValue: 3600, productionRank: 5, salary: 18, years: 1 },
  { name: "Rhamondre Stevenson", position: "RB", age: 28, rawValue: 1300, productionRank: 28, salary: 17, years: 1 },
  { name: "DeVonta Smith", position: "WR", age: 27, rawValue: 3800, productionRank: 17, salary: 32, years: 3 },
  { name: "T.J. Hockenson", position: "TE", age: 29, rawValue: 1900, productionRank: 14, salary: 26, years: 2 },
  { name: "Najee Harris", position: "RB", age: 28, rawValue: 1100, productionRank: 33, salary: 19, years: 2 },
];

function toAsset(f: Fixture): TradeAsset {
  return {
    id: f.name,
    type: "player",
    name: f.name,
    position: f.position,
    nflTeam: "NFL", // all rostered fixtures have a team
    age: f.age,
    rawValue: f.rawValue,
    productionRank: f.productionRank,
    salary: f.salary,
    years: f.years,
  };
}

const valueOf = (name: string) =>
  evaluateAsset(toAsset(FIXTURES.find((f) => f.name === name)!), "neutral").valueDollars;

describe("player valuation calibration (sign + tier, not exact)", () => {
  const MID_FIRST = DEFAULT_CONFIG.ELITE_FLOOR_POINTS; // ≈ mid-1st rookie pick

  it("Nacua: strongly positive, at least a mid-1st-round pick", () => {
    expect(valueOf("Puka Nacua")).toBeGreaterThanOrEqual(MID_FIRST);
  });

  it("Lamb: positive but not deeply negative, and well below Nacua", () => {
    const lamb = valueOf("CeeDee Lamb");
    expect(lamb).toBeGreaterThan(0);
    expect(lamb).toBeGreaterThan(DEFAULT_CONFIG.SOFT_FLOOR_POINTS); // never deeply negative
    expect(lamb).toBeLessThan(valueOf("Puka Nacua"));
  });

  it("McCaffrey: positive (RB1-overall worth a 2nd-round pick)", () => {
    expect(valueOf("Christian McCaffrey")).toBeGreaterThan(0);
  });

  it("Jonathan Taylor: positive (top RB, win-now rental)", () => {
    expect(valueOf("Jonathan Taylor")).toBeGreaterThan(0);
  });

  it("Saquon Barkley: positive (borderline RB1, 1-year rental)", () => {
    expect(valueOf("Saquon Barkley")).toBeGreaterThan(0);
  });

  it("George Pickens: positive (WR5 in scoring, short deal)", () => {
    expect(valueOf("George Pickens")).toBeGreaterThan(0);
  });

  it("Davante Adams: positive (cheap deal, productive WR)", () => {
    expect(valueOf("Davante Adams")).toBeGreaterThan(0);
  });

  it("Travis Etienne: positive (cheap 2-year deal)", () => {
    expect(valueOf("Travis Etienne")).toBeGreaterThan(0);
  });

  it("Tucker Kraft: positive (top-10 TE, 1-year rental)", () => {
    expect(valueOf("Tucker Kraft")).toBeGreaterThan(0);
  });

  it("Rhamondre Stevenson: a small asset, not a liability", () => {
    const v = valueOf("Rhamondre Stevenson");
    expect(v).toBeGreaterThan(-200); // not a clear liability
    expect(v).toBeLessThan(MID_FIRST); // but only a small asset
  });

  it("DeVonta Smith: positive (solid contract, improving situation)", () => {
    expect(valueOf("DeVonta Smith")).toBeGreaterThan(0);
  });

  it("Hockenson: REMAINS negative (expensive non-starter)", () => {
    expect(valueOf("T.J. Hockenson")).toBeLessThan(0);
  });

  it("Najee Harris: REMAINS negative (expensive non-starter)", () => {
    expect(valueOf("Najee Harris")).toBeLessThan(0);
  });

  it("ordering: clear liabilities sit below startable assets", () => {
    expect(valueOf("T.J. Hockenson")).toBeLessThan(valueOf("CeeDee Lamb"));
    expect(valueOf("Najee Harris")).toBeLessThan(valueOf("Davante Adams"));
  });
});
