// Tag Tracker — derives Tag History, Tag Insights, and Tag Eligibility from
// the Contracts sheet. No new data source: reuses getContracts() from
// lib/sheets.ts (a Do-Not-Touch file) exactly as-is.
//
// Everything here is pure/derived — no fetching happens outside getContracts()
// itself. If the sheet is unreachable, we fall back to bundled sample data
// (sample-data/contracts-sample.ts) so the page never renders blank.

import { getContracts } from "@/lib/sheets";
import { filterActiveContracts, resolveOwnerName } from "@/lib/contracts";
import type { ContractRow } from "@/types/contracts";
import {
  TAG_RULES,
  FRANCHISE_TAG_DEADLINE_MONTH,
  FRANCHISE_TAG_DEADLINE_WEEKDAY,
  FRANCHISE_TAG_DEADLINE_NTH,
} from "@/lib/tag-config";
import { SAMPLE_CONTRACTS } from "../../sample-data/contracts-sample";
import type {
  TagTrackerData,
  TagHistoryEntry,
  FranchiseBasis,
  DraftPickInfo,
  PositionSeasonPoint,
  PositionAverage,
  OwnerTagStat,
  BasisBreakdown,
  CalloutStats,
  TagInsights,
  EligibleFranchisePlayer,
  EligibleFifthYearPlayer,
  OwnerEligibility,
  TagEligibility,
} from "@/types/tags";

// ── Small shared helpers ────────────────────────────────────────────────────

function isRealPlayerRow(c: ContractRow): boolean {
  // The Contracts sheet also carries "Draft Pick" rows (future picks tracked
  // as tradeable assets, e.g. "2026 1st - Clancy") — not real players.
  return c.position !== "Draft Pick";
}

