"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SleeperAvatarImage } from "@/components/owner-avatar";
import { PlayerAvatar } from "@/components/player-avatar";
import { getPositionColors, getDivisionColor, getDivisionColorAlpha, GOLD } from "@/lib/ui-utils";
import type { Strategy } from "@/lib/trade-analyzer/config";
import type { TradeAsset, TradeTeam } from "@/lib/trade-analyzer/types";

// Position colors with a PICK → gold special case (the spec's pick accent).
export function posColors(pos: string) {
  if (pos === "PICK") return { text: GOLD, bg: "rgba(232,184,75,0.12)", border: "rgba(232,184,75,0.3)" };
  return getPositionColors(pos);
}

export function OwnerAvatar({
  name,
  avatarId,
  division,
  size = 26,
  linked = false,
}: {
  name: string;
  avatarId?: string;
  division?: string;
  size?: number;
  linked?: boolean;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  const color = division ? getDivisionColor(division) : "#888";
  const bg = division ? getDivisionColorAlpha(division, 0.12) : "rgba(136,136,136,0.12)";
  const border = division ? getDivisionColorAlpha(division, 0.25) : "rgba(136,136,136,0.25)";
  const avatar = (
    <div
      className="rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, background: bg, border: `1px solid ${border}` }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={
          <span className="font-heading font-extrabold" style={{ color, fontSize: size * 0.38 }}>
            {initials}
          </span>
        }
      />
    </div>
  );
  if (!linked) return avatar;
  return <Link href={`/teams/${encodeURIComponent(name)}`}>{avatar}</Link>;
}

export function AssetAvatar({ id, name, position, size = 32 }: { id: string; name: string; position: string; size?: number }) {
  if (position === "PICK") {
    const c = posColors("PICK");
    return (
      <div
        className="rounded-lg shrink-0 flex items-center justify-center font-heading font-extrabold"
        style={{ width: size, height: size, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: size * 0.34 }}
      >
        PK
      </div>
    );
  }
  return <PlayerAvatar playerId={id} playerName={name} position={position} size={size} />;
}

export function PosBadge({ pos }: { pos: string }) {
  const c = posColors(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {pos}
    </span>
  );
}

export function ContractChip({ salary, years, isPick }: { salary: number; years: number; isPick?: boolean }) {
  if (isPick) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
        rookie {years}yr
      </span>
    );
  }
  if (years === 0 && salary === 0) {
    return (
      <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300/90 border border-amber-400/20">
        pickup
      </span>
    );
  }
  const salColor = salary >= 50 ? "#fd7b7a" : salary >= 20 ? "#E8B84B" : "#9ca3af";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border">
      <span style={{ color: salColor }}>${salary}</span>
      <span className="text-[#555]">·</span>
      <span className="text-muted-foreground">{years}yr</span>
    </span>
  );
}

export function DealBadge({ badge }: { badge: "value" | "overpay" }) {
  if (badge === "value")
    return (
      <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">
        VALUE
      </span>
    );
  return (
    <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-rose-400/15 text-rose-400 border border-rose-400/30">
      OVERPAY
    </span>
  );
}

const STRATEGIES: { key: Strategy; label: string }[] = [
  { key: "rebuilding", label: "Rebuild" },
  { key: "neutral", label: "Neutral" },
  { key: "competing", label: "Compete" },
];

export function StrategyToggle({ value, onChange }: { value: Strategy; onChange: (s: Strategy) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-secondary border border-border p-0.5">
      {STRATEGIES.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
            value === s.key ? "bg-ittwa/20 text-ittwa" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function TeamSelect({
  teams,
  value,
  onChange,
  disabledTeamId,
  ownerAvatars,
  placeholder = "Select team",
}: {
  teams: TradeTeam[];
  value: number | null;
  onChange: (rosterId: number) => void;
  disabledTeamId: number | null;
  ownerAvatars: Record<string, string>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = teams.find((t) => t.rosterId === value) || null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary border border-border hover:border-ittwa/40 transition-colors"
      >
        {selected ? (
          <>
            <OwnerAvatar name={selected.owner} avatarId={ownerAvatars[selected.owner]} division={selected.division} />
            <div className="text-left min-w-0">
              <Link
                href={`/teams/${encodeURIComponent(selected.owner)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[13px] font-semibold truncate hover:underline underline-offset-2 block"
              >
                {selected.owner}
              </Link>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: getDivisionColor(selected.division) }}>
                {selected.division}
              </div>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-[320px] overflow-y-auto rounded-lg bg-card border border-border shadow-xl">
          {teams.map((t) => {
            const disabled = t.rosterId === disabledTeamId;
            return (
              <button
                key={t.rosterId}
                disabled={disabled}
                onClick={() => {
                  onChange(t.rosterId);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-accent/50",
                  t.rosterId === value && "bg-ittwa/10",
                )}
              >
                <OwnerAvatar name={t.owner} avatarId={ownerAvatars[t.owner]} division={t.division} />
                <span className="text-[13px] font-medium">{t.owner}</span>
                <span className="ml-auto text-[10px]" style={{ color: getDivisionColor(t.division) }}>
                  {t.division}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SearchBar({
  sourceTeam,
  excludeIds,
  valueOf,
  onAdd,
}: {
  sourceTeam: TradeTeam | null;
  excludeIds: Set<string>;
  valueOf: (a: TradeAsset) => number;
  onAdd: (a: TradeAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.toLowerCase().trim();
  const results = sourceTeam
    ? sourceTeam.assets
        .filter((a) => !excludeIds.has(a.id) && (!q || a.name.toLowerCase().includes(q)))
        .sort((a, b) => valueOf(b) - valueOf(a))
    : [];

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        disabled={!sourceTeam}
        placeholder={sourceTeam ? `Add from ${sourceTeam.owner}…` : "Select both teams first"}
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ittwa/40 disabled:opacity-40"
      />
      {open && sourceTeam && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-[300px] overflow-y-auto rounded-lg bg-card border border-border shadow-xl">
          {results.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onAdd(a);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
            >
              <AssetAvatar id={a.id} name={a.name} position={a.position} size={24} />
              <PosBadge pos={a.position} />
              <span className="text-[13px] font-medium truncate">{a.name}</span>
              <ContractChip salary={a.salary} years={a.years} isPick={a.type === "pick"} />
              <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                {Math.round(valueOf(a))}
              </span>
              <span className="text-ittwa text-sm font-bold">+</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
