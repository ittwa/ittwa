"use client";
import { useState } from "react";

interface PlayerAvatarProps {
  playerId: string;
  playerName: string;
  size?: number;
}

function getAvatarUrl(playerId: string): string {
  if (/^[A-Z]{2,4}$/.test(playerId)) {
    return `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.jpg`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerAvatar({ playerId, playerName, size = 32 }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (!playerId || playerId === "#N/A" || failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-medium shrink-0"
      >
        {initials(playerName)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getAvatarUrl(playerId)}
      alt={playerName}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
