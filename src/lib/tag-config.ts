// Tag Tracker — league rule constants.
//
// These are the ONLY numbers that should ever need to change if the league
// votes to adjust the franchise tag or 5th-year option rules. Nothing else in
// the Tag Tracker code should have a rule number hardcoded — if you find one,
// it's a bug; move it here.
//
// Commissioner: edit the values below, not the logic in lib/tags-data.ts.

export const TAG_RULES = {
  // ── Franchise Tag (Constitution §5.5) ────────────────────────────────────
  // Tag salary = one-year deal at the GREATER of:
  //   - the average of the FRANCHISE_TOP_N highest salaries at the position
  //     from the previous season, or
  //   - FRANCHISE_FIRST_TAG_PCT of the player's own previous-season salary.
  FRANCHISE_TOP_N: 5,
  FRANCHISE_FIRST_TAG_PCT: 1.2, // 120%

  // Consecutive tags: each additional consecutive tag = this multiplier times
  // the PRIOR tag's own salary (not the original pre-tag salary). Applied
  // iteratively, so a 2nd consecutive tag is 120% of the 1st, and a 3rd
  // consecutive tag is 120% of the 2nd (~144% of the original tag) — this
  // matches both the Constitution's "144% by year 3" language and real
  // historical tags (e.g. Derrick Henry 2020→2022) far better than reading
  // "144%" as a flat one-step multiplier off the immediately-prior season.
  FRANCHISE_CONSECUTIVE_PCT: 1.2, // 120% of the prior tag's salary, each year

  // Rounding tolerance (in $M) used when back-computing which formula
  // (top-N average vs. 120%-of-prior) produced a historical tag. Real
  // salaries are hand-entered and get rounded, so exact equality is too
  // strict.
  BASIS_MATCH_TOLERANCE: 0.5,

  // ── 5th Year Player Option (Constitution §5, Player Options) ─────────────
  // League-resolved interpretation of the ambiguous Constitution text:
  //   - Overall picks 1-6:  option salary = FIFTH_YEAR_MULTIPLIER × average of
  //     the top FIFTH_YEAR_TOP_N_EARLY salaries at the position.
  //   - Overall picks 7-12: option salary = FIFTH_YEAR_MULTIPLIER × average of
  //     the top FIFTH_YEAR_TOP_N_LATE salaries at the position.
  //   - Picks outside 1-12 (Round 2/3) are not 5th-year eligible.
  FIFTH_YEAR_MULTIPLIER: 0.75, // league may change to 1.0
  FIFTH_YEAR_TOP_N_EARLY: 10, // overall picks 1-6
  FIFTH_YEAR_TOP_N_LATE: 25, // overall picks 7-12

  // A Round 1 pick's rookie deal runs 4 seasons (draft year through draft
  // year + 3). The option must be declared one year before that contract
  // expires — i.e. during the offseason after the player's 3rd rookie season
  // (draft year + 2). If exercised, it adds a 5th season at draft year + 4.
  ROOKIE_CONTRACT_YEARS: 4,
  FIFTH_YEAR_DECLARE_AFTER_ROOKIE_SEASON: 2, // 0-indexed: 3rd rookie season
} as const;

// Franchise tag deadline: the third Friday in June each year.
export const FRANCHISE_TAG_DEADLINE_MONTH = 5; // June (0-indexed)
export const FRANCHISE_TAG_DEADLINE_WEEKDAY = 5; // Friday (0=Sun..6=Sat)
export const FRANCHISE_TAG_DEADLINE_NTH = 3; // third occurrence
