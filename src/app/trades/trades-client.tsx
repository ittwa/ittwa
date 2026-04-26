"use client";

import { useState, useMemo, Fragment } from "react";
import { getPositionColors } from "@/lib/ui-utils";

// ── Types (exported for server component) ────────────────────────────────────

export interface TradePlayerItem {
  type: "player";
  name: string;
  pos: string;
  nflTeam: string;
  sleeperId: string;
  salary: number;
  years: number;
}

export interface TradePickItem {
  type: "pick";
  name: string;
  round: number;
  pickSeason: string;
  originalOwner: string;
}

export type TradeItem = TradePlayerItem | TradePickItem;

export interface TradeSideData {
  owner: string;
  rosterId: number;
  received: TradeItem[];
}

export interface EnrichedTrade {
  id: string;
  created: number;
  week: number;
  season: string;
  sides: TradeSideData[];
}

interface TradesClientProps {
  trades: EnrichedTrade[];
  season: string;
}

// ── Helper Components ────────────────────────────────────────────────────────

function PosBadge({ pos }: { pos: string }) {
  const pc = getPositionColors(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded inline-flex items-baseline gap-0.5 leading-none whitespace-nowrap"
      style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}
    </span>
  );
}

function PlayerHeadshot({ sleeperId, name, pos, size = 44 }: { sleeperId: string; name: string; pos: string; size?: number }) {
  const [err, setErr] = useState(false);
  const pc = getPositionColors(pos);
  const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("");

  if (err || !sleeperId) {
    return (
      <div
        className="rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ width: size, height: size, background: pc.bg, border: `1px solid ${pc.border}` }}
      >
        <span className="font-heading font-extrabold" style={{ fontSize: size * 0.32, color: pc.text }}>{initials}</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg flex-shrink-0 overflow-hidden bg-[#161616]"
      style={{ width: size, height: size, border: "1px solid #1f1f1f" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`}
        alt={name}
        onError={() => setErr(true)}
        className="w-full h-full object-cover object-top"
      />
    </div>
  );
}

function PlayerCard({ item }: { item: TradeItem }) {
  if (item.type === "pick") {
    const roundColor = item.round === 1 ? "#E8B84B" : item.round === 2 ? "#94a3b8" : "#fb923c";
    return (
      <div
        className="flex items-center gap-2.5 p-2.5 rounded-lg"
        style={{ background: "rgba(232,184,75,0.05)", border: "1px solid rgba(232,184,75,0.15)" }}
      >
        <div
          className="w-11 h-11 rounded-lg flex-shrink-0 flex flex-col items-center justify-center"
          style={{ background: "rgba(232,184,75,0.1)", border: "1px solid rgba(232,184,75,0.25)" }}
        >
          <span className="font-heading text-lg font-black leading-none" style={{ color: roundColor }}>R{item.round}</span>
          <span className="text-[9px] font-semibold text-[#555]">{item.pickSeason}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#e8e8e8] leading-tight">{item.name}</div>
          <div className="text-[11px] text-[#555] mt-0.5">Draft Pick · via {item.originalOwner}</div>
        </div>
      </div>
    );
  }

  const salaryColor = item.salary >= 50 ? "#FD4A48" : item.salary >= 20 ? "#E8B84B" : "#e8e8e8";
  return (
    <div
      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#161616]"
      style={{ border: "1px solid #1f1f1f" }}
    >
      <PlayerHeadshot sleeperId={item.sleeperId} name={item.name} pos={item.pos} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <PosBadge pos={item.pos} />
          <span className="text-[10px] text-[#555] font-mono">{item.nflTeam}</span>
        </div>
        <div className="text-[13px] font-semibold text-[#e8e8e8] leading-tight truncate">{item.name}</div>
      </div>
      {item.salary > 0 && (
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-xs font-bold" style={{ color: salaryColor }}>${item.salary.toFixed(1)}</div>
          <div className="text-[10px] text-[#555] mt-0.5">{item.years}yr{item.years !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}

function TradeSide({ side, isLeft }: { side: TradeSideData; isLeft: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-2.5 mb-2.5 ${isLeft ? "justify-start" : "justify-end"}`}>
        <div className={`flex items-center gap-2 ${isLeft ? "flex-row" : "flex-row-reverse"}`}>
          <div
            className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
          >
            <span className="font-heading text-[13px] font-extrabold text-[#60a5fa]">
              {side.owner.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ textAlign: isLeft ? "left" : "right" }}>
            <div className="text-sm font-bold text-[#e8e8e8]">{side.owner}</div>
            <div className="text-[11px] text-[#555]">
              received {side.received.length} item{side.received.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {side.received.map((item, i) => (
          <PlayerCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

function TradeArrows() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 px-1">
      <div className="flex flex-col gap-1.5">
        <span className="text-lg text-[#FD4A48] leading-none">→</span>
        <span className="text-lg text-[#4ade80] leading-none" style={{ transform: "scaleX(-1)", display: "inline-block" }}>→</span>
      </div>
    </div>
  );
}

function TradeCard({ trade }: { trade: EnrichedTrade }) {
  const [expanded, setExpanded] = useState(true);
  const playerCount = trade.sides.flatMap((s) => s.received).filter((i) => i.type === "player").length;
  const pickCount = trade.sides.flatMap((s) => s.received).filter((i) => i.type === "pick").length;

  const date = new Date(trade.created).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const weekLabel = trade.week < 1 ? "Off-Season" : `Week ${trade.week}`;

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer bg-[#161616] select-none"
        style={{ borderBottom: expanded ? "1px solid #1f1f1f" : "none" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-semibold text-[#555] tracking-[0.06em]">
            #{trade.id}
          </span>
          <div className="flex items-center gap-1">
            {trade.sides.map((s, i) => (
              <Fragment key={s.owner}>
                <span className="text-[13px] font-semibold text-[#e8e8e8]">{s.owner}</span>
                {i < trade.sides.length - 1 && (
                  <span className="text-[11px] text-[#555] mx-0.5">↔</span>
                )}
              </Fragment>
            ))}
          </div>
          <div className="flex gap-1.5">
            {playerCount > 0 && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}
              >
                {playerCount} player{playerCount !== 1 ? "s" : ""}
              </span>
            )}
            {pickCount > 0 && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(232,184,75,0.1)", color: "#E8B84B", border: "1px solid rgba(232,184,75,0.2)" }}
              >
                {pickCount} pick{pickCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="text-right">
            <div className="text-xs text-[#777] font-mono">{date}</div>
            <div className="text-[10px] text-[#555] mt-0.5">{weekLabel}</div>
          </div>
          <span
            className="text-xs text-[#555] transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          >▼</span>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4">
          <div className="flex gap-3 items-start">
            <TradeSide side={trade.sides[0]} isLeft={true} />
            <TradeArrows />
            {trade.sides[1] && <TradeSide side={trade.sides[1]} isLeft={false} />}
          </div>

          <div className="mt-3.5 pt-3 border-t border-[#1f1f1f] flex items-center justify-between gap-3">
            <div className="flex gap-2 flex-1">
              {trade.sides.map((side, si) => {
                const otherSide = trade.sides[1 - si];
                if (!otherSide) return null;
                const salaryIn = side.received
                  .filter((i): i is TradePlayerItem => i.type === "player")
                  .reduce((s, i) => s + i.salary, 0);
                const salaryOut = otherSide.received
                  .filter((i): i is TradePlayerItem => i.type === "player")
                  .reduce((s, i) => s + i.salary, 0);
                const salaryNet = salaryIn - salaryOut;
                const picksIn = side.received.filter((i) => i.type === "pick").length;
                const picksOut = otherSide.received.filter((i) => i.type === "pick").length;
                const picksNet = picksIn - picksOut;
                const yearsIn = side.received
                  .filter((i): i is TradePlayerItem => i.type === "player")
                  .reduce((s, i) => s + i.years, 0);
                const yearsOut = otherSide.received
                  .filter((i): i is TradePlayerItem => i.type === "player")
                  .reduce((s, i) => s + i.years, 0);
                const yearsNet = yearsIn - yearsOut;
                const salaryColor = salaryNet > 0 ? "#f87171" : salaryNet < 0 ? "#4ade80" : "#555";
                const picksColor = picksNet > 0 ? "#E8B84B" : picksNet < 0 ? "#f87171" : "#555";
                const yearsColor = yearsNet > 0 ? "#f87171" : yearsNet < 0 ? "#4ade80" : "#555";
                const hasSalary = salaryIn > 0 || salaryOut > 0;
                const hasYears = yearsIn > 0 || yearsOut > 0;
                const hasPicks = picksIn > 0 || picksOut > 0;
                return (
                  <div key={side.owner} className="flex-1 bg-[#090909] border border-[#1f1f1f] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-[#777] whitespace-nowrap">{side.owner}</span>
                    <div className="flex gap-3 items-center">
                      {hasSalary && (
                        <div className="text-right">
                          <div className="text-[9px] text-[#555] font-bold tracking-[0.06em] uppercase mb-0.5">Salary</div>
                          <span className="font-mono text-[13px] font-bold" style={{ color: salaryColor }}>
                            {salaryNet > 0 ? "+" : ""}{salaryNet.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {hasYears && (
                        <div className="text-right">
                          <div className="text-[9px] text-[#555] font-bold tracking-[0.06em] uppercase mb-0.5">Years</div>
                          <span className="font-mono text-[13px] font-bold" style={{ color: yearsColor }}>
                            {yearsNet > 0 ? "+" : ""}{yearsNet}
                          </span>
                        </div>
                      )}
                      {hasPicks && (
                        <div className="text-right">
                          <div className="text-[9px] text-[#555] font-bold tracking-[0.06em] uppercase mb-0.5">Picks</div>
                          <span className="font-mono text-[13px] font-bold" style={{ color: picksColor }}>
                            {picksNet > 0 ? "+" : ""}{picksNet}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
