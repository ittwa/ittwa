"use client";

import { useState, useMemo } from "react";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
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

const ALL_POS = ["QB", "RB", "WR", "TE"] as const;

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

function PosBadge({ pos, rank }: { pos: string; rank?: number | null }) {
  const pc = posColor(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] whitespace-nowrap"
      style={{ padding: "2px 6px", borderRadius: 4, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}{rank != null && <span style={{ opacity: 0.7 }}>{rank}</span>}
    </span>
  );
}

function OwnerAvatar({ name, size = 20 }: { name: string; size?: number }) {
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
        fallback={<span className="font-heading font-extrabold" style={{ fontSize: size * 0.36, color: "var(--muted-foreground)", letterSpacing: "-0.01em" }}>{initials}</span>}
      />
    </div>
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

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  options: { value: string; label: string }[];
}) {
  const active = !!value;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-secondary border border-border rounded-lg py-[6px] pl-3 pr-8 text-[13px] cursor-pointer"
        style={{
          background: active ? "rgba(232,184,75,0.08)" : undefined,
          borderColor: active ? "rgba(232,184,75,0.35)" : undefined,
          color: active ? "#E8B84B" : "var(--muted-foreground)",
          fontWeight: active ? 600 : 400,
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: active ? "#E8B84B" : "var(--muted-foreground)" }}>▼</span>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type SortKey = "player" | "pos" | "owner" | "points" | "salary" | "contract";

interface Props {
  players: FreeAgentRow[];
  season: string;
  ownerAvatars: Record<string, string>;
  owners: string[];
}

// ── Main Client Component ────────────────────────────────────────────────────

export function FreeAgentsClient({ players, season, ownerAvatars, owners }: Props) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function onSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir(field === "player" || field === "pos" || field === "owner" ? "asc" : "desc"); }
  }

  function clearAll() {
    setSearch("");
    setPosFilter("");
    setMaxAge("");
    setOwnerFilter("");
    setMinSalary("");
  }

  const posCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of ALL_POS) m[p] = 0;
    for (const p of players) m[p.pos] = (m[p.pos] || 0) + 1;
    return m;
  }, [players]);

  const maxSalaryValue = useMemo(() => Math.max(1, ...players.map((p) => p.lastSalary)), [players]);

  const filtered = useMemo(() => {
    let r = [...players];
    if (search) r = r.filter((p) => p.player.toLowerCase().includes(search.toLowerCase()));
    if (posFilter) r = r.filter((p) => p.pos === posFilter);
    if (maxAge) r = r.filter((p) => p.age <= Number(maxAge));
    if (ownerFilter) r = r.filter((p) => p.lastOwner === ownerFilter);
    if (minSalary) r = r.filter((p) => p.lastSalary >= Number(minSalary));
    r.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "player") cmp = a.player.localeCompare(b.player);
      else if (sortKey === "pos") cmp = a.pos.localeCompare(b.pos) || (a.posRank ?? 9999) - (b.posRank ?? 9999);
      else if (sortKey === "owner") cmp = (a.lastOwner || "zz").localeCompare(b.lastOwner || "zz");
      else if (sortKey === "points") cmp = a.lastPoints - b.lastPoints;
      else if (sortKey === "salary") cmp = a.lastSalary - b.lastSalary;
      else if (sortKey === "contract") cmp = (a.lastYear || "").localeCompare(b.lastYear || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [players, search, posFilter, maxAge, ownerFilter, minSalary, sortKey, sortDir]);

  const activeFilters = [posFilter, maxAge, ownerFilter, minSalary].filter(Boolean).length;

  return (
    <div>
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
          const count = posCounts[pos];
          const total = players.length;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div
              key={pos}
              className="flex-1 min-w-[140px] bg-card border border-border rounded-[10px] p-3.5 flex flex-col gap-1 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: pc.text, opacity: 0.7 }} />
              <div className="flex items-center justify-between">
                <span className="font-heading text-lg font-extrabold tracking-[0.06em]" style={{ color: pc.text }}>{pos}</span>
                <span className="font-mono text-[13px] font-semibold">{count}</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[10px] text-muted-foreground tracking-[0.08em] uppercase font-semibold">Available</span>
                <span className="font-mono text-sm font-bold text-muted-foreground">{pct}%</span>
              </div>
            </div>
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
            className="bg-secondary border border-border rounded-lg pl-7 pr-3 py-[6px] text-[13px] text-foreground placeholder:text-muted-foreground/50 w-[160px]"
          />
        </div>
        <FilterSelect value={posFilter} onChange={setPosFilter} placeholder="All Positions" options={ALL_POS.map((p) => ({ value: p, label: p }))} />
        <FilterSelect value={ownerFilter} onChange={setOwnerFilter} placeholder="All Owners" options={[...owners].sort().map((o) => ({ value: o, label: o }))} />
        <FilterSelect value={minSalary} onChange={setMinSalary} placeholder="Any Salary" options={[
          { value: "5", label: "≥ $5M" },
          { value: "10", label: "≥ $10M" },
          { value: "20", label: "≥ $20M" },
          { value: "30", label: "≥ $30M" },
        ]} />
        <FilterSelect value={maxAge} onChange={setMaxAge} placeholder="Any Age" options={[
          { value: "25", label: "Under 26" },
          { value: "28", label: "Under 29" },
          { value: "31", label: "Under 32" },
        ]} />
        {activeFilters > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-[#FD4A48] font-semibold cursor-pointer bg-transparent border-none px-2 py-[6px]"
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
                <SortTh label="Last Owner" field="owner" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Last Pts" field="points" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                <SortTh label="Last Salary" field="salary" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                <SortTh label="Last Contract" field="contract" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="center" className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm italic">
                    No free agents match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const salaryPct = p.lastSalary / maxSalaryValue;
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
                        <PosBadge pos={p.pos} rank={p.posRank} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.lastOwner ? (
                          <div className="flex items-center gap-1.5">
                            <OwnerAvatar name={p.lastOwner} size={20} />
                            <span className="text-[13px] text-muted-foreground">{p.lastOwner}</span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-muted-foreground italic opacity-60">Never signed</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.lastPoints > 0 ? (
                          <span className="font-mono text-[13px] font-medium">{p.lastPoints.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.lastSalary > 0 ? (
                          <div className="flex flex-col items-end gap-[3px]">
                            <span className="font-mono text-[13px] text-muted-foreground font-medium">${p.lastSalary.toFixed(1)}</span>
                            <div className="w-14 h-[2.5px] bg-secondary rounded-sm overflow-hidden">
                              <div className="h-full rounded-sm" style={{ width: `${salaryPct * 100}%`, background: salaryPct > 0.6 ? "#FD4A48" : "#E8B84B" }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 pr-4 text-center">
                        {p.lastContractYears > 0 ? (
                          <span className="font-mono text-xs text-muted-foreground">{p.lastContractYears}yr · {p.lastYear}</span>
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
            Positional rankings from previous season · all salary figures in $M
          </span>
        </div>
      </div>
    </div>
  );
}
