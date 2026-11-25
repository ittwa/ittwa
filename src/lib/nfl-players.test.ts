import { describe, it, expect } from "vitest";
import { slimPlayersMap } from "./nfl-players";

describe("slimPlayersMap", () => {
  const full = {
    "4046": {
      player_id: "4046", first_name: "Patrick", last_name: "Mahomes", full_name: "Patrick Mahomes",
      position: "QB", team: "KC", age: 31, fantasy_positions: ["QB"], status: "Active",
      espn_id: 3139477, metadata: { foo: "bar" }, news_updated: 123, injury_status: null,
    },
    KC: { player_id: "KC", first_name: "Kansas City", last_name: "Chiefs", position: "DEF", team: "KC", fantasy_positions: ["DEF"] },
    "9999": { player_id: "9999", first_name: "Big", last_name: "Lineman", position: "OL", team: null, fantasy_positions: ["OL"] },
    "8888": { player_id: "8888", first_name: "No", last_name: "FantasyPos", position: "TE", team: null },
  };

  const slim = slimPlayersMap(full);

  it("keeps fantasy positions (including DEF and position-only fallback) and drops OL/IDP", () => {
    expect(Object.keys(slim).sort()).toEqual(["4046", "8888", "KC"]);
  });

  it("keeps SleeperPlayer fields and drops everything else", () => {
    expect(slim["4046"]).toEqual({
      player_id: "4046", first_name: "Patrick", last_name: "Mahomes", full_name: "Patrick Mahomes",
      position: "QB", team: "KC", age: 31, fantasy_positions: ["QB"], status: "Active",
    });
  });

  it("keeps an explicit null team for free agents", () => {
    expect(slim["8888"].team).toBeNull();
  });
});
