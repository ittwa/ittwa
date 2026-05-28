"use client";

import { useState } from "react";
import { TradeCard, type EnrichedTrade } from "@/components/trade-card";

interface TradeHistoryProps {
  trades: EnrichedTrade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  const grouped = new Map<string, EnrichedTrade[]>();
  for (const t of trades) {
    const arr = grouped.get(t.season) || [];
    arr.push(t);
    grouped.set(t.season, arr);
  }
  const seasons = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const set = new Set<string>();
    // Auto-collapse all except the most recent season
    for (let i = 1; i < seasons.length; i++) set.add(seasons[i]);
    return set;
  });

  function toggle(season: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season);
      else next.add(season);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {seasons.map((season) => {
        const seasonTrades = grouped.get(season)!;
        const isCollapsed = collapsed.has(season);

        return (
          <div key={season}>
            <button
              onClick={() => toggle(season)}
              className="flex items-center gap-2.5 w-full text-left group mb-3"
            >
              <span
                className="text-[10px] text-muted-foreground transition-transform duration-200"
                style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              >
                ▼
              </span>
              <span className="font-heading text-sm font-extrabold tracking-[0.10em] uppercase text-muted-foreground group-hover:text-foreground transition-colors">
                {season} Season
              </span>
              <span className="font-code text-[11px] text-muted-foreground">
                {seasonTrades.length} {seasonTrades.length === 1 ? "trade" : "trades"}
              </span>
              <div className="flex-1 border-b border-border/50" />
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-3.5">
                {seasonTrades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} defaultExpanded={false} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
