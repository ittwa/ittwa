"use client";

import { useState, Fragment } from "react";
import Image from "next/image";
import { getPositionColors } from "@/lib/ui-utils";
import { playerHeadshotUrls } from "@/lib/player-images";
import { SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";
import { PlayerLink } from "@/components/player-link";

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
  // The pick's season-origin roster_id (matches slot_to_roster_id in completed drafts)
  originalRosterId?: number;
}

// ── Retroactive trade grading types ──────────────────────────────────────────

export type GradeVerdict = "even" | "edge" | "win" | "heist";
export type GradeConfidence = "high" | "medium" | "low";

export interface AssetGrade {
  currentValue: number | null;
  // Set when a pick was conveyed and the drafted player is known
  resolvedPlayerId?: string;
  resolvedPlayerName?: string;
  resolvedPlayerPos?: string;
}

export interface SideGrade {
  totalValue: number;
  resolvedCount: number;
  assetGrades: AssetGrade[]; // parallel to side.received
}

export interface TradeGrade {
  sides: SideGrade[]; // parallel to trade.sides
  verdict: GradeVerdict;
  favoredSideIndex: number | null; // index into trade.sides; null = even
  confidence: GradeConfidence;
  diff: number; // sides[0].totalValue - sides[1].totalValue
  pct: number; // |diff| / totalAbsValue
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
  grade?: TradeGrade;
}

// ── Grade UI components ───────────────────────────────────────────────────────

const VERDICT_STYLE: Record<GradeVerdict, { label: string; bg: string; border: string; color: string }> = {
  even:  { label: "Even",      bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.25)", color: "#94a3b8" },
  edge:  { label: "Edge",      bg: "rgba(232,184,75,0.10)",  border: "rgba(232,184,75,0.30)",  color: "#E8B84B" },
  win:   { label: "Win",       bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.30)",  color: "#4ade80" },
  heist: { label: "Heist",     bg: "rgba(253,74,72,0.10)",   border: "rgba(253,74,72,0.30)",   color: "#FD4A48" },
};

const CONF_DOT: Record<GradeConfidence, string> = {
  high:   "●",
  medium: "◑",
  low:    "○",
};

function VerdictChip({ grade, favoredOwner }: { grade: TradeGrade; favoredOwner: string | null }) {
  const s = VERDICT_STYLE[grade.verdict];
  const label = favoredOwner && grade.verdict !== "even"
    ? `${favoredOwner} ${s.label}`
    : s.label;
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {label}
      <span className="opacity-60 text-[8px]" title={`${grade.confidence} confidence`}>{CONF_DOT[grade.confidence]}</span>
    </span>
  );
}

function TugOfWarBar({ grade, sides }: { grade: TradeGrade; sides: TradeSideData[] }) {
  const [sideA, sideB] = [grade.sides[0], grade.sides[1]];
  if (!sideA || !sideB) return null;
  const absA = Math.max(sideA.totalValue, 0);
  const absB = Math.max(sideB.totalValue, 0);
  const total = absA + absB;
  if (total === 0) return null;
  const pctA = (absA / total) * 100;
  const pctB = (absB / total) * 100;

  const vs = VERDICT_STYLE[grade.verdict];
  const colorA = grade.favoredSideIndex === 0 ? vs.color : "#475569";
  const colorB = grade.favoredSideIndex === 1 ? vs.color : "#475569";

  return (
    <div className="mt-3 mb-1">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1 font-semibold">
        <span>{sides[0]?.owner}</span>
        <span style={{ color: vs.color }} className="tracking-[0.04em] font-bold">{VERDICT_STYLE[grade.verdict].label.toUpperCase()}</span>
        <span>{sides[1]?.owner}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-secondary gap-px">
        <div className="rounded-l-full transition-all" style={{ width: `${pctA}%`, backgroundColor: colorA }} />
        <div className="rounded-r-full transition-all" style={{ width: `${pctB}%`, backgroundColor: colorB }} />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono mt-0.5">
        <span style={{ color: colorA }}>{sideA.totalValue > 0 ? "+" : ""}{Math.round(sideA.totalValue)}</span>
        <span style={{ color: colorB }}>{sideB.totalValue > 0 ? "+" : ""}{Math.round(sideB.totalValue)}</span>
      </div>
    </div>
  );
}

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
  const [attempt, setAttempt] = useState(0);
  const urls = sleeperId ? playerHeadshotUrls(sleeperId) : [];
  const pc = getPositionColors(pos);
  const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("");

  if (!sleeperId || attempt >= urls.length) {
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
      className="rounded-lg flex-shrink-0 overflow-hidden bg-secondary border border-border relative"
      style={{ width: size, height: size }}
    >
      <Image
        key={urls[attempt]}
        src={urls[attempt]}
        alt={name}
        fill
        sizes="64px"
        className="object-cover object-top"
        onError={() => setAttempt((a) => a + 1)}
      />
    </div>
  );
}

