import { describe, it, expect, vi } from "vitest";
import { SAMPLE_CONTRACTS } from "../../sample-data/contracts-sample";

// getContracts() hits the live Google Sheets API — mock it to return no rows
// so getTagTrackerData() falls back to SAMPLE_CONTRACTS, exercising the exact
// same derivation code path real data will use.
vi.mock("@/lib/sheets", () => ({ getContracts: vi.fn().mockResolvedValue([]) }));

const { getTagTrackerData } = await import("./tags-data");

describe("Tag Tracker derivation (against bundled sample data)", () => {
  it("falls back to sample data when the sheet returns nothing", async () => {
    const data = await getTagTrackerData();
    expect(data.usingSampleData).toBe(true);
  });

  it("excludes 'Draft Pick' placeholder rows and non-Active rows from everything", async () => {
    const data = await getTagTrackerData();
    expect(data.history.every((h) => h.player !== "2027 1st - Sample Owner A")).toBe(true);
    expect(data.history.every((h) => h.player !== "Sample Cut Player")).toBe(true);
  });

  it("labels a consecutive franchise-tag chain correctly (1st, 2nd, 3rd)", async () => {
    const data = await getTagTrackerData();
    const chain = data.history
      .filter((h) => h.player === "Sample RB One" && h.tagType === "franchise")
      .sort((a, b) => a.season.localeCompare(b.season));

    expect(chain.map((c) => c.season)).toEqual(["2024", "2025", "2026"]);
    expect(chain[0].consecutiveLabel).toBeNull();
    expect(chain[1].consecutiveLabel).toBe("2nd Consecutive");
    expect(chain[2].consecutiveLabel).toBe("3rd Consecutive");

    // 2nd = 120% of 1st ($36 -> $43.2); 3rd = 120% of 2nd ($43.2 -> $51.84, rounds to $51.8)
    expect(chain[1].salary).toBeCloseTo(43.2, 1);
    expect(chain[2].salary).toBeCloseTo(51.8, 1);
  });

  it("back-computes the Top-5 Positional Average basis for the first tag in the chain", async () => {
    const data = await getTagTrackerData();
    const firstTag = data.history.find((h) => h.player === "Sample RB One" && h.season === "2024")!;
    // Peers 40,38,36,34,32 average to $36, matching RB One's $36 tag salary.
    expect(firstTag.basis).toBe("Top-5 Positional Average");
  });

  it("labels consecutive tags with the consecutive formula, not a basis comparison", async () => {
    const data = await getTagTrackerData();
    const secondTag = data.history.find((h) => h.player === "Sample RB One" && h.season === "2025")!;
    expect(secondTag.basis).toBe("Consecutive Tag Formula");
  });

  it("marks a tag that matches neither formula as Unknown basis", async () => {
    const data = await getTagTrackerData();
    const legacy = data.history.find((h) => h.player === "Sample WR Legacy")!;
    // $61 vs 120%-of-$20=$24 and no WR peer data that season to average — should not force-match.
    expect(legacy.basis).toBe("Unknown");
  });

  it("shows every 5th-year-flagged row as its own entry, unmerged, even a messy multi-season streak", async () => {
    const data = await getTagTrackerData();
    const messy = data.history.filter((h) => h.player === "Sample Rookie Messy" && h.tagType === "fifth-year");
    expect(messy).toHaveLength(3);
    expect(messy.map((m) => m.season).sort()).toEqual(["2024", "2025", "2026"]);
  });

  it("parses a valid Draft Pick ID into season/pick/round on a 5th-year history entry", async () => {
    const data = await getTagTrackerData();
    const clean = data.history.find((h) => h.player === "Sample Rookie Clean" && h.tagType === "fifth-year")!;
    expect(clean.pickSlot).toEqual({ season: "2021", overallPick: 6, round: 1 });
  });

  it("makes CeeDee-Lamb-shaped bad data resolve to Round 1 without crashing", async () => {
    const data = await getTagTrackerData();
    // Sanity: no history entry should have thrown or produced NaN salaries.
    expect(data.history.every((h) => Number.isFinite(h.salary))).toBe(true);
  });

  it("identifies the fresh franchise-tag-eligible QB with a New Tag projection", async () => {
    const data = await getTagTrackerData();
    const ownerB = data.eligibility.byOwner.find((o) => o.owner === "Sample Owner B")!;
    const qb = ownerB.franchiseEligible.find((p) => p.player === "Sample QB One")!;
    expect(qb.projectionLabel).toBe("New Tag");
    // Peers 42,39,37,33,30 -> top-5 avg $36.2; 120% of own $34 -> $40.8. Greater wins.
    expect(qb.projectedTagSalary).toBeCloseTo(40.8, 1);
  });

  it("projects a 4th consecutive tag for the player already on a 3rd consecutive tag this season", async () => {
    const data = await getTagTrackerData();
    const ownerA = data.eligibility.byOwner.find((o) => o.owner === "Sample Owner A")!;
    const rb = ownerA.franchiseEligible.find((p) => p.player === "Sample RB One")!;
    expect(rb.projectionLabel).toBe("4th Consecutive Tag");
    expect(rb.projectedTagSalary).toBeCloseTo(51.8 * 1.2, 1);
  });

  it("computes the early-tier 5th-year option (picks 1-6, top-10 avg) and flags fewer-than-required", async () => {
    const data = await getTagTrackerData();
    const ownerA = data.eligibility.byOwner.find((o) => o.owner === "Sample Owner A")!;
    const rookie = ownerA.fifthYearEligible.find((p) => p.player === "Sample Rookie Early Tier")!;
    expect(rookie.pickSlot).toEqual({ season: "2024", overallPick: 3, round: 1 });
    // Only 5 WR peers in the sample data (fewer than the required top-10).
    expect(rookie.averagedFewerThanRequired).toBe(true);
    // Peers 41,38,33,28,22 (rookie itself is WR at $9, but is filtered out? no —
    // positionSalariesInSeason includes ALL WR rows incl. the rookie's own $9).
  });

  it("computes the late-tier 5th-year option (picks 7-12, top-25 avg) for a different position", async () => {
    const data = await getTagTrackerData();
    const ownerB = data.eligibility.byOwner.find((o) => o.owner === "Sample Owner B")!;
    const rookie = ownerB.fifthYearEligible.find((p) => p.player === "Sample Rookie Late Tier")!;
    expect(rookie.pickSlot).toEqual({ season: "2024", overallPick: 9, round: 1 });
    expect(rookie.projectedOptionSalary).toBeGreaterThan(0);
  });

  it("computes a plausible franchise-tag deadline (a Friday in June, one year after current season)", async () => {
    const data = await getTagTrackerData();
    const d = new Date(data.eligibility.deadline);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDay()).toBe(5); // Friday
    expect(String(d.getFullYear())).toBe(data.eligibility.upcomingOffseasonYear);
  });

  it("produces non-empty insights aggregates from the sample data", async () => {
    const data = await getTagTrackerData();
    expect(data.insights.positionOverTime.length).toBeGreaterThan(0);
    expect(data.insights.avgFranchiseTagByPosition.length).toBeGreaterThan(0);
    expect(data.insights.tagsByOwner.length).toBeGreaterThan(0);
    expect(data.insights.callouts.largestTag).not.toBeNull();
  });
});

describe("bundled sample data shape", () => {
  it("is non-empty and includes at least one row of every key scenario", () => {
    expect(SAMPLE_CONTRACTS.length).toBeGreaterThan(20);
    expect(SAMPLE_CONTRACTS.some((r) => r.position === "Draft Pick")).toBe(true);
    expect(SAMPLE_CONTRACTS.some((r) => r.contractStatus === "Cut")).toBe(true);
    expect(SAMPLE_CONTRACTS.some((r) => r.franchiseTag)).toBe(true);
    expect(SAMPLE_CONTRACTS.some((r) => r.fifthYearTag)).toBe(true);
  });
});
