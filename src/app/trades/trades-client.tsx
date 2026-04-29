"use client";

import { useState, useMemo } from "react";
import { TradeCard } from "@/components/trade-card";
import type { EnrichedTrade, TradeItem, TradeSideData, TradePlayerItem, TradePickItem } from "@/components/trade-card";

export type { EnrichedTrade, TradeItem, TradeSideData, TradePlayerItem, TradePickItem };

interface TradesClientProps {
  trades: EnrichedTrade[];
  season: string;
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const active = !!value && value !== options[0];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-7 pl-3 py-1.5 text-[13px] rounded-lg"
        style={{
          background: active ? "rgba(232,184,75,0.1)" : "#161616",
          border: `1px solid ${active ? "rgba(232,184,75,0.35)" : "#1f1f1f"}`,
          color: active ? "#E8B84B" : "#777",
          fontWeight: active ? 600 : 400,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: active ? "#E8B84B" : "#555" }}>
        ▼
      </span>
    </div>
  );
}

export function TradesClient({ trades, season }: TradesClientProps) {
  const [ownerFilter, setOwnerFilter] = useState("All Teams");
  const [seasonFilter, setSeasonFilter] = useState(season);

  const ownerNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of trades) for (const s of t.sides) names.add(s.owner);
    return [...names].sort();
  }, [trades]);

  const seasons = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) s.add(t.season);
    return [...s].sort().reverse();
  }, [trades]);

  const filtered = useMemo(() => {
    return trades.filter((trade) => {
      if (seasonFilter !== "All Seasons" && trade.season !== seasonFilter) return false;
      if (ownerFilter !== "All Teams" && !trade.sides.some((s) => s.owner === ownerFilter)) return false;
      return true;
    });
  }, [trades, ownerFilter, seasonFilter]);

  const totalPlayers = filtered.flatMap((t) => t.sides.flatMap((s) => s.received)).filter((i) => i.type === "player").length;
  const totalPicks = filtered.flatMap((t) => t.sides.flatMap((s) => s.received)).filter((i) => i.type === "pick").length;

  return (
    <div>
      {/* Page header */}
      <div className="pb-6 border-b border-[#1f1f1f] mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Trades</h1>
            </div>
            <p className="text-[13px] text-[#555] ml-4">
              {seasonFilter} season
              {ownerFilter !== "All Teams" && (
                <span> · <span className="text-[#e8e8e8]">{ownerFilter}</span></span>
              )}
            </p>
          </div>
          <div className="flex gap-5">
            {(
              [[filtered.length, "Trades"], [totalPlayers, "Players"], [totalPicks, "Picks"]] as const
            ).map(([val, lbl]) => (
              <div key={lbl} className="text-right">
                <div className="font-heading text-[30px] font-extrabold text-[#E8B84B] leading-none">{val}</div>
                <div className="text-[10px] text-[#555] font-semibold tracking-[0.06em] uppercase mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <FilterSelect value={seasonFilter} onChange={setSeasonFilter} options={["All Seasons", ...seasons]} />
        <FilterSelect value={ownerFilter} onChange={setOwnerFilter} options={["All Teams", ...ownerNames]} />
        {(ownerFilter !== "All Teams" || seasonFilter !== season) && (
          <button
            onClick={() => { setOwnerFilter("All Teams"); setSeasonFilter(season); }}
            className="bg-transparent border-none cursor-pointer text-xs text-[#FD4A48] font-semibold px-2 py-1.5"
          >
            Clear ×
          </button>
        )}
      </div>

      {/* Trade list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#555] italic">
          No trades found for the selected filters.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filtered.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}
