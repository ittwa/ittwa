// Manual FantasyCalc → Sleeper player ID overrides.
//
// FantasyCalc usually provides a sleeperId directly, and the matcher falls back
// to normalized name + position and then fuzzy matching. For the rare player
// that still won't match (name spelling quirks, missing sleeperId), add an
// entry here keyed by the FantasyCalc player id with the correct Sleeper id.
//
// During a build, unmatched players are logged to the server console as:
//   [trade-analyzer] unmatched FantasyCalc player: <name> (<pos>) fcId=<id>
// Copy the fcId here once you've found the right Sleeper id.

export const FANTASYCALC_TO_SLEEPER_OVERRIDES: Record<number, string> = {
  // 1234: "4046",  // example: Patrick Mahomes
};
