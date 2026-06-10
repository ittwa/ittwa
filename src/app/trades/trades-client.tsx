"use client";

import { useState, useMemo } from "react";
import { TradeCard } from "@/components/trade-card";
import type { EnrichedTrade, GradeVerdict } from "@/components/trade-card";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";

interface TradesClientProps {
  trades: EnrichedTrade[];
  season: string;
  ownerAvatars: Record<string, string>;
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
          background: active ? "rgba(232,184,75,0.1)" : "var(--secondary)",
          border: `1px solid ${active ? "rgba(232,184,75,0.35)" : "var(--border)"}`,
          color: active ? "#E8B84B" : "var(--muted-foreground)",
          fontWeight: active ? 600 : 400,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: active ? "#E8B84B" : "var(--muted-foreground)" }}>
        ▼
      </span>
    </div>
  );
}

const VERDICT_LABEL: Record<GradeVerdict, string> = {
  even: "Even",
  edge: "Edge",
  win: "Win",
  heist: "Heist",
};

const VERDICT_COLOR: Record<GradeVerdict, string> = {
  even: "#94a3b8",
  edge: "#E8B84B",
  win: "#4ade80",
  heist: "#FD4A48",
};

// THE LEDGER: per-owner trade grade stats
interface LedgerStats {
  wins: number;
  losses: number;
  evens: number;
  netValue: number;
  bestTrade: { id: string; margin: number } | null;
}

function computeLedger(trades: EnrichedTrade[], owner: string): LedgerStats {
  let wins = 0, losses = 0, evens = 0, netValue = 0;
  let bestTrade: { id: string; margin: number } | null = null;

  for (const trade of trades) {
    if (!trade.grade) continue;
    const sideIdx = trade.sides.findIndex((s) => s.owner === owner);
    if (sideIdx === -1) continue;

    const otherIdx = 1 - sideIdx;
    const myValue = trade.grade.sides[sideIdx]?.totalValue ?? 0;
    const theirValue = trade.grade.sides[otherIdx]?.totalValue ?? 0;
    const margin = myValue - theirValue;

    netValue += margin;

    if (trade.grade.verdict === "even") {
      evens++;
    } else if (trade.grade.favoredSideIndex === sideIdx) {
      wins++;
    } else {
      losses++;
    }

    if (!bestTrade || margin > bestTrade.margin) {
      bestTrade = { id: trade.id, margin };
    }
  }

  return { wins, losses, evens, netValue, bestTrade };
}

