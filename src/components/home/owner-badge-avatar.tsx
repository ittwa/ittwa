"use client";

import { SleeperAvatarImage } from "@/components/owner-avatar";
import { getDivColorsByOwner } from "@/lib/ui-utils";

// Small round owner avatar used across the Home page client sections. Falls back
// to division-tinted initials when the Sleeper avatar is missing or fails.
export function OwnerBadgeAvatar({
  owner,
  avatarId,
  size = 32,
}: {
  owner: string;
  avatarId?: string;
  size?: number;
}) {
  const dc = getDivColorsByOwner(owner);
  const initials = owner === "HoganLamb" ? "HL" : owner.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, background: dc.bg, border: `1.5px solid ${dc.border}` }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={owner}
        sizes={`${size * 2}px`}
        fallback={
          <span className="font-heading font-extrabold" style={{ color: dc.text, fontSize: size * 0.36 }}>
            {initials}
          </span>
        }
      />
    </div>
  );
}
