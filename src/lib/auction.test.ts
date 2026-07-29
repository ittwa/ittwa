import { describe, it, expect } from "vitest";
import type { ContractRow, CapHitRow } from "@/types/contracts";
import type { SleeperPlayersMap, SleeperRoster, SleeperUser } from "@/types/sleeper";
import {
  calculateContractValue,
  computeOwnerCap,
  aggregateOwnerCaps,
  deriveRosterFromContracts,
  attributeRosterToSleeperOwners,
  deriveCapHitsByOwner,
  deriveFreeAgentPool,
  deriveAuctionState,
  bidBeats,
  bidToBeatTable,
  legalBidLadder,
  bidIncrement,
  resultsToCsv,
  awardWarnings,
  MIN_BID,
} from "./auction";
import { SALARY_CAP, SALARY_FLOOR, YEARS_CAP, ROSTER_SIZE } from "./config";

const SEASON = "2026";

function contract(over: Partial<ContractRow>): ContractRow {
  return {
    playerId: "",
    season: SEASON,
    owner: "",
    player: "",
    position: "WR",
    years: 1,
    salary: 5,
    dpOriginalOwner: "",
    draftPickId: "",
    contractStatus: "Active",
    contractStartYear: "",
    originalPick: "",
    franchiseTag: false,
    fifthYearTag: false,
    fifthYearTagAmount: "",
    ...over,
  };
}

describe("calculateContractValue — Auction Values tab parity", () => {
  it("matches the documented multiplier examples", () => {
    expect(calculateContractValue(3.5, 2)).toBe(4.9);
    expect(calculateContractValue(3.0, 3)).toBe(5.1);
    expect(calculateContractValue(10, 1)).toBe(10);
    expect(calculateContractValue(10, 4)).toBe(19);
    expect(calculateContractValue(10, 5)).toBe(20);
    expect(calculateContractValue(10, 0)).toBe(0);
  });
});

describe("computeOwnerCap", () => {
  it("computes cash, needToSpend, maxBid, maxYears for a mid-roster owner", () => {
    const cap = computeOwnerCap({
      owner: "Clancy",
      salaryRostered: 200,
      yearsRostered: 40,
      playersRostered: 18,
      capHit: 10,
    });
    // cash = 270 - 200 - 10 = 60
    expect(cap.cash).toBe(60);
    // needToSpend = max(220 - 200, 0) = 20
    expect(cap.needToSpend).toBe(20);
    expect(cap.spotsRemaining).toBe(ROSTER_SIZE - 18); // 4
    expect(cap.yearsRemaining).toBe(YEARS_CAP - 40); // 20
    // maxBid = 60 - 1.0*(4-1) = 57
    expect(cap.maxBid).toBe(57);
    // maxYears = min(5, 20 - (4-1)) = min(5, 17) = 5
    expect(cap.maxYears).toBe(5);
  });

  it("floors needToSpend at zero when already over the floor", () => {
    const cap = computeOwnerCap({
      owner: "Bohne",
      salaryRostered: 250,
      yearsRostered: 30,
      playersRostered: 15,
      capHit: 0,
    });
    expect(cap.needToSpend).toBe(0);
  });

  it("returns null maxBid/maxYears when no roster spots remain", () => {
    const cap = computeOwnerCap({
      owner: "Katz",
      salaryRostered: 200,
      yearsRostered: 40,
      playersRostered: ROSTER_SIZE,
      capHit: 0,
    });
    expect(cap.spotsRemaining).toBe(0);
    expect(cap.maxBid).toBeNull();
    expect(cap.maxYears).toBeNull();
  });

  it("floors maxYears at 1 even when yearsRemaining is tight", () => {
    const cap = computeOwnerCap({
      owner: "Durkin",
      salaryRostered: 100,
      yearsRostered: 59,
      playersRostered: 20,
      capHit: 0,
    });
    // yearsRemaining = 1, spotsRemaining = 2 -> 1 - (2-1) = 0, floored to 1
    expect(cap.maxYears).toBe(1);
  });

  it("marks capHitOverridden when a manual value is supplied via aggregateOwnerCaps", () => {
    const owners = aggregateOwnerCaps(
      [],
      new Map([["Clancy", 15]]),
      ["Clancy"],
      new Map([["Clancy", 5]]),
    );
    expect(owners[0].capHit).toBe(5);
    expect(owners[0].capHitOverridden).toBe(true);
  });

  it("gives an empty-roster owner the full cap and floor", () => {
    const owners = aggregateOwnerCaps([], new Map(), ["Peterson"]);
    const o = owners[0];
    expect(o.cash).toBe(SALARY_CAP);
    expect(o.needToSpend).toBe(SALARY_FLOOR);
    expect(o.spotsRemaining).toBe(ROSTER_SIZE);
    // maxBid = 270 - 1.0*(22-1) = 249
    expect(o.maxBid).toBe(SALARY_CAP - (ROSTER_SIZE - 1));
  });
});

