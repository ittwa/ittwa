"use client";

import { GOLD } from "@/lib/ui-utils";

export function SectionLabel({
  label,
  count,
  right,
  color,
}: {
  label: string;
  count?: string;
  right?: React.ReactNode;
  color?: string;
}) {
  const barColor = color || GOLD;
  return (
    <div className="flex items-center justify-between mb-3.5 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="block flex-shrink-0 w-1 h-5 rounded-sm"
          style={{ background: barColor }}
        />
        <span
          className="font-heading text-lg font-extrabold tracking-[0.06em] uppercase whitespace-nowrap"
          style={{ color: color || "var(--foreground)" }}
        >
          {label}
        </span>
        {count != null && (
          <span className="text-[11px] text-muted-foreground font-mono">{count}</span>
        )}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
