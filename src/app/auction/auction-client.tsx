"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import useSWR, { mutate as globalMutate } from "swr";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { PlayerLink } from "@/components/player-link";
import { GOLD, ACCENT, getPositionColors } from "@/lib/ui-utils";
import { AUCTION_DATE, ALL_OWNERS } from "@/lib/config";
import { playerHeadshotUrls } from "@/lib/player-images";
import { bidIncrement, bidToBeatTable, MIN_BID } from "@/lib/auction";
import type { AuctionPublicState, DerivedOwnerCap, DerivedFreeAgent, AuctionResultRow } from "@/types/auction";

type SortDir = "asc" | "desc";

const EMERALD = "#4ade80";
const ROSE = "#f87171";
const MUTED = "var(--muted-foreground)";
const STATE_KEY = "/api/auction/state";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

// Every action below hits an unauthenticated /api/auction/* route on
// purpose — nominate, bid, award, undo, timer, pause/resume, and
// nominator-override are open to anyone with this link so the live call
// doesn't bottleneck on one device. Only setup and post-hoc result
// edits/deletes require the commissioner PIN (see /auction/admin).
async function postJSON(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function Btn({
  children, onClick, variant = "default", disabled,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "default" | "primary" | "ghost"; disabled?: boolean;
}) {
  const base = "font-heading font-bold uppercase tracking-[0.04em] text-[11px] px-3 py-1.5 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    default: "bg-secondary text-foreground border border-border",
    ghost: "bg-transparent text-muted-foreground border border-border",
    primary: "border",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
      style={variant === "primary" ? { background: GOLD, color: "#1a1400", borderColor: GOLD } : undefined}
    >
      {children}
    </button>
  );
}

function Banner({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const c = tone === "warn"
    ? { color: GOLD, bg: "rgba(232,184,75,0.1)", b: "rgba(232,184,75,0.3)" }
    : { color: ROSE, bg: "rgba(248,113,113,0.1)", b: "rgba(248,113,113,0.3)" };
  return (
    <div className="text-xs rounded-lg px-3 py-2 mb-2" style={{ background: c.bg, color: c.color, border: `1px solid ${c.b}` }}>
      {children}
    </div>
  );
}

function OwnerAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const avatarId = useOwnerAvatar(name);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md"
      style={{ width: size, height: size, background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={<span className="font-heading font-extrabold" style={{ fontSize: size * 0.36, color: MUTED }}>{initials}</span>}
      />
    </div>
  );
}

function PosBadge({ pos }: { pos: string }) {
  const pc = getPositionColors(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] whitespace-nowrap"
      style={{ padding: "2px 6px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}
    </span>
  );
}

// Sleeper only has headshots for real numeric player IDs — write-ins
// ("manual-...") and team defenses (e.g. "SF") fall straight to initials.
function PlayerAvatar({ playerId, name, pos, size = 32 }: { playerId: string; name: string; pos: string; size?: number }) {
  const [attempt, setAttempt] = useState(0);
  const pc = getPositionColors(pos);
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const validId = /^\d+$/.test(playerId);
  const urls = validId ? playerHeadshotUrls(playerId) : [];

  if (!validId || attempt >= urls.length) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: size, height: size, borderRadius: 8, background: pc.bg, border: `1px solid ${pc.border}` }}
      >
        <span className="font-heading font-bold" style={{ fontSize: size * 0.34, color: pc.text }}>{initials}</span>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{ position: "relative", width: size, height: size, borderRadius: 8, background: pc.bg, border: `1px solid ${pc.border}` }}
    >
      <Image
        key={urls[attempt]}
        src={urls[attempt]}
        alt={name}
        fill
        sizes="64px"
        className="object-cover object-top"
        onError={() => setAttempt((a) => a + 1)}
      />
    </div>
  );
}

function SortTh({
  label, field, sortKey, sortDir, onSort, align = "left", className,
}: {
  label: string; field: string; sortKey: string; sortDir: SortDir;
  onSort: (field: string) => void; align?: "left" | "right" | "center"; className?: string;
}) {
  const active = sortKey === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap cursor-pointer select-none ${className ?? ""}`}
      style={{ textAlign: align, color: active ? GOLD : "var(--muted-foreground)" }}
    >
      {label}{active && <span className="ml-1 opacity-80">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function RfaBadge({ previousOwner }: { previousOwner: string | null }) {
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] whitespace-nowrap"
      style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(232,184,75,0.12)", color: GOLD, border: "1px solid rgba(232,184,75,0.3)" }}
      title={previousOwner ? `Restricted free agent — last on ${previousOwner}'s roster` : "Restricted free agent"}
    >
      RFA{previousOwner ? ` · ${previousOwner}` : ""}
    </span>
  );
}

