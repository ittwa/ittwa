#!/usr/bin/env node
// Seeds a realistic auction "mid-flight" so every UI state (owner grid,
// current nomination + bidding, results feed, available/drafted tabs) is
// demoable locally without touching the real Google Sheet or Sleeper data.
//
// Usage: npm run db:seed:auction  (run `npm run db:migrate` first)
//
// This DELETES any existing auction rows before seeding — local/dev use only.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

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

// Mirrors src/lib/config.ts ALL_OWNERS — duplicated here since this is a
// plain Node script with no TS/path-alias loader.
const OWNERS = [
  "Clancy", "Collins", "Katz",
  "Chapman", "Albarran", "Durkin",
  "Peterson", "Cummings", "Bohne",
  "HoganLamb", "Brown", "Williams",
];

const POSITIONS = ["QB", "RB", "WR", "TE", "DEF"];

function makeRoster(owner, ownerIdx) {
  const rows = [];
  const count = 14 + (ownerIdx % 4); // 14-17 players, leaves room for auction adds
  for (let i = 0; i < count; i++) {
    const position = POSITIONS[i % POSITIONS.length];
    const years = 1 + ((i + ownerIdx) % 4);
    const salary = Math.round((2 + ((i * 3 + ownerIdx * 5) % 22)) * 10) / 10;
    rows.push({
      owner,
      playerId: `seed-${owner.toLowerCase()}-${i}`,
      player: `${owner} ${position}${i + 1}`,
      position,
      years,
      salary,
      source: "import",
    });
  }
  return rows;
}

function makePool() {
  const pool = [];
  let n = 0;
  for (const position of POSITIONS) {
    for (let i = 0; i < 10; i++) {
      n++;
      const rfa = n % 5 === 0;
      pool.push({
        playerId: `seed-fa-${n}`,
        player: `Free Agent ${position} ${i + 1}`,
        position,
        status: "available",
        rfa,
        previousOwner: rfa ? OWNERS[n % OWNERS.length] : null,
      });
    }
  }
  return pool;
}

async function insertRows(sql, table, columns, rows) {
  if (rows.length === 0) return;
  const placeholders = [];
  const params = [];
  rows.forEach((row, i) => {
    const base = i * columns.length;
    placeholders.push(`(${columns.map((_, j) => `$${base + j + 1}`).join(",")})`);
    params.push(...row);
  });
  await sql.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders.join(",")}`, params);
}

async function main() {
  loadDotEnvLocal();
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("NEON_DATABASE_URL is not set. Add it to .env.local, then re-run.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const season = process.argv[2] || "2026";

  console.log(`Clearing any existing auctions and seeding a mock ${season} auction mid-flight...`);
  await sql.query(`DELETE FROM auction`);

  const nominationOrder = OWNERS;
  const currentNominatorIndex = 5; // 6th owner on the clock

  const created = await sql.query(
    `INSERT INTO auction (season, status, nomination_order, current_nominator_index)
     VALUES ($1, 'live', $2, $3) RETURNING id`,
    [season, JSON.stringify(nominationOrder), currentNominatorIndex],
  );
  const auctionId = created[0].id;

  // Owners — a mix of cap hits, one manually overridden to demo that state.
  const ownerRows = OWNERS.map((owner, i) => [auctionId, owner, i === 2 ? 6.5 : (i % 3) * 2.5, i === 2]);
  await insertRows(sql, "auction_owner", ["auction_id", "owner", "cap_hit", "cap_hit_overridden"], ownerRows);

  // Rosters
  const roster = OWNERS.flatMap((owner, i) => makeRoster(owner, i));
  await insertRows(
    sql,
    "auction_roster",
    ["auction_id", "owner", "player_id", "player", "position", "years", "salary", "source"],
    roster.map((r) => [auctionId, r.owner, r.playerId, r.player, r.position, r.years, r.salary, r.source]),
  );

  // Free agent pool
  const pool = makePool();
  await insertRows(
    sql,
    "auction_pool",
    ["auction_id", "player_id", "player", "position", "status", "rfa", "previous_owner"],
    pool.map((p) => [auctionId, p.playerId, p.player, p.position, p.status, p.rfa, p.previousOwner]),
  );

  // A handful of completed picks, oldest first.
  const completedPicks = [
    { player: pool[2], winner: OWNERS[0], nominator: OWNERS[11], years: 1, salary: 39.0 },
    { player: pool[7], winner: OWNERS[1], nominator: OWNERS[0], years: 2, salary: 24.5 },
    { player: pool[13], winner: OWNERS[3], nominator: OWNERS[1], years: 3, salary: 18.0 },
    { player: pool[22], winner: OWNERS[4], nominator: OWNERS[3], years: 1, salary: 12.5 },
    { player: pool[31], winner: OWNERS[6], nominator: OWNERS[4], years: 4, salary: 9.0 },
    { player: pool[40], winner: OWNERS[8], nominator: OWNERS[6], years: 1, salary: 6.0 },
    { player: pool[45], winner: OWNERS[9], nominator: OWNERS[8], years: 2, salary: 15.0 },
    { player: pool[48], winner: OWNERS[10], nominator: OWNERS[9], years: 1, salary: 3.5 },
  ];

  for (let i = 0; i < completedPicks.length; i++) {
    const pick = completedPicks[i];
    const pickNumber = i + 1;
    const resultRows = await sql.query(
      `INSERT INTO auction_result (auction_id, pick_number, nominator, winner, player_id, player, position, years, salary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [auctionId, pickNumber, pick.nominator, pick.winner, pick.player.playerId, pick.player.player, pick.player.position, pick.years, pick.salary],
    );
    const resultId = resultRows[0].id;

    await sql.query(
      `INSERT INTO auction_roster (auction_id, owner, player_id, player, position, years, salary, source, result_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'auction',$8)`,
      [auctionId, pick.winner, pick.player.playerId, pick.player.player, pick.player.position, pick.years, pick.salary, resultId],
    );

    await sql.query(`UPDATE auction_pool SET status = 'drafted' WHERE auction_id = $1 AND player_id = $2`, [
      auctionId,
      pick.player.playerId,
    ]);
  }

  // Current nomination — mid-bid, with a running timer, so the live board's
  // bid-to-beat table and countdown both have something to show.
  const nominated = pool[55];
  await sql.query(
    `UPDATE auction_pool SET status = 'nominated' WHERE auction_id = $1 AND player_id = $2`,
    [auctionId, nominated.playerId],
  );
  await sql.query(
    `INSERT INTO auction_current
       (auction_id, player_id, player, position, rfa, previous_owner, high_bid_salary, high_bid_years, high_bidder, timer_ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      auctionId,
      nominated.playerId,
      nominated.player,
      nominated.position,
      nominated.rfa,
      nominated.previousOwner,
      14.0,
      2,
      OWNERS[5],
      new Date(Date.now() + 45_000).toISOString(),
    ],
  );

  console.log(`Seeded auction ${auctionId} for season ${season}:`);
  console.log(`  ${roster.length} rostered contracts, ${pool.length} free agents, ${completedPicks.length} completed picks`);
  console.log(`  Current nomination: ${nominated.player} (${nominated.position}), high bid $14.0 / 2yr by ${OWNERS[5]}`);
  console.log("Visit /auction (public board) and /auction/admin (PIN-gated) to see it live.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
