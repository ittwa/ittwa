"use client";

import Link from "@/components/intent-link";

export function OwnerLink({
  name,
  children,
  className,
  style,
}: {
  name: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Link
      href={`/teams/${encodeURIComponent(name)}`}
      className={className ?? "hover:underline underline-offset-2"}
      style={style}
    >
      {children ?? name}
    </Link>
  );
}
