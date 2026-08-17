import type { SleeperRoster, SleeperPlayersMap } from "@/types/sleeper";

// Builds the "Player,Position" free-agents CSV: every QB/RB/WR/TE that isn't on
// any Sleeper roster (Sleeper decides who's rostered — CLAUDE.md), alphabetical
// by name. `activeOnly` drops players with no current NFL team. Pure so it's
// unit-testable; the route just fetches and calls this.

const FA_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildFreeAgentsCsv(params: {
  rosters: SleeperRoster[];
  nflPlayers: SleeperPlayersMap;
  activeOnly?: boolean;
}): string {
  const { rosters, nflPlayers, activeOnly = false } = params;

  const rostered = new Set<string>();
  for (const r of rosters) for (const pid of r.players ?? []) rostered.add(pid);

  const freeAgents: { player: string; position: string }[] = [];
  for (const [pid, p] of Object.entries(nflPlayers)) {
    if (!FA_POSITIONS.has(p.position)) continue;
    if (p.sport && p.sport !== "nfl") continue;
    if (rostered.has(pid)) continue;
    if (activeOnly && !p.team) continue;
    const player = p.full_name || `${p.first_name} ${p.last_name}`.trim();
    if (!player) continue;
    freeAgents.push({ player, position: p.position });
  }

  freeAgents.sort((a, b) => a.player.localeCompare(b.player));

  return ["Player,Position", ...freeAgents.map((f) => `${csvEscape(f.player)},${f.position}`)].join("\n");
}
