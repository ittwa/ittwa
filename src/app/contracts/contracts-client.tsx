"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContractWithValue } from "@/types/contracts";
import { resolveOwnerName } from "@/lib/contracts";
import { getPositionVariant, getPositionColors, getSalaryBarColor } from "@/lib/ui-utils";

type SortKey = "player" | "position" | "owner" | "salary" | "years" | "contractStartYear";
type SortDir = "asc" | "desc";

interface ContractsClientProps {
  contracts: ContractWithValue[];
  season: string;
}

function yearsClass(years: number): string {
  if (years >= 4) return "bg-red-950/60 text-red-400 border border-red-800";
  if (years === 3) return "bg-orange-950/60 text-orange-400 border border-orange-800";
  if (years === 2) return "bg-amber-950/60 text-amber-400 border border-amber-800";
  return "bg-zinc-800 text-zinc-300 border border-zinc-700";
}

function PlayerInitials({ name, position, size = 32 }: { name: string; position: string; size?: number }) {
  const colors = getPositionColors(position);
  const init = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      }}
      className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
    >
      {init}
    </span>
  );
}

const rectFilter = "bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground appearance-none cursor-pointer hover:border-gold/60 transition-colors";

export function ContractsClient({ contracts, season }: ContractsClientProps) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [yearsFilter, setYearsFilter] = useState("");
  const [ftOnly, setFtOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("salary");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const positions = useMemo(() => [...new Set(contracts.map((c) => c.position))].sort(), [contracts]);
  const owners = useMemo(() => [...new Set(contracts.map((c) => c.owner))].sort(), [contracts]);
  const yearsOptions = useMemo(() => [...new Set(contracts.map((c) => c.years))].sort((a, b) => a - b), [contracts]);
  const maxSalary = useMemo(() => Math.max(...contracts.map((c) => c.salary), 1), [contracts]);

  const filtered = useMemo(() => {
    let result = contracts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.player.toLowerCase().includes(q));
    }
    if (posFilter) result = result.filter((c) => c.position === posFilter);
    if (ownerFilter) result = result.filter((c) => c.owner === ownerFilter);
    if (yearsFilter) result = result.filter((c) => c.years === Number(yearsFilter));
    if (ftOnly) result = result.filter((c) => c.franchiseTag);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "player": cmp = a.player.localeCompare(b.player); break;
        case "position": cmp = a.position.localeCompare(b.position); break;
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "salary": cmp = a.salary - b.salary; break;
        case "years": cmp = a.years - b.years; break;
        case "contractStartYear": cmp = a.contractStartYear.localeCompare(b.contractStartYear); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [contracts, search, posFilter, ownerFilter, yearsFilter, ftOnly, sortKey, sortDir]);

  const anyFilterActive = !!(search || posFilter || ownerFilter || yearsFilter || ftOnly);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function clearAll() {
    setSearch("");
    setPosFilter("");
    setOwnerFilter("");
    setYearsFilter("");
    setFtOnly(false);
  }

  function SortHeader({ label, field, className }: { label: string; field: SortKey; className?: string }) {
    const active = sortKey === field;
    return (
      <th
        className={cn(
          "px-3 py-3 font-medium cursor-pointer hover:text-foreground select-none transition-colors",
          active ? "text-gold" : "",
          className
        )}
        onClick={() => toggleSort(field)}
      >
        {label}
        {active && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">Contracts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {season} season · {filtered.length} of {contracts.length} active contracts
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">⌕</span>
          <input
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-foreground w-48 focus:border-gold/60 focus:outline-none transition-colors"
          />
        </div>
        <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className={rectFilter}>
          <option value="">All Positions</option>
          {positions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={rectFilter}>
          <option value="">All Owners</option>
          {owners.map((o) => <option key={o} value={o}>{resolveOwnerName(o)}</option>)}
        </select>
        <select value={yearsFilter} onChange={(e) => setYearsFilter(e.target.value)} className={rectFilter}>
          <option value="">All Years</option>
          {yearsOptions.map((y) => <option key={y} value={y}>{y === 0 ? "0 (Pickup)" : y}</option>)}
        </select>
        {/* Ghost placeholder filters */}
        <select disabled className="bg-secondary border border-border/40 rounded-lg px-3 py-1.5 text-sm text-muted-foreground/40 appearance-none cursor-not-allowed opacity-40">
          <option>Salary Range</option>
        </select>
        <select disabled className="bg-secondary border border-border/40 rounded-lg px-3 py-1.5 text-sm text-muted-foreground/40 appearance-none cursor-not-allowed opacity-40">
          <option>Start Year</option>
        </select>
        <button
          onClick={() => setFtOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            ftOnly
              ? "bg-ittwa/10 border-ittwa/40 text-ittwa"
              : "bg-secondary border-border text-muted-foreground hover:border-gold/60"
          )}
        >
          <span className={cn("inline-flex w-3.5 h-3.5 rounded border items-center justify-center text-[8px]", ftOnly ? "bg-ittwa border-ittwa text-white" : "border-muted-foreground")}>
            {ftOnly && "✓"}
          </span>
          FT Only
        </button>
        {anyFilterActive && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
            Clear all
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                  <SortHeader label="Player" field="player" className="text-left" />
                  <SortHeader label="Pos" field="position" className="text-left" />
                  <SortHeader label="Owner" field="owner" className="text-left hidden sm:table-cell" />
                  <SortHeader label="Salary" field="salary" className="text-right" />
                  <SortHeader label="Yrs" field="years" className="text-center" />
                  <SortHeader label="Start" field="contractStartYear" className="text-center hidden md:table-cell" />
                  <th className="px-3 py-3 font-medium text-center hidden md:table-cell">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground italic">
                      No contracts match your filters. Try broadening your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr
                      key={`${c.playerId}-${i}`}
                      className="border-b border-border/50 hover:bg-accent transition-colors"
                      style={i % 2 === 1 ? { backgroundColor: "rgba(22,22,22,0.5)" } : undefined}
                    >
                      <td className="px-3 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <PlayerInitials name={c.player} position={c.position} />
                          {c.player}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={getPositionVariant(c.position)}>{c.position}</Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">{resolveOwnerName(c.owner)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {c.isMidSeasonPickup ? (
                          <Badge variant="warning">Pickup</Badge>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span>${c.salary.toFixed(1)}</span>
                            <div className="mt-0.5 rounded-full bg-secondary overflow-hidden" style={{ width: "64px", height: "3px" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max((c.salary / maxSalary) * 100, 4)}%`,
                                  backgroundColor: getSalaryBarColor(c.salary),
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", yearsClass(c.years))}>
                          {c.years}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums hidden md:table-cell">{c.contractStartYear || "—"}</td>
                      <td className="px-3 py-2.5 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {c.franchiseTag && <Badge variant="ittwa">FT</Badge>}
                          {c.fifthYearTag && (
                            <Badge variant="secondary">5YT{c.fifthYearTagAmount ? ` (${c.fifthYearTagAmount})` : ""}</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wider">Pos</span>
            {(["QB", "RB", "WR", "TE", "K"] as const).map((pos) => (
              <Badge key={pos} variant={getPositionVariant(pos)} className="text-[10px] px-1.5 py-0">{pos}</Badge>
            ))}
            <span className="font-medium uppercase tracking-wider ml-3">Yrs</span>
            {[1, 2, 3, 4].map((y) => (
              <span key={y} className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium", yearsClass(y))}>
                {y === 4 ? "4+" : y}yr
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
