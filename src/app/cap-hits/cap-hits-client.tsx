"use client";

import { useState, useMemo, Fragment } from "react";
import Image from "next/image";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";
import { PlayerLink } from "@/components/player-link";
import { getDivColors } from "@/lib/ui-utils";
import type { CapHitClientRow } from "./page";

const POS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  QB:  { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.28)" },
  RB:  { text: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.28)" },
  WR:  { text: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.28)" },
  TE:  { text: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.28)" },
  K:   { text: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.28)" },
  TAX: { text: "#888",    bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" },
};
const DEFAULT_POS = { text: "#888", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" };

function posColor(pos: string) {
  return POS_COLORS[pos] || DEFAULT_POS;
}

interface Props {
  rows: CapHitClientRow[];
  season: string;
  allSeasons: number[];
  ownerDivisions: Record<string, string>;
  owners: string[];
}

export function CapHitsClient({ rows, season: currentSeason, allSeasons, ownerDivisions, owners }: Props) {
  const [season, setSeason] = useState(() => {
    const num = parseInt(currentSeason);
    return allSeasons.includes(num) ? num : allSeasons[0];
  });
  const [selectedOwners, setSelectedOwners] = useState<string[]>(owners);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");

  const ownersFilter = selectedOwners.length === owners.length ? null : selectedOwners;

  return (
    <div>
      <PageHeader season={season} />
      <FilterBar
        season={season} setSeason={setSeason}
        selectedOwners={selectedOwners} setSelectedOwners={setSelectedOwners}
        search={search} setSearch={setSearch}
        posFilter={posFilter} setPosFilter={setPosFilter}
        allSeasons={allSeasons} currentSeason={parseInt(currentSeason)}
        owners={owners} ownerDivisions={ownerDivisions}
      />
      <KpiRow rows={rows} season={season} ownersFilter={ownersFilter} ownerDivisions={ownerDivisions} />
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 mb-5">
        <SeasonBarChart rows={rows} season={season} ownersFilter={ownersFilter} owners={owners} ownerDivisions={ownerDivisions} />
        <HistoricalHeatmap rows={rows} season={season} ownersFilter={ownersFilter} allSeasons={allSeasons} owners={owners} ownerDivisions={ownerDivisions} />
      </div>
      <BreakdownTable rows={rows} season={season} ownersFilter={ownersFilter} search={search} posFilter={posFilter} ownerDivisions={ownerDivisions} />
      <p className="mt-6 text-[10px] text-muted-foreground leading-relaxed">
        Cap hits are calculated from contracts cut or traded before completion, distributed across the remaining
        seasons of the original deal. Luxury-tax penalties are shown as <span className="text-foreground/70">TAX</span> rows.
      </p>
    </div>
  );
}

// ─── Avatars ──────────────────────────────────────────────────────────────────

function OwnerAvatar({ name, division, size = 32, dim = false }: { name: string; division: string; size?: number; dim?: boolean }) {
  const avatarId = useOwnerAvatar(name);
  const dc = getDivColors(division);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{
        width: size, height: size,
        borderRadius: size > 40 ? 10 : size > 24 ? 8 : 6,
        background: dc.bg, border: `1px solid ${dc.border}`,
        opacity: dim ? 0.4 : 1,
      }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={<span className="font-heading font-extrabold" style={{ fontSize: size * 0.36, color: dc.text, letterSpacing: "-0.01em" }}>{initials}</span>}
      />
    </div>
  );
}

