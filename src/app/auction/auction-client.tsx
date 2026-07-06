"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { PlayerLink } from "@/components/player-link";
import { SectionLabel } from "@/components/section-label";
import { GOLD, ACCENT, getPositionColors } from "@/lib/ui-utils";
import { AUCTION_DATE } from "@/lib/config";
import type { AuctionPublicState, DerivedOwnerCap, DerivedFreeAgent, AuctionResultRow } from "@/types/auction";

const EMERALD = "#4ade80";
const ROSE = "#f87171";
const MUTED = "var(--muted-foreground)";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

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

function CurrentNominationPanel({ state }: { state: AuctionPublicState }) {
  const { current, bidToBeat } = state;

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
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">Bid to Beat</div>
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
  const cashColor = o.cash < 20 ? ROSE : o.cash < 50 ? GOLD : EMERALD;
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
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2 justify-end">
          <span className="font-code text-sm">${o.salaryRostered.toFixed(1)}<span className="text-muted-foreground">/${o.cash.toFixed(1)}</span></span>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-code text-sm font-bold" style={{ color: cashColor }}>
        {o.maxBid != null ? `$${o.maxBid.toFixed(1)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-code text-sm">{o.maxYears ?? "—"}</td>
      <td className="px-3 py-2 text-right font-code text-sm font-semibold" style={{ color: needColor }}>
        {o.needToSpend > 0 ? `$${o.needToSpend.toFixed(1)}` : "Floor met ✓"}
      </td>
    </tr>
  );
}

function OwnerGrid({ owners }: { owners: DerivedOwnerCap[] }) {
  const sorted = [...owners].sort((a, b) => b.cash - a.cash);
  return (
    <section className="mb-7">
      <SectionLabel label="Owner Board" count={`${owners.length} owners`} color={GOLD} />
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-secondary">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground sticky left-0 bg-secondary">Owner</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Players</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Years</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Salary</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Max Bid</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Max Yrs</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Need to Spend</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => <OwnerGridRow key={o.owner} o={o} />)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Results feed ──────────────────────────────────────────────────────────────

function ResultsFeed({ results }: { results: AuctionResultRow[] }) {
  return (
    <section className="mb-7">
      <SectionLabel label="Results Feed" count={`${results.length} picks`} color={GOLD} />
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
              <PlayerLink playerId={r.playerId} className="font-semibold hover:underline underline-offset-2">{r.player}</PlayerLink>
              <PosBadge pos={r.position} />
              <span className="font-code text-xs text-muted-foreground ml-auto whitespace-nowrap">
                {r.years}yr / ${r.salary.toFixed(1)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ── Available / Drafted tabs ─────────────────────────────────────────────────

function AvailablePlayersTab({ pool }: { pool: DerivedFreeAgent[] }) {
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState("");
  const available = pool.filter((p) => p.status === "available");
  const filtered = available.filter(
    (p) => (!search || p.player.toLowerCase().includes(search.toLowerCase())) && (!pos || p.position === pos),
  );

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
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
        <span className="text-xs text-muted-foreground self-center ml-1">{filtered.length} of {available.length}</span>
      </div>
      <div className="bg-card border border-border rounded-[10px] max-h-[420px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">No players match.</div>
        ) : (
          filtered.map((p) => (
            <div key={p.playerId} className="px-4 py-2 border-b border-border/50 last:border-0 flex items-center gap-2 text-sm">
              <PlayerLink playerId={p.playerId} className="font-medium hover:underline underline-offset-2">{p.player}</PlayerLink>
              <PosBadge pos={p.position} />
              {p.rfa && <RfaBadge previousOwner={p.previousOwner} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DraftedPlayersTab({ results }: { results: AuctionResultRow[] }) {
  const [sortDesc, setSortDesc] = useState(true);
  const sorted = [...results].sort((a, b) => (sortDesc ? b.pickNumber - a.pickNumber : a.pickNumber - b.pickNumber));
  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-secondary">
              <th
                onClick={() => setSortDesc((d) => !d)}
                className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground cursor-pointer"
              >
                Pick {sortDesc ? "↓" : "↑"}
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Nominator</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Winner</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Player</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Pos</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Yrs</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Salary</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-code text-xs text-muted-foreground">{String(r.pickNumber).padStart(3, "0")}</td>
                <td className="px-3 py-2 text-sm">{r.nominator}</td>
                <td className="px-3 py-2 text-sm font-semibold">{r.winner}</td>
                <td className="px-3 py-2 text-sm"><PlayerLink playerId={r.playerId} className="hover:underline underline-offset-2">{r.player}</PlayerLink></td>
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

function Tabs({ pool, results }: { pool: DerivedFreeAgent[]; results: AuctionResultRow[] }) {
  const [tab, setTab] = useState<"available" | "drafted">("available");
  return (
    <section>
      <div className="flex items-center gap-2 mb-3.5">
        {(["available", "drafted"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-heading text-xs font-bold uppercase tracking-[0.06em] px-3 py-1.5 rounded-md"
            style={{
              background: tab === t ? "rgba(232,184,75,0.12)" : "var(--secondary)",
              color: tab === t ? GOLD : "var(--muted-foreground)",
              border: `1px solid ${tab === t ? "rgba(232,184,75,0.3)" : "var(--border)"}`,
            }}
          >
            {t === "available" ? `Available Players (${pool.filter((p) => p.status === "available").length})` : `Drafted Players (${results.length})`}
          </button>
        ))}
      </div>
      {tab === "available" ? <AvailablePlayersTab pool={pool} /> : <DraftedPlayersTab results={results} />}
    </section>
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
  const { data, error } = useSWR<AuctionPublicState>("/api/auction/state", fetcher, {
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
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : !data.auction ? (
        <PreAuctionHero />
      ) : (
        <>
          {data.auction.status === "complete" && <CompleteBanner season={data.auction.season} />}
          {data.auction.status !== "complete" && (
            <>
              <CurrentNominationPanel state={data} />
              <NominationStrip onClock={data.onClock} onDeck={data.onDeck} />
            </>
          )}
          <OwnerGrid owners={data.owners} />
          <ResultsFeed results={data.results} />
          <Tabs pool={data.pool} results={data.results} />
        </>
      )}

      <div className="mt-10 pt-5 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <span className="font-code text-[11px] text-muted-foreground">{season ?? ""}</span>
        <span className="font-heading text-[10px] text-muted-foreground font-bold tracking-[0.12em] uppercase">ITTWA · Est. 2014</span>
      </div>
    </div>
  );
}
