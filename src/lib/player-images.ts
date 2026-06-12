// Sleeper player headshot URL candidates, tried in order by the avatar
// components (each advances to the next candidate on image error, then falls
// back to initials). Thumb first: it's the small (~2-15KB) variant built for
// avatar use, and images are served unoptimized (see next.config.ts), so the
// browser downloads these directly — payload size matters. The full-size path
// is the fallback for any player missing a thumb.
export function playerHeadshotUrls(playerId: string): string[] {
  return [
    `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`,
    `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`,
  ];
}
