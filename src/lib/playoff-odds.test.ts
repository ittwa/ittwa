import { describe, it, expect } from "vitest";
import {
  computeHistoricalRecordOdds,
  getModelOdds,
  oddsForRecord,
  formatPct,
  MODEL_WEEKS,
  ODDS_OUTCOMES,
} from "./playoff-odds";
import type { ScoreRow } from "./sheets";

function row(p: Partial<ScoreRow> & Pick<ScoreRow, "week" | "owner">): ScoreRow {
  return {
    season: "2024",
    opponent: "X",
    points: 100,
    opponentPoints: 90,
    playoffType: "",
    finalStanding: 99,
    ...p,
  };
}

describe("model odds", () => {
  it("covers after Week 1 through after Week 13", () => {
    expect(MODEL_WEEKS[0]).toBe(1);
    expect(MODEL_WEEKS[MODEL_WEEKS.length - 1]).toBe(13);
  });

  it("is monotonic in wins and nested (title ≤ final ≤ semis ≤ playoffs)", () => {
    for (const week of MODEL_WEEKS) {
      for (let w = 0; w <= week; w++) {
        const o = getModelOdds(week, w)!;
        expect(o.title).toBeLessThanOrEqual(o.final);
        expect(o.final).toBeLessThanOrEqual(o.semis);
        expect(o.semis).toBeLessThanOrEqual(o.playoffs);
        expect(o.bye).toBeLessThanOrEqual(o.semis);
        if (w > 0) {
          const prev = getModelOdds(week, w - 1)!;
          for (const k of ODDS_OUTCOMES) expect(o[k]).toBeGreaterThanOrEqual(prev[k]);
        }
      }
    }
  });

  it("treats a tie as half a win", () => {
    const a = oddsForRecord(3, 4, 0)!;
    const b = oddsForRecord(4, 3, 0)!;
    const t = oddsForRecord(3, 3, 1)!;
    expect(t.playoffs).toBeCloseTo((a.playoffs + b.playoffs) / 2, 6);
  });

  it("returns null outside the modeled range", () => {
    expect(oddsForRecord(0, 0)).toBeNull();
    expect(oddsForRecord(9, 5)).toBeNull(); // 14 games — season over
  });
});

describe("computeHistoricalRecordOdds", () => {
  it("tallies records after each week against how the season ended", () => {
    const scores: ScoreRow[] = [
      // Champ: W, W → bye, title
      row({ owner: "A", week: 1, finalStanding: 1 }),
      row({ owner: "A", week: 2, finalStanding: 1 }),
      row({ owner: "A", week: 3, opponent: "BYE", playoffType: "BYE", points: 0, opponentPoints: 0, finalStanding: 1 }),
      row({ owner: "A", week: 4, playoffType: "Championship", finalStanding: 1 }),
      // Wildcard loser: L, W
      row({ owner: "B", week: 1, points: 80, finalStanding: 5 }),
      row({ owner: "B", week: 2, finalStanding: 5 }),
      row({ owner: "B", week: 3, playoffType: "Contention", points: 80, finalStanding: 5 }),
      // Missed: L, L
      row({ owner: "C", week: 1, points: 80, finalStanding: 9 }),
      row({ owner: "C", week: 2, points: 80, finalStanding: 9 }),
      // In-progress season has no Championship row — ignored entirely.
      row({ season: "2026", owner: "A", week: 1 }),
    ];

    const t = computeHistoricalRecordOdds(scores);
    expect(t[1][1]).toEqual({ teams: 1, playoffs: 1, bye: 1, semis: 1, final: 1, title: 1 });
    expect(t[1][0]).toEqual({ teams: 2, playoffs: 1, bye: 0, semis: 0, final: 0, title: 0 });
    expect(t[2][1]).toEqual({ teams: 1, playoffs: 1, bye: 0, semis: 0, final: 0, title: 0 });
    expect(t[2][0].teams).toBe(1);
    expect(t[2][2].title).toBe(1);
  });

  it("skips unplayed (0–0) regular-season rows", () => {
    const t = computeHistoricalRecordOdds([
      row({ owner: "A", week: 1, finalStanding: 1, playoffType: "" }),
      row({ owner: "A", week: 2, points: 0, opponentPoints: 0 }),
      row({ owner: "A", week: 3, playoffType: "Championship", finalStanding: 1 }),
    ]);
    expect(t[2]).toBeUndefined();
  });
});

describe("formatPct", () => {
  it("clamps the tails", () => {
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(0.04)).toBe("<0.1%");
    expect(formatPct(99.96)).toBe(">99.9%");
    expect(formatPct(68.25)).toBe("68.3%");
  });
});
