"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ContractWithValue } from "@/types/contracts";
import { getPositionColors } from "@/lib/ui-utils";

export interface ContractEntry extends ContractWithValue {
  rosterSeason: string;
}

type SortKey = "player" | "position" | "owner" | "salary" | "years" | "contractStartYear";
type SortDir = "asc" | "desc";

interface ContractsClientProps {
  contracts: ContractEntry[];
  season: string;
  availableSeasons: string[];
}

const YEAR_COLORS: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: "#666", bg: "transparent", border: "#2a2a2a" },
  2: { text: "#E8B84B", bg: "rgba(232,184,75,0.1)", border: "rgba(232,184,75,0.25)" },
  3: { text: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.25)" },
  4: { text: "#FD4A48", bg: "rgba(253,74,72,0.1)", border: "rgba(253,74,72,0.25)" },
};
function yearColor(y: number) { return YEAR_COLORS[Math.min(y, 4)] || YEAR_COLORS[4]; }

function PlayerAvatar({ playerId, name, pos }: { playerId: string; name: string; pos: string }) {
  const [err, setErr] = useState(false);
  const pc = getPositionColors(pos);
  const init = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const validId = playerId && playerId !== "#N/A" && playerId !== "N/A" && playerId !== "";

  if (!validId || err) {
    return (
      <div
        className="rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ width: 32, height: 32, background: pc.bg, border: `1px solid ${pc.border}` }}
      >
        <span className="font-heading text-[11px] font-bold tracking-[0.02em]" style={{ color: pc.text }}>{init}</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg flex-shrink-0 overflow-hidden"
      style={{ width: 32, height: 32, background: pc.bg, border: `1px solid ${pc.border}` }}
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

function PosBadge({ pos, rank }: { pos: string; rank?: number }) {
  const pc = getPositionColors(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}{rank != null && <span style={{ opacity: 0.7 }}>{rank}</span>}
    </span>
  );
}

function YearBadge({ years }: { years: number }) {
  const yc = yearColor(years);
  return (
    <span
      className="inline-flex items-center justify-center min-w-[26px] h-[22px] rounded-[5px] text-xs font-semibold font-mono"
      style={{ background: yc.bg, color: yc.text, border: `1px solid ${yc.border}` }}
    >
      {years}
    </span>
  );
}

function SalaryCell({ salary, maxSalary }: { salary: number; maxSalary: number }) {
  const pct = salary / maxSalary;
  const isHigh = pct > 0.6;
  const barColor = isHigh ? "#FD4A48" : "#E8B84B";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-mono text-[13px] font-semibold" style={{ color: isHigh ? "#FD4A48" : undefined }}>
        ${salary.toFixed(1)}
      </span>
      <div className="w-14 h-[2.5px] bg-[#222] rounded-sm">
        <div className="h-full rounded-sm" style={{ width: `${pct * 100}%`, background: barColor }} />
      </div>
    </div>
  );
}

function SeasonFilter({ selected, onChange, allSeasons, currentSeason }: {
  selected: string[];
  onChange: (s: string[]) => void;
  allSeasons: string[];
  currentSeason: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (s: string) => {
    if (selected.includes(s)) onChange(selected.filter((x) => x !== s));
    else onChange([...selected, s]);
  };

  const label = selected.length === allSeasons.length
    ? "All Seasons"
    : selected.length === 1
      ? `${selected[0]} Season`
      : selected.length === 0
        ? "No Season"
        : `${selected.length} Seasons`;
  const isDefault = selected.length === 1 && selected[0] === currentSeason;
  const isActive = !isDefault && selected.length < allSeasons.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="appearance-none pr-8 pl-3 py-1.5 text-[13px] rounded-lg whitespace-nowrap relative cursor-pointer"
        style={{
          background: isActive ? "rgba(232,184,75,0.08)" : "#161616",
          border: `1px solid ${isActive ? "rgba(232,184,75,0.35)" : "#1f1f1f"}`,
          color: isActive ? "#E8B84B" : "#888",
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {label}
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none" style={{ color: isActive ? "#E8B84B" : "#555" }}>▼</span>
      </button>
      {open && (
        <div
          className="absolute top-[calc(100%+4px)] left-0 z-[200] min-w-[148px] rounded-[10px] p-1.5"
          style={{ background: "#141414", border: "1px solid #1f1f1f", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          {allSeasons.map((s) => {
            const checked = selected.includes(s);
            const isCurrent = s === currentSeason;
            return (
              <label
                key={s}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md"
                style={{ background: checked ? "rgba(232,184,75,0.06)" : "transparent" }}
              >
                <div
                  className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center"
                  style={{ border: `2px solid ${checked ? "#E8B84B" : "#333"}`, background: checked ? "#E8B84B" : "transparent" }}
                >
                  {checked && <span className="text-black text-[9px] leading-none font-extrabold">✓</span>}
                </div>
                <input type="checkbox" checked={checked} onChange={() => toggle(s)} className="hidden" />
                <span className="text-[13px]" style={{ color: checked ? "#E8B84B" : "#f0f0f0", fontWeight: checked ? 600 : 400 }}>{s}</span>
                {isCurrent && <span className="text-[9px] font-bold text-[#FD4A48] tracking-[0.05em] ml-auto">NOW</span>}
              </label>
            );
          })}
          <div className="border-t border-[#1f1f1f] my-1" />
          <button
            onClick={() => { onChange([...allSeasons]); setOpen(false); }}
            className="w-full bg-transparent border-none cursor-pointer text-xs text-[#555] py-1 px-2 text-left rounded"
          >
            Show all seasons
          </button>
        </div>
      )}
    </div>
  );
}

function SalaryFilterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: "", label: "All Salaries" },
    { value: "0-25", label: "Under $25" },
    { value: "25-50", label: "$25 – $50" },
    { value: "50-75", label: "$50 – $75" },
    { value: "75-999", label: "$75+" },
  ];
  const isActive = !!value;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-7 pl-3 py-1.5 text-[13px] rounded-lg"
        style={{
          background: isActive ? "rgba(232,184,75,0.08)" : "#161616",
          border: `1px solid ${isActive ? "rgba(232,184,75,0.35)" : "#1f1f1f"}`,
          color: isActive ? "#E8B84B" : "#888",
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: isActive ? "#E8B84B" : "#555" }}>▼</span>
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const active = !!value;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-7 pl-3 py-1.5 text-[13px] rounded-lg"
        style={{
          background: active ? "rgba(232,184,75,0.08)" : "#161616",
          border: `1px solid ${active ? "rgba(232,184,75,0.35)" : "#1f1f1f"}`,
          color: active ? "#E8B84B" : "#888",
          fontWeight: active ? 600 : 400,
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: active ? "#E8B84B" : "#555" }}>▼</span>
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555] text-[13px]">⌕</span>
      <input
        type="text"
        placeholder="Search player…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#161616] border border-[#1f1f1f] rounded-lg py-1.5 pl-[30px] pr-3 text-[13px] text-[#f0f0f0] w-[180px]"
      />
    </div>
  );
}

function CheckFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] cursor-pointer"
      style={{
        background: checked ? "rgba(253,74,72,0.1)" : "#161616",
        border: `1px solid ${checked ? "rgba(253,74,72,0.35)" : "#1f1f1f"}`,
        color: checked ? "#FD4A48" : "#888",
        fontWeight: checked ? 600 : 400,
      }}
    >
      <span
        className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center"
        style={{ border: `2px solid ${checked ? "#FD4A48" : "#555"}`, background: checked ? "#FD4A48" : "transparent" }}
      >
        {checked && <span className="text-white text-[9px] leading-none">✓</span>}
      </span>
      {label}
    </button>
  );
}

function SortTh({ label, field, sortKey, sortDir, onSort, align = "left" }: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (f: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase whitespace-nowrap cursor-pointer select-none bg-[#161616] border-b border-[#1f1f1f]"
      style={{ color: active ? "#E8B84B" : "#555", textAlign: align }}
    >
      {label}
      {active && <span className="ml-1 opacity-80">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

export function ContractsClient({ contracts, season, availableSeasons }: ContractsClientProps) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [yearsFilter, setYearsFilter] = useState("");
  const [salaryFilter, setSalaryFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState<string[]>([season]);
  const [ftOnly, setFtOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("salary");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const positions = useMemo(() => [...new Set(contracts.map((c) => c.position))].sort(), [contracts]);
  const owners = useMemo(() => [...new Set(contracts.map((c) => c.owner))].sort(), [contracts]);
  const yearsOptions = useMemo(() => [...new Set(contracts.map((c) => c.years))].sort((a, b) => a - b), [contracts]);
  const allSeasons = availableSeasons;
  const maxSalary = useMemo(() => Math.max(...contracts.map((c) => c.salary), 1), [contracts]);

  const posRanks = useMemo(() => {
    const ranks: Record<string, number> = {};
    for (const pos of positions) {
      contracts
        .filter((c) => c.position === pos)
        .sort((a, b) => b.salary - a.salary)
        .forEach((c, i) => { ranks[c.player] = i + 1; });
    }
    return ranks;
  }, [contracts, positions]);

  const filtered = useMemo(() => {
    let result = [...contracts];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.player.toLowerCase().includes(q));
    }
    if (seasonFilter.length > 0) result = result.filter((c) => seasonFilter.includes(c.rosterSeason));
    if (posFilter) result = result.filter((c) => c.position === posFilter);
    if (ownerFilter) result = result.filter((c) => c.owner === ownerFilter);
    if (salaryFilter) {
      const [mn, mx] = salaryFilter.split("-").map(Number);
      result = result.filter((c) => c.salary >= mn && c.salary < mx);
    }
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
  }, [contracts, search, seasonFilter, posFilter, ownerFilter, salaryFilter, yearsFilter, ftOnly, sortKey, sortDir]);

  const seasonFilterActive = !(seasonFilter.length === 1 && seasonFilter[0] === season);
  const activeFilters = [
    seasonFilterActive,
    ownerFilter, posFilter, salaryFilter, yearsFilter, ftOnly,
  ].filter(Boolean).length;

  function toggleSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir("desc"); }
  }

  function clearAll() {
    setSearch(""); setSeasonFilter([season]); setOwnerFilter("");
    setPosFilter(""); setSalaryFilter(""); setYearsFilter(""); setFtOnly(false);
  }

  const seasonLabel = seasonFilter.length === allSeasons.length
    ? "All Seasons"
    : seasonFilter.length === 1
      ? `${seasonFilter[0]} Season`
      : `${seasonFilter.length} Seasons`;

  return (
    <div>
      {/* Page header */}
      <div className="pb-6 border-b border-[#1f1f1f] mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
          <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Contracts</h1>
        </div>
        <p className="text-[13px] text-[#555] ml-4">
          {seasonLabel} · <span className="text-[#f0f0f0] font-medium">{filtered.length}</span> of {contracts.length} active contracts
          {activeFilters > 0 && (
            <span className="text-[#E8B84B] font-semibold ml-2">· {activeFilters} filter{activeFilters > 1 ? "s" : ""} active</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <SearchInput value={search} onChange={setSearch} />
        <SeasonFilter selected={seasonFilter} onChange={setSeasonFilter} allSeasons={allSeasons} currentSeason={season} />
        <FilterSelect value={ownerFilter} onChange={setOwnerFilter} placeholder="All Owners"
          options={owners.map((o) => ({ value: o, label: o }))} />
        <FilterSelect value={posFilter} onChange={setPosFilter} placeholder="All Positions"
          options={positions.map((p) => ({ value: p, label: p }))} />
        <SalaryFilterSelect value={salaryFilter} onChange={setSalaryFilter} />
        <FilterSelect value={yearsFilter} onChange={setYearsFilter} placeholder="All Years"
          options={yearsOptions.map((y) => ({ value: String(y), label: y === 1 ? "1 yr" : `${y} yrs` }))} />
        <CheckFilter label="FT Only" checked={ftOnly} onChange={setFtOnly} />
        {activeFilters > 0 && (
          <button onClick={clearAll} className="bg-transparent border-none cursor-pointer text-xs text-[#FD4A48] font-semibold px-2 py-1.5">
            Clear all ×
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <SortTh label="Player" field="player" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Pos" field="position" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Owner" field="owner" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Salary" field="salary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortTh label="Yrs" field="years" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortTh label="Season" field="contractStartYear" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <th className="px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase text-[#555] text-center border-b border-[#1f1f1f] bg-[#161616] whitespace-nowrap">Tags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#555] italic text-sm">
                    No contracts match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <tr
                    key={`${c.playerId}-${i}`}
                    className="border-b border-[#1f1f1f] last:border-b-0 hover:bg-[#181818] transition-colors"
                    style={i % 2 === 1 ? { backgroundColor: "rgba(22,22,22,0.5)" } : undefined}
                  >
                    <td className="px-3 py-2 pl-4">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar playerId={c.playerId} name={c.player} pos={c.position} />
                        <span className="text-[13px] font-medium whitespace-nowrap">{c.player}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <PosBadge pos={c.position} rank={posRanks[c.player]} />
                    </td>
                    <td className="px-3 py-2 text-[13px] text-[#888] whitespace-nowrap">{c.owner}</td>
                    <td className="px-3 py-2 text-right">
                      {c.isMidSeasonPickup ? (
                        <span className="text-[#555] text-xs">—</span>
                      ) : (
                        <SalaryCell salary={c.salary} maxSalary={maxSalary} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <YearBadge years={c.years} />
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-[#555] font-mono">{c.contractStartYear || "—"}</td>
                    <td className="px-3 py-2 pr-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {c.franchiseTag && (
                          <span
                            className="text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(253,74,72,0.1)", color: "#FD4A48", border: "1px solid rgba(253,74,72,0.3)" }}
                          >FT</span>
                        )}
                        {c.fifthYearTag && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
                          >5YT{c.fifthYearTagAmount ? ` ${c.fifthYearTagAmount}` : ""}</span>
                        )}
                        {!c.franchiseTag && !c.fifthYearTag && <span className="text-[11px] text-[#555]">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer legend */}
        <div className="px-4 py-3 border-t border-[#1f1f1f] bg-[#161616] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-4 items-center">
            {(["QB", "RB", "WR", "TE", "K", "DEF"] as const).map((pos) => {
              const pc = getPositionColors(pos);
              return (
                <div key={pos} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: pc.bg, border: `1px solid ${pc.border}` }} />
                  <span className="text-[10px] text-[#555] font-semibold">{pos}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-[10px] text-[#555] font-semibold tracking-[0.06em] uppercase">Yrs:</span>
            {([1, 2, 3, "4+"] as const).map((y, idx) => {
              const yc = yearColor(typeof y === "string" ? 4 : y);
              return (
                <div key={String(y)} className="flex items-center gap-1.5">
                  <div
                    className="w-3.5 h-3.5 rounded flex items-center justify-center"
                    style={{ background: yc.bg, border: `1px solid ${yc.border}` }}
                  >
                    <span className="text-[8px] font-bold" style={{ color: yc.text }}>{y}</span>
                  </div>
                  <span className="text-[10px] text-[#555]">{["Short", "Medium", "Long", "Multi"][idx]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
