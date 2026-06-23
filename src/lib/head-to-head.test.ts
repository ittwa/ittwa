import { describe, it, expect } from "vitest";
import { buildHeadToHeadMatrix, getSeries } from "./head-to-head";

describe("buildHeadToHeadMatrix", () => {
  it("records mirror-image series for each pair", () => {
    const matrix = buildHeadToHeadMatrix([
      { ownerA: "Clancy", ownerB: "Durkin", scoreA: 120, scoreB: 100 },
      { ownerA: "Clancy", ownerB: "Durkin", scoreA: 90, scoreB: 110 },
      { ownerA: "Durkin", ownerB: "Clancy", scoreA: 130, scoreB: 95 },
    ]);

    // Clancy is 1-2 vs Durkin; Durkin is 2-1 vs Clancy.
    expect(getSeries(matrix, "Clancy", "Durkin")).toEqual({ w: 1, l: 2, t: 0 });
    expect(getSeries(matrix, "Durkin", "Clancy")).toEqual({ w: 2, l: 1, t: 0 });
  });

  it("counts ties and skips unplayed / self matchups", () => {
    const matrix = buildHeadToHeadMatrix([
      { ownerA: "Katz", ownerB: "Brown", scoreA: 100, scoreB: 100 },
      { ownerA: "Katz", ownerB: "Brown", scoreA: 0, scoreB: 0 }, // unplayed
      { ownerA: "Katz", ownerB: "Katz", scoreA: 50, scoreB: 40 }, // self
    ]);
    expect(getSeries(matrix, "Katz", "Brown")).toEqual({ w: 0, l: 0, t: 1 });
    expect(getSeries(matrix, "Katz", "Katz")).toEqual({ w: 0, l: 0, t: 0 });
  });

  it("returns an empty record for pairs that never met", () => {
    const matrix = buildHeadToHeadMatrix([]);
    expect(getSeries(matrix, "A", "B")).toEqual({ w: 0, l: 0, t: 0 });
  });
});
