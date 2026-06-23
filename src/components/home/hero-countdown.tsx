"use client";

import { useEffect, useState } from "react";

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  past: boolean;
}

function diff(targetMs: number): Remaining {
  const ms = targetMs - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, past: true };
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    past: false,
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-heading text-2xl sm:text-[28px] font-extrabold leading-none text-gold tabular-nums">
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// Live ticking countdown to the next league milestone (auction in the offseason,
// kickoff once games begin). Rendered client-side; shows placeholders until
// mounted to avoid a hydration mismatch on the date math.
export function HeroCountdown({ targetIso, label }: { targetIso: string; label: string }) {
  const targetMs = new Date(targetIso).getTime();
  const [rem, setRem] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setRem(diff(targetMs));
    const raf = requestAnimationFrame(tick); // first paint, off the effect body
    const id = setInterval(tick, 30000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [targetMs]);

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {rem?.past ? "Underway" : `Countdown · ${label}`}
      </p>
      <div className="flex items-center gap-4">
        <Unit value={rem?.days ?? 0} label="Days" />
        <Unit value={rem?.hours ?? 0} label="Hrs" />
        <Unit value={rem?.minutes ?? 0} label="Min" />
      </div>
    </div>
  );
}