function PlayerAvatar({ playerId, name, pos, size = 28 }: { playerId?: string; name: string; pos: string; size?: number }) {
  const [err, setErr] = useState(false);
  const pc = posColor(pos);
  const ini = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("");
  const validId = playerId && playerId !== "#N/A" && playerId !== "N/A" && playerId !== "";

  if (!validId || err || pos === "TAX") {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: size, height: size, borderRadius: 6,
          background: pc.bg, border: `1px solid ${pc.border}`,
        }}
      >
        <span className="font-heading font-bold" style={{ fontSize: size * 0.36, color: pc.text, letterSpacing: "0.02em" }}>
          {pos === "TAX" ? "$" : ini}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{
        position: "relative", width: size, height: size, borderRadius: 6,
        background: pc.bg, border: `1px solid ${pc.border}`,
      }}
    >
      <Image
        src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`}
        alt={name}
        fill
        sizes="64px"
        className="object-cover object-top"
        onError={() => setErr(true)}
      />
    </div>
  );
}

function PosBadge({ pos }: { pos: string }) {
  const pc = posColor(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.05em] whitespace-nowrap"
      style={{ padding: "2px 6px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos === "TAX" ? "TAX" : pos}
    </span>
  );
}

function DivDot({ division, size = 6 }: { division: string; size?: number }) {
  const dc = getDivColors(division);
  return <span className="inline-block flex-shrink-0 rounded-full" style={{ width: size, height: size, background: dc.text }} />;
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ season }: { season: number }) {
  return (
    <div className="pb-6 border-b border-border mb-6">
      <div className="flex items-center gap-3 mb-1.5">
        <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
        <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Cap Hits</h1>
      </div>
      <p className="text-[13px] text-muted-foreground ml-4">
        Dead money carried against each franchise&apos;s salary cap · {season} season
      </p>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  season, setSeason, selectedOwners, setSelectedOwners, search, setSearch,
  posFilter, setPosFilter, allSeasons, currentSeason, owners, ownerDivisions,
}: {
  season: number; setSeason: (s: number) => void;
  selectedOwners: string[]; setSelectedOwners: (o: string[]) => void;
  search: string; setSearch: (s: string) => void;
  posFilter: string; setPosFilter: (p: string) => void;
  allSeasons: number[]; currentSeason: number;
  owners: string[]; ownerDivisions: Record<string, string>;
}) {
  const allOn = selectedOwners.length === owners.length;
  const toggleOwner = (k: string) => {
    if (selectedOwners.includes(k)) setSelectedOwners(selectedOwners.filter((x) => x !== k));
    else setSelectedOwners([...selectedOwners, k]);
  };
  const seasonStatus = season === currentSeason ? "active" : season > currentSeason ? "projected" : "historical";

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_auto] gap-3 bg-card border border-border rounded-[10px] p-3 mb-5">
      {/* Season */}
      <div className="bg-secondary border border-border rounded-lg p-2.5 flex flex-col">
        <div className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase flex items-center gap-1.5">
          Season
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-[0.08em] uppercase"
            style={{
              background: seasonStatus === "active" ? "rgba(253,74,72,0.12)" : seasonStatus === "projected" ? "rgba(232,184,75,0.12)" : "var(--secondary)",
              color: seasonStatus === "active" ? "#FD4A48" : seasonStatus === "projected" ? "#E8B84B" : "var(--muted-foreground)",
              border: `1px solid ${seasonStatus === "active" ? "rgba(253,74,72,0.3)" : seasonStatus === "projected" ? "rgba(232,184,75,0.3)" : "var(--border)"}`,
            }}
          >
            {seasonStatus}
          </span>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {allSeasons.map((s) => {
            const on = s === season;
            const isCurrent = s === currentSeason;
            return (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className="flex items-center gap-1 cursor-pointer transition-all duration-150 font-heading"
                style={{
                  padding: "5px 10px",
                  border: `1px solid ${on ? "#FD4A48" : "var(--border)"}`,
                  background: on ? "rgba(253,74,72,0.12)" : "var(--secondary)",
                  color: on ? "#FD4A48" : isCurrent ? "#E8B84B" : "var(--muted-foreground)",
                  borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                }}
              >
                {s}
                {isCurrent && <span className="text-[8px] opacity-70">●</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Owners */}
      <div className="bg-secondary border border-border rounded-lg p-2.5 flex flex-col">
        <div className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase flex items-center gap-1.5">
          Owners
          <span className="text-[10px] font-semibold tracking-[0.04em] normal-case text-muted-foreground">
            ({selectedOwners.length} of {owners.length})
          </span>
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={() => setSelectedOwners(owners)}
              className="text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded cursor-pointer"
              style={{
                background: allOn ? "rgba(253,74,72,0.12)" : "var(--card)",
                color: allOn ? "#FD4A48" : "var(--muted-foreground)",
                border: `1px solid ${allOn ? "#FD4A48" : "var(--border)"}`,
              }}
            >
              All
            </button>
            <button
              onClick={() => setSelectedOwners([])}
              className="text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded cursor-pointer border border-border bg-card text-muted-foreground"
            >
              None
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {owners.map((k) => {
            const div = ownerDivisions[k] || "";
            const dc = getDivColors(div);
            const on = selectedOwners.includes(k);
            return (
              <button
                key={k}
                onClick={() => toggleOwner(k)}
                className="flex items-center gap-1.5 cursor-pointer transition-all duration-150"
                style={{
                  padding: "3px 8px 3px 4px",
                  border: `1px solid ${on ? dc.text : "var(--border)"}`,
                  background: on ? dc.bg : "var(--secondary)",
                  color: on ? dc.text : "var(--muted-foreground)",
                  borderRadius: 6, fontSize: 11, fontWeight: 600,
                  opacity: on ? 1 : 0.65,
                }}
              >
                <OwnerAvatar name={k} division={div} size={18} />
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {/* Refine */}
      <div className="bg-secondary border border-border rounded-lg p-2.5 flex flex-col min-w-[240px]">
        <div className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase">Refine</div>
        <div className="flex gap-1.5 mt-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">⌕</span>
            <input
              type="text" placeholder="Search player…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-border rounded-md pl-7 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
        <div className="flex gap-1 mt-1.5">
          {(["ALL", "QB", "RB", "WR", "TE", "TAX"] as const).map((p) => {
            const on = posFilter === p;
            const pc = p === "ALL" ? null : posColor(p);
            return (
              <button
                key={p}
                onClick={() => setPosFilter(p)}
                className="flex-1 cursor-pointer font-heading text-[10px] font-bold tracking-[0.06em] uppercase"
                style={{
                  padding: "4px 6px", borderRadius: 5,
                  border: `1px solid ${on ? (pc ? pc.border : "#FD4A48") : "var(--border)"}`,
                  background: on ? (pc ? pc.bg : "rgba(253,74,72,0.12)") : "var(--card)",
                  color: on ? (pc ? pc.text : "#FD4A48") : "var(--muted-foreground)",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, suffix, color, sub, avatar }: {
  label: string; value: string; suffix?: string; color: string; sub?: string;
  avatar?: { name: string; division: string };
}) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {avatar && <OwnerAvatar name={avatar.name} division={avatar.division} size={20} />}
        <span className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-[28px] font-black leading-none" style={{ color, letterSpacing: "-0.02em" }}>{value}</span>
        {suffix && <span className="text-[11px] text-foreground/70 font-medium">{suffix}</span>}
      </div>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function KpiRow({ rows, season, ownersFilter, ownerDivisions }: {
  rows: CapHitClientRow[]; season: number; ownersFilter: string[] | null;
  ownerDivisions: Record<string, string>;
}) {
  const stats = useMemo(() => {
    const byOwner: Record<string, number> = {};
    let activeHits = 0;
    let largest: { player: string; owner: string; cutYear: string; amt: number } | null = null;

    for (const h of rows) {
      if (ownersFilter && !ownersFilter.includes(h.owner)) continue;
      const amt = h.yearlyHits[season] || 0;
      if (amt <= 0) continue;
      byOwner[h.owner] = (byOwner[h.owner] || 0) + amt;
      activeHits++;
      if (!largest || amt > largest.amt) {
        largest = { player: h.player, owner: h.owner, cutYear: h.cutYear, amt };
      }
    }

    const total = Object.values(byOwner).reduce((s, v) => s + v, 0);
    const affected = Object.keys(byOwner).length;
    const sorted = Object.entries(byOwner).sort((a, b) => b[1] - a[1]);
    const topOwner = sorted[0] ?? null;

    return { total, activeHits, affected, topOwner, largest };
  }, [rows, season, ownersFilter]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <KpiCard
        label={`${season} League Total`}
        value={`$${stats.total.toFixed(1)}`}
        suffix="M dead $"
        color="#FD4A48"
        sub={`${stats.activeHits} active hits across ${stats.affected} owners`}
      />
      <KpiCard
        label="Highest Owner"
        value={stats.topOwner ? `$${stats.topOwner[1].toFixed(1)}` : "—"}
        suffix={stats.topOwner ? stats.topOwner[0] : ""}
        color="#E8B84B"
        avatar={stats.topOwner ? { name: stats.topOwner[0], division: ownerDivisions[stats.topOwner[0]] || "" } : undefined}
        sub={stats.topOwner ? `${((stats.topOwner[1] / stats.total) * 100).toFixed(0)}% of league cap hits` : "No active hits"}
      />
      <KpiCard
        label="Largest Single Hit"
        value={stats.largest ? `$${stats.largest.amt.toFixed(1)}` : "—"}
        suffix={stats.largest?.player}
        color="#f87171"
        sub={stats.largest ? `${stats.largest.owner} · cut ${stats.largest.cutYear}` : "No active hits"}
      />
      <KpiCard
        label="Avg Hit per Owner"
        value={stats.affected ? `$${(stats.total / stats.affected).toFixed(1)}` : "$0.0"}
        suffix={stats.affected ? `across ${stats.affected} owners` : ""}
        color="#4ade80"
        sub={`League avg of $${(stats.total / 12).toFixed(1)} per franchise`}
      />
    </div>
  );
}

// ─── Season Bar Chart ─────────────────────────────────────────────────────────

function SeasonBarChart({ rows, season, ownersFilter, owners, ownerDivisions }: {
  rows: CapHitClientRow[]; season: number; ownersFilter: string[] | null;
  owners: string[]; ownerDivisions: Record<string, string>;
}) {
  const data = useMemo(() => {
    const byOwner: Record<string, number> = {};
    for (const o of owners) byOwner[o] = 0;
    for (const h of rows) {
      if (ownersFilter && !ownersFilter.includes(h.owner)) continue;
      if (h.yearlyHits[season] && byOwner[h.owner] !== undefined) byOwner[h.owner] += h.yearlyHits[season];
    }
    const sorted = owners.map((o) => ({ owner: o, amount: byOwner[o] || 0 })).sort((a, b) => b.amount - a.amount);
    const max = Math.max(1, ...sorted.map((r) => r.amount));
    const avg = sorted.reduce((s, r) => s + r.amount, 0) / Math.max(1, sorted.length);
    return { sorted, max, avg };
  }, [rows, season, ownersFilter, owners]);

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-secondary flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">{season} Cap Hits by Owner</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Dead cap landing in {season} · league avg ${data.avg.toFixed(1)}M</div>
        </div>
        <div className="flex items-center gap-3.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[#FD4A48]" /> Above avg
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: "rgba(253,74,72,0.35)" }} /> Below avg
          </span>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between py-2">
        {data.sorted.map((r) => {
          const div = ownerDivisions[r.owner] || "";
          const dc = getDivColors(div);
          const pct = (r.amount / data.max) * 100;
          const aboveAvg = r.amount >= data.avg && r.amount > 0;
          const barColor = r.amount === 0 ? "var(--secondary)" : aboveAvg ? "#FD4A48" : "rgba(253,74,72,0.35)";
          return (
            <div key={r.owner} className="grid items-center gap-2.5 px-4 py-1.5 border-b border-border last:border-b-0" style={{ gridTemplateColumns: "140px 1fr 70px" }}>
              <div className="flex items-center gap-2 min-w-0">
                <OwnerAvatar name={r.owner} division={div} size={24} />
                <div className="min-w-0">
                  <div className="font-heading text-[13px] font-extrabold leading-tight">
                    <OwnerLink name={r.owner} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{r.owner}</OwnerLink>
                  </div>
                  <div className="text-[9px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: dc.text }}>
                    <DivDot division={div} size={4} /> {div}
                  </div>
                </div>
              </div>
              <div className="relative h-[22px] bg-secondary rounded overflow-hidden border border-border">
                <div className="absolute left-0 top-0 bottom-0 transition-[width] duration-300" style={{ width: `${pct}%`, background: barColor }} />
                <div
                  className="absolute top-[-2px] bottom-[-2px] w-px opacity-70"
                  style={{ left: `${(data.avg / data.max) * 100}%`, background: "#E8B84B" }}
                  title={`League avg $${data.avg.toFixed(1)}M`}
                />
              </div>
              <div
                className="text-right font-mono text-[13px] font-bold"
                style={{ color: r.amount === 0 ? "var(--muted-foreground)" : aboveAvg ? "#FD4A48" : "var(--foreground/70)" }}
              >
                {r.amount === 0 ? "—" : `$${r.amount.toFixed(1)}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Historical Heatmap ───────────────────────────────────────────────────────