describe("deriveRosterFromContracts", () => {
  it("includes only Active, years>=1, current-season rows and resolves owner names", () => {
    const contracts: ContractRow[] = [
      contract({ playerId: "1", owner: "Clancy", player: "Active Vet", years: 2, salary: 20 }),
      contract({ playerId: "2", owner: "Clancy", player: "Mid-season Pickup", years: 0, salary: 0 }),
      contract({ playerId: "3", owner: "Bohne", player: "Cut Player", years: 3, salary: 15, contractStatus: "Cut" }),
      contract({ playerId: "4", owner: "Bohne", player: "Last Year", years: 2, salary: 10, season: "2025" }),
      contract({ owner: "Bohne", player: "2027 1st", years: 4, salary: 8, position: "Draft Pick" }),
    ];
    const roster = deriveRosterFromContracts(contracts, SEASON);
    expect(roster.map((r) => r.player)).toEqual(["Active Vet"]);
    expect(roster[0].owner).toBe("Clancy");
  });

  it("includes franchise-tagged players", () => {
    const contracts: ContractRow[] = [
      contract({ playerId: "1", owner: "Katz", player: "Tagged Player", years: 1, salary: 45, franchiseTag: true }),
    ];
    const roster = deriveRosterFromContracts(contracts, SEASON);
    expect(roster).toHaveLength(1);
  });
});

describe("attributeRosterToSleeperOwners — Sleeper owns WHO, the sheet owns TERMS", () => {
  // "SamCummings" and "mschapman" are mapped to "Cummings"/"Chapman" by
  // USERNAME_OVERRIDES, same as everywhere else on the site.
  const users: SleeperUser[] = [
    { user_id: "u1", username: "SamCummings", display_name: "SamCummings", avatar: null },
    { user_id: "u2", username: "mschapman", display_name: "mschapman", avatar: null },
  ];

  function roster(over: Partial<SleeperRoster> & { roster_id: number; owner_id: string }): SleeperRoster {
    return {
      league_id: "L",
      players: [],
      starters: [],
      reserve: [],
      settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
      ...over,
    };
  }

  const nflPlayers: SleeperPlayersMap = {
    "1": { player_id: "1", first_name: "Traded", last_name: "Vet", full_name: "Traded Vet", position: "WR", team: "DAL", sport: "nfl" },
    "2": { player_id: "2", first_name: "Dropped", last_name: "Guy", full_name: "Dropped Guy", position: "RB", team: "SF", sport: "nfl" },
    "3": { player_id: "3", first_name: "D.J.", last_name: "Moore", full_name: "D.J. Moore", position: "WR", team: "CHI", sport: "nfl" },
  };

  it("moves a traded player to the Sleeper owner, keeping the sheet's salary and years", () => {
    // Sheet still says Chapman owns him; Sleeper says he is on Cummings' roster.
    const contractRoster = deriveRosterFromContracts(
      [contract({ playerId: "1", owner: "Chapman", player: "Traded Vet", years: 3, salary: 22 })],
      SEASON,
    );
    const { roster: result, unrostered } = attributeRosterToSleeperOwners({
      contractRoster,
      rosters: [roster({ roster_id: 1, owner_id: "u1", players: ["1"] }), roster({ roster_id: 2, owner_id: "u2", players: [] })],
      users,
      nflPlayers,
    });

    expect(result).toHaveLength(1);
    expect(result[0].owner).toBe("Cummings");
    expect(result[0].salary).toBe(22);
    expect(result[0].years).toBe(3);
    expect(unrostered).toHaveLength(0);
  });

  it("drops a player who is no longer on any Sleeper roster and reports him as unrostered", () => {
    const contractRoster = deriveRosterFromContracts(
      [contract({ playerId: "2", owner: "Cummings", player: "Dropped Guy", years: 2, salary: 14 })],
      SEASON,
    );
    const { roster: result, unrostered } = attributeRosterToSleeperOwners({
      contractRoster,
      rosters: [roster({ roster_id: 1, owner_id: "u1", players: [] })],
      users,
      nflPlayers,
    });

    expect(result).toHaveLength(0);
    expect(unrostered.map((r) => r.player)).toEqual(["Dropped Guy"]);
  });

  it("falls back to a normalized name match and adopts Sleeper's player_id", () => {
    const contractRoster = deriveRosterFromContracts(
      [contract({ playerId: "#N/A", owner: "Chapman", player: "DJ Moore", years: 2, salary: 18 })],
      SEASON,
    );
    const { roster: result } = attributeRosterToSleeperOwners({
      contractRoster,
      rosters: [roster({ roster_id: 1, owner_id: "u1", players: ["3"] })],
      users,
      nflPlayers,
    });

    expect(result).toHaveLength(1);
    expect(result[0].owner).toBe("Cummings");
    expect(result[0].playerId).toBe("3");
  });

  it("leaves a Sleeper-rostered player with no current-season contract off the roster", () => {
    const { roster: result } = attributeRosterToSleeperOwners({
      contractRoster: [],
      rosters: [roster({ roster_id: 1, owner_id: "u1", players: ["1", "2"] })],
      users,
      nflPlayers,
    });
    expect(result).toHaveLength(0);
  });
});

