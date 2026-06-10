import type { FantasyCalcEntry } from "@/lib/fantasycalc";
import { FANTASYCALC_TO_SLEEPER_OVERRIDES } from "./overrides";

// Maps FantasyCalc player values onto Sleeper player ids so the analyzer can
// attach a dynasty value to each rostered player.
//
// Strategy, in order:
//   1. Manual override map (overrides.ts)
//   2. FantasyCalc's own sleeperId field (present for most players)
//   3. Normalized full name + position exact match
//   4. Fuzzy name match (Levenshtein <= 2) within the same position
// Anything that still fails to match is reported for manual override.

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'`]/g, "")
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .join(" ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// A matched FantasyCalc entry: its dynasty value plus positional rank (1 = best
// at the position), which the valuation model uses to pick an expected-salary
// tier and to decide startability.
export interface PlayerValue {
  value: number;
  rank: number | null;
}

export interface ValueIndex {
  bySleeperId: Map<string, PlayerValue>;
  byNamePos: Map<string, PlayerValue>; // key: `${normName}|${pos}`
  fuzzyCandidates: { name: string; pos: string; value: PlayerValue }[];
}

export function buildValueIndex(entries: FantasyCalcEntry[]): ValueIndex {
  const bySleeperId = new Map<string, PlayerValue>();
  const byNamePos = new Map<string, PlayerValue>();
  const fuzzyCandidates: ValueIndex["fuzzyCandidates"] = [];

  // FantasyCalc supplies positionRank directly, but fall back to a value-derived
  // rank within position when it's missing so the model always has a tier signal.
  const seenByPos = new Map<string, number>();

  for (const entry of entries) {
    const p = entry.player;
    if (!p) continue;
    const pos = (p.position || "").toUpperCase();
    if (pos === "PICK") continue; // picks are matched separately

    const fallbackRank = (seenByPos.get(pos) ?? 0) + 1;
    seenByPos.set(pos, fallbackRank);
    const pv: PlayerValue = {
      value: entry.value,
      rank: entry.positionRank ?? fallbackRank,
    };

    // Manual overrides win.
    const overrideSleeperId = FANTASYCALC_TO_SLEEPER_OVERRIDES[p.id];
    if (overrideSleeperId) bySleeperId.set(overrideSleeperId, pv);

    if (p.sleeperId) bySleeperId.set(String(p.sleeperId), pv);

    const norm = normalizeName(p.name || "");
    if (norm) {
      byNamePos.set(`${norm}|${pos}`, pv);
      fuzzyCandidates.push({ name: norm, pos, value: pv });
    }
  }

  return { bySleeperId, byNamePos, fuzzyCandidates };
}

export interface MatchResult {
  value: number | null;
  rank: number | null;
  method: "override" | "sleeperId" | "namePos" | "fuzzy" | "none";
}

export function matchPlayerValue(
  sleeperId: string,
  fullName: string,
  position: string,
  index: ValueIndex,
): MatchResult {
  const direct = index.bySleeperId.get(sleeperId);
  if (direct !== undefined) return { value: direct.value, rank: direct.rank, method: "sleeperId" };

  const pos = (position || "").toUpperCase();
  const norm = normalizeName(fullName);
  const exact = index.byNamePos.get(`${norm}|${pos}`);
  if (exact !== undefined) return { value: exact.value, rank: exact.rank, method: "namePos" };

  // Fuzzy: closest name within the same position, distance <= 2.
  let best: { value: PlayerValue; dist: number } | null = null;
  for (const cand of index.fuzzyCandidates) {
    if (cand.pos !== pos) continue;
    const dist = levenshtein(norm, cand.name);
    if (dist <= 2 && (!best || dist < best.dist)) {
      best = { value: cand.value, dist };
    }
  }
  if (best) return { value: best.value.value, rank: best.value.rank, method: "fuzzy" };

  return { value: null, rank: null, method: "none" };
}
