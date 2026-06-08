"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Tweaks {
  surplusPerDollar: number;
  fairPct: number;
  valueMode: "adjusted" | "raw";
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-foreground tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#FD4A48]"
      />
    </div>
  );
}

export function TweaksPanel({
  tweaks,
  onChange,
  onReset,
}: {
  tweaks: Tweaks;
  onChange: (t: Tweaks) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Tweaks>) => onChange({ ...tweaks, ...patch });
  return (
    <div className="bg-card border border-border rounded-[14px] px-4 py-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between"
      >
        <span className="font-heading font-extrabold text-xs tracking-[0.04em]">TWEAKS</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-mono">
            surplus {tweaks.surplusPerDollar} · fair {(tweaks.fairPct * 100).toFixed(0)}% · {tweaks.valueMode}
          </span>
          <span className="text-[10px] text-muted-foreground">{open ? "▴" : "▾"}</span>
        </div>
      </button>
      {open && (
        <div className="pt-3 pb-1 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
          <Slider
            label="Surplus weight (per $)"
            value={tweaks.surplusPerDollar}
            min={0}
            max={80}
            step={1}
            onChange={(v) => set({ surplusPerDollar: v })}
            format={(v) => String(v)}
          />
          <Slider
            label="Fair threshold"
            value={tweaks.fairPct}
            min={0.01}
            max={0.2}
            step={0.01}
            onChange={(v) => set({ fairPct: v })}
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Value display</span>
              <button onClick={onReset} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                reset
              </button>
            </div>
            <div className="inline-flex rounded-lg bg-secondary border border-border p-0.5">
              {(["adjusted", "raw"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set({ valueMode: m })}
                  className={cn(
                    "px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors",
                    tweaks.valueMode === m ? "bg-ittwa/20 text-ittwa" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