describe("deriveAuctionState — Sleeper attribution end to end", () => {
  const users: SleeperUser[] = [
    { user_id: "u1", username: "SamCummings", display_name: "SamCummings", avatar: null },
    { user_id: "u2", username: "mschapman", display_name: "mschapman", avatar: null },
  ];
  const rosters: SleeperRoster[] = [
    {
      roster_id: 1, owner_id: "u1", league_id: "L", players: ["1", "9"], starters: [], reserve: [],
      settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
    },
    {
      roster_id: 2, owner_id: "u2", league_id: "L", players: [], starters: [], reserve: [],
      settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
    },
  ];
  const nflPlayers: SleeperPlayersMap = {
    "1": { player_id: "1", first_name: "Traded", last_name: "Vet", full_name: "Traded Vet", position: "WR", team: "DAL", sport: "nfl" },
    "2": { player_id: "2", first_name: "Dropped", last_name: "Guy", full_name: "Dropped Guy", position: "RB", team: "SF", sport: "nfl" },
    "9": { player_id: "9", first_name: "Expiring", last_name: "Rfa", full_name: "Expiring Rfa", position: "TE", team: "KC", sport: "nfl" },
  };

  it("bills the traded-in salary to the Sleeper owner and frees the dropped player", () => {
    const contracts: ContractRow[] = [
      contract({ playerId: "1", owner: "Chapman", player: "Traded Vet", years: 3, salary: 22 }),
      contract({ playerId: "2", owner: "Cummings", player: "Dropped Guy", years: 2, salary: 14 }),
    ];
    const result = deriveAuctionState({ season: SEASON, contracts, capHits: [], nflPlayers, rosters, users });

    const cummings = result.owners.find((o) => o.owner === "Cummings")!;
    const chapman = result.owners.find((o) => o.owner === "Chapman")!;
    expect(cummings.salaryRostered).toBe(22);
    expect(cummings.playersRostered).toBe(1);
    expect(chapman.salaryRostered).toBe(0);

    // The dropped player is biddable again; the traded player is not.
    expect(result.pool.map((p) => p.playerId)).toContain("2");
    expect(result.pool.map((p) => p.playerId)).not.toContain("1");
    expect(result.warnings.some((w) => w.includes("no longer on any Sleeper roster") || w.includes("nobody's Sleeper roster"))).toBe(true);
  });

  it("gives RFA rights to the owner who holds the expiring player on Sleeper now", () => {
    const contracts: ContractRow[] = [
      contract({ playerId: "9", owner: "Chapman", player: "Expiring Rfa", years: 1, salary: 9, season: "2025" }),
    ];
    const result = deriveAuctionState({ season: SEASON, contracts, capHits: [], nflPlayers, rosters, users });

    const rfa = result.pool.find((p) => p.playerId === "9")!;
    expect(rfa.rfa).toBe(true);
    expect(rfa.previousOwner).toBe("Cummings");
  });

  it("warns loudly when Sleeper is unavailable and it has to trust the sheet's Owner column", () => {
    const contracts: ContractRow[] = [
      contract({ playerId: "1", owner: "Chapman", player: "Traded Vet", years: 3, salary: 22 }),
    ];
    const result = deriveAuctionState({ season: SEASON, contracts, capHits: [], nflPlayers });

    expect(result.roster[0].owner).toBe("Chapman");
    expect(result.warnings.some((w) => w.includes("Sleeper rosters were unavailable"))).toBe(true);
  });
});

