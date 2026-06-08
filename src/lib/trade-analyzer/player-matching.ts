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

export interface ValueIndex {
  bySleeperId: Map<string, number>;
  byNamePos: Map<string, number>; // key: `${normName}|${pos}`
  fuzzyCandidates: { name: string; pos: string; value: number }[];
}

export function buildValueIndex(entries: FantasyCalcEntry[]): ValueIndex {
  const bySleeperId = new Map<string, number>();
  const byNamePos = new Map<string, number>();
  const fuzzyCandidates: ValueIndex["fuzzyCandidates"] = [];

  for (const entry of entries) {
    const p = entry.player;
    if (!p) continue;
    const pos = (p.position || "").toUpperCase();
    if (pos === "PICK") continue; // picks are matched separately

    // Manual overrides win.
    const overrideSleeperId = FANTASYCALC_TO_SLEEPER_OVERRIDES[p.id];
    if (overrideSleeperId) bySleeperId.set(overrideSleeperId, entry.value);

    if (p.sleeperId) bySleeperId.set(String(p.sleeperId), entry.value);

    const norm = normalizeName(p.name || "");
    if (norm) {
      byNamePos.set(`${norm}|${pos}`, entry.value);
      fuzzyCandidates.push({ name: norm, pos, value: entry.value });
    }
  }

  return { bySleeperId, byNamePos, fuzzyCandidates };
}

export interface MatchResult {
  value: number | null;
  method: "override" | "sleeperId" | "namePos" | "fuzzy" | "none";
}

export function matchPlayerValue(
  sleeperId: string,
  fullName: string,
  position: string,
  index: ValueIndex,
): MatchResult {
  const direct = index.bySleeperId.get(sleeperId);
  if (direct !== undefined) return { value: direct, method: "sleeperId" };

  const pos = (position || "").toUpperCase();
  const norm = normalizeName(fullName);
  const exact = index.byNamePos.get(`${norm}|${pos}`);
  if (exact !== undefined) return { value: exact, method: "namePos" };

  // Fuzzy: closest name within the same position, distance <= 2.
  let best: { value: number; dist: number } | null = null;
  for (const cand of index.fuzzyCandidates) {
    if (cand.pos !== pos) continue;
    const dist = levenshtein(norm, cand.name);
    if (dist <= 2 && (!best || dist < best.dist)) {
      best = { value: cand.value, dist };
    }
  }
  if (best) return { value: best.value, method: "fuzzy" };

  return { value: null, method: "none" };
}
