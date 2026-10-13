#!/usr/bin/env node
// Backs up league data into data/ so history survives even if the Google
// Sheet or the Sleeper API disappears. The app does not read these files.
//
//   data/sheets/<Tab>.json       raw cell values (header row included)
//   data/sleeper/<season>/*.json league, users, rosters, matchups,
//                                transactions, drafts (+picks), traded_picks
//   data/sleeper/players.json    id → name/position for every referenced player
//
// Usage: npm run export-snapshots
// Requires GOOGLE_API_KEY (reads .env.local if present, same as the app).
//
// Anything that fails or comes back empty keeps its previous snapshot; the
// script still writes everything else and exits 1 so the failure is visible.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DATA_DIR = path.join(root, "data");

// Required tabs are the ones the site reads; optional ones are snapshotted if present.
const REQUIRED_TABS = ["Scores", "Contracts", "CapHits", "Finances", "Dates"];
const OPTIONAL_TABS = ["Trades", "Players", "Owners"];
const PRIVATE_COLUMN = /e-?mail|phone/i;
// Tabs refreshed less often than weekly. Players is ~10 MB and mostly weekly noise (injuries, teams).
const REFRESH_EVERY_DAYS = { players: 56 };

const SLEEPER_API_BASE = "https://api.sleeper.app/v1";
const MAX_WEEK = 18;
const PLAYER_FIELDS = ["first_name", "last_name", "full_name", "position", "birth_date", "college"];

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

// Read IDs from src/lib/config.ts so a new season only has to be added in one place.
function readConfig() {
  const src = readFileSync(path.join(root, "src", "lib", "config.ts"), "utf8");
  const sheetsId = src.match(/GOOGLE_SHEETS_ID\s*=.*?\|\|\s*"([^"]+)"/)?.[1];
  const block = src.match(/SEASON_LEAGUE_IDS[^{]*\{([^}]*)\}/)?.[1];
  if (!sheetsId || !block) throw new Error("Could not read GOOGLE_SHEETS_ID / SEASON_LEAGUE_IDS from src/lib/config.ts");
  const seasons = Object.fromEntries([...block.matchAll(/"(\d{4})"\s*:\s*"(\d+)"/g)].map((m) => [m[1], m[2]]));
  if (Object.keys(seasons).length === 0) throw new Error("SEASON_LEAGUE_IDS in src/lib/config.ts is empty");
  return { sheetsId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || sheetsId, seasons };
}

const errors = [];

function writeJson(relPath, data) {
  const full = path.join(DATA_DIR, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 2) + "\n");
}

async function getJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${res.statusText}`.trim());
  return res.json();
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const fileSafe = (s) => s.replace(/[^A-Za-z0-9_-]+/g, "-");

// --- Google Sheets ---

const today = () => new Date().toISOString().slice(0, 10);

function isFresh(tab) {
  const days = REFRESH_EVERY_DAYS[normalize(tab)];
  const file = path.join(DATA_DIR, "sheets", `${fileSafe(tab)}.json`);
  if (!days || !existsSync(file)) return false;
  const last = JSON.parse(readFileSync(file, "utf8")).refreshedAt;
  if (!last) return false;
  return (Date.parse(today()) - Date.parse(last)) / 86_400_000 < days;
}

async function exportSheets(sheetsId, apiKey) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}`;
  const meta = await getJson(`${base}?fields=sheets.properties.title&key=${apiKey}`, "Sheets tab list");
  const titles = (meta.sheets || []).map((s) => s.properties.title);
  console.log(`Workbook tabs: ${titles.join(" | ")}`);

  const wanted = [];
  for (const name of [...REQUIRED_TABS, ...OPTIONAL_TABS]) {
    const title = titles.find((t) => normalize(t) === normalize(name));
    if (title && isFresh(title)) console.log(`"${title}" tab refreshed within the last ${REFRESH_EVERY_DAYS[normalize(title)]} days — skipped`);
    else if (title) wanted.push(title);
    else if (REQUIRED_TABS.includes(name)) errors.push(`Sheet tab "${name}" not found`);
    else console.log(`No "${name}" tab in the workbook — skipped`);
  }
  if (wanted.length === 0) return null;

  const ranges = wanted.map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'`)}`).join("&");
  const data = await getJson(`${base}/values:batchGet?${ranges}&key=${apiKey}`, "Sheets values");

  let contracts = null;
  data.valueRanges.forEach((vr, i) => {
    const tab = wanted[i];
    let values = vr.values || [];
    if (values.length === 0) {
      errors.push(`Sheet tab "${tab}" came back empty — kept previous snapshot`);
      return;
    }
    // The repo is public: never commit owners' contact details.
    const drop = new Set(values[0].flatMap((h, c) => (PRIVATE_COLUMN.test(h || "") ? [c] : [])));
    if (drop.size) {
      console.log(`  ${tab}: dropped private columns ${[...drop].map((c) => values[0][c]).join(", ")}`);
      values = values.map((row) => row.filter((_, c) => !drop.has(c)));
    }
    const refreshedAt = REFRESH_EVERY_DAYS[normalize(tab)] ? { refreshedAt: today() } : {};
    writeJson(`sheets/${fileSafe(tab)}.json`, { tab, ...refreshedAt, values });
    console.log(`  sheets/${fileSafe(tab)}.json — ${values.length} rows`);
    if (normalize(tab) === "contracts") contracts = values;
  });
  return contracts;
}

