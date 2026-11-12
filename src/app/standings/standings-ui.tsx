"use client";

import { getDivisionColor, getDivisionColorAlpha } from "@/lib/ui-utils";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";

// Shared by the standings tables and the Draft Order panel.

export function DivisionBadge({ division }: { division: string }) {
  const color = getDivisionColor(division);
  return (
    <span
      className="inline-flex items-center rounded-[5px] px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap"
      style={{
        background: getDivisionColorAlpha(division, 0.1),
        color,
        border: `1px solid ${getDivisionColorAlpha(division, 0.25)}`,
      }}
    >
      {division}
    </span>
  );
}

export function OwnerAvatar({ name, division, size = 30 }: { name: string; division: string; size?: number }) {
  const color = getDivisionColor(division);
  const avatarId = useOwnerAvatar(name);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        background: getDivisionColorAlpha(division, 0.1),
        border: `1px solid ${getDivisionColorAlpha(division, 0.2)}`,
      }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={
          <span className="font-heading font-extrabold text-xs" style={{ color }}>{initials}</span>
        }
      />
    </div>
  );
}
