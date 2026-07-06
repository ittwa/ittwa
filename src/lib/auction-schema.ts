// Runtime access to the auction schema migration, so the app can create its
// own tables the first time the commissioner starts an auction — no manual
// `npm run db:migrate` step required (though it still works).
//
// migrations/0001_auction.sql stays the single source of truth; it is bundled
// into the serverless trace via outputFileTracingIncludes in next.config.ts.

import { readFileSync } from "node:fs";
import path from "node:path";
import { getSql } from "./db";

// Postgres error 42P01 = undefined_table ("relation ... does not exist").
// This is what every auction query throws before the migration has run —
// it means "not set up yet", not a transient outage.
export function isMissingTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "42P01"
  );
}

// Splits a migration file into executable statements. Comment-only lines are
// stripped from each chunk BEFORE deciding whether it's empty — a chunk that
// begins with header comments still contains real DDL after them (the first
// CREATE TABLE in the file sits right below the file header, and discarding
// chunks that merely start with "--" would silently skip it).
export function splitSqlStatements(raw: string): string[] {
  return raw
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

// Idempotent — every statement in the migration is IF NOT EXISTS.
export async function ensureAuctionSchema(): Promise<void> {
  const sqlFile = path.join(process.cwd(), "migrations", "0001_auction.sql");
  const statements = splitSqlStatements(readFileSync(sqlFile, "utf8"));
  const sql = getSql();
  for (const statement of statements) {
    await sql.query(statement);
  }
}