function playerKey(c: ContractRow): string {
  return c.playerId && c.playerId !== "#N/A" && c.playerId !== "N/A" && c.playerId !== ""
    ? c.playerId
    : c.player.toLowerCase().trim();
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

// Draft Pick ID: exactly 6 digits, first 4 = season, last 2 = zero-padded
// overall pick (01-36). Anything else is malformed — logged and treated as
// "not rookie-drafted" per spec, never thrown.
function parseDraftPickId(id: string | undefined, context: { player: string; season: string }): DraftPickInfo | null {
  const trimmed = (id || "").trim();
  if (!trimmed) return null;
  if (!/^\d{6}$/.test(trimmed)) {
    console.warn(`[tags] malformed Draft Pick ID "${trimmed}" for ${context.player} (${context.season}) — treating as not rookie-drafted`);
    return null;
  }
  const season = trimmed.slice(0, 4);
  const overallPick = parseInt(trimmed.slice(4), 10);
  if (overallPick < 1 || overallPick > 36) {
    console.warn(`[tags] Draft Pick ID "${trimmed}" for ${context.player} (${context.season}) has an out-of-range pick number — treating as not rookie-drafted`);
    return null;
  }
  const round = overallPick <= 12 ? 1 : overallPick <= 24 ? 2 : 3;
  return { season, overallPick, round };
}

function positionSalariesInSeason(rows: ContractRow[], position: string, season: string): number[] {
  return rows
    .filter((r) => r.position === position && r.season === season)
    .map((r) => r.salary)
    .sort((a, b) => b - a);
}

function topNAverage(salaries: number[], n: number): { avg: number; usedCount: number } | null {
  if (salaries.length === 0) return null;
  const top = salaries.slice(0, n);
  const avg = top.reduce((s, v) => s + v, 0) / top.length;
  return { avg: Math.round(avg * 10) / 10, usedCount: top.length };
}

// Third Friday in June (or any nth-weekday-of-month) for the franchise tag deadline.
function nthWeekdayOfMonth(year: number, monthIndex0: number, weekday: number, n: number): Date {
  const first = new Date(year, monthIndex0, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, monthIndex0, day);
}

// ── Basis: back-compute which formula produced a historical franchise tag ──

function determineBasis(tagSalary: number, prevOwnSalary: number | null, top5Avg: number | null): FranchiseBasis {
  const tol = TAG_RULES.BASIS_MATCH_TOLERANCE;
  const pct120 = prevOwnSalary != null ? Math.round(prevOwnSalary * TAG_RULES.FRANCHISE_FIRST_TAG_PCT * 10) / 10 : null;
  const matchesTop5 = top5Avg != null && Math.abs(tagSalary - top5Avg) <= tol;
  const matches120 = pct120 != null && Math.abs(tagSalary - pct120) <= tol;
  if (matchesTop5 && matches120) {
    // Both match (rule says take the greater of the two) — prefer whichever is larger.
    return (top5Avg as number) >= (pct120 as number) ? "Top-5 Positional Average" : "120% of Previous Salary";
  }
  if (matchesTop5) return "Top-5 Positional Average";
  if (matches120) return "120% of Previous Salary";
  return "Unknown";
}

// ── Tag History ──────────────────────────────────────────────────────────

function buildFranchiseHistory(activeRows: ContractRow[]): TagHistoryEntry[] {
  const tagged = activeRows.filter((c) => c.franchiseTag);
  const byPlayer = new Map<string, ContractRow[]>();
  for (const c of tagged) {
    const key = playerKey(c);
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(c);
  }

  const entries: TagHistoryEntry[] = [];
  for (const [key, rows] of byPlayer) {
    const sorted = [...rows].sort((a, b) => a.season.localeCompare(b.season));
    let streak = 0;
    let prevSeasonNum: number | null = null;

    for (const c of sorted) {
      const seasonNum = parseInt(c.season, 10);
      streak = prevSeasonNum !== null && seasonNum === prevSeasonNum + 1 ? streak + 1 : 1;
      prevSeasonNum = seasonNum;

      const consecutiveLabel = streak >= 2 ? `${ordinal(streak)} Consecutive` : null;
      let basis: FranchiseBasis;
      let incompleteData = false;

      if (streak >= 2) {
        // 2nd/3rd+ consecutive tags follow the consecutive formula, not the
        // top-N-vs-120% comparison — that only applies to a standalone/first tag.
        basis = "Consecutive Tag Formula";
      } else {
        const prevSeason = String(seasonNum - 1);
        const ownPrev = activeRows.find((r) => playerKey(r) === key && r.season === prevSeason);
        const top5 = topNAverage(positionSalariesInSeason(activeRows, c.position, prevSeason), TAG_RULES.FRANCHISE_TOP_N);
        basis = determineBasis(c.salary, ownPrev?.salary ?? null, top5?.avg ?? null);
        if (!ownPrev && !top5) incompleteData = true;
      }

      entries.push({
        key: `ft-${key}-${c.season}`,
        playerId: c.playerId,
        player: c.player,
        position: c.position,
        owner: resolveOwnerName(c.owner),
        season: c.season,
        salary: c.salary,
        tagType: "franchise",
        consecutiveLabel,
        basis,
        pickSlot: null,
        incompleteData,
      });
    }
  }
  return entries;
}

// 5th-year tag flag usage is inconsistent in the sheet's real history (see
// project notes) — rather than guess which row "really" represents the
// option year, every row flagged Y becomes its own history entry, verbatim,
// with its own season and salary. This can never misrepresent the sheet,
// only reflect it exactly.
function buildFifthYearHistory(activeRows: ContractRow[]): TagHistoryEntry[] {
  return activeRows
    .filter((c) => c.fifthYearTag)
    .map((c) => {
      const pick = parseDraftPickId(c.draftPickId, { player: c.player, season: c.season });
      return {
        key: `5yt-${playerKey(c)}-${c.season}`,
        playerId: c.playerId,
        player: c.player,
        position: c.position,
        owner: resolveOwnerName(c.owner),
        season: c.season,
        salary: c.salary,
        tagType: "fifth-year" as const,
        consecutiveLabel: null,
        basis: null,
        pickSlot: pick,
        incompleteData: pick === null,
      };
    });
}

function buildTagHistory(activeRows: ContractRow[]): TagHistoryEntry[] {
  return [...buildFranchiseHistory(activeRows), ...buildFifthYearHistory(activeRows)].sort(
    (a, b) => b.season.localeCompare(a.season) || a.player.localeCompare(b.player),
  );
}

// ── Tag Insights ─────────────────────────────────────────────────────────
// Position-over-time and avg-by-position are franchise-tag-only: 5th-year
// option salaries use a different (75%-multiplier) formula, so blending them
// into the same market-inflation trend would compare apples to oranges.

function buildPositionOverTime(franchiseEntries: TagHistoryEntry[]): PositionSeasonPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const e of franchiseEntries) {
    const key = `${e.season}|${e.position}`;
    const b = buckets.get(key) || { sum: 0, count: 0 };
    b.sum += e.salary;
    b.count += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([key, b]) => {
      const [season, position] = key.split("|");
      return { season, position, avgSalary: Math.round((b.sum / b.count) * 10) / 10, count: b.count };
    })
    .sort((a, b) => a.season.localeCompare(b.season) || a.position.localeCompare(b.position));
}

