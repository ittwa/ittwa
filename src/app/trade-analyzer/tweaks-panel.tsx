"use client";

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
  const set = (patch: Partial<Tweaks>) => onChange({ ...tweaks, ...patch });
  return (
    <div className="bg-card border border-border rounded-[14px] p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="font-heading font-extrabold text-sm tracking-[0.04em]">TWEAKS</span>
        <button onClick={onReset} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          reset
        </button>
      </div>
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
        <div className="text-[11px] text-muted-foreground mb-1.5">Value display</div>
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
  );
}
