// ITTWA League Configuration

export const LEAGUE_ID = process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID || "1215789390190624768";
export const GOOGLE_SHEETS_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || "17kspYjtSNtiBuUxbdWYkHbP8Y5K7qs0nJ-D1VA-Wpwo";

export const SALARY_CAP = 270;
export const YEARS_CAP = 60;
export const SALARY_FLOOR = 220;
export const FAAB_BUDGET = 100;
export const ROSTER_SIZE = 22;

// Sleeper display_name → ITTWA display name mapping
// Maps every Sleeper display name to "First Last" format used across the site.
export const USERNAME_OVERRIDES: Record<string, string> = {
  t11clancy: "Tiger Clancy",
  mdurkin5: "Mike Durkin",
  bpeterson: "Brian Peterson",
  braintrust: "Mike Lamb",
  mschapman: "Mike Chapman",
  breezy7: "Chris Brown",
  TheresaHitsOnMe: "Justin Williams",
  Lropc: "Liam Collins",
  rbohne: "Ryan Bohne",
  zachkatz: "Zach Katz",
  BooCake: "Jorge Albarran",
  SamCummings: "Sam Cummings",
  // Legacy / alternate handles
  Rackalamb: "Mike Lamb",
  HoganLamb: "Mike Lamb",
};

// Division configuration — permanent, year-over-year
export const DIVISIONS: Record<string, string[]> = {
  Concussion: ["Tiger Clancy", "Liam Collins", "Zach Katz"],
  "Hey Arnold": ["Mike Chapman", "Jorge Albarran", "Mike Durkin"],
  Replacements: ["Brian Peterson", "Sam Cummings", "Ryan Bohne"],
  "Dark Knight Rises": ["Mike Lamb", "Chris Brown", "Justin Williams"],
};

// Sleeper division number → division name
// Sleeper rosters have a settings.division field (1-4) that maps to these names.
// This is more reliable than matching display names which may differ from real names.
export const DIVISION_NUMBER_MAP: Record<number, string> = {
  1: "Concussion",
  2: "Hey Arnold",
  3: "Replacements",
  4: "Dark Knight Rises",
};

// Reverse lookup: display name → division
export const OWNER_DIVISION: Record<string, string> = {};
for (const [div, owners] of Object.entries(DIVISIONS)) {
  for (const owner of owners) {
    OWNER_DIVISION[owner] = div;
  }
}

// All owner display names
export const ALL_OWNERS = Object.values(DIVISIONS).flat();

// Owner last name mapping for Google Sheets → display name
export const OWNER_LAST_NAME_MAP: Record<string, string> = {
  Clancy: "Tiger Clancy",
  Collins: "Liam Collins",
  Katz: "Zach Katz",
  Chapman: "Mike Chapman",
  Albarran: "Jorge Albarran",
  Durkin: "Mike Durkin",
  Peterson: "Brian Peterson",
  Cummings: "Sam Cummings",
  Bohne: "Ryan Bohne",
  Lamb: "Mike Lamb",
  Brown: "Chris Brown",
  Williams: "Justin Williams",
  // Handle "HoganLamb" or "Hogan" as well
  Hogan: "Mike Lamb",
  HoganLamb: "Mike Lamb",
};

// Rookie draft pick contract values — hardcoded per league rules
export const ROOKIE_PICK_CONTRACTS: Record<string, { years: number; salary: number }> = {
  "1.01": { years: 4, salary: 14 },
  "1.02": { years: 4, salary: 13 },
  "1.03": { years: 4, salary: 12 },
  "1.04": { years: 4, salary: 11 },
  "1.05": { years: 4, salary: 10 },
  "1.06": { years: 4, salary: 9 },
  "1.07": { years: 4, salary: 8 },
  "1.08": { years: 4, salary: 8 },
  "1.09": { years: 4, salary: 8 },
  "1.10": { years: 4, salary: 8 },
  "1.11": { years: 4, salary: 8 },
  "1.12": { years: 4, salary: 8 },
  "2.01": { years: 4, salary: 7 },
  "2.02": { years: 4, salary: 6 },
  "2.03": { years: 4, salary: 5 },
  "2.04": { years: 4, salary: 4 },
  "2.05": { years: 4, salary: 3 },
  "2.06": { years: 4, salary: 2 },
  "2.07": { years: 4, salary: 2 },
  "2.08": { years: 4, salary: 2 },
  "2.09": { years: 4, salary: 2 },
  "2.10": { years: 4, salary: 2 },
  "2.11": { years: 4, salary: 2 },
  "2.12": { years: 4, salary: 2 },
};

// Contract value multipliers by years remaining
// Used for FA bidding and contract valuation
export const CONTRACT_VALUE_MULTIPLIERS: Record<number, number> = {
  0: 0,    // Mid-season pickup — no contract value
  1: 1.0,
  2: 1.4,
  3: 1.7,
  4: 1.9,
  5: 2.0,
};

// Payout structure
export const PAYOUTS = {
  first: 1250,
  second: 300,
  third: 150,
  pointsLeader: 100,
};

// API base URL
export const SLEEPER_API_BASE = "https://api.sleeper.app/v1";

// Revalidation intervals (seconds)
export const REVALIDATE = {
  players: 86400,      // 24 hours
  roster: 3600,        // 1 hour
  matchups: 300,       // 5 minutes
  sheets: 600,         // 10 minutes
} as const;
