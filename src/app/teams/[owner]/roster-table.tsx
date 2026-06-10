"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerLink } from "@/components/player-link";
import { getPositionVariant, getPositionColor } from "@/lib/ui-utils";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";
import { Tooltip } from "@/components/ui/tooltip";

export interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string;
  salary: number | null;
  years: number | null;
  dpOriginalOwner: string;
  isMidSeasonPickup: boolean;
  hasContract: boolean;
  posRank?: number;
  value?: number | null; // contract-adjusted value
}

const VALUE_TOOLTIP =
  "Contract-adjusted value: the player's FantasyCalc dynasty value, adjusted for what their contract costs.";

type SortKey = "name" | "position" | "nflTeam" | "dpOriginalOwner" | "salary" | "years" | "value";
type SortDir = "asc" | "desc";

const POSITION_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

function comparePlayers(a: RosterPlayer, b: RosterPlayer, key: SortKey, dir: SortDir): number {
  const m = dir === "asc" ? 1 : -1;
  switch (key) {
    case "name":
      return m * a.name.localeCompare(b.name);
    case "position": {
      const pa = POSITION_ORDER[a.position] ?? 99;
      const pb = POSITION_ORDER[b.position] ?? 99;
      if (pa !== pb) return m * (pa - pb);
      const sa = a.salary ?? -1;
      const sb = b.salary ?? -1;
      return sa !== sb ? -(sa - sb) : a.name.localeCompare(b.name);
    }
    case "nflTeam":
      return m * a.nflTeam.localeCompare(b.nflTeam) || a.name.localeCompare(b.name);
    case "dpOriginalOwner":
      return m * (a.dpOriginalOwner || "").localeCompare(b.dpOriginalOwner || "") || a.name.localeCompare(b.name);
    case "salary": {
      const sa = a.salary ?? (dir === "asc" ? Infinity : -1);
      const sb = b.salary ?? (dir === "asc" ? Infinity : -1);
      return sa !== sb ? m * (sa - sb) : a.name.localeCompare(b.name);
    }
    case "years": {
      const ya = a.years ?? (dir === "asc" ? Infinity : -1);
      const yb = b.years ?? (dir === "asc" ? Infinity : -1);
      return ya !== yb ? m * (ya - yb) : a.name.localeCompare(b.name);
    }
    case "value": {
      const va = a.value ?? (dir === "asc" ? Infinity : -Infinity);
      const vb = b.value ?? (dir === "asc" ? Infinity : -Infinity);
      return va !== vb ? m * (va - vb) : a.name.localeCompare(b.name);
    }
  }
}

function fmtDollar(n: number): string {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(1)}`;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex ml-1 text-[10px] leading-none ${active ? "text-foreground" : "text-muted-foreground/40"}`}>
      {active ? (dir === "asc" ? "▲" : "▼") : "▴"}
    </span>
  );
}

function DPOwnerAvatar({ name }: { name: string }) {
  const avatarId = useOwnerAvatar(name);
  return (
    <div
      className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={<span className="font-heading text-[7px] font-bold text-[#60a5fa]">{name.slice(0, 2).toUpperCase()}</span>}
      />
    </div>
  );
}

interface RosterTableProps {
  players: RosterPlayer[];
  maxRosterSalary: number;
  rosterSalary: number;
}

export function RosterTable({ players, maxRosterSalary, rosterSalary }: RosterTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(
    () => [...players].sort((a, b) => comparePlayers(a, b, sortKey, sortDir)),
    [players, sortKey, sortDir]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "position" || key === "nflTeam" || key === "dpOriginalOwner" ? "asc" : "desc");
    }
  }

  const columns: { key: SortKey; label: string; className: string; tooltip?: string }[] = [
    { key: "name", label: "Player", className: "px-4 py-3 text-left font-medium" },
    { key: "position", label: "Pos", className: "px-4 py-3 text-left font-medium" },
    { key: "nflTeam", label: "Team", className: "px-4 py-3 text-left font-medium hidden sm:table-cell" },
    { key: "dpOriginalOwner", label: "DP Original Owner", className: "px-4 py-3 text-left font-medium hidden md:table-cell" },
    { key: "salary", label: "Salary", className: "px-4 py-3 text-right font-medium" },
    { key: "value", label: "Value", className: "px-4 py-3 text-right font-medium", tooltip: VALUE_TOOLTIP },
    { key: "years", label: "Years", className: "px-4 py-3 text-center font-medium" },
  ];

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${col.className} cursor-pointer select-none hover:text-foreground transition-colors`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {col.tooltip && (
                    <Tooltip content={col.tooltip} side="bottom" className="font-normal normal-case">
                      <span className="ml-1 text-gold/70 cursor-help">ⓘ</span>
                    </Tooltip>
                  )}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground italic">
                  No players on this roster. Rebuild season, apparently.
                </td>
              </tr>
            ) : (
              sorted.map((p) => (
                <tr key={p.playerId} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar playerId={p.playerId} playerName={p.name} position={p.position} />
                      <PlayerLink playerId={p.playerId}>{p.name}</PlayerLink>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={getPositionVariant(p.position)}>
                      {p.position}
                      {p.posRank != null && <span style={{ opacity: 0.65 }}>{p.posRank}</span>}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.nflTeam}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                    {p.dpOriginalOwner ? (
                      <div className="flex items-center gap-1.5">
                        <DPOwnerAvatar name={p.dpOriginalOwner} />
                        <OwnerLink name={p.dpOriginalOwner} className="hover:text-foreground hover:underline underline-offset-2 transition-colors">{p.dpOriginalOwner}</OwnerLink>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.isMidSeasonPickup ? (
                      <Badge variant="warning">Pickup</Badge>
                    ) : p.salary !== null ? (
                      <div className="flex flex-col items-end">
                        <span>${p.salary.toFixed(1)}</span>
                        <div className="mt-0.5 rounded-full bg-secondary overflow-hidden" style={{ width: "64px", height: "3px" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max((p.salary / maxRosterSalary) * 100, 6)}%`,
                              backgroundColor: getPositionColor(p.position),
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{"—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.value !== null && p.value !== undefined ? (
                      <span style={{ color: p.value > 0 ? "#4ade80" : p.value < 0 ? "#f87171" : undefined }}>
                        {Math.round(p.value)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{"—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums">
                    {p.years !== null ? p.years : <span className="text-muted-foreground">{"—"}</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-secondary">
        <div className="flex items-center gap-3">
          {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
            <div key={pos} className="flex items-center gap-1">
              <div className="w-3 h-[3px] rounded-sm" style={{ backgroundColor: getPositionColor(pos) }} />
              <span className="text-[10px] font-semibold text-muted-foreground">{pos}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">Total: <span className="text-ittwa font-semibold">{fmtDollar(rosterSalary)}</span> / $270</span>
      </div>
    </>
  );
}
