"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useOwnerAvatar, SleeperAvatarImage } from "@/components/owner-avatar";
import { GOLD, ACCENT, getPositionColors } from "@/lib/ui-utils";
import { ALL_OWNERS } from "@/lib/config";
import type {
  AuctionPublicState,
  DerivationResult,
  DerivedOwnerCap,
  DerivedRosterEntry,
  DerivedFreeAgent,
  AuctionResultRow,
} from "@/types/auction";

const STATE_KEY = "/api/auction/state";
const ROSE = "#f87171";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

function OwnerAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const avatarId = useOwnerAvatar(name);
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md"
      style={{ width: size, height: size, background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <SleeperAvatarImage avatarId={avatarId} name={name} fallback={<span className="font-heading font-bold" style={{ fontSize: size * 0.4 }}>{name.slice(0, 2).toUpperCase()}</span>} />
    </div>
  );
}

function PosBadge({ pos }: { pos: string }) {
  const pc = getPositionColors(pos);
  return (
    <span className="text-[10px] font-bold whitespace-nowrap" style={{ padding: "1px 6px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
      {pos}
    </span>
  );
}

function Banner({ tone, children }: { tone: "warn" | "error" | "info"; children: React.ReactNode }) {
  const colors = {
    warn: { c: GOLD, bg: "rgba(232,184,75,0.1)", b: "rgba(232,184,75,0.3)" },
    error: { c: ROSE, bg: "rgba(248,113,113,0.1)", b: "rgba(248,113,113,0.3)" },
    info: { c: "#60a5fa", bg: "rgba(96,165,250,0.1)", b: "rgba(96,165,250,0.3)" },
  }[tone];
  return (
    <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: colors.bg, color: colors.c, border: `1px solid ${colors.b}` }}>
      {children}
    </div>
  );
}

