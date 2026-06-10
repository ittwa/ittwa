"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  // "top" (default) renders above the trigger; "bottom" renders below it — use
  // "bottom" when the trigger sits at the top edge of an `overflow` container
  // (e.g. a table header), where an upward tooltip would be clipped.
  side?: "top" | "bottom";
  // "center" (default) centers the tooltip on the trigger; "end" anchors its
  // right edge to the trigger and extends leftward — use for triggers near the
  // right edge of an `overflow-x` container, where a centered tooltip would be
  // clipped on the right.
  align?: "center" | "end";
}

export function Tooltip({ content, children, className, side = "top", align = "center" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg",
            "min-w-[200px] max-w-[300px]",
            align === "end" ? "right-0 text-left" : "left-1/2 -translate-x-1/2 text-center",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            className
          )}
        >
          {content}
          <div
            className={cn(
              "absolute border-4 border-transparent",
              align === "end" ? "right-2" : "left-1/2 -translate-x-1/2",
              side === "bottom" ? "bottom-full border-b-border" : "top-full border-t-border"
            )}
          />
        </div>
      )}
    </div>
  );
}
