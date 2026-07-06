import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { splitSqlStatements, isMissingTableError } from "./auction-schema";

describe("splitSqlStatements — against the real migration file", () => {
  const raw = readFileSync(path.join(process.cwd(), "migrations", "0001_auction.sql"), "utf8");
  const statements = splitSqlStatements(raw);

  it("produces a CREATE TABLE for every auction table — including the first one under the file header", () => {
    // Regression: a previous version discarded any chunk that started with a
    // comment line, which silently skipped `CREATE TABLE auction` (it sits
    // directly below the file's header comments). Production then failed
    // every query with `relation "auction" does not exist`.
    const tables = ["auction", "auction_owner", "auction_result", "auction_roster", "auction_pool", "auction_current"];
    for (const table of tables) {
      expect(
        statements.some((s) => s.includes(`CREATE TABLE IF NOT EXISTS ${table}`) && s.startsWith("CREATE")),
        `expected an executable CREATE TABLE statement for "${table}"`,
      ).toBe(true);
    }
  });

  it("produces no empty or comment-only statements", () => {
    for (const s of statements) {
      expect(s.length).toBeGreaterThan(0);
      expect(s.startsWith("--")).toBe(false);
    }
  });

  it("keeps inline trailing comments without breaking the statement", () => {
    const auctionTable = statements.find((s) => s.includes("CREATE TABLE IF NOT EXISTS auction ("));
    expect(auctionTable).toBeDefined();
    expect(auctionTable).toContain("status TEXT NOT NULL DEFAULT 'setup'");
  });

  it("produces exactly one statement per CREATE in the file — none truncated or split apart", () => {
    // Regression: a prose comment containing a semicolon ("...NEXT
    // nomination only;") split CREATE TABLE auction into two fragments —
    // one truncated (missing its closing paren and two trailing columns)
    // and one that was an orphan half-statement. Both "started with CREATE"
    // style checks still passed, because the truncated fragment still began
    // with "CREATE TABLE IF NOT EXISTS auction (" — only a structural check
    // catches this.
    const createCount = (raw.match(/^\s*CREATE /gm) || []).length;
    expect(statements).toHaveLength(createCount);
    for (const s of statements) {
      expect(s.startsWith("CREATE")).toBe(true);
    }
  });

  it("balances parentheses in every statement (catches truncated CREATE TABLE bodies)", () => {
    for (const s of statements) {
      const opens = (s.match(/\(/g) || []).length;
      const closes = (s.match(/\)/g) || []).length;
      expect(opens, `unbalanced parens in: ${s.slice(0, 60)}...`).toBe(closes);
      expect(opens).toBeGreaterThan(0);
    }
  });

  it("includes every column of the auction table in a single statement", () => {
    const auctionTable = statements.find((s) => s.startsWith("CREATE TABLE IF NOT EXISTS auction ("));
    expect(auctionTable).toBeDefined();
    for (const column of ["id SERIAL", "season TEXT", "status TEXT", "nomination_order JSONB", "current_nominator_index INTEGER", "nominator_override TEXT", "created_at TIMESTAMPTZ"]) {
      expect(auctionTable, `missing "${column}"`).toContain(column);
    }
    expect(auctionTable!.trim().endsWith(")")).toBe(true);
  });
});

describe("isMissingTableError", () => {
  it("matches Postgres undefined_table (42P01) errors", () => {
    expect(isMissingTableError({ code: "42P01", message: 'relation "auction" does not exist' })).toBe(true);
  });

  it("does not match other errors", () => {
    expect(isMissingTableError({ code: "28P01" })).toBe(false); // bad password
    expect(isMissingTableError(new Error("network timeout"))).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});
