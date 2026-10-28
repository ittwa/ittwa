#!/usr/bin/env node
// Builds src/lib/playoff-odds-model.ts — playoff / bye / semis / final / title
// odds for every record after every week of ITTWA's regular season.
//
// How it works
// ------------
// We only have published "playoff chances by record" data for one week
// (Roster Audit, after Week 7, pooled across thousands of Sleeper leagues).
// To extrapolate to other weeks we simulate whole seasons:
//
//   • Each team has a true strength μ ~ Normal(0, r²). Each week it scores
//     μ + Normal(0, 1) — i.e. scores are in units of one week's noise.
//   • r is the only free parameter: how much teams really differ vs. how much
//     a single week is luck. Bigger r → records are more predictive.
//   • Calibration: simulate a generic 12-team, 6-playoff-team league, then
//     pick the r whose after-Week-7 curves best match Roster Audit's table.
//     Their data pools many formats (some with more playoff spots), which
//     shifts every curve up or down a bit, so we fit on the logit scale with a
//     per-outcome offset: r is fit to the *shape* of each curve (how fast odds
//     change per win), not its level.
//   • Then run ITTWA's actual format with that r for every week: 2025's real
//     14-week schedule (division rivals twice), 4 division winners seeded 1–4
//     + 2 wild cards, top 2 byes, 3v6 / 4v5, re-seed for semis, and 3-point
//     home-field advantage to the higher seed.
//
// Usage: node scripts/build-playoff-odds.mjs [--seasons 2000000] [--r 0.27]
//   --r skips calibration and uses the given strength spread.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_PATH = path.join(root, "src", "lib", "playoff-odds-model.ts");

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const SEASONS = Number(argVal("--seasons") ?? 2_000_000);
const FIXED_R = argVal("--r") !== undefined ? Number(argVal("--r")) : undefined;

// Roster Audit, "Playoff Chances By Record After Week 7".
// wins → [playoffs, bye, semis, final, title] in percent.
const SOURCE_WEEK = 7;
const SOURCE = {
  7: [99.5, 86.8, 93.8, 53.4, 28.7],
  6: [97.5, 64.7, 84.0, 43.6, 22.8],
  5: [89.1, 35.8, 66.9, 32.2, 16.1],
  4: [68.3, 13.2, 44.7, 19.5, 9.5],
  3: [38.9, 2.9, 23.1, 9.5, 4.5],
  2: [13.9, 0.4, 7.8, 3.0, 1.4],
  1: [3.0, 0.0, 1.6, 0.6, 0.3],
  0: [0.3, 0.0, 0.2, 0.1, 0.0],
};

// --- ITTWA format ---

const TEAMS = 12;
const REG_WEEKS = 14;
// ITTWA weekly scores have a standard deviation of ~21 points (2014–2025), so
// the 3-point playoff home-field advantage is ~0.14 of one week's noise.
const HFA = 3 / 21;

const DIVISIONS = [
  ["Clancy", "Collins", "Katz"],
  ["Chapman", "Albarran", "Durkin"],
  ["Peterson", "Cummings", "Bohne"],
  ["HoganLamb", "Brown", "Williams"],
];
const OWNERS = DIVISIONS.flat();
const DIV_OF = OWNERS.map((o) => DIVISIONS.findIndex((d) => d.includes(o)));

// Schedule template: the real 2025 regular season (14 weeks).
const SCHEDULE_SEASON = "2025";
const scoreRows = JSON.parse(readFileSync(path.join(root, "data", "scores-history.json"), "utf8")).rows;
const SCHEDULE = [];
for (let w = 1; w <= REG_WEEKS; w++) {
  const opp = new Int8Array(TEAMS).fill(-1);
  for (const r of scoreRows) {
    if (r.season !== SCHEDULE_SEASON || r.week !== w || r.playoffType) continue;
    opp[OWNERS.indexOf(r.owner)] = OWNERS.indexOf(r.opponent);
  }
  if (opp.some((o) => o < 0)) throw new Error(`Incomplete ${SCHEDULE_SEASON} schedule in week ${w}`);
  SCHEDULE.push(opp);
}

// --- Simulator ---

function makeRng(seed) {
  // mulberry32 — seeded so the generated file is reproducible.
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const gauss = () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u, v, q;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      q = u * u + v * v;
    } while (q >= 1 || q === 0);
    const m = Math.sqrt((-2 * Math.log(q)) / q);
    spare = v * m;
    return u * m;
  };
  return { rand, gauss };
}

// Outcome bit flags
const PO = 1, BYE = 2, SEMI = 4, FINAL = 8, TITLE = 16;
const FLAGS = [PO, BYE, SEMI, FINAL, TITLE];

