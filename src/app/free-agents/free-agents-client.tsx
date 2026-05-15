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

      {/* TODO: PosTiles — position summary KPI tiles with FT tag costs */}

      {/* TODO: StatusPills — UFA/RFA/ROOKIE/CUT/IR toggle pills */}

      {/* TODO: FilterBar — search, position dropdown, age dropdown, clear button */}

      {/* TODO: FreeAgentTable — sortable table with player rows, avatars, badges */}

      {/* TODO: FooterLegend — position color legend + FT tag explanation */}
    </div>
  );
}
