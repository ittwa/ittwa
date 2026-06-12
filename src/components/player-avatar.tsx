"use client";
import { useState } from "react";
import Image from "next/image";
import { getPositionColors } from "@/lib/ui-utils";
import { playerHeadshotUrls } from "@/lib/player-images";

interface PlayerAvatarProps {
  playerId: string;
  playerName: string;
  position?: string;
  size?: number;
}

function getAvatarUrls(playerId: string): string[] {
  // Team-code "players" (DEF) use the team logo; real players get the
  // headshot candidate chain.
  if (/^[A-Z]{2,4}$/.test(playerId)) {
    return [`https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.jpg`];
  }
  return playerHeadshotUrls(playerId);
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerAvatar({ playerId, playerName, position, size = 32 }: PlayerAvatarProps) {
  const [attempt, setAttempt] = useState(0);
  const urls = playerId ? getAvatarUrls(playerId) : [];
  const failed = attempt >= urls.length;

  if (!playerId || playerId === "#N/A" || failed) {
    const colors = getPositionColors(position || "");
    return (
      <span
        style={{
          width: size,
          height: size,
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
        }}
        className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
      >
        {initials(playerName)}
      </span>
    );
  }

  return (
    // key forces a remount when the src changes, so onError reliably fires
    // again for the next candidate.
    <Image
      key={urls[attempt]}
      src={urls[attempt]}
      alt={playerName}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