function TheLedger({ trades, owner }: { trades: EnrichedTrade[]; owner: string }) {
  const stats = useMemo(() => computeLedger(trades, owner), [trades, owner]);
  const gradedCount = trades.filter((t) => t.grade && t.sides.some((s) => s.owner === owner)).length;
  if (gradedCount === 0) return null;

  const netColor = stats.netValue > 0 ? "#4ade80" : stats.netValue < 0 ? "#f87171" : "#94a3b8";
  const record = `${stats.wins}W – ${stats.losses}L – ${stats.evens}E`;

  return (
    <div className="mb-6 grid grid-cols-3 gap-3">
      {/* Record */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <div className="text-[9px] text-muted-foreground font-bold tracking-[0.08em] uppercase mb-1.5">Trade Record</div>
        <div className="font-heading text-lg font-black leading-none text-foreground">{record}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{gradedCount} graded</div>
      </div>
      {/* Net value */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <div className="text-[9px] text-muted-foreground font-bold tracking-[0.08em] uppercase mb-1.5">Net Value</div>
        <div className="font-heading text-lg font-black leading-none font-mono" style={{ color: netColor }}>
          {stats.netValue > 0 ? "+" : ""}{Math.round(stats.netValue)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">pts (current values)</div>
      </div>
      {/* Best trade */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <div className="text-[9px] text-muted-foreground font-bold tracking-[0.08em] uppercase mb-1.5">Best Haul</div>
        {stats.bestTrade ? (
          <>
            <a
              href={`#${stats.bestTrade.id}`}
              className="font-heading text-lg font-black leading-none text-[#E8B84B] hover:underline"
            >
              #{stats.bestTrade.id}
            </a>
            <div className="text-[10px] text-muted-foreground mt-1">
              +{Math.round(stats.bestTrade.margin)} pts margin
            </div>
          </>
        ) : (
          <div className="text-muted-foreground text-sm">—</div>
        )}
      </div>
    </div>
  );
}

export function TradesClient({ trades, season, ownerAvatars }: TradesClientProps) {
  const [ownerFilter, setOwnerFilter] = useState("All Teams");
  const [seasonFilter, setSeasonFilter] = useState(season);
  const [verdictFilter, setVerdictFilter] = useState("All Verdicts");
  const [hintsVisible, setHintsVisible] = useState(true);

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

  const hasGrades = useMemo(() => trades.some((t) => t.grade), [trades]);

  const filtered = useMemo(() => {
    return trades.filter((trade) => {
      if (seasonFilter !== "All Seasons" && trade.season !== seasonFilter) return false;
      if (ownerFilter !== "All Teams" && !trade.sides.some((s) => s.owner === ownerFilter)) return false;
      if (verdictFilter !== "All Verdicts") {
        if (!trade.grade) return false;
        const wanted = verdictFilter.toLowerCase() as GradeVerdict;
        if (trade.grade.verdict !== wanted) return false;
      }
      return true;
    });
  }, [trades, ownerFilter, seasonFilter, verdictFilter]);

  const { totalPlayers, totalPicks } = useMemo(() => {
    let players = 0, picks = 0;
    for (const t of filtered) for (const s of t.sides) for (const item of s.received)
      if (item.type === "player") players++; else picks++;
    return { totalPlayers: players, totalPicks: picks };
  }, [filtered]);

  const verdictOptions = ["All Verdicts", ...Object.entries(VERDICT_LABEL).map(([, lbl]) => lbl)];
  const isFiltered = ownerFilter !== "All Teams" || seasonFilter !== season || verdictFilter !== "All Verdicts";

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
    <div>
      {/* Page header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Trades</h1>
            </div>
            <p className="text-[13px] text-muted-foreground ml-4">
              {seasonFilter} season
              {ownerFilter !== "All Teams" && (
                <span> · <span className="text-foreground">{ownerFilter}</span></span>
              )}
            </p>
          </div>
          <div className="flex gap-5">
            {(
              [[filtered.length, "Trades"], [totalPlayers, "Players"], [totalPicks, "Picks"]] as const
            ).map(([val, lbl]) => (
              <div key={lbl} className="text-right">
                <div className="font-heading text-[30px] font-extrabold text-[#E8B84B] leading-none">{val}</div>
                <div className="text-[10px] text-muted-foreground font-semibold tracking-[0.06em] uppercase mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterSelect value={seasonFilter} onChange={setSeasonFilter} options={["All Seasons", ...seasons]} />
        <FilterSelect value={ownerFilter} onChange={setOwnerFilter} options={["All Teams", ...ownerNames]} />
        {hasGrades && (
          <FilterSelect value={verdictFilter} onChange={setVerdictFilter} options={verdictOptions} />
        )}
        {isFiltered && (
          <button
            onClick={() => { setOwnerFilter("All Teams"); setSeasonFilter(season); setVerdictFilter("All Verdicts"); }}
            className="bg-transparent border-none cursor-pointer text-xs text-[#FD4A48] font-semibold px-2 py-1.5"
          >
            Clear ×
          </button>
        )}
      </div>

      {/* THE LEDGER — only when an owner is selected */}
      {ownerFilter !== "All Teams" && (
        <TheLedger trades={filtered} owner={ownerFilter} />
      )}

      {/* Hindsight note */}
      {hasGrades && hintsVisible && (
        <div
          className="mb-4 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-[12px]"
          style={{ background: "rgba(232,184,75,0.06)", border: "1px solid rgba(232,184,75,0.18)", color: "#E8B84B" }}
        >
          <span>
            <span className="font-bold">Hindsight note:</span> grades use current player values, not what was known at trade time.
          </span>
          <button
            onClick={() => setHintsVisible(false)}
            className="text-[#E8B84B]/60 hover:text-[#E8B84B] font-bold text-sm flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Trade list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground italic">
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
    </OwnerAvatarsProvider>
  );
}
