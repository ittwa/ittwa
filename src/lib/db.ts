import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// This project's Neon integration exposes the connection string as
// NEON_DATABASE_URL; DATABASE_URL is accepted too in case a differently
// configured Neon/Vercel integration is used instead.
export function resolveDatabaseUrl(): string | undefined {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
}

// Lazily initialized so importing this module never throws at build time —
// only actually querying the auction database without the connection string
// set does.
let cached: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const url = resolveDatabaseUrl();
    if (!url) {
      throw new Error("NEON_DATABASE_URL is not set — the auction database is unavailable");
    }
    cached = neon(url);
  }
  return cached;
}
