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
}

export function Tooltip({ content, children, className, side = "top" }: TooltipProps) {
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
            "absolute left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg",
            "min-w-[200px] max-w-[300px] text-center",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            className
          )}
        >
          {content}
          {side === "bottom" ? (
            <div className="absolute left-1/2 bottom-full -translate-x-1/2 border-4 border-transparent border-b-border" />
          ) : (
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border" />
          )}
        </div>
      )}
    </div>
  );
}
