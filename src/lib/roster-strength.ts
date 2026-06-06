import { SleeperRoster, SleeperPlayer } from "@/types/sleeper";
import { SALARY_CAP } from "./config";

const MAX_PLAYER_SCORE = 100;
const POS_DECAY = 0.92;
const CAP_WEIGHT = 0.20;

export interface RosterStrengthEntry {
  rosterId: number;
  displayName: string;
  division: string;
  rosterScore: number;
  capSpace: number;
  capBonus: number;
  totalScore: number;
  rank: number;
  topPlayers: { name: string; position: string; posRank: number; score: number }[];
}

const SCORING_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

export function calculateRosterStrength(
  rosters: SleeperRoster[],
  rosterOwnerMap: Record<number, string>,
  rosterDivisionMap: Record<number, string>,
  posRanks: Record<string, number>,
  nflPlayers: Record<string, SleeperPlayer>,
  capByOwner?: Record<string, number>,
  includeCapBonus = false,
): RosterStrengthEntry[] {
  const entries: RosterStrengthEntry[] = [];

  for (const roster of rosters) {
    const displayName = rosterOwnerMap[roster.roster_id] || `Team ${roster.roster_id}`;
    const division = rosterDivisionMap[roster.roster_id] || "";
    const players = roster.players || [];

    const playerScores: { name: string; position: string; posRank: number; score: number }[] = [];

    for (const pid of players) {
      const player = nflPlayers[pid];
      if (!player) continue;
      const pos = player.position || "";
      if (!SCORING_POSITIONS.has(pos)) continue;

      const posRank = posRanks[pid];
      if (!posRank || posRank <= 0) {
        playerScores.push({
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: pos,
          posRank: 999,
          score: 0,
        });
        continue;
      }

      const score = MAX_PLAYER_SCORE * Math.pow(POS_DECAY, posRank - 1);
      playerScores.push({
        name: player.full_name || `${player.first_name} ${player.last_name}`,
        position: pos,
        posRank,
        score: Math.round(score * 10) / 10,
      });
    }

    playerScores.sort((a, b) => b.score - a.score);
    const rosterScore = playerScores.reduce((sum, p) => sum + p.score, 0);
    const topPlayers = playerScores.slice(0, 5);

    entries.push({
      rosterId: roster.roster_id,
      displayName,
      division,
      rosterScore: Math.round(rosterScore * 10) / 10,
      capSpace: 0,
      capBonus: 0,
      totalScore: Math.round(rosterScore * 10) / 10,
      rank: 0,
      topPlayers,
    });
  }

  if (includeCapBonus && capByOwner) {
    const avgScore = entries.reduce((sum, e) => sum + e.rosterScore, 0) / (entries.length || 1);

    for (const entry of entries) {
      const capRemaining = capByOwner[entry.displayName] ?? 0;
      entry.capSpace = Math.round(capRemaining * 10) / 10;
      entry.capBonus = Math.round(
        (capRemaining / SALARY_CAP) * avgScore * CAP_WEIGHT * 10,
      ) / 10;
      entry.totalScore = Math.round((entry.rosterScore + entry.capBonus) * 10) / 10;
    }
  }

  entries.sort((a, b) => b.totalScore - a.totalScore);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}
