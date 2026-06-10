import {
  getRosters,
  getNFLPlayers,
  getTradedPicks,
  buildRosterOwnerMap,
} from "@/lib/sleeper";
import { getContracts } from "@/lib/sheets";
import { getLatestActiveContracts } from "@/lib/contracts";
import { getFantasyCalcValues } from "@/lib/fantasycalc";
import {
  LEAGUE_ID,
  SALARY_CAP,
  YEARS_CAP,
  DIVISION_NUMBER_MAP,
  OWNER_DIVISION,
  ROOKIE_PICK_CONTRACTS,
} from "@/lib/config";
import type { ContractWithValue } from "@/types/contracts";
import { buildValueIndex, matchPlayerValue } from "./player-matching";
import { DEFAULT_CONFIG } from "./config";
import type { TradeAnalyzerData, TradeAsset, TradeTeam } from "./types";

// How many future draft seasons to expose as tradeable picks, and how many
// rounds the rookie draft has (rookie contracts are defined for rounds 1-2).
const PICK_SEASONS_AHEAD = 3;
const ROOKIE_ROUNDS = 2;

const ORDINAL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

function roundMidSlot(round: number): string {
  // A future pick's exact slot is unknown, so we estimate a mid-round rookie
  // contract for cap purposes (refine once standings/slotting is wired in).
  return round === 1 ? "1.06" : "2.06";
}

// ---- FantasyCalc pick values -------------------------------------------------

interface PickTiers {
  early?: number;
  mid?: number;
  late?: number;
  generic?: number;
}

function parsePickName(
  name: string,
): { season: string; round: number; tier: keyof PickTiers } | null {
  const m = name.match(/(\d{4})\s+(?:(early|mid|late)\s+)?(\d)(?:st|nd|rd|th)/i);
  if (!m) return null;
  const season = m[1];
  const tier = (m[2]?.toLowerCase() as keyof PickTiers) || "generic";
  const round = parseInt(m[3], 10);
  return { season, round, tier };
}

function buildPickValueIndex(
  entries: { player: { name: string; position?: string }; value: number }[],
): Map<string, PickTiers> {
  const index = new Map<string, PickTiers>();
  for (const e of entries) {
    if ((e.player.position || "").toUpperCase() !== "PICK") continue;
    const parsed = parsePickName(e.player.name || "");
    if (!parsed) continue;
    const key = `${parsed.season}-${parsed.round}`;
    const tiers = index.get(key) || {};
    tiers[parsed.tier] = e.value;
    index.set(key, tiers);
  }
  return index;
}

function pickValue(index: Map<string, PickTiers>, season: string, round: number): number {
  const tiers = index.get(`${season}-${round}`);
  if (!tiers) return 0;
  if (tiers.mid !== undefined) return tiers.mid;
  if (tiers.generic !== undefined) return tiers.generic;
  const present = [tiers.early, tiers.mid, tiers.late].filter(
    (v): v is number => v !== undefined,
  );
  return present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : 0;
}

// ---- Main loader -------------------------------------------------------------