function ValueTag({ value }: { value: number | null }) {
  if (value === null) return null;
  const color = value > 0 ? "#4ade80" : value < 0 ? "#f87171" : "#94a3b8";
  return (
    <span
      className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
    >
      {value > 0 ? "+" : ""}{Math.round(value)}
    </span>
  );
}

function PlayerCard({ item, grade }: { item: TradeItem; grade?: AssetGrade }) {
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
          <span className="text-[9px] font-semibold text-muted-foreground">{item.pickSeason}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground leading-tight">{item.name}</div>
          {grade?.resolvedPlayerName ? (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              → <span className="text-foreground/80">{grade.resolvedPlayerName}</span>
              {grade.resolvedPlayerPos && <span className="ml-1 opacity-60">{grade.resolvedPlayerPos}</span>}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground mt-0.5">Draft Pick · via {item.originalOwner}</div>
          )}
        </div>
        {grade && <ValueTag value={grade.currentValue} />}
      </div>
    );
  }

  const salaryColor = item.salary >= 50 ? "#FD4A48" : item.salary >= 20 ? "#E8B84B" : undefined;
  return (
    <div
      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary border border-border"
    >
      <PlayerHeadshot sleeperId={item.sleeperId} name={item.name} pos={item.pos} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <PosBadge pos={item.pos} />
          <span className="text-[10px] text-muted-foreground font-mono">{item.nflTeam}</span>
        </div>
        <PlayerLink playerId={item.sleeperId} className="text-[13px] font-semibold text-foreground leading-tight truncate hover:underline underline-offset-2">{item.name}</PlayerLink>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {grade && <ValueTag value={grade.currentValue} />}
        {item.salary > 0 && (
          <div className="text-right">
            <div className="font-mono text-xs font-bold" style={salaryColor ? { color: salaryColor } : undefined}>${item.salary.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">{item.years}yr{item.years !== 1 ? "s" : ""}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function OwnerAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const avatarId = useOwnerAvatar(name);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={<span className="font-heading font-extrabold text-[#60a5fa]" style={{ fontSize: size * 0.38 }}>{initials}</span>}
      />
    </div>
  );
}

function TradeSide({ side, sideGrade, isLeft }: { side: TradeSideData; sideGrade?: SideGrade; isLeft: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-2.5 mb-2.5 justify-start ${!isLeft ? "sm:justify-end" : ""}`}>
        <div className={`flex items-center gap-2 flex-row ${!isLeft ? "sm:flex-row-reverse" : ""}`}>
          <OwnerAvatar name={side.owner} />
          <div className={`text-left ${!isLeft ? "sm:text-right" : ""}`}>
            <OwnerLink name={side.owner} className="text-sm font-bold text-foreground hover:underline underline-offset-2">{side.owner}</OwnerLink>
            <div className="text-[11px] text-muted-foreground">
              received {side.received.length} item{side.received.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {side.received.map((item, i) => (
          <PlayerCard key={i} item={item} grade={sideGrade?.assetGrades[i]} />
        ))}
      </div>
    </div>
  );
}

function TradeArrows() {
  return (
    <>
      <div className="hidden sm:flex flex-col items-center justify-center gap-1.5 flex-shrink-0 px-1">
        <span className="text-lg text-[#FD4A48] leading-none">→</span>
        <span className="text-lg text-[#4ade80] leading-none" style={{ transform: "scaleX(-1)", display: "inline-block" }}>→</span>
      </div>
      <div className="flex sm:hidden items-center justify-center gap-1.5 flex-shrink-0 py-1">
        <span className="text-lg text-[#FD4A48] leading-none">↓</span>
        <span className="text-lg text-[#4ade80] leading-none">↑</span>
      </div>
    </>
  );
}

export function TradeCard({ trade, defaultExpanded = true }: { trade: EnrichedTrade; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  let playerCount = 0, pickCount = 0;
  for (const s of trade.sides) for (const item of s.received) {
    if (item.type === "player") playerCount++; else pickCount++;
  }

  const date = new Date(trade.created).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  // Guard against missing/undefined week too: `undefined < 1` is false, which
  // would otherwise fall through to the literal "Week undefined". Offseason
  // trades carry week -1 (or no week at all) → show "Offseason".
  const weekLabel = !trade.week || trade.week < 1 ? "Offseason" : `Week ${trade.week}`;

  return (
    <div id={trade.id} className="bg-card border border-border rounded-xl overflow-hidden scroll-mt-20">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between px-4 sm:px-5 py-3.5 cursor-pointer bg-secondary select-none gap-2 flex-wrap"
        style={{ borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground tracking-[0.06em]">
            #{trade.id}
          </span>
          <div className="flex items-center gap-1">
            {trade.sides.map((s, i) => (
              <Fragment key={s.owner}>
                <div className="flex items-center gap-1.5">
                  <OwnerAvatar name={s.owner} size={22} />
                  <OwnerLink name={s.owner} className="text-[13px] font-semibold text-foreground hover:underline underline-offset-2">{s.owner}</OwnerLink>
                </div>
                {i < trade.sides.length - 1 && (
                  <span className="text-[11px] text-muted-foreground mx-0.5">↔</span>
                )}
              </Fragment>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
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
            {trade.grade && (
              <VerdictChip
                grade={trade.grade}
                favoredOwner={trade.grade.favoredSideIndex != null ? (trade.sides[trade.grade.favoredSideIndex]?.owner ?? null) : null}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <div className="text-right">
            <div className="text-xs text-muted-foreground font-mono">{date}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{weekLabel}</div>
          </div>
          <span
            className="text-xs text-muted-foreground transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          >▼</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 sm:px-5 py-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
            <TradeSide side={trade.sides[0]} sideGrade={trade.grade?.sides[0]} isLeft={true} />
            <TradeArrows />
            {trade.sides[1] && <TradeSide side={trade.sides[1]} sideGrade={trade.grade?.sides[1]} isLeft={false} />}
          </div>

          {trade.grade && (
            <TugOfWarBar grade={trade.grade} sides={trade.sides} />
          )}

          <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              {trade.sides.map((side, si) => {
                const otherSide = trade.sides[1 - si];
                if (!otherSide) return null;
                const agg = (items: TradeItem[]) => {
                  let salary = 0, years = 0, picks = 0;
                  for (const i of items) { if (i.type === "player") { salary += i.salary; years += i.years; } else { picks++; } }
                  return { salary, years, picks };
                };
                const inn = agg(side.received), out = agg(otherSide.received);
                const salaryNet = inn.salary - out.salary;
                const yearsNet = inn.years - out.years;
                const picksNet = inn.picks - out.picks;
                const salaryColor = salaryNet > 0 ? "#f87171" : salaryNet < 0 ? "#4ade80" : "var(--muted-foreground)";
                const picksColor = picksNet > 0 ? "#E8B84B" : picksNet < 0 ? "#f87171" : "var(--muted-foreground)";
                const yearsColor = yearsNet > 0 ? "#f87171" : yearsNet < 0 ? "#4ade80" : "var(--muted-foreground)";
                const hasSalary = inn.salary > 0 || out.salary > 0;
                const hasYears = inn.years > 0 || out.years > 0;
                const hasPicks = inn.picks > 0 || out.picks > 0;
                return (
                  <div key={side.owner} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <OwnerLink name={side.owner} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap hover:underline underline-offset-2">{side.owner}</OwnerLink>
                    <div className="flex gap-3 items-center">
                      {hasSalary && (
                        <div className="text-right">
                          <div className="text-[9px] text-muted-foreground font-bold tracking-[0.06em] uppercase mb-0.5">Salary</div>
                          <span className="font-mono text-[13px] font-bold" style={{ color: salaryColor }}>
                            {salaryNet > 0 ? "+" : ""}{salaryNet.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {hasYears && (
                        <div className="text-right">
                          <div className="text-[9px] text-muted-foreground font-bold tracking-[0.06em] uppercase mb-0.5">Years</div>
                          <span className="font-mono text-[13px] font-bold" style={{ color: yearsColor }}>
                            {yearsNet > 0 ? "+" : ""}{yearsNet}
                          </span>
                        </div>
                      )}
                      {hasPicks && (
                        <div className="text-right">
                          <div className="text-[9px] text-muted-foreground font-bold tracking-[0.06em] uppercase mb-0.5">Picks</div>
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
