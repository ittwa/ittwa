"use client";

import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}

export function Progress({ value, max, className, indicatorClassName, label }: ProgressProps) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {value} / {max}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-ittwa",
            indicatorClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