function LiveDot({ ok }: { ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block rounded-full"
        style={{ width: 7, height: 7, background: ok ? EMERALD : ROSE, boxShadow: ok ? `0 0 6px ${EMERALD}` : "none" }}
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: ok ? EMERALD : ROSE }}>
        {ok ? "Live" : "Reconnecting"}
      </span>
    </span>
  );
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  return (
    <span className="font-code text-xs" style={{ color: remaining <= 10 ? ROSE : MUTED }}>
      {mm}:{String(ss).padStart(2, "0")}
    </span>
  );
}

// ── Current nomination panel ─────────────────────────────────────────────────

// The bid the commissioner is dialing in right now, before (or without) pressing
// Set Bid. Lifted out of the controls so the Bid to Beat table can track it
// live — the whole point of the numbers is to answer "what beats this?", which
// is useless if you have to publish a bid first to find out.
export interface BidDraft {
  salary: number;
  years: number;
  owner: string;
  // False until the commissioner touches a control. While untouched the draft
  // is derived from the live server bid, so a bid entered on another device
  // still flows through. Once touched, local input wins until the next
  // nomination remounts the board.
  touched: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function CurrentNominationPanel({ state, draft }: { state: AuctionPublicState; draft: BidDraft | null }) {
  const { current } = state;

  // Recomputed client-side from the dialed numbers rather than read from
  // state.bidToBeat (which only refreshes after a bid is published).
  const committed = current?.highBidSalary ?? null;
  const draftSalary = draft?.salary ?? null;
  const draftYears = draft?.years ?? null;
  // With no bid placed and nothing dialed, show the $1.0 opening table instead
  // of "what it takes to beat $1.0".
  const isLive = draft != null && (draft.touched || committed != null);
  const bidToBeat = useMemo(
    () => bidToBeatTable(isLive ? draftSalary : null, isLive ? draftYears : null),
    [isLive, draftSalary, draftYears],
  );
  const isPreview =
    draft != null &&
    current != null &&
    (draft.salary !== current.highBidSalary || draft.years !== current.highBidYears);

  if (!current) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-8 text-center mb-5">
        <p className="text-sm text-muted-foreground italic">No player nominated yet — sit tight.</p>
      </div>
    );
  }

  const hasBid = current.highBidSalary != null;

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden mb-5">
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD}55 60%, transparent 100%)` }} />
      <div className="p-4 md:p-5 flex flex-col md:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">On the Block</div>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <PlayerAvatar playerId={current.playerId} name={current.player} pos={current.position} size={44} />
            <PlayerLink playerId={current.playerId} className="font-heading text-2xl md:text-3xl font-black uppercase tracking-[0.01em] hover:underline underline-offset-2">
              {current.player}
            </PlayerLink>
            <PosBadge pos={current.position} />
            {current.rfa && <RfaBadge previousOwner={current.previousOwner} />}
            {current.timerEndsAt && <Countdown endsAt={current.timerEndsAt} />}
          </div>

          {hasBid ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">High Bid</span>
              <span className="font-code text-xl font-bold" style={{ color: GOLD }}>
                ${current.highBidSalary!.toFixed(1)} <span className="text-sm text-muted-foreground font-normal">/ {current.highBidYears}yr</span>
              </span>
              {current.highBidder && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <OwnerAvatar name={current.highBidder} size={20} /> {current.highBidder}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm font-semibold" style={{ color: GOLD }}>Opening bid: $1.0</div>
          )}
        </div>

        <div className="md:w-[340px] flex-shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
            Bid to Beat
            {isPreview && (
              <span className="ml-1.5 font-semibold normal-case tracking-normal" style={{ color: GOLD }}>
                · preview
              </span>
            )}
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground pb-1">Years</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground pb-1">Salary</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {bidToBeat.map((row) => (
                <tr key={row.years} className="border-t border-border/50">
                  <td className="font-code text-sm py-1">{row.years}yr</td>
                  <td className="font-code text-sm py-1 text-right font-semibold">${row.salary.toFixed(1)}</td>
                  <td className="font-code text-xs py-1 text-right text-muted-foreground">${row.value.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Nomination strip ──────────────────────────────────────────────────────────

function NominationStrip({ onClock, onDeck }: { onClock: string | null; onDeck: string | null }) {
  if (!onClock) return null;
  return (
    <div className="flex items-center gap-4 mb-5 flex-wrap">
      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">On the Clock</span>
        <OwnerAvatar name={onClock} size={24} />
        <span className="font-heading font-bold uppercase tracking-[0.02em]" style={{ color: ACCENT }}>{onClock}</span>
      </div>
      {onDeck && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]">Next</span>
          <OwnerAvatar name={onDeck} size={20} />
          <span>{onDeck}</span>
        </div>
      )}
    </div>
  );
}

// ── Run the auction (public — nominate / bid / award / undo / timer) ────────

function NominateSection({ state }: { state: AuctionPublicState }) {
  const [search, setSearch] = useState("");
  const [writeIn, setWriteIn] = useState(false);
  const [manual, setManual] = useState({ player: "", position: "WR" });
  const [nominatorOverride, setNominatorOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = state.pool.filter((p) => p.status === "available");
  const matches = search.length >= 2 ? available.filter((p) => p.player.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];

  async function nominate(player: { playerId: string; player: string; position: string; rfa: boolean; previousOwner: string | null }) {
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/auction/nominate", { ...player, nominatorOverride: nominatorOverride || null });
      setSearch("");
      setManual({ player: "", position: "WR" });
      setNominatorOverride("");
      globalMutate(STATE_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nominate failed");
    } finally {
      setBusy(false);
    }
  }

  if (state.current) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{state.current.player}</span> is on the block — award or undo above before nominating the next player.
      </p>
    );
  }

  return (
    <div>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Nominate for:</span>
        <select value={nominatorOverride} onChange={(e) => setNominatorOverride(e.target.value)} className="bg-secondary border border-border rounded px-2 py-1 text-xs">
          <option value="">{state.onClock ?? "—"} (on the clock)</option>
          {ALL_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {!writeIn ? (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search free agent to nominate…"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm mb-2"
          />
          {matches.length > 0 && (
            <div className="border border-border rounded-lg mb-2 overflow-hidden">
              {matches.map((p) => (
                <button
                  key={p.playerId}
                  onClick={() => nominate(p)}
                  disabled={busy}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <PlayerAvatar playerId={p.playerId} name={p.player} pos={p.position} size={24} />
                  <span className="flex-1">{p.player}</span>
                  <PosBadge pos={p.position} />
                  {p.rfa && <span className="text-[9px] font-bold" style={{ color: GOLD }}>RFA</span>}
                </button>
              ))}
            </div>
          )}
          <Btn variant="ghost" onClick={() => setWriteIn(true)}>+ Write-in (player missing from list)</Btn>
        </>
      ) : (
        <div className="flex gap-2 items-center flex-wrap">
          <input placeholder="Player name" value={manual.player} onChange={(e) => setManual({ ...manual, player: e.target.value })} className="bg-secondary border border-border rounded px-2 py-1.5 text-sm w-40" />
          <select value={manual.position} onChange={(e) => setManual({ ...manual, position: e.target.value })} className="bg-secondary border border-border rounded px-2 py-1.5 text-sm">
            {["QB", "RB", "WR", "TE", "DEF"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Btn variant="primary" disabled={busy || !manual.player} onClick={() => nominate({
            playerId: `manual-${manual.player.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
            player: manual.player, position: manual.position, rfa: false, previousOwner: null,
          })}>Nominate</Btn>
          <Btn variant="ghost" onClick={() => setWriteIn(false)}>Cancel</Btn>
        </div>
      )}
    </div>
  );
}