function buildAvgByPosition(franchiseEntries: TagHistoryEntry[]): PositionAverage[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const e of franchiseEntries) {
    const b = buckets.get(e.position) || { sum: 0, count: 0 };
    b.sum += e.salary;
    b.count += 1;
    buckets.set(e.position, b);
  }
  return [...buckets.entries()]
    .map(([position, b]) => ({ position, avgSalary: Math.round((b.sum / b.count) * 10) / 10, count: b.count }))
    .sort((a, b) => b.avgSalary - a.avgSalary);
}

function buildTagsByOwner(allEntries: TagHistoryEntry[]): OwnerTagStat[] {
  const buckets = new Map<string, { f: number; fy: number }>();
  for (const e of allEntries) {
    const b = buckets.get(e.owner) || { f: 0, fy: 0 };
    if (e.tagType === "franchise") b.f += 1;
    else b.fy += 1;
    buckets.set(e.owner, b);
  }
  return [...buckets.entries()]
    .map(([owner, b]) => ({ owner, franchiseCount: b.f, fifthYearCount: b.fy }))
    .sort((a, b) => b.franchiseCount + b.fifthYearCount - (a.franchiseCount + a.fifthYearCount));
}

function buildBasisBreakdown(franchiseEntries: TagHistoryEntry[]): BasisBreakdown {
  let topN = 0;
  let pct120 = 0;
  let unknown = 0;
  for (const e of franchiseEntries) {
    if (e.consecutiveLabel) continue; // only standalone/first tags have a real basis choice
    if (e.basis === "Top-5 Positional Average") topN++;
    else if (e.basis === "120% of Previous Salary") pct120++;
    else unknown++;
  }
  return { topN, pct120, unknown };
}

