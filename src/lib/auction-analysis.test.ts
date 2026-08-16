import { describe, it, expect } from "vitest";
import { computeOwnerPerformance, computePositionTrends } from "./auction-analysis";
import type { AuctionResultRow } from "@/types/auction";

function pick(over: Partial<AuctionResultRow>): AuctionResultRow {
  return {
    id: 0, pickNumber: 0, nominator: "X", winner: "Katz", playerId: "p", player: "P",
    position: "WR", years: 1, salary: 10, createdAt: "", ...over,
  };
}

describe("computeOwnerPerformance", () => {
  it("sums spend and contract value per owner and derives surplus", () => {
    // Katz: $20/3yr → value 20×1.7 = 34 ; $10/1yr → value 10. Total spent 30, value 44.
    const results = [
      pick({ id: 1, winner: "Katz", playerId: "a", salary: 20, years: 3 }),
      pick({ id: 2, winner: "Katz", playerId: "b", salary: 10, years: 1 }),
      pick({ id: 3, winner: "Clancy", playerId: "c", salary: 5, years: 2 }), // value 7
    ];
    const perf = computeOwnerPerformance(results, new Map());
    const katz = perf.find((p) => p.owner === "Katz")!;
    expect(katz.picks).toBe(2);
    expect(katz.salarySpent).toBe(30);
    expect(katz.contractValue).toBe(44); // 34 + 10
    expect(katz.surplus).toBe(14); // 44 − 30
    expect(katz.avgYears).toBe(2); // (3+1)/2
    expect(katz.spendByPosition).toEqual({ WR: 30 });
  });

  it("sorts owners by surplus, highest first", () => {
    const results = [
      pick({ id: 1, winner: "A", playerId: "a", salary: 10, years: 1 }), // surplus 0
      pick({ id: 2, winner: "B", playerId: "b", salary: 10, years: 5 }), // value 20, surplus 10
    ];
    const perf = computeOwnerPerformance(results, new Map());
    expect(perf.map((p) => p.owner)).toEqual(["B", "A"]);
  });

  it("computes market delta by redistributing covered spend by market-value share", () => {
    // Two players, equal market value, total covered spend $30. Expected each = $15.
    // A paid $20 (a reach, +5), B paid $10 (a deal, −5).
    const results = [
      pick({ id: 1, winner: "A", playerId: "a", salary: 20, years: 1 }),
      pick({ id: 2, winner: "B", playerId: "b", salary: 10, years: 1 }),
    ];
    const market = new Map([["a", 100], ["b", 100]]);
    const perf = computeOwnerPerformance(results, market);
    expect(perf.find((p) => p.owner === "A")!.marketDelta).toBe(5); // overpaid
    expect(perf.find((p) => p.owner === "B")!.marketDelta).toBe(-5); // deal
    expect(perf.find((p) => p.owner === "A")!.expectedSpend).toBe(15);
  });

  it("leaves market fields null for owners whose picks have no market value", () => {
    const results = [pick({ id: 1, winner: "A", playerId: "writein", salary: 5, years: 1 })];
    const perf = computeOwnerPerformance(results, new Map()); // no coverage at all
    expect(perf[0].expectedSpend).toBeNull();
    expect(perf[0].marketDelta).toBeNull();
  });

  it("buckets unknown positions under OTHER", () => {
    const results = [pick({ id: 1, winner: "A", playerId: "a", position: "K", salary: 3, years: 1 })];
    const perf = computeOwnerPerformance(results, new Map());
    expect(perf[0].spendByPosition).toEqual({ OTHER: 3 });
  });
});

describe("computePositionTrends", () => {
  it("aggregates per-position averages and omits empty positions", () => {
    const results = [
      pick({ id: 1, position: "RB", salary: 30, years: 2 }), // value 42
      pick({ id: 2, position: "RB", salary: 10, years: 1 }), // value 10
      pick({ id: 3, position: "QB", salary: 40, years: 5 }), // value 80
    ];
    const trends = computePositionTrends(results);
    const rb = trends.find((t) => t.position === "RB")!;
    expect(rb.picks).toBe(2);
    expect(rb.totalSalary).toBe(40);
    expect(rb.avgSalary).toBe(20);
    expect(rb.avgYears).toBe(1.5);
    expect(rb.avgValue).toBe(26); // (42 + 10) / 2
    expect(trends.some((t) => t.position === "WR")).toBe(false); // no WR picks
  });

  it("returns [] with no results", () => {
    expect(computePositionTrends([])).toEqual([]);
  });
});
