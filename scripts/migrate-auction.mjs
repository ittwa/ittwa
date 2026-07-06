#!/usr/bin/env node
// Runs migrations/0001_auction.sql against NEON_DATABASE_URL.
// Usage: npm run db:migrate
//
// Safe to re-run — every statement in the migration is idempotent
// (CREATE TABLE/INDEX IF NOT EXISTS).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// next dev/build auto-load .env.local; a plain node script does not, so load
// it here for local runs. Vercel injects NEON_DATABASE_URL directly in
// deployed environments, so this is a no-op there.
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadDotEnvLocal();

  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "NEON_DATABASE_URL is not set. Add it to .env.local (local) or the Vercel project's env vars (deployed), then re-run.",
    );
    process.exit(1);
  }

  const sqlFile = path.join(root, "migrations", "0001_auction.sql");
  const raw = readFileSync(sqlFile, "utf8");

  // Comments must be stripped (everything from "--" to end of line, on EVERY
  // line) before splitting on ";" — not after. A prose comment containing a
  // semicolon (e.g. "for the NEXT nomination only;") otherwise creates a
  // bogus split point in the middle of a statement, truncating it. None of
  // this file's DDL puts "--" inside a string literal, so a per-line strip
  // is safe here. Keep this in sync with splitSqlStatements in
  // src/lib/auction-schema.ts (duplicated here since this plain Node script
  // has no TS loader to import it directly) — src/lib/auction-schema.test.ts
  // covers the shared logic.
  const codeOnly = raw
    .split("\n")
    .map((line) => {
      const commentIdx = line.indexOf("--");
      return commentIdx === -1 ? line : line.slice(0, commentIdx);
    })
    .join("\n");

  const statements = codeOnly
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sql = neon(databaseUrl);

  console.log(`Running ${statements.length} statement(s) from migrations/0001_auction.sql...`);
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log("Auction schema migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