function buildCallouts(allEntries: TagHistoryEntry[], currentSeasonNum: number): CalloutStats {
  const withSalary = allEntries.filter((e) => e.salary > 0);
  const largest = withSalary.length ? withSalary.reduce((a, b) => (b.salary > a.salary ? b : a)) : null;
  const cheapest = withSalary.length ? withSalary.reduce((a, b) => (b.salary < a.salary ? b : a)) : null;

  const countByPlayer = new Map<string, { player: string; count: number }>();
  for (const e of allEntries) {
    if (e.tagType !== "franchise") continue; // "most tagged" tracks repeat franchise use, the interesting recurring stat
    const c = countByPlayer.get(e.playerId || e.player) || { player: e.player, count: 0 };
    c.count += 1;
    countByPlayer.set(e.playerId || e.player, c);
  }
  const mostTagged = [...countByPlayer.values()].sort((a, b) => b.count - a.count)[0] || null;

  const deadlineYear = currentSeasonNum + 1;
  const deadline = nthWeekdayOfMonth(deadlineYear, FRANCHISE_TAG_DEADLINE_MONTH, FRANCHISE_TAG_DEADLINE_WEEKDAY, FRANCHISE_TAG_DEADLINE_NTH);
  const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / 86400000);

  return {
    largestTag: largest ? { player: largest.player, season: largest.season, salary: largest.salary, tagType: largest.tagType } : null,
    cheapestTag: cheapest ? { player: cheapest.player, season: cheapest.season, salary: cheapest.salary, tagType: cheapest.tagType } : null,
    mostTaggedPlayer: mostTagged && mostTagged.count > 1 ? mostTagged : null,
    nextDeadline: deadline.toISOString(),
    daysUntilDeadline,
  };
}

// ── Tag Eligibility (forward-looking) ───────────────────────────────────

function buildFranchiseEligible(activeRows: ContractRow[], currentSeason: string): Map<string, EligibleFranchisePlayer[]> {
  const currentSeasonNum = parseInt(currentSeason, 10);
  // "rostered and under contract at the end of the previous season" whose
  // deal expires at the end of THIS (current) season == years remaining is 1.
  const candidates = activeRows.filter((c) => c.season === currentSeason && c.years === 1);

  const result = new Map<string, EligibleFranchisePlayer[]>();
  for (const c of candidates) {
    const key = playerKey(c);
    let projectedTagSalary: number;
    let projectionLabel: string;
    let incompleteData = false;

    if (c.franchiseTag) {
      // Already tagged this season — project the NEXT consecutive tag off the
      // current streak length (walking backward through prior seasons).
      let streak = 1;
      let s = currentSeasonNum - 1;
      while (activeRows.some((r) => playerKey(r) === key && r.season === String(s) && r.franchiseTag)) {
        streak += 1;
        s -= 1;
      }
      const nextStreak = streak + 1;
      projectedTagSalary = Math.round(c.salary * TAG_RULES.FRANCHISE_CONSECUTIVE_PCT * 10) / 10;
      projectionLabel = `${ordinal(nextStreak)} Consecutive Tag`;
    } else {
      // A NEW tag for the upcoming offseason compares against THIS (about to
      // expire) season's own data, since that becomes "the previous season"
      // relative to the tag year.
      const top5 = topNAverage(positionSalariesInSeason(activeRows, c.position, currentSeason), TAG_RULES.FRANCHISE_TOP_N);
      const pct120 = Math.round(c.salary * TAG_RULES.FRANCHISE_FIRST_TAG_PCT * 10) / 10;
      projectedTagSalary = Math.max(top5?.avg ?? 0, pct120);
      projectionLabel = "New Tag";
      if (!top5) incompleteData = true;
    }

    const entry: EligibleFranchisePlayer = {
      playerId: c.playerId,
      player: c.player,
      position: c.position,
      owner: resolveOwnerName(c.owner),
      expiringSalary: c.salary,
      projectedTagSalary: Math.round(projectedTagSalary * 10) / 10,
      projectionLabel,
      incompleteData,
    };

    if (!result.has(entry.owner)) result.set(entry.owner, []);
    result.get(entry.owner)!.push(entry);
  }
  return result;
}

