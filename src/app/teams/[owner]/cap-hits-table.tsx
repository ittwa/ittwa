"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { getPositionVariant } from "@/lib/ui-utils";

export interface CapHitEntry {
  player: string;
  playerId: string;
  position: string;
  salary: number;
  years: number;
  capHit: number;
  seasonCapHit: number;
}

type SortKey = "player" | "position" | "salary" | "years" | "capHit" | "seasonCapHit";
type SortDir = "asc" | "desc";

const POSITION_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

function compare(a: CapHitEntry, b: CapHitEntry, key: SortKey, dir: SortDir): number {
  const m = dir === "asc" ? 1 : -1;
  switch (key) {
    case "player":
      return m * a.player.localeCompare(b.player);
    case "position": {
      const pa = POSITION_ORDER[a.position] ?? 99;
      const pb = POSITION_ORDER[b.position] ?? 99;
      return pa !== pb ? m * (pa - pb) : a.player.localeCompare(b.player);
    }
    case "salary":
      return a.salary !== b.salary ? m * (a.salary - b.salary) : a.player.localeCompare(b.player);
    case "years":
      return a.years !== b.years ? m * (a.years - b.years) : a.player.localeCompare(b.player);
    case "capHit":
      return a.capHit !== b.capHit ? m * (a.capHit - b.capHit) : a.player.localeCompare(b.player);
    case "seasonCapHit":
      return a.seasonCapHit !== b.seasonCapHit ? m * (a.seasonCapHit - b.seasonCapHit) : a.player.localeCompare(b.player);
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex ml-1 text-[10px] leading-none ${active ? "text-foreground" : "text-muted-foreground/40"}`}>
      {active ? (dir === "asc" ? "▲" : "▼") : "▴"}
    </span>
  );
}

interface CapHitsTableProps {
  entries: CapHitEntry[];
  displaySeason: number;
}

export function CapHitsTable({ entries, displaySeason }: CapHitsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("capHit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(
    () => [...entries].sort((a, b) => compare(a, b, sortKey, sortDir)),
    [entries, sortKey, sortDir]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "player" || key === "position" ? "asc" : "desc");
    }
  }

  const columns: { key: SortKey; label: string; className: string }[] = [
    { key: "player", label: "Player", className: "px-4 py-2 text-left font-medium" },
    { key: "position", label: "Pos", className: "px-4 py-2 text-left font-medium" },
    { key: "salary", label: "Salary", className: "px-4 py-2 text-right font-medium" },
    { key: "years", label: "Years", className: "px-4 py-2 text-center font-medium" },
    { key: "capHit", label: "Cap Hit", className: "px-4 py-2 text-right font-medium" },
    { key: "seasonCapHit", label: `${displaySeason} Cap Hit`, className: "px-4 py-2 text-right font-medium" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.className} cursor-pointer select-none hover:text-foreground transition-colors`}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                <SortIcon active={sortKey === col.key} dir={sortDir} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((ch, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
              <td className="px-4 py-2 font-medium">
                <div className="flex items-center gap-2">
                  <PlayerAvatar playerId={ch.playerId} playerName={ch.player} position={ch.position} />
                  {ch.player}
                </div>
              </td>
              <td className="px-4 py-2">
                <Badge variant={getPositionVariant(ch.position)}>{ch.position}</Badge>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">${ch.salary.toFixed(1)}</td>
              <td className="px-4 py-2 text-center tabular-nums">{ch.years}</td>
              <td className="px-4 py-2 text-right text-ittwa font-medium tabular-nums">${ch.capHit.toFixed(1)}</td>
              <td className="px-4 py-2 text-right text-ittwa font-medium tabular-nums">${ch.seasonCapHit.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
