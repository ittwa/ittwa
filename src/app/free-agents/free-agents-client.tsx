"use client";

import { useState, useMemo } from "react";
import type { FreeAgentRow } from "./page";

// ── Design tokens from prototype ─────────────────────────────────────────────

const POS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  QB:  { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)" },
  RB:  { text: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.25)" },
  WR:  { text: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.25)" },
  TE:  { text: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.25)" },
  K:   { text: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)" },
};
const DEFAULT_POS = { text: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };

function posColor(pos: string) {
  return POS_COLORS[pos] || DEFAULT_POS;
}

const STATUS_COLORS: Record<string, { label: string; text: string; bg: string; border: string }> = {
  UFA:    { label: "UFA",    text: "#E8B84B", bg: "rgba(232,184,75,0.1)",  border: "rgba(232,184,75,0.3)" },
  RFA:    { label: "RFA",    text: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)" },
  ROOKIE: { label: "ROOKIE", text: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)" },
  CUT:    { label: "CUT",    text: "#FD4A48", bg: "rgba(253,74,72,0.1)",   border: "rgba(253,74,72,0.3)" },
  IR:     { label: "IR",     text: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
};

const FT_COST: Record<string, number> = { QB: 48, RB: 52, WR: 66, TE: 30, K: 8 };
const ALL_POS = ["QB", "RB", "WR", "TE", "K"] as const;
const ALL_STATUS = ["UFA", "RFA", "ROOKIE", "CUT", "IR"] as const;

const MAX_FT_COST = Math.max(...Object.values(FT_COST));

// ── Sub-components ───────────────────────────────────────────────────────────

function PlayerAvatar({ playerId, name, pos, size = 32 }: { playerId: string; name: string; pos: string; size?: number }) {
  const [err, setErr] = useState(false);
  const pc = posColor(pos);
  const ini = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const validId = playerId && playerId !== "#N/A" && playerId !== "N/A" && playerId !== "";

  if (!validId || err) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: size, height: size, borderRadius: 8, background: pc.bg, border: `1px solid ${pc.border}` }}
      >
        <span className="font-heading font-bold" style={{ fontSize: 11, color: pc.text, letterSpacing: "0.02em" }}>{ini}</span>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, borderRadius: 8, background: pc.bg, border: `1px solid ${pc.border}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`}
        alt={name}
        onError={() => setErr(true)}
        className="w-full h-full object-cover object-top"
      />
    </div>
  );
}