// A big +/− stepper with a directly editable value. Sized for a phone held in
// one hand at a live auction — the old controls were 28px buttons and a
// dropdown, which is a hard target to hit while running the room.
function BigStepper({
  label, value, display, min, max, onStep, onEnter,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  onStep: (dir: 1 | -1) => void;
  onEnter: (raw: string) => void;
}) {
  // While focused the input is free text, so typing "12" doesn't get clamped
  // and reformatted after the first keystroke. Committed on blur/Enter.
  const [text, setText] = useState<string | null>(null);

  const btn =
    "w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-2xl font-bold bg-secondary " +
    "border border-border cursor-pointer select-none hover:bg-accent transition-colors " +
    "disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className={`${btn} rounded-l-lg`}
        >
          −
        </button>
        <input
          inputMode="decimal"
          value={text ?? display}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => { setText(display); e.currentTarget.select(); }}
          onBlur={() => { if (text !== null) onEnter(text); setText(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          aria-label={label}
          className="w-20 md:w-24 h-12 md:h-14 text-center font-code text-xl md:text-2xl font-bold bg-background border-y border-border focus:outline-none focus:ring-2 focus:ring-inset"
          style={{ color: GOLD }}
        />
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className={`${btn} rounded-r-lg`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// One section for both tracking the bidding and awarding the player. These used
// to be two panels with duplicate salary/years/owner inputs, which meant
// re-entering the winning numbers at the moment they mattered most. Now the
// numbers on screen are the numbers that get published and the numbers that get
// awarded.
function BidAndAwardSection({
  state, draft, setDraft,
}: {
  state: AuctionPublicState;
  draft: BidDraft;
  setDraft: (d: BidDraft) => void;
}) {
  const current = state.current!;
  const [busy, setBusy] = useState<"bid" | "award" | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Handlers read `draft` (already the effective value) rather than a functional
  // updater, because while untouched the stored draft lags the live server bid.
  function stepSalary(dir: 1 | -1) {
    // Walk the legal ladder symmetrically: stepping down from $10.0 lands on
    // $9.5 (the $0.5 rung below it), not $9.0.
    const step = dir === 1 ? bidIncrement(draft.salary) : bidIncrement(draft.salary - 0.01);
    setDraft({ ...draft, salary: Math.max(MIN_BID, round1(draft.salary + dir * step)), touched: true });
  }

  function enterSalary(raw: string) {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return;
    setDraft({ ...draft, salary: Math.max(MIN_BID, round1(n)), touched: true });
  }

  function stepYears(dir: 1 | -1) {
    setDraft({ ...draft, years: Math.min(5, Math.max(1, draft.years + dir)), touched: true });
  }

  function enterYears(raw: string) {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n)) return;
    setDraft({ ...draft, years: Math.min(5, Math.max(1, n)), touched: true });
  }

  async function setBid() {
    setBusy("bid");
    setError(null);
    setWarnings([]);
    try {
      await postJSON("/api/auction/bid", { salary: draft.salary, years: draft.years, bidder: draft.owner || null });
      globalMutate(STATE_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Set bid failed");
    } finally {
      setBusy(null);
    }
  }

  async function award() {
    setBusy("award");
    setError(null);
    setWarnings([]);
    try {
      const res = await postJSON("/api/auction/award", {
        winner: draft.owner, salary: draft.salary, years: draft.years,
      });
      setWarnings(res.warnings ?? []);
      globalMutate(STATE_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Award failed");
    } finally {
      setBusy(null);
    }
  }

  const bigBtn =
    "font-heading font-bold uppercase tracking-[0.04em] text-sm px-5 h-12 md:h-14 rounded-lg cursor-pointer " +
    "transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="mt-4 pt-4 border-t border-border/60">
      <div className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground mb-3">
        Track the Bidding · Award {current.player}
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      {warnings.map((w, i) => <Banner key={i} tone="warn">⚠ {w}</Banner>)}

      <div className="flex flex-wrap items-end gap-3 md:gap-5">
        <BigStepper
          label="Salary ($)"
          value={draft.salary}
          display={draft.salary.toFixed(1)}
          min={MIN_BID}
          max={Infinity}
          onStep={stepSalary}
          onEnter={enterSalary}
        />
        <BigStepper
          label="Years"
          value={draft.years}
          display={String(draft.years)}
          min={1}
          max={5}
          onStep={stepYears}
          onEnter={enterYears}
        />
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Owner</div>
          <select
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value, touched: true })}
            aria-label="Owner"
            className="h-12 md:h-14 bg-secondary border border-border rounded-lg px-3 text-sm md:text-base cursor-pointer"
          >
            <option value="">Owner…</option>
            {ALL_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={setBid}
            disabled={busy !== null}
            className={`${bigBtn} bg-secondary text-foreground border border-border`}
          >
            {busy === "bid" ? "Setting…" : "Set Bid"}
          </button>
          <button
            type="button"
            onClick={award}
            disabled={busy !== null || !draft.owner}
            className={`${bigBtn} border`}
            style={{ background: GOLD, color: "#1a1400", borderColor: GOLD }}
          >
            {busy === "award" ? "Awarding…" : "Award"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Bid to Beat updates as you dial. <span className="text-foreground font-semibold">Set Bid</span> publishes
        to everyone watching; <span className="text-foreground font-semibold">Award</span> closes{" "}
        {current.player} at these numbers.
      </p>
    </div>
  );
}

function AuctionControls({
  state, draft, setDraft,
}: {
  state: AuctionPublicState;
  draft: BidDraft;
  setDraft: (d: BidDraft) => void;
}) {
  const auction = state.auction!;

  async function pause() { await postJSON("/api/auction/pause"); globalMutate(STATE_KEY); }
  async function resume() { await postJSON("/api/auction/resume"); globalMutate(STATE_KEY); }
  async function undo() {
    if (!confirm("Undo the last award?")) return;
    await postJSON("/api/auction/undo");
    globalMutate(STATE_KEY);
  }
  async function setTimer(seconds: number | null) {
    await postJSON("/api/auction/timer", { seconds });
    globalMutate(STATE_KEY);
  }

  return (
    <div className="bg-card border border-border rounded-[10px] p-4 md:p-5 mb-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <span className="font-heading text-xs font-bold uppercase tracking-[0.08em]" style={{ color: GOLD }}>Run the Auction</span>
        <div className="flex gap-2 flex-wrap">
          {auction.status === "live" && <Btn onClick={pause}>Pause</Btn>}
          {auction.status === "paused" && <Btn variant="primary" onClick={resume}>Resume</Btn>}
          <Btn onClick={undo}>Undo Last</Btn>
          <Btn onClick={() => setTimer(30)}>30s</Btn>
          <Btn onClick={() => setTimer(60)}>60s</Btn>
          <Btn variant="ghost" onClick={() => setTimer(null)}>Clear Timer</Btn>
        </div>
      </div>
      <NominateSection state={state} />
      {state.current && <BidAndAwardSection state={state} draft={draft} setDraft={setDraft} />}
    </div>
  );
}

// Owns the bid draft shared by the Bid to Beat table and the bid/award
// controls. Keyed by playerId at the call site, so a new nomination remounts
// this and re-seeds the draft from the live bid rather than syncing prop →
// state in an effect.
function LiveBoard({ state }: { state: AuctionPublicState }) {
  const current = state.current;
  const [draft, setDraft] = useState<BidDraft>(() => ({
    salary: current?.highBidSalary ?? MIN_BID,
    years: current?.highBidYears ?? 1,
    owner: current?.highBidder ?? "",
    touched: false,
  }));

  // Until the commissioner touches a control, follow the live server bid so a
  // bid placed on another device shows up here. Deriving it (rather than
  // syncing in an effect) keeps the "local input wins once touched" rule
  // without a prop → state effect.
  const effective: BidDraft = draft.touched
    ? draft
    : {
        salary: current?.highBidSalary ?? MIN_BID,
        years: current?.highBidYears ?? 1,
        owner: current?.highBidder ?? "",
        touched: false,
      };

  return (
    <>
      <CurrentNominationPanel state={state} draft={current ? effective : null} />
      <NominationStrip onClock={state.onClock} onDeck={state.onDeck} />
      <AuctionControls state={state} draft={effective} setDraft={setDraft} />
    </>
  );
}

// ── Owner grid ────────────────────────────────────────────────────────────────

function bar(used: number, cap: number, color: string) {
  const pct = Math.max(0, Math.min(used / cap, 1));
  return (
    <div className="w-16 h-[3px] bg-secondary rounded-sm overflow-hidden">
      <div className="h-full rounded-sm" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  );
}

function OwnerGridRow({ o }: { o: DerivedOwnerCap }) {
  const capSpaceColor = o.cash < 20 ? ROSE : o.cash < 50 ? GOLD : EMERALD;
  const needColor = o.needToSpend > 0 ? ROSE : EMERALD;
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-accent/20">
      <td className="px-3 py-2 sticky left-0 bg-card">
        <div className="flex items-center gap-2">
          <OwnerAvatar name={o.owner} size={24} />
          <span className="font-heading font-bold text-sm uppercase tracking-[0.02em] whitespace-nowrap">{o.owner}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-code text-sm whitespace-nowrap">{o.playersRostered}<span className="text-muted-foreground">/{o.spotsRemaining}</span></td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2 justify-end">
          <span className="font-code text-sm">{o.yearsRostered}<span className="text-muted-foreground">/{o.yearsRemaining}</span></span>
          {bar(o.yearsRostered, 60, GOLD)}
        </div>
      </td>
      <td className="px-3 py-2 text-right font-code text-sm whitespace-nowrap">${o.salaryRostered.toFixed(1)}</td>
      <td className="px-3 py-2 text-right font-code text-sm font-bold whitespace-nowrap" style={{ color: capSpaceColor }}>
        ${o.cash.toFixed(1)}
      </td>
      <td className="px-3 py-2 text-right font-code text-sm font-bold" style={{ color: capSpaceColor }}>
        {o.maxBid != null ? `$${o.maxBid.toFixed(1)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-code text-sm">{o.maxYears ?? "—"}</td>
      <td className="px-3 py-2 text-right font-code text-sm font-semibold" style={{ color: needColor }}>
        {o.needToSpend > 0 ? `$${o.needToSpend.toFixed(1)}` : "Floor met ✓"}
      </td>
    </tr>
  );
}

type OwnerSortKey = "owner" | "players" | "years" | "salary" | "capSpace" | "maxBid" | "maxYears" | "needToSpend";

function OwnerGrid({ owners }: { owners: DerivedOwnerCap[] }) {
  const [sortKey, setSortKey] = useState<OwnerSortKey>("capSpace");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function onSort(field: string) {
    const key = field as OwnerSortKey;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "owner" ? "asc" : "desc"); }
  }

  const sorted = useMemo(() => {
    const arr = [...owners];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "players": cmp = a.playersRostered - b.playersRostered; break;
        case "years": cmp = a.yearsRostered - b.yearsRostered; break;
        case "salary": cmp = a.salaryRostered - b.salaryRostered; break;
        case "capSpace": cmp = a.cash - b.cash; break;
        case "maxBid": cmp = (a.maxBid ?? -Infinity) - (b.maxBid ?? -Infinity); break;
        case "maxYears": cmp = (a.maxYears ?? -Infinity) - (b.maxYears ?? -Infinity); break;
        case "needToSpend": cmp = a.needToSpend - b.needToSpend; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [owners, sortKey, sortDir]);

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[820px]">
          <thead>
            <tr className="bg-secondary">
              <SortTh label="Owner" field="owner" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="sticky left-0 bg-secondary" />
              <SortTh label="Players" field="players" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Years" field="years" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Salary" field="salary" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Cap Space" field="capSpace" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Max Bid" field="maxBid" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Max Yrs" field="maxYears" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Need to Spend" field="needToSpend" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => <OwnerGridRow key={o.owner} o={o} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Results feed ──────────────────────────────────────────────────────────────

function ResultsFeed({ results }: { results: AuctionResultRow[] }) {
  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden max-h-[320px] overflow-y-auto">
      {results.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">No awards yet.</div>
      ) : (
        results.map((r) => (
          <div key={r.id} className="px-4 py-2.5 border-b border-border/50 last:border-0 flex items-center gap-2 flex-wrap text-sm">
            <span className="font-code text-xs text-muted-foreground">Pick {String(r.pickNumber).padStart(3, "0")}</span>
            <span className="text-muted-foreground">—</span>
            <OwnerAvatar name={r.winner} size={20} />
            <span className="font-semibold">{r.winner}</span>
            <span className="text-muted-foreground">wins</span>
            <PlayerAvatar playerId={r.playerId} name={r.player} pos={r.position} size={22} />
            <PlayerLink playerId={r.playerId} className="font-semibold hover:underline underline-offset-2">{r.player}</PlayerLink>
            <PosBadge pos={r.position} />
            <span className="font-code text-xs text-muted-foreground ml-auto whitespace-nowrap">
              {r.years}yr / ${r.salary.toFixed(1)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ── Available / Drafted tabs ─────────────────────────────────────────────────

type AvailableSortKey = "player" | "position" | "rfa";

function AvailablePlayersTab({ state }: { state: AuctionPublicState }) {
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState("");
  const [rfaOnly, setRfaOnly] = useState(false);
  const [sortKey, setSortKey] = useState<AvailableSortKey>("player");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [nominatingId, setNominatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSort(field: string) {
    const key = field as AvailableSortKey;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Nobody has to go back up to the search box — this credits whichever
  // owner is currently on the clock, no matter who clicks it. Disabled
  // while a pick is already on the block so it can't silently blow away an
  // in-progress bid; award or undo that one first.
  const locked = state.current != null;

  async function nominate(p: DerivedFreeAgent) {
    setNominatingId(p.playerId);
    setError(null);
    try {
      await postJSON("/api/auction/nominate", {
        playerId: p.playerId,
        player: p.player,
        position: p.position,
        rfa: p.rfa,
        previousOwner: p.previousOwner,
      });
      globalMutate(STATE_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nominate failed");
    } finally {
      setNominatingId(null);
    }
  }

  const pool = state.pool;
  const available = pool.filter((p) => p.status === "available");
  const filtered = useMemo(() => {
    const r = available.filter(
      (p) =>
        (!search || p.player.toLowerCase().includes(search.toLowerCase())) &&
        (!pos || p.position === pos) &&
        (!rfaOnly || p.rfa),
    );
    r.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "player") cmp = a.player.localeCompare(b.player);
      else if (sortKey === "position") cmp = a.position.localeCompare(b.position);
      else if (sortKey === "rfa") cmp = Number(a.rfa) - Number(b.rfa);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [available, search, pos, rfaOnly, sortKey, sortDir]);

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player…"
          className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-[13px] w-[180px]"
        />
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-[13px]"
        >
          <option value="">All Positions</option>
          {["QB", "RB", "WR", "TE", "DEF"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={rfaOnly} onChange={(e) => setRfaOnly(e.target.checked)} />
          RFA only
        </label>
        <span className="text-xs text-muted-foreground self-center ml-1">{filtered.length} of {available.length}</span>
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      {locked && (
        <p className="text-xs text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">{state.current!.player}</span> is on the block — award or undo it above before nominating the next player.
        </p>
      )}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-secondary">
                <SortTh label="Player" field="player" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Position" field="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="RFA" field="rfa" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="center" />
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground text-right">Nominate{state.onClock ? ` for ${state.onClock}` : ""}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground italic">No players match.</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.playerId} className="border-t border-border/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar playerId={p.playerId} name={p.player} pos={p.position} size={28} />
                        <PlayerLink playerId={p.playerId} className="font-medium text-sm hover:underline underline-offset-2">{p.player}</PlayerLink>
                      </div>
                    </td>
                    <td className="px-3 py-2"><PosBadge pos={p.position} /></td>
                    <td className="px-3 py-2 text-center">
                      {p.rfa ? <RfaBadge previousOwner={p.previousOwner} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Btn
                        variant="primary"
                        disabled={locked || nominatingId === p.playerId}
                        onClick={() => nominate(p)}
                      >
                        {nominatingId === p.playerId ? "Nominating…" : "Nominate"}
                      </Btn>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type DraftedSortKey = "pick" | "nominator" | "winner" | "player" | "position" | "years" | "salary";

function DraftedPlayersTab({ results }: { results: AuctionResultRow[] }) {
  const [sortKey, setSortKey] = useState<DraftedSortKey>("pick");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function onSort(field: string) {
    const key = field as DraftedSortKey;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "pick" || key === "years" || key === "salary" ? "desc" : "asc"); }
  }

  const sorted = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "pick": cmp = a.pickNumber - b.pickNumber; break;
        case "nominator": cmp = a.nominator.localeCompare(b.nominator); break;
        case "winner": cmp = a.winner.localeCompare(b.winner); break;
        case "player": cmp = a.player.localeCompare(b.player); break;
        case "position": cmp = a.position.localeCompare(b.position); break;
        case "years": cmp = a.years - b.years; break;
        case "salary": cmp = a.salary - b.salary; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-secondary">
              <SortTh label="Pick" field="pick" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Nominator" field="nominator" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Winner" field="winner" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Player" field="player" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Pos" field="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Yrs" field="years" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Salary" field="salary" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-code text-xs text-muted-foreground">{String(r.pickNumber).padStart(3, "0")}</td>
                <td className="px-3 py-2 text-sm">{r.nominator}</td>
                <td className="px-3 py-2 text-sm font-semibold">{r.winner}</td>
                <td className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar playerId={r.playerId} name={r.player} pos={r.position} size={24} />
                    <PlayerLink playerId={r.playerId} className="hover:underline underline-offset-2">{r.player}</PlayerLink>
                  </div>
                </td>
                <td className="px-3 py-2"><PosBadge pos={r.position} /></td>
                <td className="px-3 py-2 text-right font-code text-sm">{r.years}</td>
                <td className="px-3 py-2 text-right font-code text-sm">${r.salary.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type AuctionTab = "owners" | "nominate" | "results";

// The three standing views under the live board. The Owner Board and the
// results used to be always-on sections stacked above these tabs, which made
// the page a long scroll during a live auction — everything below the block is
// now one click away instead.
function AuctionTabs({ state }: { state: AuctionPublicState }) {
  const [tab, setTab] = useState<AuctionTab>("owners");

  const tabs: { id: AuctionTab; label: string; count: number }[] = [
    { id: "owners", label: "Owner Board", count: state.owners.length },
    { id: "nominate", label: "Nomination", count: state.pool.filter((p) => p.status === "available").length },
    { id: "results", label: "Results", count: state.results.length },
  ];

  return (
    <section>
      <div role="tablist" aria-label="Auction views" className="flex items-center gap-2 mb-3.5 flex-wrap">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className="font-heading text-[13px] font-bold uppercase tracking-[0.06em] px-4 py-2 rounded-md cursor-pointer transition-colors"
              style={{
                background: active ? "rgba(232,184,75,0.12)" : "var(--secondary)",
                color: active ? GOLD : "var(--muted-foreground)",
                border: `1px solid ${active ? "rgba(232,184,75,0.3)" : "var(--border)"}`,
              }}
            >
              {t.label}
              <span className="ml-1.5 font-code text-[11px] font-normal opacity-70">{t.count}</span>
            </button>
          );
        })}
      </div>
      {tab === "owners" && <OwnerGrid owners={state.owners} />}
      {tab === "nominate" && <AvailablePlayersTab state={state} />}
      {tab === "results" && <ResultsTab results={state.results} />}
    </section>
  );
}

// Results keeps both existing views: the chronological feed for glancing at who
// just won what mid-auction, and the sortable table for the full record.
function ResultsTab({ results }: { results: AuctionResultRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">Recent Awards</div>
        <ResultsFeed results={results} />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">All Picks</div>
        <DraftedPlayersTab results={results} />
      </div>
    </div>
  );
}

// ── Pre/post-auction states ───────────────────────────────────────────────────

function PreAuctionHero() {
  const dateStr = AUCTION_DATE.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="bg-card border border-border rounded-[10px] p-10 text-center">
      <div className="font-heading text-3xl font-black uppercase tracking-[0.04em] mb-2">Auction Starts Soon</div>
      <p className="text-sm text-muted-foreground">
        The commissioner hasn&apos;t opened the board yet. Mark your calendar for <span style={{ color: GOLD }}>{dateStr}</span> and check back — this page updates live once bidding begins.
      </p>
    </div>
  );
}

function CompleteBanner({ season }: { season: string }) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-4 mb-5 flex items-center gap-3" style={{ borderColor: "rgba(74,222,128,0.35)" }}>
      <span className="font-heading text-sm font-black uppercase tracking-[0.06em]" style={{ color: EMERALD }}>Auction Complete</span>
      <span className="text-xs text-muted-foreground">Final results for the {season} Free Agent Auction — this board is the permanent record.</span>
    </div>
  );
}

// ── Main client component ────────────────────────────────────────────────────

export function AuctionBoardClient() {
  const { data, error } = useSWR<AuctionPublicState>(STATE_KEY, fetcher, {
    refreshInterval: 4000,
    keepPreviousData: true,
  });

  const live = !error;
  const season = data?.auction?.season;

  const headerRight = (
    <div className="flex items-center gap-3">
      <LiveDot ok={live} />
      {data?.generatedAt && (
        <span className="font-code text-[10px] text-muted-foreground">
          updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );

  return (
    <div>
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Free Agent Auction</h1>
            </div>
            <p className="text-[13px] text-muted-foreground ml-4">
              {season ? `${season} Season` : "Live board"}
              {data?.auction?.status === "paused" && <span className="ml-2 font-semibold" style={{ color: GOLD }}>· Paused</span>}
            </p>
          </div>
          {headerRight}
        </div>
      </div>

      {!data ? (
        error ? (
          // First fetch failed, so there's no stale data to keep on screen.
          // Keep polling (SWR retries) and say so instead of a dead "Loading…".
          <div className="bg-card border border-border rounded-[10px] p-10 text-center">
            <div className="font-heading text-2xl font-black uppercase tracking-[0.04em] mb-2">Reconnecting…</div>
            <p className="text-sm text-muted-foreground">
              The auction board can&apos;t reach the server right now. It retries automatically — no need to refresh.
            </p>
          </div>
        ) : (
          <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
        )
      ) : !data.auction ? (
        <PreAuctionHero />
      ) : (
        <>
          {data.auction.status === "complete" && <CompleteBanner season={data.auction.season} />}
          {data.auction.status !== "complete" && (
            <>
              <LiveBoard key={data.current?.playerId ?? "none"} state={data} />
            </>
          )}
          <AuctionTabs state={data} />
        </>
      )}

      <div className="mt-10 pt-5 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <span className="font-code text-[11px] text-muted-foreground">{season ?? ""}</span>
        <span className="font-heading text-[10px] text-muted-foreground font-bold tracking-[0.12em] uppercase">ITTWA · Est. 2014</span>
      </div>
    </div>
  );
}
