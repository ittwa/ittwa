"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContractWithValue } from "@/types/contracts";
import { resolveOwnerName } from "@/lib/contracts";

type SortKey = "player" | "position" | "owner" | "salary" | "years" | "contractStartYear" | "contractValue";
type SortDir = "asc" | "desc";

interface ContractsClientProps {
  contracts: ContractWithValue[];
  season: string;
}

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
        case "contractValue": cmp = a.contractValue - b.contractValue; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [contracts, search, posFilter, ownerFilter, yearsFilter, ftOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({ label, field, className }: { label: string; field: SortKey; className?: string }) {
    return (
      <th
        className={cn("px-3 py-3 font-medium cursor-pointer hover:text-foreground select-none", className)}
        onClick={() => toggleSort(field)}
      >
        {label}
        {sortKey === field && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {season} season &middot; {filtered.length} active contracts
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground w-48"
        />
        <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="">All Positions</option>
          {positions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="">All Owners</option>
          {owners.map((o) => <option key={o} value={o}>{resolveOwnerName(o)}</option>)}
        </select>
        <select value={yearsFilter} onChange={(e) => setYearsFilter(e.target.value)} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="">All Years</option>
          {yearsOptions.map((y) => <option key={y} value={y}>{y === 0 ? "0 (Pickup)" : y}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={ftOnly} onChange={(e) => setFtOnly(e.target.checked)} className="rounded accent-ittwa" />
          FT Only
        </label>
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
                  <th className="px-3 py-3 font-medium text-left hidden lg:table-cell">DP Owner</th>
                  <th className="px-3 py-3 font-medium text-center hidden md:table-cell">Tags</th>
                  <SortHeader label="Value" field="contractValue" className="text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground italic">
                      No contracts match your filters. Try broadening your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr key={`${c.playerId}-${i}`} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{c.player}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.position}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">{resolveOwnerName(c.owner)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {c.isMidSeasonPickup ? (
                          <Badge variant="warning">Mid-Season Pickup</Badge>
                        ) : (
                          `$${c.salary.toFixed(1)}`
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{c.years}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums hidden md:table-cell">{c.contractStartYear || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">{c.dpOriginalOwner || "—"}</td>
                      <td className="px-3 py-2.5 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {c.franchiseTag && <Badge variant="ittwa">FT</Badge>}
                          {c.fifthYearTag && (
                            <Badge variant="secondary">5YT {c.fifthYearTagAmount ? `(${c.fifthYearTagAmount})` : ""}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {c.contractValue > 0 ? `$${c.contractValue.toFixed(1)}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
