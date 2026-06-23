"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { playerHeadshotUrls } from "@/lib/player-images";
import type { Discrepancy, DiscrepancyType, ReconcileResult } from "@/lib/reconcile";

// ── Per-type presentation ────────────────────────────────────────────────────
// id_mismatch is the "good fix" category — it's an easy, confident correction,
// so it gets the positive green token.
const TYPE_META: Record<
  DiscrepancyType,
  { emoji: string; label: string; color: string; bg: string; border: string; blurb: string }
> = {
  ghost_on_sleeper: {
    emoji: "👻",
    label: "Ghost on Sleeper",
    color: "#f97316", // --dark-knight
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.28)",
    blurb: "On a Sleeper roster, but no active contract anywhere in the sheet.",
  },
  id_mismatch: {
    emoji: "🆔",
    label: "Wrong Player ID",
    color: "#22c55e", // green — positive / easy fix
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.28)",
    blurb: "Same player stored under two IDs — the sheet has an inactive namesake.",
  },
  stale_in_sheet: {
    emoji: "🕸️",
    label: "Stale in Sheet",
    color: "#e8b84b", // --gold
    bg: "rgba(232,184,75,0.12)",
    border: "rgba(232,184,75,0.28)",
    blurb: "Active in the sheet, but not on any Sleeper roster.",
  },
  owner_mismatch: {
    emoji: "🔀",
    label: "Owner Mismatch",
    color: "#fd4a48", // --ittwa / --primary
    bg: "rgba(253,74,72,0.12)",
    border: "rgba(253,74,72,0.28)",
    blurb: "Active in both, but the owners disagree.",
  },
};

const TYPE_ORDER: DiscrepancyType[] = [
  "ghost_on_sleeper",
  "id_mismatch",
  "stale_in_sheet",
  "owner_mismatch",
];

// ── Plain-English fix sentence per discrepancy ───────────────────────────────
function fixSentence(d: Discrepancy): string {
  switch (d.type) {
    case "ghost_on_sleeper":
      return `Add an active contract for ${d.player} under ${d.sleeperOwner} — they're rostered on Sleeper but missing from the sheet.`;
    case "stale_in_sheet":
      return `Retire or remove ${d.player}'s contract — the sheet still lists them active under ${d.sheetOwner}, but they're off every Sleeper roster.`;
    case "owner_mismatch":
      return `Change ${d.player}'s owner in the sheet from ${d.sheetOwner} to ${d.sleeperOwner} — Sleeper has them on a different roster.`;
    case "id_mismatch":
      return `Update ${d.player}'s player_id in the sheet from ${d.sheetId} to ${d.sleeperId} — the sheet stored an inactive namesake.`;
  }
}

// ── Player headshot with initials fallback ───────────────────────────────────
function Headshot({ playerId, name, color, bg, border }: { playerId: string; name: string; color: string; bg: string; border: string }) {
  const [attempt, setAttempt] = useState(0);
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const valid = playerId && /^\d+$/.test(playerId);
  const urls = valid ? playerHeadshotUrls(playerId) : [];
  const size = 48;

  if (!valid || attempt >= urls.length) {
    return (
      <div className="flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size, borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
        <span className="font-heading font-bold" style={{ fontSize: 15, color, letterSpacing: "0.02em" }}>{initials}</span>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 overflow-hidden" style={{ position: "relative", width: size, height: size, borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
      <Image key={urls[attempt]} src={urls[attempt]} alt={name} fill sizes="96px" className="object-cover object-top" onError={() => setAttempt((a) => a + 1)} unoptimized />
    </div>
  );
}

// ── Type pill ────────────────────────────────────────────────────────────────
function TypePill({ type }: { type: DiscrepancyType }) {
  const m = TYPE_META[type];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.04em] uppercase whitespace-nowrap" style={{ padding: "3px 8px", borderRadius: 5, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span aria-hidden>{m.emoji}</span>
      {m.label}
    </span>
  );
}

// ── "Sleeper says ≠ Sheet says" strip ────────────────────────────────────────
function SaysStrip({ d }: { d: Discrepancy }) {
  let sleeperVal: string;
  let sheetVal: string;
  let caption: string;

  if (d.type === "id_mismatch") {
    caption = "player_id";
    sleeperVal = d.sleeperId ?? "—";
    sheetVal = d.sheetId ?? "—";
  } else {
    caption = "owner";
    sleeperVal = d.sleeperOwner ?? "— not rostered";
    sheetVal = d.sheetOwner ?? "— no contract";
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-0 mt-3 rounded-lg overflow-hidden border border-border">
      <div className="px-3 py-2 bg-secondary/60">
        <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-0.5">Sleeper {caption}</div>
        <div className="font-code text-[13px] font-semibold text-foreground truncate">{sleeperVal}</div>
      </div>
      <div className="flex items-center justify-center px-2 bg-secondary/30 text-muted-foreground font-bold text-sm">≠</div>
      <div className="px-3 py-2 bg-secondary/60 text-right">
        <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-0.5">Sheet {caption}</div>
        <div className="font-code text-[13px] font-semibold text-foreground truncate">{sheetVal}</div>
      </div>
    </div>
  );
}