describe("deriveCapHitsByOwner", () => {
  it("sums yearlyHits for the target season across multiple rows per owner", () => {
    const capHits: CapHitRow[] = [
      { season: "2025", owner: "Clancy", player: "Cut A", position: "WR", years: 2, salary: 10, capHit: 5, yearsRemaining: 1, yearlyHits: { 2026: 3 } },
      { season: "2025", owner: "Clancy", player: "Cut B", position: "RB", years: 1, salary: 8, capHit: 4, yearsRemaining: 1, yearlyHits: { 2026: 2 } },
      { season: "2025", owner: "Bohne", player: "Cut C", position: "TE", years: 1, salary: 6, capHit: 3, yearsRemaining: 1, yearlyHits: { 2027: 3 } },
    ];
    const byOwner = deriveCapHitsByOwner(capHits, SEASON);
    expect(byOwner.get("Clancy")).toBe(5);
    expect(byOwner.get("Bohne")).toBeUndefined();
  });
});

describe("deriveFreeAgentPool", () => {
  const nflPlayers: SleeperPlayersMap = {
    "101": { player_id: "101", first_name: "Free", last_name: "Agent", full_name: "Free Agent", position: "WR", team: "DAL", sport: "nfl" },
    "102": { player_id: "102", first_name: "Rostered", last_name: "Guy", full_name: "Rostered Guy", position: "RB", team: "SF", sport: "nfl" },
    "103": { player_id: "103", first_name: "No", last_name: "Team", full_name: "No Team", position: "WR", team: null, sport: "nfl" },
    "104": { player_id: "104", first_name: "", last_name: "", full_name: "Kicker Guy", position: "K", team: "BUF", sport: "nfl" },
    "SF": { player_id: "SF", first_name: "San Francisco", last_name: "49ers", full_name: "San Francisco 49ers", position: "DEF", team: "SF", sport: "nfl" },
  };

  it("filters to QB/RB/WR/TE/DEF, excludes rostered players and players without a team", () => {
    const pool = deriveFreeAgentPool({
      nflPlayers,
      contractedPlayerIds: new Set(["102"]),
      priorSeasonOwnerByPlayerId: new Map(),
    });
    const ids = pool.map((p) => p.playerId);
    expect(ids).toContain("101");
    expect(ids).toContain("SF");
    expect(ids).not.toContain("102"); // rostered
    expect(ids).not.toContain("103"); // no team
    expect(ids).not.toContain("104"); // K not eligible
  });

  it("flags RFA with previous owner from prior-season contract rows", () => {
    const pool = deriveFreeAgentPool({
      nflPlayers,
      contractedPlayerIds: new Set(),
      priorSeasonOwnerByPlayerId: new Map([["101", "Williams"]]),
    });
    const fa = pool.find((p) => p.playerId === "101")!;
    expect(fa.rfa).toBe(true);
    expect(fa.previousOwner).toBe("Williams");

    const def = pool.find((p) => p.playerId === "SF")!;
    expect(def.rfa).toBe(false);
    expect(def.previousOwner).toBeNull();
  });
});

