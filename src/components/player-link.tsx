"use client";

import Link from "next/link";

export function PlayerLink({
  playerId,
  children,
  className,
  style,
}: {
  playerId: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Link
      href={`/players/${encodeURIComponent(playerId)}`}
      className={className ?? "hover:underline underline-offset-2"}
      style={style}
    >
      {children}
    </Link>
  );
}