// ── Discrepancy card ─────────────────────────────────────────────────────────
function DiscrepancyCard({ d }: { d: Discrepancy }) {
  const m = TYPE_META[d.type];
  return (
    <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: m.color, opacity: 0.8 }} />
      <div className="flex items-start gap-3.5">
        <Headshot playerId={d.playerId} name={d.player} color={m.color} bg={m.bg} border={m.border} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-heading text-lg font-extrabold tracking-[0.01em] truncate">{d.player}</span>
            {d.position && <span className="font-code text-[11px] text-muted-foreground">{d.position}</span>}
            <TypePill type={d.type} />
          </div>
          <p className="text-[13px] text-muted-foreground leading-snug">{fixSentence(d)}</p>
          <SaysStrip d={d} />
        </div>
      </div>
    </div>
  );
}

// ── Health summary tile ──────────────────────────────────────────────────────
function SummaryTile({ type, count, active, onClick }: { type: DiscrepancyType; count: number; active: boolean; onClick: () => void }) {
  const m = TYPE_META[type];
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-[150px] bg-card border rounded-[10px] p-3.5 flex flex-col gap-1 relative overflow-hidden text-left transition-colors hover:bg-accent/30"
      style={{ borderColor: active ? m.border : "var(--border)", background: active ? m.bg : undefined }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: m.color, opacity: 0.7 }} />
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: m.color }}>
          <span aria-hidden>{m.emoji}</span>
          {m.label}
        </span>
        <span className="font-code text-lg font-bold tabular-nums">{count}</span>
      </div>
      <span className="text-[11px] text-muted-foreground leading-tight">{m.blurb}</span>
    </button>
  );
}

// ── Owner map panel (collapsible) ────────────────────────────────────────────
function OwnerMapPanel({ aliasMap }: { aliasMap: ReconcileResult["aliasMap"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-3.5 rounded-sm bg-[#E8B84B]" />
          <span className="font-heading text-[13px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground">
            Owner Map · {aliasMap.length} auto-derived pairings
          </span>
        </div>
        <svg className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">
          <p className="text-[12px] text-muted-foreground mb-3">
            Each Sleeper roster is matched to the sheet owner whose active players it overlaps most. Verify the pairings and overlap ratios below.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {aliasMap.map((a) => {
              const pct = Math.round(a.ratio * 100);
              const strong = a.ratio >= 0.8;
              return (
                <div key={a.rosterId} className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2">
                  <span className="font-code text-[13px] font-semibold text-foreground truncate flex-1">{a.sleeperOwner}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="font-code text-[13px] font-semibold text-foreground truncate flex-1">{a.sheetOwner}</span>
                  <span className="font-code text-[11px] tabular-nums whitespace-nowrap" style={{ color: strong ? "#22c55e" : "#e8b84b" }}>
                    {a.overlap}/{a.matchable} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
type Filter = "all" | DiscrepancyType;

export function DataCheckClient({ result }: { result: ReconcileResult }) {
  const { totals, discrepancies, aliasMap, season, generatedAt } = result;
  const [filter, setFilter] = useState<Filter>("all");

  const asOf = useMemo(() => {
    const d = new Date(generatedAt);
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }, [generatedAt]);

  const filtered = useMemo(
    () => (filter === "all" ? discrepancies : discrepancies.filter((d) => d.type === filter)),
    [discrepancies, filter],
  );

  const clear = totals.total === 0;

  return (
    <div>
      {/* Header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
          <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Data Check</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-4 max-w-3xl">
          Reconciles the {season} Contracts sheet against live Sleeper rosters. A flag means{" "}
          <span className="text-foreground font-medium">Sleeper needs cleanup OR the sheet is behind — not necessarily an error.</span>{" "}
          Fix them proactively before they bite.
        </p>
        <p className="text-[11px] text-muted-foreground ml-4 mt-2 font-code">
          data as of {asOf} · {totals.activeContracts} active contracts · {totals.rosteredPlayers} rostered players
        </p>
      </div>

      {/* Owner map */}
      <OwnerMapPanel aliasMap={aliasMap} />

      {/* Health summary */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] border transition-colors"
          style={{
            borderColor: filter === "all" ? "rgba(232,184,75,0.4)" : "var(--border)",
            background: filter === "all" ? "rgba(232,184,75,0.08)" : "var(--card)",
          }}
        >
          <span className="font-heading text-2xl font-black tabular-nums" style={{ color: clear ? "#22c55e" : "#e8b84b" }}>{totals.total}</span>
          <span className="text-[13px] font-semibold text-muted-foreground">total flag{totals.total === 1 ? "" : "s"}</span>
        </button>
      </div>

      <div className="flex gap-2.5 mb-6 flex-wrap">
        {TYPE_ORDER.map((type) => (
          <SummaryTile
            key={type}
            type={type}
            count={totals[type]}
            active={filter === type}
            onClick={() => setFilter((f) => (f === type ? "all" : type))}
          />
        ))}
      </div>

      {/* Results */}
      {clear ? (
        <div className="bg-card border border-border rounded-xl py-16 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-3" aria-hidden>✅</div>
          <div className="font-heading text-2xl font-extrabold tracking-[0.02em]">All clear</div>
          <p className="text-[13px] text-muted-foreground mt-1.5 max-w-md">
            Every active contract lines up with a Sleeper roster spot. Nothing to reconcile.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center text-[13px] text-muted-foreground">
          No <span className="text-foreground font-medium">{TYPE_META[filter as DiscrepancyType]?.label}</span> flags.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => (
            <DiscrepancyCard key={`${d.type}:${d.playerId}:${d.sheetId ?? ""}`} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
