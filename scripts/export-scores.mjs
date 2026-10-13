#!/usr/bin/env node
// Snapshots the Google Sheets "Scores" tab (historical game-by-game results,
// 2014–present) to data/scores-history.json so the league's history survives
// even if the Sheet or the Sleeper API ever becomes unreachable.
//
// Usage: npm run export-scores
// Requires GOOGLE_API_KEY (reads .env.local if present, same as the app).

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_PATH = path.join(root, "data", "scores-history.json");

function loadDotEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvLocal();

const SHEETS_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || "17kspYjtSNtiBuUxbdWYkHbP8Y5K7qs0nJ-D1VA-Wpwo";
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("GOOGLE_API_KEY is not set (checked process.env and .env.local). Aborting.");
  process.exit(1);
}

function parseNum(val, fallback = 0) {
  if (!val) return fallback;
  const cleaned = String(val).replace("$", "").replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "#N/A" || cleaned === "N/A" || cleaned === "#REF!" || cleaned === "#VALUE!") {
    return fallback;
  }
  const n = Number(cleaned);
  return Number.isNaN(n) ? fallback : n;
}

// Mirrors ScoreRow parsing in src/lib/sheets.ts getScores() — duplicated here
// since this is a plain Node script with no TS/path-alias loader.
async function fetchScores() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent("Scores")}!A2:L?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Sheets API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const rows = data.values || [];

  return rows
    .filter((row) => row.length >= 6 && row[2])
    .map((row) => ({
      season: (row[0] || "").trim(),
      week: parseNum(row[1]),
      owner: (row[2] || "").trim(),
      opponent: (row[3] || "").trim(),
      points: parseNum(row[4]),
      opponentPoints: parseNum(row[5]),
      playoffType: (row[6] || "").trim(),
      finalStanding: parseNum(row[8], 99),
    }));
}

const scores = await fetchScores();

if (scores.length === 0) {
  console.error("Fetched 0 rows from the Scores tab — refusing to overwrite the existing snapshot.");
  process.exit(1);
}

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(
  OUT_PATH,
  JSON.stringify({ exportedAt: new Date().toISOString(), rowCount: scores.length, rows: scores }, null, 2) + "\n"
);

console.log(`Wrote ${scores.length} rows to ${path.relative(root, OUT_PATH)}`);
