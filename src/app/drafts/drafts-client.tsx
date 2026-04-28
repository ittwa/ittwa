"use client";

import { useState, useMemo } from "react";
import { getPositionColors, getDivisionColor, getDivisionColorAlpha } from "@/lib/ui-utils";
import { OWNER_DIVISION } from "@/lib/config";

// ── Types ────────────────────────────────────────────────────────────────────

interface DraftPick {
  pickNo: number;
  round: number;
  draftSlot: number;
  rosterId: number;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  ownerName: string;
  ownerDivision: string;
  contractYears: number;
  contractSalary: number;
}

interface DraftData {
  draftId: string;
  season: string;
  type: string;
  status: string;
  rounds: number;
  numTeams: number;
  slotToOwner: Record<number, string>;
  picks: DraftPick[];
}

interface DraftsClientProps {
  drafts: DraftData[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  QB: { bg: "rgba(253,74,72,0.18)", text: "#fd7b7a", border: "rgba(253,74,72,0.35)" },
  RB: { bg: "rgba(74,222,128,0.15)", text: "#4ade80", border: "rgba(74,222,128,0.3)" },
  WR: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  TE: { bg: "rgba(232,184,75,0.15)", text: "#e8b84b", border: "rgba(232,184,75,0.3)" },
  K: { bg: "rgba(148,163,184,0.12)", text: "#94a3b8", border: "rgba(148,163,184,0.25)" },
  DEF: { bg: "rgba(148,163,184,0.12)", text: "#94a3b8", border: "rgba(148,163,184,0.25)" },
};

const DIV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Concussion: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  "Hey Arnold": { bg: "rgba(168,85,247,0.15)", text: "#c084fc", border: "rgba(168,85,247,0.3)" },
  Replacements: { bg: "rgba(34,197,94,0.15)", text: "#4ade80", border: "rgba(34,197,94,0.3)" },
  "Dark Knight Rises": { bg: "rgba(249,115,22,0.15)", text: "#fb923c", border: "rgba(249,115,22,0.3)" },
};

function posColors(pos: string) {
  return POS_COLORS[pos] || POS_COLORS.K;
}

function divColors(div: string) {
  return DIV_COLORS[div] || DIV_COLORS.Concussion;
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Sub-components (placeholders) ────────────────────────────────────────────

function OwnerAvatar({ name, division, size = 28 }: { name: string; division: string; size?: number }) {
  const dc = divColors(division);
  const ini = initials(name);
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: dc.bg, border: `1.5px solid ${dc.border}` }}
    >
      <span className="font-heading font-extrabold" style={{ fontSize: size * 0.36, color: dc.text, letterSpacing: "-0.01em" }}>{ini}</span>
    </div>
  );
}

function PlayerAvatar({ name, pos, size = 34 }: { name: string; pos: string; size?: number }) {
  const pc = posColors(pos);
  const ini = initials(name);
  return (
    <div
      className="rounded-md flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: pc.bg, border: `1.5px solid ${pc.border}` }}
    >
      <span className="font-heading font-extrabold" style={{ fontSize: size * 0.33, color: pc.text, letterSpacing: "-0.01em" }}>{ini}</span>
    </div>
  );
}

function PosBadge({ pos }: { pos: string }) {
  const pc = posColors(pos);
  return (
    <span
      className="text-[9px] font-bold tracking-[0.06em] px-[5px] py-[1px] rounded-[3px] font-heading flex-shrink-0"
      style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}
    </span>
  );
}

// ── Sidebar Components ───────────────────────────────────────────────────────

function SidebarCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-[18px]" style={{ boxShadow: "0 0 0 1px #222" }}>
      {children}
    </div>
  );
}

function ChartLabel({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <span className="text-[11px] font-bold tracking-[0.07em] uppercase text-[#666] font-heading">{label}</span>
      {subtitle && <span className="text-[10px] text-[#666] ml-2">{subtitle}</span>}
    </div>
  );
}