function HistoricalHeatmap({ rows, season, ownersFilter, allSeasons, owners, ownerDivisions }: {
  rows: CapHitClientRow[]; season: number; ownersFilter: string[] | null;
  allSeasons: number[]; owners: string[]; ownerDivisions: Record<string, string>;
}) {
  const seasonsToShow = allSeasons.slice(0, 10);

  const { totals, grid, maxCell, maxTotal } = useMemo(() => {
    const g: Record<string, Record<number, number>> = {};
    for (const o of owners) g[o] = {};
    for (const h of rows) {
      if (ownersFilter && !ownersFilter.includes(h.owner)) continue;
      if (!g[h.owner]) continue;
      for (const [y, v] of Object.entries(h.yearlyHits)) {
        g[h.owner][Number(y)] = (g[h.owner][Number(y)] || 0) + v;
      }
    }
    const t = owners.map((o) => ({
      owner: o,
      total: Object.values(g[o]).reduce((s, v) => s + v, 0),
    })).sort((a, b) => b.total - a.total);
    const mc = Math.max(1, ...owners.flatMap((o) => Object.values(g[o])));
    const mt = Math.max(1, ...t.map((r) => r.total));
    return { totals: t, grid: g, maxCell: mc, maxTotal: mt };
  }, [rows, ownersFilter, owners]);

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary">
        <div className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">Historical Cap Hit Total</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">All-time dead cap per franchise · darker = worse</div>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 540 }}>
          {/* Header */}
          <div className="bg-secondary border-b border-border" style={{ display: "grid", gridTemplateColumns: `150px repeat(${seasonsToShow.length}, minmax(46px, 1fr)) 90px` }}>
            <div className="px-3 py-2 text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase">Owner</div>
            {seasonsToShow.map((s) => (
              <div
                key={s}
                className="px-1 py-2 text-center font-mono text-[10px] font-bold border-l border-border"
                style={{ color: s === season ? "#FD4A48" : "var(--muted-foreground)", background: s === season ? "rgba(253,74,72,0.12)" : "transparent" }}
              >
                {s}
              </div>
            ))}
            <div className="px-2.5 py-2 text-right text-[9px] font-bold tracking-[0.1em] uppercase border-l border-border" style={{ color: "#E8B84B" }}>Total</div>
          </div>
          {/* Rows */}
          {totals.map((r) => {
            const div = ownerDivisions[r.owner] || "";
            const dc = getDivColors(div);
            return (
              <div
                key={r.owner}
                className="border-b border-border"
                style={{
                  display: "grid",
                  gridTemplateColumns: `150px repeat(${seasonsToShow.length}, minmax(46px, 1fr)) 90px`,
                  opacity: ownersFilter && !ownersFilter.includes(r.owner) ? 0.3 : 1,
                }}
              >
                <div className="px-3 py-2 flex items-center gap-2 min-w-0">
                  <OwnerAvatar name={r.owner} division={div} size={22} />
                  <div className="min-w-0">
                    <div className="font-heading text-xs font-extrabold leading-tight">{r.owner}</div>
                    <div className="text-[9px] font-semibold mt-0.5" style={{ color: dc.text }}>{div}</div>
                  </div>
                </div>
                {seasonsToShow.map((s) => {
                  const v = grid[r.owner]?.[s] || 0;
                  const intensity = v / maxCell;
                  return (
                    <div
                      key={s}
                      className="px-1 py-2 text-center font-mono text-[11px] font-bold border-l border-border"
                      style={{
                        background: v > 0 ? `rgba(253, 74, 72, ${0.06 + intensity * 0.55})` : "transparent",
                        color: v > 0 ? (intensity > 0.55 ? "#fff" : "var(--foreground)") : "var(--muted-foreground)",
                      }}
                      title={`${r.owner} · ${s} · $${v.toFixed(1)}M`}
                    >
                      {v > 0 ? (v >= 10 ? v.toFixed(0) : v.toFixed(1)) : "—"}
                    </div>
                  );
                })}
                <div className="px-2.5 py-2 text-right border-l border-border flex flex-col items-end gap-1">
                  <span className="font-mono text-[13px] font-bold" style={{ color: "#E8B84B" }}>${r.total.toFixed(1)}</span>
                  <div className="w-[50px] h-[3px] bg-secondary rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${(r.total / maxTotal) * 100}%`, background: "#E8B84B", opacity: 0.85 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Breakdown Table ──────────────────────────────────────────────────────────

type SortKey = "player" | "owner" | "pos" | "cutYear" | "total" | "seasonHit";

function SortTh({ label, field, sortKey, sortDir, onSort, align = "left", className: extra }: {
  label: string; field: SortKey; sortKey: SortKey; sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void; align?: string; className?: string;
}) {
  const active = sortKey === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase whitespace-nowrap border-b border-border bg-secondary cursor-pointer select-none ${extra || ""}`}
      style={{ textAlign: align as "left" | "right" | "center", color: active ? "#E8B84B" : "var(--muted-foreground)" }}
    >
      {label}{active && <span className="ml-1 opacity-80">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

const BREAKDOWN_COLS = [2023, 2024, 2025, 2026, 2027];

function BreakdownTable({ rows, season, ownersFilter, search, posFilter, ownerDivisions }: {
  rows: CapHitClientRow[]; season: number; ownersFilter: string[] | null;
  search: string; posFilter: string;
  ownerDivisions: Record<string, string>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("seasonHit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupBy, setGroupBy] = useState<"owner" | "none">("owner");

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "player" || key === "owner" || key === "pos" ? "asc" : "desc"); }
  };

  const filtered = useMemo(() => {
    return rows.filter((h) => {
      if (ownersFilter && !ownersFilter.includes(h.owner)) return false;
      if (posFilter !== "ALL" && h.pos !== posFilter) return false;
      if (search && !h.player.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, ownersFilter, posFilter, search]);

  const sortedFlat = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "player":    av = a.player; bv = b.player; break;
        case "owner":     av = a.owner;  bv = b.owner;  break;
        case "pos":       av = a.pos;    bv = b.pos;    break;
        case "cutYear":   av = a.cutYear; bv = b.cutYear; break;
        case "total":     av = a.total;  bv = b.total;  break;
        case "seasonHit": av = a.yearlyHits[season] || 0; bv = b.yearlyHits[season] || 0; break;
        default:          av = 0; bv = 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, season]);

  const grouped = useMemo(() => {
    if (groupBy !== "owner") return null;
    const m: Record<string, CapHitClientRow[]> = {};
    for (const h of sortedFlat) {
      (m[h.owner] ??= []).push(h);
    }
    return Object.entries(m).map(([k, items]) => ({
      owner: k,
      items,
      seasonTotal: items.reduce((s, h) => s + (h.yearlyHits[season] || 0), 0),
      careerTotal: items.reduce((s, h) => s + h.total, 0),
    })).sort((a, b) => b.seasonTotal - a.seasonTotal);
  }, [sortedFlat, groupBy, season]);

  const maxCellValue = useMemo(() => {
    return Math.max(1, ...sortedFlat.flatMap((h) => Object.values(h.yearlyHits)));
  }, [sortedFlat]);

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase">Cap Hit Breakdown</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{sortedFlat.length} hits · viewing distribution across seasons · highlighting {season}</div>
        </div>
        <div className="flex gap-0.5 bg-card border border-border rounded-md p-0.5">
          {([{ id: "owner" as const, label: "By Owner" }, { id: "none" as const, label: "Flat" }]).map((g) => {
            const on = g.id === groupBy;
            return (
              <button
                key={g.id}
                onClick={() => setGroupBy(g.id)}
                className="font-heading text-[10px] font-bold tracking-[0.06em] uppercase cursor-pointer transition-all"
                style={{
                  padding: "4px 10px", border: "none", borderRadius: 4,
                  background: on ? "var(--secondary)" : "transparent",
                  color: on ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 1080 }}>
          <thead>
            <tr className="bg-secondary">
              <SortTh label="Player" field="player" sortKey={sortKey} sortDir={sortDir} onSort={setSort} className="pl-4 min-w-[220px]" />
              <SortTh label="Pos" field="pos" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
              {groupBy !== "owner" && <SortTh label="Owner" field="owner" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />}
              <SortTh label="Cut Yr" field="cutYear" sortKey={sortKey} sortDir={sortDir} onSort={setSort} align="center" />
              <SortTh label="Total" field="total" sortKey={sortKey} sortDir={sortDir} onSort={setSort} align="right" />
              <SortTh label={`${season} Hit`} field="seasonHit" sortKey={sortKey} sortDir={sortDir} onSort={setSort} align="right" />
              {BREAKDOWN_COLS.map((y) => (
                <th
                  key={y}
                  className="px-2 py-2.5 text-[10px] font-bold tracking-[0.06em] uppercase whitespace-nowrap border-b border-border text-right"
                  style={{
                    color: y === season ? "#FD4A48" : "var(--muted-foreground)",
                    background: y === season ? "rgba(253,74,72,0.12)" : "var(--secondary)",
                  }}
                >
                  {y} Hit
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped
              ? grouped.map((g, gi) => (
                  <OwnerGroupRow key={g.owner} group={g} season={season} maxCellValue={maxCellValue} groupIdx={gi} ownerDivisions={ownerDivisions} />
                ))
              : sortedFlat.map((h, i) => (
                  <BreakdownRow key={h.id} h={h} i={i} season={season} maxCellValue={maxCellValue} showOwner ownerDivisions={ownerDivisions} />
                ))
            }
            {sortedFlat.length === 0 && (
              <tr>
                <td colSpan={6 + BREAKDOWN_COLS.length} className="px-4 py-10 text-center text-muted-foreground text-xs">
                  No cap hits match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OwnerGroupRow({ group, season, maxCellValue, groupIdx, ownerDivisions }: {
  group: { owner: string; items: CapHitClientRow[]; seasonTotal: number; careerTotal: number };
  season: number; maxCellValue: number; groupIdx: number; ownerDivisions: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const div = ownerDivisions[group.owner] || "";
  const dc = getDivColors(div);
  return (
    <Fragment>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer border-y border-border"
        style={{ background: groupIdx % 2 === 0 ? "var(--background)" : "var(--secondary)" }}
      >
        <td className="px-4 py-2.5" colSpan={2}>
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground text-[10px] w-2.5 inline-block transition-transform duration-200" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            <OwnerAvatar name={group.owner} division={div} size={28} />
            <div>
              <div className="font-heading text-sm font-extrabold tracking-[0.02em]">
                <OwnerLink name={group.owner} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{group.owner}</OwnerLink>
              </div>
              <div className="text-[9px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: dc.text }}>
                <DivDot division={div} size={4} /> {div} · {group.items.length} hits
              </div>
            </div>
          </div>
        </td>
        <td colSpan={2} className="px-3 py-2.5 text-right text-[10px] text-muted-foreground tracking-[0.08em] uppercase font-bold">Career total</td>
        <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold" style={{ color: "#E8B84B" }}>
          ${group.careerTotal.toFixed(1)}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-sm font-extrabold" style={{ color: group.seasonTotal > 0 ? "#FD4A48" : "var(--muted-foreground)", background: "rgba(253,74,72,0.12)" }}>
          {group.seasonTotal > 0 ? `$${group.seasonTotal.toFixed(1)}` : "—"}
        </td>
        {BREAKDOWN_COLS.map((y) => {
          const v = group.items.reduce((s, h) => s + (h.yearlyHits[y] || 0), 0);
          return (
            <td
              key={y}
              className="px-2 py-2.5 text-right font-mono text-xs font-bold"
              style={{
                color: v > 0 ? (y === season ? "#FD4A48" : "var(--foreground/70)") : "var(--muted-foreground)",
                background: y === season ? "rgba(253,74,72,0.12)" : "transparent",
              }}
            >
              {v > 0 ? `$${v.toFixed(1)}` : "—"}
            </td>
          );
        })}
      </tr>
      {open && group.items.map((h, i) => (
        <BreakdownRow key={h.id} h={h} i={i} season={season} maxCellValue={maxCellValue} showOwner={false} ownerDivisions={ownerDivisions} />
      ))}
    </Fragment>
  );
}

function BreakdownRow({ h, i, season, maxCellValue, showOwner, ownerDivisions }: {
  h: CapHitClientRow; i: number; season: number; maxCellValue: number;
  showOwner?: boolean; ownerDivisions: Record<string, string>;
}) {
  const seasonAmt = h.yearlyHits[season] || 0;
  const div = ownerDivisions[h.owner] || "";
  return (
    <tr
      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
      style={{ background: i % 2 === 0 ? "transparent" : "var(--secondary)" }}
    >
      <td className="px-3 py-1.5 pl-4">
        <div className="flex items-center gap-2.5">
          <PlayerAvatar playerId={h.playerId} name={h.player} pos={h.pos} size={26} />
          <PlayerLink playerId={h.playerId} className="text-xs font-medium whitespace-nowrap hover:underline underline-offset-2">{h.player}</PlayerLink>
        </div>
      </td>
      <td className="px-3 py-1.5">
        <PosBadge pos={h.pos} />
      </td>
      {showOwner && (
        <td className="px-3 py-1.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <OwnerAvatar name={h.owner} division={div} size={20} />
            <span className="text-xs text-foreground/70">{h.owner}</span>
          </div>
        </td>
      )}
      <td className="px-3 py-1.5 text-center font-mono text-xs text-muted-foreground">
        {h.cutYear}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-xs font-bold">
        ${h.total.toFixed(1)}
      </td>
      <td className="px-3 py-1.5 text-right" style={{ background: "rgba(253,74,72,0.12)" }}>
        {seasonAmt > 0 ? (
          <span className="font-mono text-[13px] font-extrabold" style={{ color: "#FD4A48" }}>${seasonAmt.toFixed(1)}</span>
        ) : (
          <span className="text-muted-foreground text-[11px]">—</span>
        )}
      </td>
      {BREAKDOWN_COLS.map((y) => {
        const v = h.yearlyHits[y] || 0;
        const isHit = y === season;
        const intensity = v / maxCellValue;
        return (
          <td
            key={y}
            className="px-2 py-1.5 text-right relative"
            style={{
              background: isHit ? "rgba(253,74,72,0.12)" : v > 0 ? `rgba(232, 184, 75, ${0.04 + intensity * 0.18})` : "transparent",
            }}
          >
            {v > 0 ? (
              <span className="font-mono text-xs font-bold" style={{ color: isHit ? "#FD4A48" : "var(--foreground/70)" }}>${v.toFixed(1)}</span>
            ) : (
              <span className="text-muted-foreground text-[11px]">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