describe("deriveAuctionState — end-to-end derivation with warnings", () => {
  it("surfaces a warning for mid-season pickups and for missing player_id on rostered contracts", () => {
    const contracts: ContractRow[] = [
      contract({ playerId: "#N/A", owner: "Clancy", player: "Mystery Vet", years: 2, salary: 12 }),
      contract({ playerId: "5", owner: "Bohne", player: "Pickup", years: 0, salary: 0 }),
    ];
    const result = deriveAuctionState({ season: SEASON, contracts, capHits: [], nflPlayers: {} });
    expect(result.warnings.some((w) => w.includes("mid-season pickup"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("no Sleeper player_id"))).toBe(true);
    expect(result.roster).toHaveLength(1);
  });
});

describe("bid increments and ladder", () => {
  it("steps $0.5 below $10 and $1.0 at/above $10", () => {
    expect(bidIncrement(5)).toBe(0.5);
    expect(bidIncrement(9.5)).toBe(0.5);
    expect(bidIncrement(10)).toBe(1.0);
    expect(bidIncrement(50)).toBe(1.0);
  });

  it("builds a ladder starting at $1.0 with the correct step change at $10", () => {
    const ladder = legalBidLadder(12);
    expect(ladder[0]).toBe(MIN_BID);
    expect(ladder).toContain(9.5);
    expect(ladder).toContain(10);
    expect(ladder).toContain(11);
    expect(ladder).not.toContain(10.5);
  });
});

describe("bidBeats — constitution rule (more value, or equal value with more years)", () => {
  it("requires at least the opening bid when there is no current bid", () => {
    expect(bidBeats(1.0, 1, null, null)).toBe(true);
    expect(bidBeats(0.5, 1, null, null)).toBe(false);
  });

  it("a strictly greater value wins", () => {
    // current: $10 x 2yr = $14.0 value. $11 x 2yr = $15.4 > 14.0
    expect(bidBeats(11, 2, 10, 2)).toBe(true);
  });

  it("a lower value loses even with more years", () => {
    // $5 x 5yr = $10.0 value vs current $10 x 2yr = $14.0
    expect(bidBeats(5, 5, 10, 2)).toBe(false);
  });

  it("an equal value with MORE years wins (you may match by adding years)", () => {
    // current: $10 x 1yr = $10.0. $10 x 2yr = $14.0... need an exact-equal case:
    // $7 x 1yr = 7.0, $5 x 1.4(2yr)=7.0 -> equal value, more years -> wins
    expect(calculateContractValue(5, 2)).toBe(7.0);
    expect(bidBeats(5, 2, 7, 1)).toBe(true);
  });

  it("an equal value with the SAME or fewer years does not win", () => {
    expect(bidBeats(7, 1, 7, 1)).toBe(false);
    expect(calculateContractValue(5, 2)).toBe(7.0);
    expect(bidBeats(7, 1, 5, 2)).toBe(false); // equal value, fewer years than 2
  });
});

describe("bidToBeatTable", () => {
  it("shows the $1.0 opening bid for every length when there is no current bid", () => {
    const rows = bidToBeatTable(null, null);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.salary).toBe(MIN_BID);
      expect(row.value).toBe(calculateContractValue(MIN_BID, row.years));
    }
  });

  it("finds the minimum legal salary at each length that beats the current bid", () => {
    const rows = bidToBeatTable(10, 2);
    const ladder = legalBidLadder();
    for (const row of rows) {
      expect(bidBeats(row.salary, row.years, 10, 2)).toBe(true);
      const idx = ladder.indexOf(row.salary);
      expect(idx).toBeGreaterThan(-1);
      if (idx > 0) {
        const prevRung = ladder[idx - 1];
        expect(bidBeats(prevRung, row.years, 10, 2)).toBe(false);
      }
    }
  });
});

describe("awardWarnings — soft, never blocking", () => {
  it("flags an award that busts max bid, max years, or cash without preventing it", () => {
    const cap = computeOwnerCap({
      owner: "Chapman",
      salaryRostered: 200,
      yearsRostered: 40,
      playersRostered: 20,
      capHit: 0,
    });
    // maxBid = (270-200) - 1*(2-1) = 69; maxYears = min(5, 20-1) = 5
    const warnings = awardWarnings(cap, 100, 6);
    expect(warnings.some((w) => w.includes("max bid"))).toBe(true);
    expect(warnings.some((w) => w.includes("max contract length"))).toBe(true);
  });

  it("returns no warnings for an award within bounds", () => {
    const cap = computeOwnerCap({
      owner: "Cummings",
      salaryRostered: 100,
      yearsRostered: 20,
      playersRostered: 10,
      capHit: 0,
    });
    expect(awardWarnings(cap, 10, 2)).toEqual([]);
  });
});

describe("resultsToCsv", () => {
  it("formats the exact old Drafted Players layout with zero-padded pick numbers", () => {
    const csv = resultsToCsv([
      { id: 1, pickNumber: 14, nominator: "Clancy", winner: "Bohne", playerId: "9999", player: "Jaylen Warren", position: "RB", years: 1, salary: 39, createdAt: "" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("ID,Nominator,Owner,Player,Position,Years,Salary");
    expect(lines[1]).toBe("014,Clancy,Bohne,Jaylen Warren,RB,1,39.0");
  });

  it("optionally appends a Player ID column", () => {
    const csv = resultsToCsv(
      [{ id: 1, pickNumber: 1, nominator: "Clancy", winner: "Bohne", playerId: "9999", player: "Jaylen Warren", position: "RB", years: 1, salary: 39, createdAt: "" }],
      { includePlayerId: true },
    );
    const lines = csv.split("\n");
    expect(lines[0]).toBe("ID,Nominator,Owner,Player,Position,Years,Salary,Player ID");
    expect(lines[1]).toBe("001,Clancy,Bohne,Jaylen Warren,RB,1,39.0,9999");
  });
});