function PosBadge({ pos }: { pos: string }) {
  const pc = posColor(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] whitespace-nowrap"
      style={{ padding: "2px 6px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLORS[status];
  if (!sc) return <span className="text-muted-foreground text-[11px]">—</span>;
  return (
    <span
      className="text-[10px] font-bold tracking-[0.06em] whitespace-nowrap"
      style={{ padding: "2px 7px", borderRadius: 4, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
    >
      {sc.label}
    </span>
  );
}

function SortTh({ label, field, sortKey: sk, sortDir: sd, onSort, align = "left", className: extra }: {
  label: string; field: SortKey; sortKey: SortKey; sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void; align?: string; className?: string;
}) {
  const active = sk === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase whitespace-nowrap border-b border-border bg-secondary cursor-pointer select-none ${extra || ""}`}
      style={{ textAlign: align as "left" | "right" | "center", color: active ? "#E8B84B" : "var(--muted-foreground)" }}
    >
      {label}{active && <span className="ml-1 opacity-80">{sd === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type SortKey = "player" | "pos" | "status" | "owner" | "salary" | "last" | "ftCost";

interface Props {
  players: FreeAgentRow[];
  season: string;
  ownerAvatars: Record<string, string>;
}

// ── Main Client Component ────────────────────────────────────────────────────

export function FreeAgentsClient({ players, season, ownerAvatars }: Props) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [maxAge, setMaxAge] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("salary");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function onSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir("desc"); }
  }

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function clearAll() {
    setSearch("");
    setPosFilter("");
    setStatusFilter([]);
    setMaxAge("");
  }

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of ALL_STATUS) m[s] = 0;
    for (const p of players) m[p.status] = (m[p.status] || 0) + 1;
    return m;
  }, [players]);

  const posCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of ALL_POS) m[p] = 0;
    for (const p of players) m[p.pos] = (m[p.pos] || 0) + 1;
    return m;
  }, [players]);

  const filtered = useMemo(() => {
    let r = [...players];
    if (search) r = r.filter((p) => p.player.toLowerCase().includes(search.toLowerCase()));
    if (posFilter) r = r.filter((p) => p.pos === posFilter);
    if (statusFilter.length > 0) r = r.filter((p) => statusFilter.includes(p.status));
    if (maxAge) r = r.filter((p) => p.age <= Number(maxAge));
    r.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "player") cmp = a.player.localeCompare(b.player);
      else if (sortKey === "pos") cmp = a.pos.localeCompare(b.pos);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "owner") cmp = (a.lastOwner || "zz").localeCompare(b.lastOwner || "zz");
      else if (sortKey === "salary") cmp = a.lastSalary - b.lastSalary;
      else if (sortKey === "last") cmp = (a.lastYear || "").localeCompare(b.lastYear || "");
      else if (sortKey === "ftCost") cmp = (FT_COST[a.pos] || 0) - (FT_COST[b.pos] || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [players, search, posFilter, statusFilter, maxAge, sortKey, sortDir]);

  const activeFilters = [posFilter, statusFilter.length > 0, maxAge].filter(Boolean).length;

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-8 pb-16">
      {/* TODO: PageHeader — gold bar + "Free Agents" title + subtitle */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
          <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">
            Free Agents
          </h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-4">
          {season} Season · {filtered.length} of {players.length} players available
          {activeFilters > 0 && (
            <span className="text-[#E8B84B] ml-2 font-semibold">
              · {activeFilters} filter{activeFilters > 1 ? "s" : ""} active
            </span>
          )}
        </p>
      </div>

      {/* Position summary tiles */}
      <div className="flex gap-2.5 mb-5 flex-wrap">
        {ALL_POS.map((pos) => {
          const pc = posColor(pos);
          const cost = FT_COST[pos];
          return (
            <div
              key={pos}
              className="flex-1 min-w-[140px] bg-card border border-border rounded-[10px] p-3.5 flex flex-col gap-1 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: pc.text, opacity: 0.7 }} />
              <div className="flex items-center justify-between">
                <span className="font-heading text-lg font-extrabold tracking-[0.06em]" style={{ color: pc.text }}>{pos}</span>
                <span className="font-mono text-[13px] font-semibold">{posCounts[pos]}</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[10px] text-muted-foreground tracking-[0.08em] uppercase font-semibold">FT Tag</span>
                <span className="font-mono text-sm font-bold text-[#E8B84B]">${cost}.0</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status pills */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <span className="text-[10px] text-muted-foreground tracking-[0.08em] uppercase font-bold mr-1">Status</span>
        {ALL_STATUS.map((s) => {
          const sc = STATUS_COLORS[s];
          const active = statusFilter.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className="inline-flex items-center gap-1.5 cursor-pointer transition-all duration-150"
              style={{
                background: active ? sc.bg : "var(--secondary)",
                border: `1px solid ${active ? sc.border : "var(--border)"}`,
                borderRadius: 8, padding: "7px 12px",
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? sc.text : "var(--muted-foreground)",
                letterSpacing: "0.04em",
              }}
            >
              <span
                className="rounded-full"
                style={{ width: 6, height: 6, background: sc.text, opacity: active ? 1 : 0.5 }}
              />
              {sc.label}
              <span className="font-mono font-semibold" style={{ color: active ? sc.text : "var(--muted-foreground)", opacity: 0.7 }}>
                {statusCounts[s] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">⌕</span>
          <input
            type="text"
            placeholder="Search player…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border border-border rounded-lg pl-7 pr-3 py-[7px] text-[13px] text-foreground placeholder:text-muted-foreground/50 w-[180px]"
          />
        </div>
        <div className="relative">
          <select
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value)}
            className="bg-secondary border border-border rounded-lg py-[7px] pl-3 pr-8 text-[13px] cursor-pointer"
            style={{
              background: posFilter ? "rgba(232,184,75,0.08)" : undefined,
              borderColor: posFilter ? "rgba(232,184,75,0.35)" : undefined,
              color: posFilter ? "#E8B84B" : "var(--muted-foreground)",
              fontWeight: posFilter ? 600 : 400,
            }}
          >
            <option value="">All Positions</option>
            {ALL_POS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: posFilter ? "#E8B84B" : "var(--muted-foreground)" }}>▼</span>
        </div>
        <div className="relative">
          <select
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
            className="bg-secondary border border-border rounded-lg py-[7px] pl-3 pr-8 text-[13px] cursor-pointer"
            style={{
              background: maxAge ? "rgba(232,184,75,0.08)" : undefined,
              borderColor: maxAge ? "rgba(232,184,75,0.35)" : undefined,
              color: maxAge ? "#E8B84B" : "var(--muted-foreground)",
              fontWeight: maxAge ? 600 : 400,
            }}
          >
            <option value="">Any Age</option>
            <option value="25">Under 26</option>
            <option value="28">Under 29</option>
            <option value="31">Under 32</option>
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: maxAge ? "#E8B84B" : "var(--muted-foreground)" }}>▼</span>
        </div>
        {activeFilters > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-[#FD4A48] font-semibold cursor-pointer bg-transparent border-none px-2 py-[7px]"
          >
            Clear all ×
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <SortTh label="Player" field="player" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="pl-4" />
                <SortTh label="Pos" field="pos" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Status" field="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Last Owner" field="owner" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Last Salary" field="salary" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                <SortTh label="Last Yr" field="last" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="center" />
                <SortTh label="Est. FT Tag" field="ftCost" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm italic">
                    No free agents match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const ftCost = FT_COST[p.pos];
                  const ftPct = ftCost != null ? ftCost / MAX_FT_COST : 0;
                  const ftHigh = ftPct > 0.6;
                  return (
                    <tr
                      key={p.playerId}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                      style={{ background: i % 2 === 0 ? "transparent" : "var(--secondary)" }}
                    >
                      <td className="px-3 py-2 pl-4">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar playerId={p.playerId} name={p.player} pos={p.pos} />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-medium whitespace-nowrap">{p.player}</span>
                            <span className="text-[10px] text-muted-foreground font-mono tracking-[0.04em]">
                              {p.lastTeam} · AGE {p.age}{p.exp > 0 ? ` · ${p.exp}Y` : " · RK"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <PosBadge pos={p.pos} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-2 text-[13px] whitespace-nowrap" style={{ color: p.lastOwner ? "var(--muted-foreground)" : "var(--muted-foreground)", fontStyle: p.lastOwner ? "normal" : "italic", opacity: p.lastOwner ? 1 : 0.6 }}>
                        {p.lastOwner || "Never signed"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.lastSalary > 0 ? (
                          <span className="font-mono text-[13px] text-muted-foreground font-medium">${p.lastSalary.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground font-mono">{p.lastYear}</td>
                      <td className="px-3 py-2 pr-4 text-right">
                        {ftCost != null ? (
                          <div className="flex flex-col items-end gap-[3px]">
                            <span className="font-mono text-[13px] font-semibold" style={{ color: ftHigh ? "#FD4A48" : "var(--foreground)" }}>
                              ${ftCost.toFixed(1)}
                            </span>
                            <div className="w-14 h-[2.5px] bg-secondary rounded-sm overflow-hidden">
                              <div className="h-full rounded-sm" style={{ width: `${ftPct * 100}%`, background: ftHigh ? "#FD4A48" : "#E8B84B" }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer legend */}
        <div className="px-4 py-3 border-t border-border bg-secondary flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-3.5 items-center flex-wrap">
            {ALL_POS.map((pos) => {
              const pc = posColor(pos);
              return (
                <div key={pos} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: pc.bg, border: `1px solid ${pc.border}` }} />
                  <span className="text-[10px] text-muted-foreground font-semibold">{pos}</span>
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-muted-foreground tracking-[0.02em]">
            FT tag = avg of top-5 salaries at position · all figures in $M
          </span>
        </div>
      </div>
    </div>
  );
}
