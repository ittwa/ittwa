import { describe, it, expect } from "vitest";
import { buildFreeAgentsCsv } from "./free-agents-export";
import type { SleeperRoster, SleeperPlayer, SleeperPlayersMap } from "@/types/sleeper";

function player(over: Partial<SleeperPlayer> & { player_id: string }): SleeperPlayer {
  return { first_name: "", last_name: "", position: "WR", team: "KC", sport: "nfl", ...over };
}
function roster(players: string[]): SleeperRoster {
  return { players } as unknown as SleeperRoster;
}

const players: SleeperPlayersMap = {
  "1": player({ player_id: "1", full_name: "Aaron Jones", position: "RB", team: "MIN" }),
  "2": player({ player_id: "2", full_name: "Aaron Rodgers", position: "QB", team: "PIT" }),
  "3": player({ player_id: "3", full_name: "Adam Thielen", position: "WR", team: "CAR" }),
  "4": player({ player_id: "4", full_name: "Aaron Dobson", position: "WR", team: null }), // retired, no team
  "5": player({ player_id: "5", full_name: "Rostered Guy", position: "WR", team: "SF" }),
  "6": player({ player_id: "6", full_name: "Patrick Mahomes", position: "QB", team: "KC" }),
  "K1": player({ player_id: "K1", full_name: "Some Kicker", position: "K", team: "KC" }), // wrong position
  "SF": player({ player_id: "SF", full_name: "San Francisco", position: "DEF", team: "SF" }), // DEF excluded
  "NBA": player({ player_id: "NBA", full_name: "Hooper", position: "WR", team: "X", sport: "nba" }), // non-nfl
};

describe("buildFreeAgentsCsv", () => {
  it("lists unrostered QB/RB/WR/TE alphabetically, with a header", () => {
    const csv = buildFreeAgentsCsv({ rosters: [roster(["5", "6"])], nflPlayers: players });
    expect(csv).toBe(
      [
        "Player,Position",
        "Aaron Dobson,WR", // team-less included by default (matches a raw export)
        "Aaron Jones,RB",
        "Aaron Rodgers,QB",
        "Adam Thielen,WR",
      ].join("\n"),
    );
  });

  it("excludes rostered players, kickers/DEF, and non-NFL players", () => {
    const csv = buildFreeAgentsCsv({ rosters: [roster(["5", "6"])], nflPlayers: players });
    expect(csv).not.toContain("Rostered Guy");
    expect(csv).not.toContain("Patrick Mahomes");
    expect(csv).not.toContain("Some Kicker");
    expect(csv).not.toContain("San Francisco");
    expect(csv).not.toContain("Hooper");
  });

  it("activeOnly drops players with no NFL team", () => {
    const csv = buildFreeAgentsCsv({ rosters: [roster([])], nflPlayers: players, activeOnly: true });
    expect(csv).not.toContain("Aaron Dobson"); // team null → dropped
    expect(csv).toContain("Aaron Jones");
  });

  it("dedupes rostered ids across multiple rosters and quotes names with commas", () => {
    const map: SleeperPlayersMap = {
      a: player({ player_id: "a", full_name: "Odell Beckham, Jr.", position: "WR", team: "MIA" }),
      b: player({ player_id: "b", full_name: "Taken Player", position: "RB", team: "SF" }),
    };
    const csv = buildFreeAgentsCsv({ rosters: [roster(["b"]), roster([])], nflPlayers: map });
    expect(csv).toContain('"Odell Beckham, Jr.",WR'); // comma → quoted
    expect(csv).not.toContain("Taken Player");
  });
});