export async function getTradeAnalyzerData(): Promise<TradeAnalyzerData> {
  const [rosters, nflPlayers, contracts, fcValues, tradedPicks, rosterOwnerMap] =
    await Promise.all([
      getRosters(LEAGUE_ID),
      getNFLPlayers(),
      getContracts(),
      getFantasyCalcValues(),
      getTradedPicks(LEAGUE_ID),
      buildRosterOwnerMap(LEAGUE_ID),
    ]);

  const activeContracts = getLatestActiveContracts(contracts);
  const contractByPlayerId = new Map<string, ContractWithValue>();
  const contractByName = new Map<string, ContractWithValue>();
  for (const c of activeContracts) {
    if (c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== "") {
      contractByPlayerId.set(c.playerId, c);
    }
    if (c.player) contractByName.set(c.player.toLowerCase().trim(), c);
  }

  const valueIndex = buildValueIndex(fcValues);
  const pickIndex = buildPickValueIndex(fcValues);

  let unmatchedCount = 0;

  const divisionForRoster = (r: (typeof rosters)[number], owner: string): string =>
    DIVISION_NUMBER_MAP[r.settings.division ?? 0] || OWNER_DIVISION[owner] || "";

  // Determine current draft-season window from the FantasyCalc pick names
  // (e.g. earliest "20xx" pick) so the window tracks reality without hardcoding.
  const pickSeasons = [...pickIndex.keys()]
    .map((k) => parseInt(k.split("-")[0], 10))
    .filter((n) => !Number.isNaN(n));
  const baseSeason = pickSeasons.length ? Math.min(...pickSeasons) : new Date().getFullYear();
  const seasonWindow = Array.from({ length: PICK_SEASONS_AHEAD }, (_, i) =>
    String(baseSeason + i),
  );

  // Build player assets per roster.
  const teams: TradeTeam[] = rosters.map((roster) => {
    const owner = rosterOwnerMap[roster.roster_id] || `Team ${roster.roster_id}`;
    const division = divisionForRoster(roster, owner);
    const playerIds = roster.players || [];

    let totalSalary = 0;
    let totalYears = 0;
    const assets: TradeAsset[] = [];

    for (const pid of playerIds) {
      const sp = nflPlayers[pid];
      const contract =
        contractByPlayerId.get(pid) ||
        (sp
          ? contractByName.get(
              (sp.full_name || `${sp.first_name} ${sp.last_name}`).toLowerCase().trim(),
            )
          : undefined);

      const name = sp
        ? sp.full_name || `${sp.first_name} ${sp.last_name}`
        : contract?.player || `Unknown (${pid})`;
      const position = sp?.position || contract?.position || "—";

      const salary = contract?.salary ?? 0;
      const years = contract?.years ?? 0;
      totalSalary += salary;
      totalYears += years;

      const match = matchPlayerValue(pid, name, position, valueIndex);
      if (match.value === null) {
        unmatchedCount++;
        // Logged for manual override during build (see overrides.ts).
        console.warn(
          `[trade-analyzer] unmatched player: ${name} (${position}) sleeperId=${pid}`,
        );
      }

      assets.push({
        id: pid,
        type: "player",
        name,
        position,
        nflTeam: sp?.team ?? null,
        age: sp?.age ?? null,
        rawValue: match.value ?? 0,
        productionRank: match.rank,
        salary,
        years,
      });
    }

    return {
      rosterId: roster.roster_id,
      owner,
      division,
      totalSalary: Math.round(totalSalary * 10) / 10,
      totalYears,
      capSpace: Math.round((SALARY_CAP - totalSalary) * 10) / 10,
      yearsSpace: YEARS_CAP - totalYears,
      assets,
    };
  });

  // Resolve future-pick ownership: every team owns its own picks unless a
  // traded pick moved them. Sleeper's traded_picks fields are roster ids:
  //   roster_id = the pick's original team, owner_id = current holder.
  const tradedByKey = new Map<string, number>(); // `${season}-${round}-${originalRosterId}` -> currentRosterId
  for (const tp of tradedPicks) {
    if (!seasonWindow.includes(tp.season)) continue;
    if (tp.round < 1 || tp.round > ROOKIE_ROUNDS) continue;
    tradedByKey.set(`${tp.season}-${tp.round}-${tp.roster_id}`, tp.owner_id);
  }

  const teamByRosterId = new Map(teams.map((t) => [t.rosterId, t]));

  for (const season of seasonWindow) {
    for (let round = 1; round <= ROOKIE_ROUNDS; round++) {
      for (const originalTeam of teams) {
        const key = `${season}-${round}-${originalTeam.rosterId}`;
        const currentRosterId = tradedByKey.get(key) ?? originalTeam.rosterId;
        const holder = teamByRosterId.get(currentRosterId);
        if (!holder) continue;

        const slot = roundMidSlot(round);
        const contract = ROOKIE_PICK_CONTRACTS[slot];
        const isOwn = currentRosterId === originalTeam.rosterId;
        const label = isOwn
          ? `${season} ${ORDINAL[round]}`
          : `${season} ${ORDINAL[round]} (${originalTeam.owner})`;

        holder.assets.push({
          id: key,
          type: "pick",
          name: label,
          position: "PICK",
          nflTeam: null,
          age: null,
          rawValue: pickValue(pickIndex, season, round),
          productionRank: null,
          salary: contract?.salary ?? 0,
          years: contract?.years ?? 4,
          pickRound: round,
          pickSeason: season,
          pickOriginalOwner: originalTeam.owner,
          pickSlot: slot,
        });
      }
    }
  }

  if (unmatchedCount > 0) {
    console.warn(`[trade-analyzer] ${unmatchedCount} player(s) had no FantasyCalc value match`);
  }

  // Derive the league's exchange rate from live data: what one league dollar
  // actually buys in production at market = Σ(rostered production) / Σ(rostered
  // salaries). This is the ONLY place production points and dollars touch in the
  // valuation model. Only count matched, salaried players so the ratio reflects
  // real spend (skip $0 mid-season pickups and unmatched players).
  let prodSum = 0;
  let salarySum = 0;
  for (const team of teams) {
    for (const a of team.assets) {
      if (a.type !== "player" || a.salary <= 0 || a.rawValue <= 0) continue;
      prodSum += a.rawValue;
      salarySum += a.salary;
    }
  }
  const valuePerDollar =
    salarySum > 0
      ? Math.round((prodSum / salarySum) * 10) / 10
      : DEFAULT_CONFIG.LEAGUE_VALUE_PER_DOLLAR;
  console.log(
    `[trade-analyzer] LEAGUE_VALUE_PER_DOLLAR = ${valuePerDollar} ` +
      `(Σproduction ${Math.round(prodSum)} / Σsalary ${Math.round(salarySum)}; ` +
      `fallback ${DEFAULT_CONFIG.LEAGUE_VALUE_PER_DOLLAR})`,
  );

  return { teams, generatedAt: Date.now(), unmatchedCount, valuePerDollar };
}
