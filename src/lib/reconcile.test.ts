import { describe, it, expect } from "vitest";
import { reconcile, type ReconcileInput } from "./reconcile";
import type { ContractRow } from "@/types/contracts";
import type { SleeperRoster, SleeperUser } from "@/types/sleeper";

// ── Fixture builders ─────────────────────────────────────────────────────────

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

function roster(rosterId: number, ownerId: string, players: string[]): SleeperRoster {
  return {
    roster_id: rosterId,
    owner_id: ownerId,
    league_id: "L",
    players,
    starters: null,
    reserve: null,
    settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
  };
}

function user(userId: string, displayName: string): SleeperUser {
  return { user_id: userId, username: displayName, display_name: displayName, avatar: null };
}

describe("reconcile — owner alias map", () => {
  it("derives Sleeper→sheet pairings by overlap and asserts they are distinct", () => {
    const input: ReconcileInput = {
      season: SEASON,
      generatedAt: "2026-06-23T00:00:00.000Z",
      // Bohne owns 101/102, Clancy owns 201/202.
      contracts: [
        contract({ playerId: "101", owner: "Bohne", player: "A One" }),
        contract({ playerId: "102", owner: "Bohne", player: "A Two" }),
        contract({ playerId: "201", owner: "Clancy", player: "B One" }),
        contract({ playerId: "202", owner: "Clancy", player: "B Two" }),
      ],
      rosters: [roster(1, "u1", ["101", "102"]), roster(2, "u2", ["201", "202"])],
      users: [user("u1", "rbohne"), user("u2", "t11clancy")],
    };

    const result = reconcile(input);
    const byRoster = Object.fromEntries(result.aliasMap.map((a) => [a.rosterId, a]));

    expect(byRoster[1].sheetOwner).toBe("Bohne");
    expect(byRoster[1].sleeperOwner).toBe("rbohne");
    expect(byRoster[1].overlap).toBe(2);
    expect(byRoster[1].ratio).toBe(1);
    expect(byRoster[2].sheetOwner).toBe("Clancy");
    expect(byRoster[2].sleeperOwner).toBe("t11clancy");
    expect(result.totals.total).toBe(0);
  });

  it("throws when two rosters map to the same sheet owner", () => {
    const input: ReconcileInput = {
      season: SEASON,
      contracts: [
        contract({ playerId: "101", owner: "Bohne" }),
        contract({ playerId: "102", owner: "Bohne" }),
      ],
      // Both rosters overlap only with Bohne → not 1:1.
      rosters: [roster(1, "u1", ["101"]), roster(2, "u2", ["102"])],
      users: [user("u1", "rbohne"), user("u2", "t11clancy")],
    };

    expect(() => reconcile(input)).toThrow(/not 1:1/);
  });
});

describe("reconcile — classification", () => {
  // Two owners with anchor players so the alias map resolves cleanly.
  function withAnchors(extraContracts: ContractRow[], extraPlayers: Record<string, string[]>) {
    const contracts: ContractRow[] = [
      contract({ playerId: "101", owner: "Bohne", player: "Anchor B1" }),
      contract({ playerId: "102", owner: "Bohne", player: "Anchor B2" }),
      contract({ playerId: "201", owner: "Clancy", player: "Anchor C1" }),
      contract({ playerId: "202", owner: "Clancy", player: "Anchor C2" }),
      ...extraContracts,
    ];
    const rosters = [
      roster(1, "u1", ["101", "102", ...(extraPlayers["1"] || [])]),
      roster(2, "u2", ["201", "202", ...(extraPlayers["2"] || [])]),
    ];
    return { season: SEASON, contracts, rosters, users: [user("u1", "rbohne"), user("u2", "t11clancy")] };
  }

  it("flags a ghost_on_sleeper (rostered, no active contract)", () => {
    const input = withAnchors([], { "1": ["999"] });
    const result = reconcile({ ...input, players: { "999": { player_id: "999", first_name: "Rookie", last_name: "Guy", full_name: "Rookie Guy", position: "RB", team: "DET" } } });
    const ghosts = result.discrepancies.filter((d) => d.type === "ghost_on_sleeper");
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].player).toBe("Rookie Guy");
    expect(ghosts[0].sleeperOwner).toBe("Bohne");
    expect(result.totals.ghost_on_sleeper).toBe(1);
  });

  it("flags a stale_in_sheet (active contract, not rostered)", () => {
    const input = withAnchors([contract({ playerId: "888", owner: "Clancy", player: "Benched Vet" })], {});
    const result = reconcile(input);
    const stale = result.discrepancies.filter((d) => d.type === "stale_in_sheet");
    expect(stale).toHaveLength(1);
    expect(stale[0].player).toBe("Benched Vet");
    expect(stale[0].sheetOwner).toBe("Clancy");
  });

  it("flags an owner_mismatch (active in both, different owners)", () => {
    // Sheet says Bohne owns 777, but it sits on Clancy's roster.
    const input = withAnchors([contract({ playerId: "777", owner: "Bohne", player: "Traded Player" })], { "2": ["777"] });
    const result = reconcile(input);
    const mismatch = result.discrepancies.filter((d) => d.type === "owner_mismatch");
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].sleeperOwner).toBe("Clancy");
    expect(mismatch[0].sheetOwner).toBe("Bohne");
  });

  it("excludes non-numeric player_ids (DEF / #N/A) from reconciliation", () => {
    const input = withAnchors([contract({ playerId: "#N/A", owner: "Clancy", player: "Mystery Pick" })], { "2": ["DET"] });
    const result = reconcile(input);
    expect(result.totals.total).toBe(0);
  });
});