// --- Sleeper ---

const sleeper = (p) => getJson(`${SLEEPER_API_BASE}${p}`, `Sleeper ${p}`);
const weeks = (from) => Array.from({ length: MAX_WEEK - from + 1 }, (_, i) => i + from);
const byKeys = (...keys) => (a, b) => {
  for (const k of keys) {
    const x = a[k] ?? "";
    const y = b[k] ?? "";
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
};

async function exportSeason(season, leagueId, playerIds) {
  const [league, users, rosters, tradedPicks, drafts, matchupWeeks, txWeeks] = await Promise.all([
    sleeper(`/league/${leagueId}`),
    sleeper(`/league/${leagueId}/users`),
    sleeper(`/league/${leagueId}/rosters`),
    sleeper(`/league/${leagueId}/traded_picks`),
    sleeper(`/league/${leagueId}/drafts`),
    Promise.all(weeks(1).map((w) => sleeper(`/league/${leagueId}/matchups/${w}`))),
    Promise.all(weeks(0).map((w) => sleeper(`/league/${leagueId}/transactions/${w}`))),
  ]);

  // An empty league means Sleeper lost or changed the data — never overwrite a good snapshot with that.
  if (!league || !users?.length || !rosters?.length) {
    throw new Error("league, users or rosters came back empty");
  }

  const draftsWithPicks = await Promise.all(
    (drafts || []).sort(byKeys("start_time", "draft_id")).map(async (d) => ({
      ...d,
      picks: ((await sleeper(`/draft/${d.draft_id}/picks`)) || []).sort(byKeys("pick_no")),
    }))
  );

  const matchups = {};
  matchupWeeks.forEach((m, i) => {
    if (m?.length) matchups[weeks(1)[i]] = m.sort(byKeys("roster_id"));
  });
  const transactions = txWeeks.flat().filter(Boolean).sort(byKeys("created", "transaction_id"));

  for (const r of rosters) for (const id of [...(r.players || []), ...(r.reserve || []), ...(r.taxi || [])]) playerIds.add(id);
  for (const week of Object.values(matchups)) for (const m of week) for (const id of [...(m.players || []), ...(m.starters || [])]) playerIds.add(id);
  for (const t of transactions) for (const id of [...Object.keys(t.adds || {}), ...Object.keys(t.drops || {})]) playerIds.add(id);
  for (const d of draftsWithPicks) for (const p of d.picks) if (p.player_id) playerIds.add(p.player_id);

  const dir = `sleeper/${season}`;
  writeJson(`${dir}/league.json`, league);
  writeJson(`${dir}/users.json`, [...users].sort(byKeys("user_id")));
  writeJson(`${dir}/rosters.json`, [...rosters].sort(byKeys("roster_id")));
  writeJson(`${dir}/matchups.json`, matchups);
  writeJson(`${dir}/transactions.json`, transactions);
  writeJson(`${dir}/drafts.json`, draftsWithPicks);
  writeJson(`${dir}/traded_picks.json`, [...(tradedPicks || [])].sort(byKeys("season", "round", "roster_id", "owner_id")));
  console.log(
    `  sleeper/${season} — ${users.length} users, ${Object.keys(matchups).length} matchup weeks, ` +
      `${transactions.length} transactions, ${draftsWithPicks.length} drafts`
  );
}

async function exportPlayers(playerIds) {
  const all = await sleeper("/players/nfl");
  if (!all || Object.keys(all).length === 0) throw new Error("Sleeper players list came back empty");

  const out = {};
  for (const id of [...playerIds].sort()) {
    const p = all[id];
    if (!p) continue;
    out[id] = Object.fromEntries(PLAYER_FIELDS.filter((f) => p[f] != null).map((f) => [f, p[f]]));
  }
  writeJson("sleeper/players.json", out);
  console.log(`  sleeper/players.json — ${Object.keys(out).length} players (${playerIds.size} referenced)`);
}

// --- Main ---

loadDotEnvLocal();
const apiKey = process.env.GOOGLE_API_KEY;
const { sheetsId, seasons } = readConfig();
const playerIds = new Set();

if (!apiKey) {
  errors.push("GOOGLE_API_KEY is not set — skipped Google Sheets");
} else {
  try {
    const contracts = await exportSheets(sheetsId, apiKey);
    // Contracts column A is the Sleeper player_id; skip the header and "#N/A" rows.
    for (const row of (contracts || []).slice(1)) {
      const id = (row[0] || "").trim();
      if (/^[A-Za-z0-9]+$/.test(id)) playerIds.add(id);
    }
  } catch (e) {
    errors.push(`Google Sheets: ${e.message}`);
  }
}

for (const [season, leagueId] of Object.entries(seasons).sort()) {
  try {
    await exportSeason(season, leagueId, playerIds);
  } catch (e) {
    errors.push(`Sleeper ${season}: ${e.message} — kept previous snapshot`);
  }
}

try {
  await exportPlayers(playerIds);
} catch (e) {
  errors.push(`Sleeper players: ${e.message} — kept previous snapshot`);
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll snapshots written.");
