// Sleeper player headshot URL candidates, tried in order by the avatar
// components (each advances to the next candidate on image error, then falls
// back to initials). The full-size path is the one Sleeper's own app uses and
// is maintained for all players; the legacy thumb/ path stopped being
// populated for older players (only recently-added players have files there),
// so it's kept only as a fallback.
export function playerHeadshotUrls(playerId: string): string[] {
  return [
    `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`,
    `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`,
  ];
}