function Btn({
  children, onClick, variant = "default", disabled, small,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "default" | "primary" | "danger" | "ghost"; disabled?: boolean; small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" },
    primary: { background: GOLD, color: "#1a1400", border: `1px solid ${GOLD}`, fontWeight: 700 },
    danger: { background: "rgba(248,113,113,0.12)", color: ROSE, border: "1px solid rgba(248,113,113,0.35)" },
    ghost: { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-heading font-bold uppercase tracking-[0.04em] rounded-md ${small ? "text-[11px] px-2.5 py-1" : "text-xs px-3.5 py-2"} disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

// ── PIN gate ──────────────────────────────────────────────────────────────────

function PinGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/auction/admin/login", { pin });
      onAuthenticated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20 bg-card border border-border rounded-[10px] p-6 text-center">
      <div className="font-heading text-xl font-black uppercase tracking-[0.04em] mb-1">Commissioner Access</div>
      <p className="text-xs text-muted-foreground mb-4">Enter the auction admin PIN to continue.</p>
      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-full text-center text-lg tracking-[0.3em] bg-secondary border border-border rounded-lg px-3 py-2.5 mb-3"
        placeholder="••••"
        autoFocus
      />
      {error && <Banner tone="error">{error}</Banner>}
      <Btn variant="primary" onClick={submit} disabled={busy || !pin}>{busy ? "Checking…" : "Enter"}</Btn>
    </div>
  );
}

// ── Setup wizard ──────────────────────────────────────────────────────────────

function OwnerRosterPanel({
  owner, roster, onOverride, onRemove, onAdd,
}: {
  owner: DerivedOwnerCap;
  roster: DerivedRosterEntry[];
  onOverride: (owner: string, capHit: number) => void;
  onRemove: (playerId: string) => void;
  onAdd: (row: DerivedRosterEntry) => void;
}) {
  const cap = owner;
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ player: "", position: "WR", years: 1, salary: 1 });
  const [capInput, setCapInput] = useState(String(cap.capHit));

  return (
    <div className="border-b border-border/60 last:border-0">
      <div className="px-3 py-2 grid grid-cols-[1.5fr_repeat(6,1fr)] gap-2 items-center text-sm">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left cursor-pointer">
          <OwnerAvatar name={owner.owner} size={22} />
          <span className="font-heading font-bold uppercase text-[13px]">{owner.owner}</span>
          <span className="text-muted-foreground text-xs">{open ? "▾" : "▸"}</span>
        </button>
        <span className="font-code text-xs text-right">{cap.playersRostered}</span>
        <span className="font-code text-xs text-right">{cap.yearsRostered}</span>
        <span className="font-code text-xs text-right">${cap.salaryRostered.toFixed(1)}</span>
        <span className="font-code text-xs text-right">${cap.cash.toFixed(1)}</span>
        <span className="font-code text-xs text-right">{cap.maxBid != null ? `$${cap.maxBid.toFixed(1)}` : "—"}</span>
        <div className="flex items-center gap-1 justify-end">
          <input
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            onBlur={() => {
              const n = Number(capInput);
              if (Number.isFinite(n)) onOverride(owner.owner, n);
            }}
            className="w-14 font-code text-xs text-right bg-secondary border border-border rounded px-1 py-0.5"
            title="Cap hit (dead money) — override if the derived value looks wrong"
          />
          {cap.capHitOverridden && <span className="text-[9px]" style={{ color: GOLD }}>edited</span>}
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <table className="w-full text-xs mb-2">
            <tbody>
              {roster.map((r) => (
                <tr key={r.playerId || r.player} className="border-t border-border/40">
                  <td className="py-1">{r.player}</td>
                  <td className="py-1"><PosBadge pos={r.position} /></td>
                  <td className="py-1 text-right font-code">{r.years}yr</td>
                  <td className="py-1 text-right font-code">${r.salary.toFixed(1)}</td>
                  <td className="py-1 text-right">
                    <button onClick={() => onRemove(r.playerId || r.player)} className="text-[10px] cursor-pointer" style={{ color: ROSE }}>
                      Move to FA pool
                    </button>
                  </td>
                </tr>
              ))}
              {roster.length === 0 && (
                <tr><td colSpan={5} className="py-2 text-center text-muted-foreground italic">No rostered players.</td></tr>
              )}
            </tbody>
          </table>
          {addOpen ? (
            <div className="flex gap-1.5 items-center flex-wrap">
              <input placeholder="Player" value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })} className="bg-secondary border border-border rounded px-2 py-1 text-xs w-32" />
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="bg-secondary border border-border rounded px-1 py-1 text-xs">
                {["QB", "RB", "WR", "TE", "DEF"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="number" min={1} max={5} value={form.years} onChange={(e) => setForm({ ...form, years: Number(e.target.value) })} className="bg-secondary border border-border rounded px-2 py-1 text-xs w-14" />
              <input type="number" min={0} step={0.5} value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} className="bg-secondary border border-border rounded px-2 py-1 text-xs w-16" />
              <Btn small variant="primary" onClick={() => {
                if (!form.player) return;
                onAdd({ owner: owner.owner, playerId: `manual-${form.player.toLowerCase().replace(/\s+/g, "-")}`, player: form.player, position: form.position, years: form.years, salary: form.salary, source: "manual" });
                setForm({ player: "", position: "WR", years: 1, salary: 1 });
                setAddOpen(false);
              }}>Add</Btn>
              <Btn small variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Btn>
            </div>
          ) : (
            <Btn small variant="ghost" onClick={() => setAddOpen(true)}>+ Add missing contract</Btn>
          )}
        </div>
      )}
    </div>
  );
}

function NominationOrderEditor({ order, setOrder }: { order: string[]; setOrder: (o: string[]) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  }

  return (
    <div className="bg-card border border-border rounded-[10px] p-3">
      {order.map((owner, i) => (
        <div
          key={owner}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIdx !== null) move(dragIdx, i);
            setDragIdx(null);
          }}
          className="flex items-center gap-2 px-2 py-1.5 border-b border-border/40 last:border-0 cursor-move"
        >
          <span className="font-code text-xs text-muted-foreground w-5">{i + 1}</span>
          <OwnerAvatar name={owner} size={20} />
          <span className="text-sm font-medium flex-1">{owner}</span>
          <button onClick={() => move(i, i - 1)} disabled={i === 0} className="text-xs disabled:opacity-30 cursor-pointer">↑</button>
          <button onClick={() => move(i, i + 1)} disabled={i === order.length - 1} className="text-xs disabled:opacity-30 cursor-pointer">↓</button>
        </div>
      ))}
    </div>
  );
}

