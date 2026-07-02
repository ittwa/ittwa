"use client";

import { useMemo, useState } from "react";
import { OwnerLink } from "@/components/owner-link";
import { PlayerLink } from "@/components/player-link";
import { Tooltip } from "@/components/ui/tooltip";
import { getPositionColors } from "@/lib/ui-utils";
import type { TagHistoryEntry, TagType } from "@/types/tags";

type SortKey = "season" | "player" | "position" | "owner" | "tagType" | "salary";
type SortDir = "asc" | "desc";

function PosBadge({ pos }: { pos: string }) {
  const pc = getPositionColors(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}
    </span>
  );
}

function TagTypeBadge({ tagType }: { tagType: TagType }) {
  if (tagType === "franchise") {
    return (
      <span
        className="text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ background: "rgba(253,74,72,0.1)", color: "#FD4A48", border: "1px solid rgba(253,74,72,0.3)" }}
      >
        FRANCHISE
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
    >
      5TH YEAR
    </span>
  );
}

function ConsecutiveBadge({ label }: { label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: "rgba(232,184,75,0.1)", color: "#E8B84B", border: "1px solid rgba(232,184,75,0.3)" }}
    >
      {label}
    </span>
  );
}

function SortTh({ label, field, sortKey, sortDir, onSort, align = "left", tooltip }: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (f: SortKey) => void;
  align?: "left" | "right" | "center";
  tooltip?: string;
}) {
  const active = sortKey === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase whitespace-nowrap cursor-pointer select-none bg-secondary border-b border-border"
      style={{ color: active ? "#E8B84B" : "var(--muted-foreground)", textAlign: align }}
    >
      {label}
      {tooltip && (
        <Tooltip content={tooltip} side="bottom" align="end" className="normal-case tracking-normal font-normal">
          <span className="ml-1 text-[#E8B84B]/70 cursor-help">ⓘ</span>
        </Tooltip>
      )}
      {active && <span className="ml-1 opacity-80">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
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
          background: active ? "rgba(232,184,75,0.08)" : "var(--secondary)",
          border: `1px solid ${active ? "rgba(232,184,75,0.35)" : "var(--border)"}`,
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

export function TagHistoryTable({ history }: { history: TagHistoryEntry[] }) {
  const [seasonFilter, setSeasonFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("season");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const seasons = useMemo(() => [...new Set(history.map((h) => h.season))].sort().reverse(), [history]);
  const owners = useMemo(() => [...new Set(history.map((h) => h.owner))].sort(), [history]);
  const positions = useMemo(() => [...new Set(history.map((h) => h.position))].sort(), [history]);

  const filtered = useMemo(() => {
    let result = [...history];
    if (seasonFilter) result = result.filter((h) => h.season === seasonFilter);
    if (ownerFilter) result = result.filter((h) => h.owner === ownerFilter);
    if (posFilter) result = result.filter((h) => h.position === posFilter);
    if (typeFilter) result = result.filter((h) => h.tagType === typeFilter);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "season": cmp = a.season.localeCompare(b.season); break;
        case "player": cmp = a.player.localeCompare(b.player); break;
        case "position": cmp = a.position.localeCompare(b.position); break;
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "tagType": cmp = a.tagType.localeCompare(b.tagType); break;
        case "salary": cmp = a.salary - b.salary; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [history, seasonFilter, ownerFilter, posFilter, typeFilter, sortKey, sortDir]);

  function toggleSort(field: SortKey) {
    if (sortKey === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(field); setSortDir("desc"); }
  }

  const activeFilters = [seasonFilter, ownerFilter, posFilter, typeFilter].filter(Boolean).length;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <FilterSelect value={seasonFilter} onChange={setSeasonFilter} placeholder="All Seasons"
          options={seasons.map((s) => ({ value: s, label: s }))} />
        <FilterSelect value={ownerFilter} onChange={setOwnerFilter} placeholder="All Owners"
          options={owners.map((o) => ({ value: o, label: o }))} />
        <FilterSelect value={posFilter} onChange={setPosFilter} placeholder="All Positions"
          options={positions.map((p) => ({ value: p, label: p }))} />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} placeholder="All Tag Types"
          options={[{ value: "franchise", label: "Franchise" }, { value: "fifth-year", label: "5th Year" }]} />
        {activeFilters > 0 && (
          <button
            onClick={() => { setSeasonFilter(""); setOwnerFilter(""); setPosFilter(""); setTypeFilter(""); }}
            className="bg-transparent border-none cursor-pointer text-xs text-[#FD4A48] font-semibold px-2 py-1.5"
          >
            Clear all ×
          </button>
        )}
        <span className="text-[12px] text-muted-foreground ml-auto">
          {filtered.length} of {history.length} tags
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <SortTh label="Season" field="season" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortTh label="Player" field="player" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Pos" field="position" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Owner" field="owner" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Type" field="tagType" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <th className="px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase text-center border-b border-border bg-secondary whitespace-nowrap text-muted-foreground">
                  Details
                </th>
                <SortTh label="Salary" field="salary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right"
                  tooltip="For 5th-year tags, this is the raw salary from the sheet's own flagged row — see the note below the table." />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground italic text-sm">
                    No tags match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((h, i) => (
                  <tr
                    key={h.key}
                    className="border-b border-border last:border-b-0 hover:bg-accent transition-colors"
                    style={i % 2 === 1 ? { backgroundColor: "var(--secondary)" } : undefined}
                  >
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground font-mono">{h.season}</td>
                    <td className="px-3 py-2 pl-4">
                      <PlayerLink playerId={h.playerId} className="text-[13px] font-medium whitespace-nowrap hover:underline underline-offset-2">
                        {h.player}
                      </PlayerLink>
                      {h.incompleteData && (
                        <Tooltip content="Some contract history for this player is missing or ambiguous — treat this entry's details as approximate.">
                          <span className="ml-1.5 text-[10px] text-muted-foreground cursor-help">⚠</span>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-3 py-2"><PosBadge pos={h.position} /></td>
                    <td className="px-3 py-2">
                      <OwnerLink name={h.owner} className="text-[13px] text-muted-foreground whitespace-nowrap hover:underline underline-offset-2">
                        {h.owner}
                      </OwnerLink>
                    </td>
                    <td className="px-3 py-2 text-center"><TagTypeBadge tagType={h.tagType} /></td>
                    <td className="px-3 py-2 text-center">
                      {h.consecutiveLabel && <ConsecutiveBadge label={h.consecutiveLabel} />}
                      {h.basis && !h.consecutiveLabel && (
                        <span className="text-[11px] text-muted-foreground">{h.basis}</span>
                      )}
                      {h.pickSlot && (
                        <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                          Pick {h.pickSlot.overallPick} ({h.pickSlot.season})
                        </span>
                      )}
                      {!h.consecutiveLabel && !h.basis && !h.pickSlot && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 pr-4 text-right font-mono text-[13px] font-semibold">
                      ${h.salary.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
        <strong className="text-foreground/80">Note on 5th-Year rows:</strong> each row reflects the sheet&apos;s own
        Franchise/5th-Year flag exactly as recorded, season by season — some historical seasons flag the same player
        across multiple consecutive years with different salaries. This section intentionally does not try to guess
        which one &quot;really&quot; represents the option year; it shows the raw flags as recorded.
      </p>
    </div>
  );
}