function PositionDonut({ picks }: { picks: DraftPick[] }) {
  const positions = ["QB", "RB", "WR", "TE"] as const;
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const p of picks) {
    if (counts[p.position] !== undefined) counts[p.position]++;
  }
  const total = picks.length;

  const cx = 64, cy = 64, r = 52, inner = 32;
  let angle = -Math.PI / 2;
  const slices = positions.map((pos) => {
    const cnt = counts[pos] || 0;
    const sweep = (cnt / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const xi1 = cx + inner * Math.cos(angle);
    const yi1 = cy + inner * Math.sin(angle);
    const xi2 = cx + inner * Math.cos(angle + sweep);
    const yi2 = cy + inner * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${inner},${inner} 0 ${large},0 ${xi1},${yi1} Z`;
    angle += sweep;
    const pct = Math.round((cnt / total) * 100);
    return { pos, cnt, path, pct };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={128} height={128} className="flex-shrink-0">
        {slices.map((s) => (
          <path key={s.pos} d={s.path} fill={POS_COLORS[s.pos]?.text || "#94a3b8"} opacity={0.85} />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" fill="#f5f5f5" fontSize={13} fontWeight={800} fontFamily="'Barlow Condensed', sans-serif">{total}</text>
        <text x={cx} y={cy + 17} textAnchor="middle" fill="#666" fontSize={8} fontFamily="'Inter', sans-serif">PICKS</text>
      </svg>
      <div className="flex flex-col gap-[7px] flex-1">
        {slices.map((s) => {
          const pc = POS_COLORS[s.pos] || POS_COLORS.K;
          return (
            <div key={s.pos} className="flex items-center gap-2">
              <span className="text-[9px] font-bold font-heading tracking-[0.06em] min-w-[22px]" style={{ color: pc.text }}>{s.pos}</span>
              <div className="flex-1 h-[5px] rounded-[3px] bg-[#222] overflow-hidden">
                <div className="h-full rounded-[3px] transition-[width] duration-500" style={{ width: `${s.pct}%`, background: pc.text, opacity: 0.8 }} />
              </div>
              <span className="text-[10px] font-bold font-heading min-w-[20px] text-right" style={{ color: pc.text }}>{s.cnt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoundPositionBars({ roundData }: { roundData: { round: number; counts: Record<string, number>; total: number }[] }) {
  const positions = ["QB", "RB", "WR", "TE"] as const;

  return (
    <div>
      <div className="flex flex-col gap-2">
        {roundData.map(({ round: r, counts, total }) => {
          let offset = 0;
          const segments = positions.map((pos) => {
            const pct = total > 0 ? (counts[pos] / total) * 100 : 0;
            const x = offset;
            offset += pct;
            return { pos, pct, x };
          });

          return (
            <div key={r} className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-[#666] font-heading min-w-[28px]">RD {r}</span>
              <div className="flex-1 h-7 rounded-[5px] overflow-hidden relative bg-[#222]">
                <svg width="100%" height={28} className="absolute top-0 left-0">
                  {segments.map((s) => s.pct > 0 ? (
                    <rect key={s.pos} x={`${s.x}%`} y={0} width={`${s.pct}%`} height={28} fill={POS_COLORS[s.pos]?.text || "#94a3b8"} opacity={0.75} />
                  ) : null)}
                </svg>
                {segments.map((s) => s.pct >= 12 ? (
                  <div
                    key={s.pos}
                    className="absolute top-0 flex items-center h-7 text-[9px] font-extrabold font-heading opacity-70 pointer-events-none"
                    style={{ left: `${s.x + s.pct / 2}%`, transform: "translateX(-50%)", color: "#000" }}
                  >
                    {s.pos}
                  </div>
                ) : null)}
              </div>
              <span className="text-[10px] text-[#666] font-mono min-w-[16px] text-right">{total}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-2.5 mt-2.5 flex-wrap">
        {positions.map((pos) => {
          const pc = POS_COLORS[pos] || POS_COLORS.K;
          return (
            <div key={pos} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: pc.text, opacity: 0.75 }} />
              <span className="text-[9px] text-[#666] font-semibold">{pos}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PicksByOwnerChart({ data }: { data: { name: string; cnt: number; division: string }[] }) {
  const max = Math.max(...data.map((d) => d.cnt), 1);

  return (
    <div className="flex flex-col gap-[5px]">
      {data.map(({ name, cnt, division }) => {
        const dc = division ? divColors(division) : null;
        const barColor = dc ? dc.text : "#FD4A48";
        return (
          <div key={name} className="flex items-center gap-2">
            <OwnerAvatar name={name} division={division} size={20} />
            <span className="text-[10px] text-[#666] min-w-[68px] truncate">{name.split(" ")[0]}</span>
            <div className="flex-1 h-1.5 rounded-[3px] bg-[#222] overflow-hidden">
              <div className="h-full rounded-[3px] transition-[width] duration-500" style={{ width: `${(cnt / max) * 100}%`, background: barColor, opacity: 0.8 }} />
            </div>
            <span className="text-[10px] font-bold font-heading text-[#f5f5f5] min-w-[14px] text-right">{cnt}</span>
          </div>
        );
      })}
    </div>
  );
}

function TradedPicksChart({ data }: { data: { name: string; cnt: number; division: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map(({ name, cnt, division }) => {
        const dc = division ? divColors(division) : null;
        return (
          <div key={name} className="flex items-center gap-2">
            <OwnerAvatar name={name} division={division} size={22} />
            <span className="text-[11px] text-[#f5f5f5] flex-1 truncate">{name.split(" ")[0]}</span>
            <div className="flex gap-[3px]">
              {Array.from({ length: cnt }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: dc ? dc.text : "#e8b84b", opacity: 0.8 }}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold font-heading text-[#f5f5f5] min-w-[14px] text-right">{cnt}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DraftsClient({ drafts }: DraftsClientProps) {
  const seasons = useMemo(() => [...new Set(drafts.map((d) => d.season))].sort().reverse(), [drafts]);
  const [selectedSeason, setSelectedSeason] = useState(seasons[0] || "");

  const draft = useMemo(() => drafts.find((d) => d.season === selectedSeason) || drafts[0], [drafts, selectedSeason]);

  // Derive slot owners (original pick order) from slotToOwner map or round 1 picks
  const slotData = useMemo(() => {
    if (!draft) return [];
    const numTeams = draft.numTeams || 12;
    const slots: { slot: number; ownerName: string; division: string }[] = [];

    for (let s = 1; s <= numTeams; s++) {
      const ownerFromMap = draft.slotToOwner[s];
      // Fallback: find round-1 pick with draftSlot === s
      const r1Pick = draft.picks.find((p) => p.round === 1 && p.draftSlot === s);
      const ownerName = ownerFromMap || r1Pick?.ownerName || `Slot ${s}`;
      const division = OWNER_DIVISION[ownerName] || r1Pick?.ownerDivision || "";
      slots.push({ slot: s, ownerName, division });
    }
    return slots;
  }, [draft]);

  // Build pick lookup: [round][slot] => pick
  const pickLookup = useMemo(() => {
    if (!draft) return {};
    const lookup: Record<number, Record<number, DraftPick>> = {};
    const numTeams = draft.numTeams || 12;
    const isSnake = draft.type === "snake";

    for (const p of draft.picks) {
      const pickInRound = ((p.pickNo - 1) % numTeams) + 1;
      // For snake drafts, even rounds are reversed
      const slot = isSnake && p.round % 2 === 0 ? (numTeams - pickInRound + 1) : pickInRound;
      if (!lookup[p.round]) lookup[p.round] = {};
      lookup[p.round][slot] = p;
    }
    return lookup;
  }, [draft]);

  // Position counts for charts
  const posCounts = useMemo(() => {
    if (!draft) return { QB: 0, RB: 0, WR: 0, TE: 0 };
    const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    for (const p of draft.picks) {
      if (counts[p.position] !== undefined) counts[p.position]++;
    }
    return counts;
  }, [draft]);

  // Picks per owner for chart
  const picksPerOwner = useMemo(() => {
    if (!draft) return [];
    const counts: Record<string, number> = {};
    for (const p of draft.picks) {
      counts[p.ownerName] = (counts[p.ownerName] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, cnt]) => ({ name, cnt, division: OWNER_DIVISION[name] || "" }))
      .sort((a, b) => b.cnt - a.cnt);
  }, [draft]);

  // Traded picks count
  const tradedPicks = useMemo(() => {
    if (!draft) return [];
    const numTeams = draft.numTeams || 12;
    const isSnake = draft.type === "snake";

    return draft.picks.filter((p) => {
      const pickInRound = ((p.pickNo - 1) % numTeams) + 1;
      const slot = isSnake && p.round % 2 === 0 ? (numTeams - pickInRound + 1) : pickInRound;
      const originalOwner = draft.slotToOwner[slot];
      return originalOwner && originalOwner !== p.ownerName;
    });
  }, [draft]);

  // Traded picks grouped by gaining owner
  const tradedByOwner = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of tradedPicks) {
      counts[p.ownerName] = (counts[p.ownerName] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, cnt]) => ({ name, cnt, division: OWNER_DIVISION[name] || "" }))
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, 6);
  }, [tradedPicks]);

  // Round data for position stacked bars
  const roundData = useMemo(() => {
    if (!draft) return [];
    return Array.from({ length: draft.rounds }, (_, i) => {
      const r = i + 1;
      const roundPicks = draft.picks.filter((p) => p.round === r);
      const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      for (const p of roundPicks) {
        if (counts[p.position] !== undefined) counts[p.position]++;
      }
      return { round: r, counts, total: roundPicks.length };
    });
  }, [draft]);

  if (!draft) return null;

  const draftTypeLabel = draft.type === "snake" ? "Startup" : "Rookie";

  return (
    <div>
      {/* Page header */}
      <div className="pb-5 border-b border-[#222] mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-xl font-extrabold tracking-[0.06em] uppercase">Draft History</h1>
            </div>
            <span
              className="text-[11px] font-semibold px-2.5 py-[2px] rounded tracking-[0.04em]"
              style={{ background: "rgba(253,74,72,0.1)", color: "#FD4A48", border: "1px solid rgba(253,74,72,0.3)" }}
            >
              {draftTypeLabel} · {draft.rounds} Rounds · {draft.picks.length} Picks
            </span>
          </div>

          {/* Season filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#666] font-semibold tracking-[0.06em] uppercase mr-1">Season</span>
            {seasons.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedSeason(yr)}
                className="px-3.5 py-1.5 rounded-md cursor-pointer text-[13px] font-heading tracking-[0.04em]"
                style={{
                  background: selectedSeason === yr ? "#FD4A48" : "transparent",
                  border: `1px solid ${selectedSeason === yr ? "#FD4A48" : "#222"}`,
                  color: selectedSeason === yr ? "#fff" : "#666",
                  fontWeight: selectedSeason === yr ? 700 : 500,
                  transition: "all 0.15s",
                }}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Draft Grid */}
        <div className="bg-[#111] border border-[#222] rounded-[10px] overflow-hidden" style={{ boxShadow: "0 0 0 1px #222" }}>
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
            <div style={{ minWidth: `${200 + 160 * draft.rounds}px` }}>
              {/* Grid header row */}
              <div
                className="sticky top-0 z-10"
                style={{
                  display: "grid",
                  gridTemplateColumns: `200px ${Array(draft.rounds).fill("160px").join(" ")}`,
                  borderBottom: "2px solid #222",
                  background: "#090909",
                }}
              >
                <div className="px-4 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase text-[#666] border-r border-[#222]">
                  Original Owner
                </div>
                {Array.from({ length: draft.rounds }, (_, i) => i + 1).map((r) => (
                  <div
                    key={r}
                    className="py-2.5 text-center text-[10px] font-bold tracking-[0.08em] uppercase text-[#666]"
                    style={{ borderRight: r < draft.rounds ? "1px solid #222" : "none" }}
                  >
                    <span className="font-heading text-[13px] font-extrabold text-[#f5f5f5]">RD {r}</span>
                  </div>
                ))}
              </div>

              {/* Slot rows */}
              {slotData.map(({ slot, ownerName, division }) => {
                const isEven = slot % 2 === 0;
                const dc = division ? divColors(division) : null;

                return (
                  <div
                    key={slot}
                    className="hover:!bg-[rgba(253,74,72,0.1)] transition-colors"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `200px ${Array(draft.rounds).fill("160px").join(" ")}`,
                      borderBottom: "1px solid #222",
                      background: isEven ? "transparent" : "rgba(22,22,22,0.4)",
                    }}
                  >
                    {/* Owner cell */}
                    <div
                      className="px-3.5 py-2.5 border-r border-[#222] flex items-center gap-2.5 sticky left-0 z-[1]"
                      style={{ background: isEven ? "#111" : "#161616" }}
                    >
                      <OwnerAvatar name={ownerName} division={division} size={32} />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading text-[10px] font-extrabold text-[#666] min-w-[14px]">{slot}</span>
                          <span className="text-[12px] font-semibold text-[#f5f5f5] truncate">{ownerName}</span>
                        </div>
                        {dc && (
                          <span
                            className="text-[9px] font-semibold tracking-[0.05em] px-1.5 py-[1px] rounded-[3px] self-start"
                            style={{ background: dc.bg, color: dc.text, border: `1px solid ${dc.border}` }}
                          >
                            {division}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pick cells */}
                    {Array.from({ length: draft.rounds }, (_, i) => i + 1).map((r) => {
                      const pick = pickLookup[r]?.[slot];
                      const originalOwner = draft.slotToOwner[slot];
                      const traded = pick && originalOwner && pick.ownerName !== originalOwner;
                      const numTeams = draft.numTeams || 12;
                      const isSnake = draft.type === "snake";
                      const pickNum = isSnake && r % 2 === 0 ? (numTeams - slot + 1) : slot;

                      return (
                        <div
                          key={r}
                          className="px-3 py-2.5 flex flex-col justify-center gap-1 relative"
                          style={{
                            borderRight: r < draft.rounds ? "1px solid #222" : "none",
                            minHeight: 66,
                          }}
                        >
                          {pick ? (
                            <div className="flex gap-2 items-start">
                              <PlayerAvatar name={pick.playerName} pos={pick.position} size={36} />
                              <div className="flex flex-col gap-[3px] min-w-0 flex-1">
                                <div className="flex items-center gap-[5px]">
                                  <PosBadge pos={pick.position} />
                                  <span className="text-[9px] font-medium text-[#666] font-mono">
                                    {r}.{String(pickNum).padStart(2, "0")}
                                  </span>
                                </div>
                                <span className="text-[11px] font-semibold text-[#f5f5f5] leading-[1.3] line-clamp-2">
                                  {pick.playerName}
                                </span>
                                <span className="text-[10px] text-[#666]">{pick.team}</span>
                                {traded && (
                                  <div
                                    className="inline-flex items-center gap-1 mt-0.5 self-start px-1.5 py-[2px] rounded"
                                    style={{ background: "rgba(232,184,75,0.13)", border: "1px solid rgba(232,184,75,0.35)" }}
                                  >
                                    <OwnerAvatar name={pick.ownerName} division={pick.ownerDivision} size={14} />
                                    <span className="text-[8px] text-[#e8b84b] font-bold tracking-[0.03em]">traded to</span>
                                    <span className="text-[9px] text-[#e8b84b] font-semibold">
                                      {pick.ownerName.split(" ")[0]}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#666] italic">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar charts */}
        <div className="flex flex-col gap-4">
          {/* Position Mix donut */}
          <SidebarCard>
            <ChartLabel label="Position Mix" />
            <PositionDonut picks={draft.picks} />
          </SidebarCard>

          {/* Positions by Round */}
          <SidebarCard>
            <ChartLabel label="Positions by Round" />
            <RoundPositionBars roundData={roundData} />
          </SidebarCard>

          {/* Picks by Owner */}
          <SidebarCard>
            <ChartLabel label="Picks by Owner" />
            <PicksByOwnerChart data={picksPerOwner} />
          </SidebarCard>

          {/* Pick Trades */}
          <SidebarCard>
            <ChartLabel label="Pick Trades" subtitle={tradedPicks.length > 0 ? `${tradedPicks.length} picks changed hands` : undefined} />
            {tradedPicks.length === 0 ? (
              <span className="text-[12px] text-[#666] italic">No picks were traded this draft.</span>
            ) : (
              <TradedPicksChart data={tradedByOwner} />
            )}
          </SidebarCard>
        </div>
      </div>
    </div>
  );
}
