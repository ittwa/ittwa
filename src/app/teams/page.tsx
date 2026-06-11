import { connection } from "next/server";

export const metadata = { title: "Teams" };


import {
  getTeamsData,
  calculateStandings,
  getContracts,
  getCapHits,
  getLatestActiveContracts,
  getLeagueUsers,
  getLeague,
} from "@/lib/data";
import { getNFLPlayers, getDisplayName } from "@/lib/sleeper";
import { OWNER_LAST_NAME_MAP, SALARY_CAP, YEARS_CAP } from "@/lib/config";
import { TeamsClient, type TeamDirectoryEntry } from "./teams-client";

function getOwnerLastName(displayName: string): string {
  for (const [lastName, fullName] of Object.entries(OWNER_LAST_NAME_MAP)) {
    if (fullName === displayName) return lastName;
  }
  return displayName.split(" ").pop() || displayName;
}

export default async function TeamsPage() {
  await connection();
  const [teamsData, contracts, capHits, nflPlayers, league, users] = await Promise.all([
    getTeamsData(),
    getContracts(),
    getCapHits(),
    getNFLPlayers(),
    getLeague(),
    getLeagueUsers(),
  ]);

  const { teams, season, allMatchups } = teamsData;
  const standings = calculateStandings(teams, allMatchups);
  const allActiveContracts = getLatestActiveContracts(contracts);
  const currentSeasonNum = parseInt(season, 10);
  const seasonStarted = allMatchups.size > 0;
  const capHitYear = seasonStarted ? currentSeasonNum + 1 : currentSeasonNum;
  const playoffTeams = league.settings.playoff_teams || 6;

  const teamNames: Record<string, string> = {};
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    teamNames[getDisplayName(user)] = user.metadata?.team_name || "";
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const contractById = new Map<string, { salary: number; years: number; position: string }>();
  const contractByName = new Map<string, { salary: number; years: number; position: string }>();
  for (const c of allActiveContracts) {
    const entry = { salary: c.salary, years: c.years, position: c.position };
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      contractById.set(c.playerId, entry);
    }
    if (c.player) {
      contractByName.set(c.player.toLowerCase().trim(), entry);
    }
  }

  const activeDraftPicks = contracts.filter(
    (c) =>
      c.contractStatus.toLowerCase() === "active" &&
      c.position.toLowerCase() === "draft pick" &&
      parseInt(c.season, 10) >= currentSeasonNum
  );
  const draftPicksByOwner = new Map<string, typeof activeDraftPicks>();
  for (const dp of activeDraftPicks) {
    const key = dp.owner.toLowerCase();
    const arr = draftPicksByOwner.get(key) ?? [];
    arr.push(dp);
    draftPicksByOwner.set(key, arr);
  }

  const capHitsByOwner = new Map<string, typeof capHits>();
  for (const ch of capHits) {
    const key = ch.owner.toLowerCase();
    const arr = capHitsByOwner.get(key) ?? [];
    arr.push(ch);
    capHitsByOwner.set(key, arr);
  }

  const entries: TeamDirectoryEntry[] = standings.map((team) => {
    const ownerLastName = getOwnerLastName(team.displayName);
    const ownerKey = ownerLastName.toLowerCase();

    let playerSalary = 0;
    let playerYears = 0;
    let expiringContracts = 0;
    const pos: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };

    for (const pid of team.players) {
      const sp = nflPlayers[pid];
      let contract = contractById.get(pid);
      if (!contract && sp) {
        const name = (sp.full_name || `${sp.first_name} ${sp.last_name}`).toLowerCase().trim();
        contract = contractByName.get(name);
      }
      if (contract) {
        playerSalary += contract.salary;
        playerYears += contract.years;
        if (contract.years <= 1) expiringContracts++;
      }
      const position = sp?.position || contract?.position;
      if (position && position in pos) pos[position]++;
    }

    const draftPicks = draftPicksByOwner.get(ownerKey) ?? [];
    let dpSalary = 0;
    let dpYears = 0;
    for (const dp of draftPicks) {
      if (parseInt(dp.season, 10) === currentSeasonNum) {
        dpSalary += dp.salary;
        dpYears += dp.years;
      }
    }

    const committed = playerSalary + dpSalary;
    const yearsUsed = playerYears + dpYears;
    const dead = (capHitsByOwner.get(ownerKey) ?? [])
      .reduce((s, ch) => s + (ch.yearlyHits[capHitYear] ?? 0), 0);

    return {
      owner: team.displayName,
      team: teamNames[team.displayName] || "",
      division: team.division,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      divRec: team.divisionRecord,
      pf: team.pointsFor,
      pa: team.pointsAgainst,
      streak: team.streak,
      rank: team.rank,
      seed: team.rank <= playoffTeams ? team.rank : null,
      capCommit: committed,
      capDead: dead,
      capRem: SALARY_CAP - committed - dead,
      yearsUsed,
      yearsRem: YEARS_CAP - yearsUsed,
      picks: draftPicks.length,
      roster: team.players.length,
      pos,
      expiringContracts,
    };
  });

  return <TeamsClient teams={entries} season={season} ownerAvatars={ownerAvatars} />;
}
