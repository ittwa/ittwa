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

// Splits a migration file into executable statements. Comments must be
// stripped (everything from "--" to end of line, on EVERY line) before
// splitting on ";" — not after. A prose comment containing a semicolon
// (e.g. "for the NEXT nomination only;") otherwise creates a bogus split
// point in the middle of a statement, truncating it. None of this file's
// DDL puts "--" inside a string literal, so a per-line strip is safe here.
export function splitSqlStatements(raw: string): string[] {
  const codeOnly = raw
    .split("\n")
    .map((line) => {
      const commentIdx = line.indexOf("--");
      return commentIdx === -1 ? line : line.slice(0, commentIdx);
    })
    .join("\n");

  return codeOnly
    .split(";")
    .map((s) => s.trim())
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