function SetupWizard({ defaultSeason }: { defaultSeason: string }) {
  const [season, setSeason] = useState(defaultSeason);
  const [deriving, setDeriving] = useState(false);
  const [derived, setDerived] = useState<DerivationResult | null>(null);
  const [owners, setOwners] = useState<DerivedOwnerCap[]>([]);
  const [roster, setRoster] = useState<DerivedRosterEntry[]>([]);
  const [pool, setPool] = useState<DerivedFreeAgent[]>([]);
  const [order, setOrder] = useState<string[]>([...ALL_OWNERS]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function derive() {
    setDeriving(true);
    setError(null);
    try {
      const res = await fetch(`/api/auction/admin/derive?season=${encodeURIComponent(season)}`);
      const data: DerivationResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Derivation failed");
      setDerived(data);
      setOwners(data.owners);
      setRoster(data.roster);
      setPool(data.pool);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Derivation failed");
    } finally {
      setDeriving(false);
    }
  }

  function reload() {
    if (!confirm("Reload from sheet? This discards any manual edits made on this screen.")) return;
    derive();
  }

  function overrideCapHit(owner: string, capHit: number) {
    setOwners((prev) => prev.map((o) => (o.owner === owner ? { ...o, capHit, capHitOverridden: true } : o)));
  }

  function removeFromRoster(playerId: string) {
    setRoster((prev) => {
      const row = prev.find((r) => r.playerId === playerId);
      if (row) {
        setPool((p) => [...p, { playerId: row.playerId, player: row.player, position: row.position, team: null, rfa: false, previousOwner: row.owner, status: "available" }]);
      }
      return prev.filter((r) => r.playerId !== playerId);
    });
  }

  function addToRoster(row: DerivedRosterEntry) {
    setRoster((prev) => [...prev, row]);
    setPool((prev) => prev.filter((p) => p.playerId !== row.playerId));
  }

  async function start() {
    if (!confirm(`Start the ${season} auction? This snapshots the reviewed state — the sheet won't be re-read after this.`)) return;
    setStarting(true);
    setError(null);
    try {
      await postJSON("/api/auction/admin/start", { season, owners, roster, pool, nominationOrder: order });
      globalMutate(STATE_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start auction");
    } finally {
      setStarting(false);
    }
  }

  const rosterByOwner = useMemo(() => {
    const m = new Map<string, DerivedRosterEntry[]>();
    for (const r of roster) m.set(r.owner, [...(m.get(r.owner) ?? []), r]);
    return m;
  }, [roster]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input value={season} onChange={(e) => setSeason(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm w-28 font-code" />
        <Btn variant="primary" onClick={derive} disabled={deriving}>{deriving ? "Deriving…" : derived ? "Re-derive" : "Derive Auction State"}</Btn>
        {derived && <Btn variant="ghost" onClick={reload}>Reload from Sheet</Btn>}
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {derived && (
        <>
          {derived.warnings.map((w, i) => <Banner key={i} tone="warn">⚠ {w}</Banner>)}

          <div className="font-heading text-sm font-bold uppercase tracking-[0.06em] mb-2 mt-4">Review Screen</div>
          <div className="bg-card border border-border rounded-[10px] overflow-hidden mb-6">
            <div className="px-3 py-2 grid grid-cols-[1.5fr_repeat(6,1fr)] gap-2 bg-secondary text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              <span>Owner</span><span className="text-right">Players</span><span className="text-right">Years</span>
              <span className="text-right">Salary</span><span className="text-right">Cash</span><span className="text-right">Max Bid</span><span className="text-right">Cap Hit</span>
            </div>
            {owners.map((o) => (
              <OwnerRosterPanel
                key={o.owner}
                owner={o}
                roster={rosterByOwner.get(o.owner) ?? []}
                onOverride={overrideCapHit}
                onRemove={removeFromRoster}
                onAdd={addToRoster}
              />
            ))}
          </div>

          <div className="font-heading text-sm font-bold uppercase tracking-[0.06em] mb-2">Free Agent Pool</div>
          <p className="text-xs text-muted-foreground mb-2">{pool.length} players derived. Full search happens during the auction on the live board.</p>

          <div className="font-heading text-sm font-bold uppercase tracking-[0.06em] mb-2 mt-6">Nomination Order</div>
          <p className="text-xs text-muted-foreground mb-2">Drag rows (or use the arrows) to set the draft order.</p>
          <NominationOrderEditor order={order} setOrder={setOrder} />

          <div className="mt-6">
            <Btn variant="primary" onClick={start} disabled={starting}>{starting ? "Starting…" : "Start Auction"}</Btn>
          </div>
        </>
      )}
    </div>
  );
}

// ── Live console ──────────────────────────────────────────────────────────────
//
// Nominate/bid/award/undo/timer/pause/resume/nominator-override all live on
// the public /auction board now — anyone on the call can run them, so the
// live flow doesn't bottleneck on one device. This console keeps only what
// stays commissioner-only: marking the auction complete, exporting the CSV,
// the confirm-guarded full reset, and editing/deleting past results.

function ResultRowEditor({ r }: { r: AuctionResultRow }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ winner: r.winner, player: r.player, position: r.position, years: r.years, salary: r.salary });

  async function save() {
    await fetch(`/api/auction/admin/result/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditing(false);
    globalMutate(STATE_KEY);
  }

  async function del() {
    if (!confirm(`Delete pick ${r.pickNumber} (${r.player})?`)) return;
    await fetch(`/api/auction/admin/result/${r.id}`, { method: "DELETE" });
    globalMutate(STATE_KEY);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap py-1.5 border-b border-border/40 text-xs">
        <input value={form.winner} onChange={(e) => setForm({ ...form, winner: e.target.value })} className="w-20 bg-secondary border border-border rounded px-1.5 py-1" />
        <input value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })} className="w-28 bg-secondary border border-border rounded px-1.5 py-1" />
        <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-14 bg-secondary border border-border rounded px-1.5 py-1" />
        <input type="number" value={form.years} onChange={(e) => setForm({ ...form, years: Number(e.target.value) })} className="w-12 bg-secondary border border-border rounded px-1.5 py-1" />
        <input type="number" step={0.5} value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} className="w-16 bg-secondary border border-border rounded px-1.5 py-1" />
        <Btn small variant="primary" onClick={save}>Save</Btn>
        <Btn small variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/40 text-xs">
      <span className="font-code text-muted-foreground w-10">{String(r.pickNumber).padStart(3, "0")}</span>
      <span className="w-20 font-semibold">{r.winner}</span>
      <span className="flex-1">{r.player}</span>
      <PosBadge pos={r.position} />
      <span className="font-code">{r.years}yr / ${r.salary.toFixed(1)}</span>
      <button onClick={() => setEditing(true)} className="cursor-pointer" style={{ color: GOLD }}>Edit</button>
      <button onClick={del} className="cursor-pointer" style={{ color: ROSE }}>Delete</button>
    </div>
  );
}

interface ResyncSummary {
  rosterRows: number;
  capHitsUpdated: number;
  poolAdded: number;
  poolRemoved: number;
  warnings: string[];
}

function LiveConsole({ state }: { state: AuctionPublicState }) {
  const [includePlayerId, setIncludePlayerId] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [resync, setResync] = useState<ResyncSummary | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);

  async function complete() {
    if (!confirm("Mark the auction complete? The public board will show it as final.")) return;
    await postJSON("/api/auction/admin/complete"); globalMutate(STATE_KEY);
  }
  async function reset() {
    if (!confirm("Full reset? This permanently deletes the current auction and all results.")) return;
    await postJSON("/api/auction/admin/reset", { confirm: true }); globalMutate(STATE_KEY);
  }
  async function resyncInputs() {
    if (!confirm("Re-import rosters, cap hits, and the free agent pool from Sleeper + the sheet? Auction results, manual roster edits, and overridden cap hits are kept.")) return;
    setResyncing(true);
    setResyncError(null);
    setResync(null);
    try {
      setResync(await postJSON("/api/auction/admin/resync"));
      globalMutate(STATE_KEY);
    } catch (e) {
      setResyncError(e instanceof Error ? e.message : "Resync failed");
    } finally {
      setResyncing(false);
    }
  }

  const auction = state.auction!;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4 bg-card border border-border rounded-[10px] p-3">
        <div className="text-sm">
          <span className="font-heading font-bold uppercase">{auction.season}</span>{" "}
          <span className="text-xs text-muted-foreground">· status: {auction.status}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {auction.status !== "complete" && (
            <Btn small variant="default" onClick={resyncInputs} disabled={resyncing}>
              {resyncing ? "Resyncing…" : "Resync Rosters"}
            </Btn>
          )}
          {auction.status !== "complete" && <Btn small variant="ghost" onClick={complete}>Mark Complete</Btn>}
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={includePlayerId} onChange={(e) => setIncludePlayerId(e.target.checked)} /> Player ID
          </label>
          <a href={`/api/auction/admin/export?includePlayerId=${includePlayerId}`} className="no-underline">
            <Btn small variant="primary">Export CSV</Btn>
          </a>
          <Btn small variant="danger" onClick={reset}>Reset</Btn>
        </div>
      </div>

      {resyncError && <Banner tone="error">{resyncError}</Banner>}
      {resync && (
        <>
          <Banner tone="info">
            Resynced from Sleeper + the sheet — {resync.rosterRows} imported roster rows, {resync.capHitsUpdated} cap hit{resync.capHitsUpdated === 1 ? "" : "s"} updated, {resync.poolAdded} added to the pool, {resync.poolRemoved} removed. Auction results and manual edits were untouched.
          </Banner>
          {resync.warnings.map((w, i) => <Banner key={i} tone="warn">⚠ {w}</Banner>)}
        </>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        Nominating, bidding, awarding, undo, the timer, and pause/resume all run from the public board at <a href="/auction" target="_blank" rel="noreferrer" className="underline underline-offset-2">/auction</a> — anyone on the call can use them. This console is for setup, exporting results, and fixing a past pick.
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        <strong className="text-foreground">Resync Rosters</strong> re-imports rosters, cap hits, and the free agent pool from Sleeper and the Contracts sheet. Use it when a trade or drop lands after the auction was started — Sleeper decides who is on which roster, the sheet supplies salary and years.
      </p>

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground mb-2">Recent Results</div>
        <div className="bg-card border border-border rounded-[10px] p-3 max-h-[360px] overflow-y-auto">
          {state.results.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No results yet.</p>
          ) : (
            state.results.map((r) => <ResultRowEditor key={r.id} r={r} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ── Top-level client ──────────────────────────────────────────────────────────

export function AuctionAdminClient({ defaultSeason }: { defaultSeason: string }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auction/admin/session")
      .then((r) => r.json())
      .then((d) => setAuthenticated(!!d.authenticated))
      .finally(() => setAuthChecked(true));
  }, []);

  const { data } = useSWR<AuctionPublicState>(authenticated ? STATE_KEY : null, fetcher, { refreshInterval: 4000 });

  if (!authChecked) return null;
  if (!authenticated) return <PinGate onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <div>
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-1 h-7 rounded-sm" style={{ background: ACCENT }} />
          <h1 className="font-heading text-3xl font-black tracking-[0.04em] uppercase">Auction Admin</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-4">Commissioner console — not visible to owners.</p>
      </div>

      {!data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data.auction ? (
        <SetupWizard defaultSeason={defaultSeason} />
      ) : (
        <LiveConsole state={data} />
      )}
    </div>
  );
}