/**
 * Simulate `n` seasons. Returns acc[week][wins] = Float64Array(6):
 * [teams, playoffs, bye, semis, final, title] counts for every team that had
 * `wins` wins after `week` games (week 1..REG_WEEKS-1).
 * `ittwa` = true uses ITTWA's schedule + division seeding; false is a generic
 * top-6 league with random weekly pairings (for calibration).
 */
function simulate({ r, n, seed, ittwa }) {
  const { rand, gauss } = makeRng(seed);
  const acc = [];
  for (let k = 1; k < REG_WEEKS; k++) acc[k] = Array.from({ length: k + 1 }, () => new Float64Array(6));

  const mu = new Float64Array(TEAMS);
  const wins = new Int16Array(TEAMS);
  const pf = new Float64Array(TEAMS);
  const sc = new Float64Array(TEAMS);
  const out = new Uint8Array(TEAMS);
  const winsAt = Array.from({ length: REG_WEEKS }, () => new Int16Array(TEAMS));
  const ids = [...Array(TEAMS).keys()];
  const perm = ids.slice();

  // Higher seed is at home: +HFA. Returns the winner.
  const game = (hi, lo) => (mu[hi] + gauss() + HFA > mu[lo] + gauss() ? hi : lo);

  for (let it = 0; it < n; it++) {
    for (let i = 0; i < TEAMS; i++) {
      mu[i] = r * gauss();
      wins[i] = 0;
      pf[i] = 0;
      out[i] = 0;
    }

    for (let w = 0; w < REG_WEEKS; w++) {
      for (let i = 0; i < TEAMS; i++) {
        sc[i] = mu[i] + gauss();
        pf[i] += sc[i];
      }
      if (ittwa) {
        const opp = SCHEDULE[w];
        for (let i = 0; i < TEAMS; i++) if (sc[i] > sc[opp[i]]) wins[i]++;
      } else {
        for (let i = TEAMS - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        for (let i = 0; i < TEAMS; i += 2) wins[sc[perm[i]] > sc[perm[i + 1]] ? perm[i] : perm[i + 1]]++;
      }
      winsAt[w].set(wins);
    }

    // Standings: wins, then points for. (ITTWA's real cascade is H2H →
    // division record → PF; PF alone is close enough for a record-only model.)
    const order = ids.slice().sort((a, b) => wins[b] - wins[a] || pf[b] - pf[a]);
    let seeds;
    if (ittwa) {
      const seen = new Set();
      const divWinners = [];
      const rest = [];
      for (const t of order) {
        if (!seen.has(DIV_OF[t])) {
          seen.add(DIV_OF[t]);
          divWinners.push(t);
        } else rest.push(t);
      }
      seeds = [...divWinners, rest[0], rest[1]];
    } else {
      seeds = order.slice(0, 6);
    }
    const seedOf = (t) => seeds.indexOf(t);

    for (const t of seeds) out[t] |= PO;
    out[seeds[0]] |= BYE | SEMI;
    out[seeds[1]] |= BYE | SEMI;
    const w36 = game(seeds[2], seeds[5]);
    const w45 = game(seeds[3], seeds[4]);
    // Re-seed: #1 plays the lowest remaining seed.
    const [hiWc, loWc] = seedOf(w36) < seedOf(w45) ? [w36, w45] : [w45, w36];
    out[hiWc] |= SEMI;
    out[loWc] |= SEMI;
    const f1 = game(seeds[0], loWc);
    const f2 = game(seeds[1], hiWc);
    out[f1] |= FINAL;
    out[f2] |= FINAL;
    out[seedOf(f1) < seedOf(f2) ? game(f1, f2) : game(f2, f1)] |= TITLE;

    for (let k = 1; k < REG_WEEKS; k++) {
      const row = acc[k];
      const wk = winsAt[k - 1];
      for (let i = 0; i < TEAMS; i++) {
        const a = row[wk[i]];
        a[0]++;
        for (let f = 0; f < 5; f++) if (out[i] & FLAGS[f]) a[f + 1]++;
      }
    }
  }
  return acc;
}

// --- Calibration ---

const clip = (p) => Math.min(Math.max(p, 0.002), 0.998);
const logit = (p) => Math.log(clip(p) / (1 - clip(p)));

/** Weighted logit-scale misfit vs. SOURCE, after the best per-outcome offset. */
function misfit(acc) {
  let total = 0;
  for (let o = 0; o < 5; o++) {
    const pts = [];
    for (let w = 0; w <= SOURCE_WEEK; w++) {
      const p = SOURCE[w][o] / 100;
      if (p <= 0) continue; // "0%" / "almost none" carries no shape information
      const a = acc[SOURCE_WEEK][w];
      pts.push({ diff: logit(p) - logit(a[o + 1] / a[0]), wt: clip(p) * (1 - clip(p)) });
    }
    const sw = pts.reduce((s, x) => s + x.wt, 0);
    const offset = pts.reduce((s, x) => s + x.wt * x.diff, 0) / sw;
    total += pts.reduce((s, x) => s + x.wt * (x.diff - offset) ** 2, 0);
  }
  return total;
}

let r = FIXED_R;
if (r === undefined) {
  console.log("Calibrating strength spread against the Week 7 source table…");
  let best = { r: NaN, err: Infinity };
  for (let cand = 0.12; cand <= 0.481; cand += 0.03) {
    const err = misfit(simulate({ r: cand, n: 150_000, seed: 11, ittwa: false }));
    console.log(`  r=${cand.toFixed(2)}  misfit=${err.toFixed(4)}`);
    if (err < best.err) best = { r: cand, err };
  }
  r = Math.round(best.r * 100) / 100;
}
console.log(`Using r = ${r}. Simulating ${SEASONS.toLocaleString()} ITTWA seasons…`);

const acc = simulate({ r, n: SEASONS, seed: 2026, ittwa: true });

// --- Post-process: percentages, monotone in wins, nested outcomes ---

const round2 = (x) => Math.round(x * 100) / 100;
const odds = {};
for (let k = 1; k < REG_WEEKS; k++) {
  const rows = acc[k].map((a) => (a[0] > 0 ? [1, 2, 3, 4, 5].map((o) => (100 * a[o]) / a[0]) : null));
  // A record that never occurred in simulation (e.g. 13-0) inherits its neighbor.
  for (let w = 0; w <= k; w++) if (!rows[w]) rows[w] = w > 0 && rows[w - 1] ? rows[w - 1].slice() : [0, 0, 0, 0, 0];
  // Simulation noise can make a tail cell dip below the record one win worse.
  for (let w = 1; w <= k; w++) for (let o = 0; o < 5; o++) rows[w][o] = Math.max(rows[w][o], rows[w - 1][o]);
  for (const row of rows) {
    row[2] = Math.min(row[2], row[0]); // semis ≤ playoffs
    row[1] = Math.min(row[1], row[2]); // bye ≤ semis
    row[3] = Math.min(row[3], row[2]); // final ≤ semis
    row[4] = Math.min(row[4], row[3]); // title ≤ final
  }
  odds[k] = rows.map((row) => row.map(round2));
}

const fmtRow = (row) => `[${row.join(", ")}]`;
const body = Object.entries(odds)
  .map(([k, rows]) => `  ${k}: [\n${rows.map((row, w) => `    ${fmtRow(row)}, // ${w}-${k - w}`).join("\n")}\n  ],`)
  .join("\n");
const sourceBody = Object.entries(SOURCE)
  .sort((a, b) => Number(b[0]) - Number(a[0]))
  .map(([w, row]) => `  ${w}: ${fmtRow(row)},`)
  .join("\n");

const file = `// GENERATED by scripts/build-playoff-odds.mjs — do not edit by hand.
// Re-run \`npm run build-playoff-odds\` to regenerate.

/** Simulation parameters used to generate MODEL_ODDS. */
export const MODEL_PARAMS = {
  /** Team strength spread, in units of one week's scoring noise (calibrated). */
  strengthSpread: ${r},
  /** Playoff home-field advantage, same units (3 pts ÷ ~21-pt weekly SD). */
  homeField: ${round2(HFA)},
  seasonsSimulated: ${SEASONS},
  scheduleTemplate: "${SCHEDULE_SEASON}",
} as const;

/** Week of the published source table the model is calibrated to. */
export const SOURCE_WEEK = ${SOURCE_WEEK};

/**
 * Roster Audit, "Playoff Chances By Record After Week ${SOURCE_WEEK}" (pooled Sleeper
 * leagues). wins → [playoffs, bye, semis, final, title] %.
 */
export const SOURCE_ODDS: Record<number, readonly number[]> = {
${sourceBody}
};

/**
 * MODEL_ODDS[week][wins] → [playoffs, bye, semis, final, title] % for an ITTWA
 * team with that record after that many games.
 */
export const MODEL_ODDS: Record<number, readonly (readonly number[])[]> = {
${body}
};
`;

writeFileSync(OUT_PATH, file);
console.log(`Wrote ${path.relative(root, OUT_PATH)}`);