describe("reconcile — id_mismatch collapse (confirmed real cases)", () => {
  // Each case: Sleeper has the active id, the sheet stored an inactive
  // same-name namesake under a different id. Sleeper active id → sheet stale id.
  const CASES = [
    { name: "DJ Moore", sleeperId: "4983", sheetId: "4961", owner: "Bohne" },
    { name: "Josh Allen", sleeperId: "4984", sheetId: "2212", owner: "Clancy" },
    { name: "Kenneth Walker", sleeperId: "8151", sheetId: "4634", owner: "Katz" },
    { name: "Kyle Williams", sleeperId: "12547", sheetId: "7437", owner: "Brown" },
    { name: "Kaleb Johnson", sleeperId: "12504", sheetId: "2967", owner: "Durkin" },
  ];

  it("collapses every confirmed namesake pair into a single id_mismatch", () => {
    const contracts: ContractRow[] = [];
    const rosters: SleeperRoster[] = [];
    const users: SleeperUser[] = [];
    // The active (ghost) pid only exists in Sleeper — its name comes from the
    // /players/nfl dictionary, exactly as in production.
    const players: ReconcileInput["players"] = {};

    CASES.forEach((c, i) => {
      const ownerId = `u${i}`;
      // Two anchor pids per owner so the alias map resolves to this surname.
      const a1 = `${i + 1}001`;
      const a2 = `${i + 1}002`;
      contracts.push(contract({ playerId: a1, owner: c.owner, player: `${c.owner} Anchor1` }));
      contracts.push(contract({ playerId: a2, owner: c.owner, player: `${c.owner} Anchor2` }));
      // The sheet stores the WRONG (stale namesake) id for this player.
      contracts.push(contract({ playerId: c.sheetId, owner: c.owner, player: c.name }));
      // The roster carries the CORRECT (active) Sleeper id.
      rosters.push(roster(i + 1, ownerId, [a1, a2, c.sleeperId]));
      users.push(user(ownerId, `handle${i}`));
      const [first, ...rest] = c.name.split(" ");
      players![c.sleeperId] = { player_id: c.sleeperId, first_name: first, last_name: rest.join(" "), full_name: c.name, position: "WR", team: "DET" };
    });

    const result = reconcile({ season: SEASON, contracts, rosters, users, players, generatedAt: "2026-06-23T00:00:00.000Z" });

    const idMismatches = result.discrepancies.filter((d) => d.type === "id_mismatch");
    expect(idMismatches).toHaveLength(CASES.length);

    for (const c of CASES) {
      const hit = idMismatches.find((d) => d.player === c.name);
      expect(hit, `expected id_mismatch for ${c.name}`).toBeDefined();
      expect(hit!.sleeperId).toBe(c.sleeperId);
      expect(hit!.sheetId).toBe(c.sheetId);
      expect(hit!.owner).toBe(c.owner);
    }

    // The collapsed pairs must NOT remain as separate ghosts/stales.
    expect(result.totals.ghost_on_sleeper).toBe(0);
    expect(result.totals.stale_in_sheet).toBe(0);
    expect(result.totals.id_mismatch).toBe(CASES.length);
  });

  it("does NOT collapse same-name players owned by different owners", () => {
    const input: ReconcileInput = {
      season: SEASON,
      contracts: [
        contract({ playerId: "101", owner: "Bohne", player: "Anchor B" }),
        contract({ playerId: "201", owner: "Clancy", player: "Anchor C" }),
        // Sheet has "Josh Allen" under Bohne with the stale id...
        contract({ playerId: "2212", owner: "Bohne", player: "Josh Allen" }),
      ],
      // ...but the active Josh Allen sits on Clancy's roster — owners differ.
      rosters: [roster(1, "u1", ["101"]), roster(2, "u2", ["201", "4984"])],
      users: [user("u1", "rbohne"), user("u2", "t11clancy")],
      players: { "4984": { player_id: "4984", first_name: "Josh", last_name: "Allen", full_name: "Josh Allen", position: "QB", team: "BUF" } },
    };
    const result = reconcile(input);
    expect(result.totals.id_mismatch).toBe(0);
    expect(result.totals.ghost_on_sleeper).toBe(1); // Clancy's Josh Allen
    expect(result.totals.stale_in_sheet).toBe(1); // Bohne's stale Josh Allen
  });
});