function buildFifthYearEligible(activeRows: ContractRow[], currentSeason: string): Map<string, EligibleFifthYearPlayer[]> {
  const currentSeasonNum = parseInt(currentSeason, 10);
  const result = new Map<string, EligibleFifthYearPlayer[]>();

  for (const c of activeRows) {
    if (c.season !== currentSeason) continue;
    const pick = parseDraftPickId(c.draftPickId, { player: c.player, season: c.season });
    if (!pick || pick.round !== 1) continue;
    const draftYearNum = parseInt(pick.season, 10);
    if (draftYearNum + TAG_RULES.FIFTH_YEAR_DECLARE_AFTER_ROOKIE_SEASON !== currentSeasonNum) continue;

    const isEarlyTier = pick.overallPick <= 6;
    const topN = isEarlyTier ? TAG_RULES.FIFTH_YEAR_TOP_N_EARLY : TAG_RULES.FIFTH_YEAR_TOP_N_LATE;
    const avgResult = topNAverage(positionSalariesInSeason(activeRows, c.position, currentSeason), topN);
    const projected = avgResult ? Math.round(avgResult.avg * TAG_RULES.FIFTH_YEAR_MULTIPLIER * 10) / 10 : 0;

    const entry: EligibleFifthYearPlayer = {
      playerId: c.playerId,
      player: c.player,
      position: c.position,
      owner: resolveOwnerName(c.owner),
      pickSlot: pick,
      currentSalary: c.salary,
      projectedOptionSalary: projected,
      averagedFewerThanRequired: !!avgResult && avgResult.usedCount < topN,
    };

    if (!result.has(entry.owner)) result.set(entry.owner, []);
    result.get(entry.owner)!.push(entry);
  }
  return result;
}

// ── Main entry point ─────────────────────────────────────────────────────

export async function getTagTrackerData(): Promise<TagTrackerData> {
  let rawContracts = await getContracts();
  let usingSampleData = false;
  if (rawContracts.length === 0) {
    usingSampleData = true;
    rawContracts = SAMPLE_CONTRACTS;
  }

  const realRows = rawContracts.filter(isRealPlayerRow);
  const activeRows = filterActiveContracts(realRows);

  const dataWarnings: string[] = [];
  if (activeRows.length === 0) {
    dataWarnings.push("No active player contract rows were found in the Contracts sheet.");
  }

  const history = buildTagHistory(activeRows);
  const franchiseEntries = history.filter((e) => e.tagType === "franchise");

  const seasonNums = activeRows.map((r) => parseInt(r.season, 10)).filter(Number.isFinite);
  const currentSeasonNum = seasonNums.length ? Math.max(...seasonNums) : new Date().getFullYear();
  const currentSeason = String(currentSeasonNum);

  const insights: TagInsights = {
    positionOverTime: buildPositionOverTime(franchiseEntries),
    avgFranchiseTagByPosition: buildAvgByPosition(franchiseEntries),
    tagsByOwner: buildTagsByOwner(history),
    basisBreakdown: buildBasisBreakdown(franchiseEntries),
    callouts: buildCallouts(history, currentSeasonNum),
  };

  const franchiseByOwner = buildFranchiseEligible(activeRows, currentSeason);
  const fifthYearByOwner = buildFifthYearEligible(activeRows, currentSeason);
  const allOwners = new Set([...franchiseByOwner.keys(), ...fifthYearByOwner.keys()]);
  const byOwner: OwnerEligibility[] = [...allOwners].sort().map((owner) => ({
    owner,
    franchiseEligible: (franchiseByOwner.get(owner) || []).sort((a, b) => b.projectedTagSalary - a.projectedTagSalary),
    fifthYearEligible: (fifthYearByOwner.get(owner) || []).sort((a, b) => b.projectedOptionSalary - a.projectedOptionSalary),
  }));

  const deadlineYear = currentSeasonNum + 1;
  const deadline = nthWeekdayOfMonth(deadlineYear, FRANCHISE_TAG_DEADLINE_MONTH, FRANCHISE_TAG_DEADLINE_WEEKDAY, FRANCHISE_TAG_DEADLINE_NTH);

  const eligibility: TagEligibility = {
    currentSeason,
    upcomingOffseasonYear: String(deadlineYear),
    deadline: deadline.toISOString(),
    byOwner,
  };

  return { history, insights, eligibility, usingSampleData, dataWarnings };
}
