import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazily initialized so importing this module never throws at build time —
// only actually querying the auction database without DATABASE_URL set does.
let cached: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set — the auction database is unavailable");
    }
    cached = neon(url);
  }
  return cached;
}
