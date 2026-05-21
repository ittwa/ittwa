"use client";

import Link from "next/link";

function isValidId(id: string | undefined | null): id is string {
  return !!id && id !== "#N/A" && id !== "N/A" && id !== "";
}

export function PlayerLink({
  playerId,
  children,
  className,
  style,
}: {
  playerId: string | undefined | null;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!isValidId(playerId)) {
    return <span className={className} style={style}>{children}</span>;
  }

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
