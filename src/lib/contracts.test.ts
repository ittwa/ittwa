import { describe, it, expect } from "vitest";
import { canonicalContractPlayerId, getLatestActiveContracts } from "./contracts";
import type { ContractRow } from "@/types/contracts";

function contract(over: Partial<ContractRow>): ContractRow {
  return {
    playerId: "", season: "2024", owner: "Durkin", player: "", position: "WR",
    years: 1, salary: 1, dpOriginalOwner: "", draftPickId: "", contractStatus: "Active",
    contractStartYear: "", originalPick: "", franchiseTag: false, fifthYearTag: false,
    fifthYearTagAmount: "", ...over,
  };
}

describe("canonicalContractPlayerId", () => {
  it("maps a defense keyed by nickname to the Sleeper team abbreviation", () => {
    expect(canonicalContractPlayerId({ playerId: "Texans", player: "Texans", position: "DEF" })).toBe("HOU");
    expect(canonicalContractPlayerId({ playerId: "Steelers", player: "Steelers", position: "DEF" })).toBe("PIT");
    expect(canonicalContractPlayerId({ playerId: "49ers", player: "49ers", position: "DEF" })).toBe("SF");
  });

  it("leaves an abbreviation-keyed defense unchanged", () => {
    expect(canonicalContractPlayerId({ playerId: "HOU", player: "HOU", position: "DEF" })).toBe("HOU");
  });

  it("resolves by the player name when the id is not a team token", () => {
    expect(canonicalContractPlayerId({ playerId: "#N/A", player: "Houston Texans", position: "DEF" })).toBe("HOU");
  });

  it("does not touch non-defense rows", () => {
    expect(canonicalContractPlayerId({ playerId: "4046", player: "Patrick Mahomes", position: "QB" })).toBe("4046");
    // A skill player who happens to share a team nickname is never remapped.
    expect(canonicalContractPlayerId({ playerId: "999", player: "Texans", position: "WR" })).toBe("999");
  });
});

describe("getLatestActiveContracts — defense id unification", () => {
  it("collapses a defense's abbreviation and nickname rows so the newest season wins, keyed by the Sleeper abbreviation", () => {
    // The real bug: a stale abbreviation-keyed $0/0 pickup shadowed the current
    // nickname-keyed $1/1 contract, because Sleeper rosters reference "HOU".
    const rows = [
      contract({ playerId: "HOU", player: "HOU", position: "DEF", season: "2024", owner: "Durkin", salary: 0, years: 0 }),
      contract({ playerId: "Texans", player: "Texans", position: "DEF", season: "2026", owner: "Durkin", salary: 1, years: 1 }),
    ];
    const latest = getLatestActiveContracts(rows);
    const hou = latest.filter((c) => c.playerId === "HOU");
    expect(hou).toHaveLength(1); // one player, not two
    expect(hou[0].season).toBe("2026");
    expect(hou[0].salary).toBe(1);
    expect(hou[0].years).toBe(1);
    // No stray nickname-keyed entry survives.
    expect(latest.some((c) => c.playerId === "Texans")).toBe(false);
  });

  it("does not merge two different defenses", () => {
    const rows = [
      contract({ playerId: "Texans", player: "Texans", position: "DEF", season: "2026", owner: "Durkin", salary: 1, years: 1 }),
      contract({ playerId: "NYJ", player: "NYJ", position: "DEF", season: "2026", owner: "Collins", salary: 2.5, years: 1 }),
    ];
    const latest = getLatestActiveContracts(rows);
    expect(latest.map((c) => c.playerId).sort()).toEqual(["HOU", "NYJ"]);
  });
});

describe("getLatestActiveContracts — cut / traded players", () => {
  it("does not resurrect a prior season's Active row once the latest season's row is Cut", () => {
    // Efton Chism: 2025 rookie deal stays "Active" in the sheet; the 2026 row
    // was set to Cut. Whoever picks him up must not inherit the $2 / 5yr deal.
    const rows = [
      contract({ playerId: "12542", season: "2025", owner: "Clancy", player: "Efton Chism", years: 5, salary: 2, contractStatus: "Active" }),
      contract({ playerId: "12542", season: "2026", owner: "Clancy", player: "Efton Chism", years: 4, salary: 2, contractStatus: "Cut" }),
    ];
    expect(getLatestActiveContracts(rows)).toEqual([]);
  });

  it("uses the new $0 / 0 pickup row written after a cut in the same season", () => {
    const rows = [
      contract({ playerId: "100", season: "2025", owner: "Clancy", years: 5, salary: 2, contractStatus: "Active" }),
      contract({ playerId: "100", season: "2026", owner: "Clancy", years: 4, salary: 2, contractStatus: "Cut" }),
      contract({ playerId: "100", season: "2026", owner: "HoganLamb", years: 0, salary: 0, contractStatus: "Active" }),
    ];
    const latest = getLatestActiveContracts(rows);
    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({ owner: "HoganLamb", salary: 0, years: 0, isMidSeasonPickup: true });
  });

  it("follows the Active duplicate row on a trade", () => {
    const rows = [
      contract({ playerId: "200", season: "2026", owner: "Collins", years: 2, salary: 24, contractStatus: "Traded" }),
      contract({ playerId: "200", season: "2026", owner: "Chapman", years: 2, salary: 24, contractStatus: "Active" }),
    ];
    expect(getLatestActiveContracts(rows).map((c) => c.owner)).toEqual(["Chapman"]);
  });

  it("still falls back to the latest season when the player has no newer row", () => {
    const rows = [contract({ playerId: "300", season: "2025", owner: "Katz", years: 3, salary: 10, contractStatus: "Active" })];
    expect(getLatestActiveContracts(rows).map((c) => c.season)).toEqual(["2025"]);
  });
});
