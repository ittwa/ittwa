"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { OWNER_DIVISION, ALL_OWNERS } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoricalMatchup {
  season: number;
  week: number;
  ownerA: string;
  ownerB: string;
  scoreA: number;
  scoreB: number;
  playoff: boolean;
}

interface NormalizedMatchup {
  season: number;
  week: number;
  scoreA: number;
  scoreB: number;
  playoff: boolean;
}

interface PairRecord {
  aw: number;
  bw: number;
  ties: number;
  aPts: number;
  bPts: number;
  count: number;
  matches: NormalizedMatchup[];
}

export interface RivalryClientProps {
  allMatchups: HistoricalMatchup[];
  availableSeasons: number[];
}

type MatrixMode = "record" | "heat" | "points";

// ── Constants ─────────────────────────────────────────────────────────────────

const DIV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Concussion":        { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  "Hey Arnold":        { bg: "rgba(168,85,247,0.15)", text: "#c084fc", border: "rgba(168,85,247,0.3)" },
  "Replacements":      { bg: "rgba(34,197,94,0.15)",  text: "#4ade80", border: "rgba(34,197,94,0.3)"  },
  "Dark Knight Rises": { bg: "rgba(249,115,22,0.15)", text: "#fb923c", border: "rgba(249,115,22,0.3)" },
};

const FALLBACK_DC = { bg: "rgba(100,100,100,0.15)", text: "#999999", border: "rgba(100,100,100,0.3)" };
const ACCENT = "#FD4A48";
const ACCENT_DIM = "rgba(253,74,72,0.1)";
const GOLD = "#E8B84B";
const WIN_COLOR = "#4ade80";
const LOSS_COLOR = "#fd7b7a";
const HEADER_FONT = "'Barlow Condensed', sans-serif";
const MONO_FONT = "'JetBrains Mono', monospace";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDivColor(owner: string) {
  const div = OWNER_DIVISION[owner];
  return (div && DIV_COLORS[div]) || FALLBACK_DC;
}

function initials(name: string): string {
  if (name === "HoganLamb") return "HL";
  return name.slice(0, 2).toUpperCase();
}

function pairRecord(
  ownerA: string,
  ownerB: string,
  activeSeasons: Set<number>,
  allMatchups: HistoricalMatchup[]
): PairRecord {
  let aw = 0, bw = 0, ties = 0, aPts = 0, bPts = 0;
  const matches: NormalizedMatchup[] = [];

  for (const m of allMatchups) {
    if (!activeSeasons.has(m.season)) continue;
    const isAB = m.ownerA === ownerA && m.ownerB === ownerB;
    const isBA = m.ownerA === ownerB && m.ownerB === ownerA;
    if (!isAB && !isBA) continue;

    const scoreA = isAB ? m.scoreA : m.scoreB;
    const scoreB = isAB ? m.scoreB : m.scoreA;
    aPts += scoreA;
    bPts += scoreB;
    if (scoreA > scoreB) aw++;
    else if (scoreB > scoreA) bw++;
    else ties++;

    matches.push({ season: m.season, week: m.week, scoreA, scoreB, playoff: m.playoff });
  }

  return { aw, bw, ties, aPts, bPts, count: matches.length, matches };
}

// ── OwnerAvatar ───────────────────────────────────────────────────────────────

function OwnerAvatar({ owner, size = 28 }: { owner: string; size?: number }) {
  const dc = getDivColor(owner);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: dc.bg, border: `1.5px solid ${dc.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{
        fontSize: size * 0.36, fontWeight: 800, color: dc.text,
        fontFamily: HEADER_FONT, letterSpacing: "-0.01em",
      }}>
        {initials(owner)}
      </span>
    </div>
  );
}

// ── ChartLabel ────────────────────────────────────────────────────────────────

function ChartLabel({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase" as const, color: "var(--muted-foreground)",
        fontFamily: HEADER_FONT,
      }}>{label}</span>
      {subtitle && (
        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontStyle: "italic" }}>{subtitle}</span>
      )}
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase" as const, color: "var(--muted-foreground)", marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontFamily: HEADER_FONT, fontSize: 16, fontWeight: 800,
        color: accent || "var(--foreground)", letterSpacing: "0.02em",
      }}>{value}</div>
    </div>
  );
}

// ── HighlightCard ─────────────────────────────────────────────────────────────

function HighlightCard({ kind, match, ownerA, ownerB }: {
  kind: "closest" | "blowout";
  match: NormalizedMatchup;
  ownerA: string;
  ownerB: string;
}) {
  const margin = Math.abs(match.scoreA - match.scoreB);
  const winner = match.scoreA > match.scoreB ? ownerA : ownerB;
  const winnerColor = getDivColor(winner).text;
  const color = kind === "closest" ? GOLD : ACCENT;
  return (
    <div style={{
      background: "var(--secondary)", border: "1px solid var(--border)",
      borderRadius: 8, padding: 14, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color }} />
      <div style={{ marginLeft: 4 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase" as const, color, marginBottom: 6,
        }}>
          {kind === "closest" ? "Closest Game" : "Biggest Blowout"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: HEADER_FONT, fontSize: 22, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {match.scoreA.toFixed(1)} – {match.scoreB.toFixed(1)}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: MONO_FONT, fontWeight: 600 }}>
            ±{margin.toFixed(1)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          <span style={{ color: winnerColor, fontWeight: 700 }}>{winner}</span>
          {" · "}
          {match.season} {match.playoff ? "Playoffs" : `Week ${match.week}`}
        </div>
      </div>
    </div>
  );
}

// ── H2HMatrix ─────────────────────────────────────────────────────────────────

function H2HMatrix({ owners, activeSeasons, allMatchups, mode, showDivColors, onSelect, selA, selB }: {
  owners: string[];
  activeSeasons: Set<number>;
  allMatchups: HistoricalMatchup[];
  mode: MatrixMode;
  showDivColors: boolean;
  onSelect: (i: number, j: number) => void;
  selA: number | null;
  selB: number | null;
}) {
  const CELL_W = 64, CELL_H = 40, OWNER_COL_W = 132;

  const records = useMemo(() =>
    owners.map((a, i) => owners.map((b, j) => {
      if (i === j) return null;
      return pairRecord(a, b, activeSeasons, allMatchups);
    })),
    [owners, activeSeasons, allMatchups]
  );

  const maxDiff = useMemo(() => {
    let max = 1;
    for (const row of records) for (const rec of row) {
      if (rec) max = Math.max(max, Math.abs(rec.aw - rec.bw));
    }
    return max;
  }, [records]);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: OWNER_COL_W + CELL_W * owners.length + 20 }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${OWNER_COL_W}px repeat(${owners.length}, ${CELL_W}px)`,
          borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, zIndex: 5,
          background: "var(--card)",
        }}>
          <div style={{
            padding: "10px 16px", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            color: "var(--muted-foreground)", borderRight: "1px solid var(--border)",
          }}>Team ↓ vs →</div>
          {owners.map((owner, i) => {
            const dc = showDivColors ? getDivColor(owner) : null;
            const isSel = selA === i || selB === i;
            return (
              <div key={i} style={{
                padding: "8px 0 6px", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: isSel ? ACCENT_DIM : "transparent",
                borderLeft: "1px solid var(--border)",
              }}>
                <OwnerAvatar owner={owner} size={22} />
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                  color: dc ? dc.text : "var(--muted-foreground)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: CELL_W - 4,
                }}>{owner}</span>
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {owners.map((rowOwner, i) => {
          const dc = showDivColors ? getDivColor(rowOwner) : null;
          const rowSel = selA === i || selB === i;
          return (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: `${OWNER_COL_W}px repeat(${owners.length}, ${CELL_W}px)`,
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{
                padding: "0 12px", display: "flex", alignItems: "center", gap: 8,
                borderRight: "1px solid var(--border)",
                background: rowSel ? ACCENT_DIM : "var(--card)",
                position: "sticky", left: 0, zIndex: 2, height: CELL_H,
              }}>
                <OwnerAvatar owner={rowOwner} size={22} />
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: dc ? dc.text : "var(--foreground)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{rowOwner}</span>
              </div>

              {owners.map((_, j) => {
                if (i === j) return (
                  <div key={j} style={{
                    height: CELL_H, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--secondary)", borderLeft: "1px solid var(--border)",
                  }}>
                    <div style={{ width: 14, height: 2, background: "var(--border)", borderRadius: 1 }} />
                  </div>
                );

                const rec = records[i][j]!;
                const diff = rec.aw - rec.bw;
                const intensity = Math.abs(diff) / maxDiff;
                const isSel = (selA === i && selB === j) || (selA === j && selB === i);
                const isFocused = selA !== null && selB !== null && (selA === i || selB === i || selA === j || selB === j);
                const dim = selA !== null && selB !== null && !isFocused;

                let cellBg = "transparent";
                if (mode === "heat") {
                  if (diff > 0) cellBg = `rgba(74,222,128,${(0.05 + intensity * 0.32).toFixed(3)})`;
                  else if (diff < 0) cellBg = `rgba(253,74,72,${(0.05 + intensity * 0.32).toFixed(3)})`;
                }
                if (isSel) cellBg = ACCENT_DIM;

                return (
                  <div
                    key={j}
                    onClick={() => onSelect(i, j)}
                    style={{
                      height: CELL_H, display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer",
                      background: cellBg, borderLeft: "1px solid var(--border)",
                      opacity: dim ? 0.35 : 1, transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = ACCENT_DIM; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = cellBg; }}
                  >
                    {mode === "record" && (
                      <span style={{
                        fontFamily: MONO_FONT, fontSize: 12, fontWeight: 600,
                        color: diff > 0 ? WIN_COLOR : diff < 0 ? LOSS_COLOR : "var(--muted-foreground)",
                        letterSpacing: "-0.02em",
                      }}>
                        {rec.aw}-{rec.bw}{rec.ties > 0 ? `-${rec.ties}` : ""}
                      </span>
                    )}
                    {mode === "heat" && (
                      <span style={{
                        fontFamily: MONO_FONT, fontSize: 12, fontWeight: 700,
                        color: diff > 0 ? WIN_COLOR : diff < 0 ? LOSS_COLOR : "var(--muted-foreground)",
                      }}>
                        {diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : "—"}
                      </span>
                    )}
                    {mode === "points" && (
                      <span style={{
                        fontFamily: MONO_FONT, fontSize: 11, fontWeight: 600,
                        color: rec.aPts > rec.bPts ? WIN_COLOR : rec.bPts > rec.aPts ? LOSS_COLOR : "var(--muted-foreground)",
                      }}>
                        {(rec.aPts - rec.bPts >= 0 ? "+" : "") + (rec.aPts - rec.bPts).toFixed(0)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score Timeline ─────────────────────────────────────────────────────────────

function ScoreTimeline({ ownerA, ownerB, matches }: {
  ownerA: string;
  ownerB: string;
  matches: NormalizedMatchup[];
}) {
  if (matches.length === 0) return null;
  const dcA = getDivColor(ownerA);
  const dcB = getDivColor(ownerB);
  const H = 180;
  const usableH = H / 2 - 24;
  const maxAbs = Math.max(...matches.map(m => Math.abs(m.scoreA - m.scoreB)), 10);
  const barW = Math.max(6, Math.min(22, (560 / matches.length) - 2));
  const gap = 2;
  const startX = 30;
  const totalW = Math.max(620, startX + (barW + gap) * matches.length + 30);

  const seasonMarkers: { season: number; idx: number }[] = [];
  let lastSeason: number | null = null;
  matches.forEach((m, i) => {
    if (m.season !== lastSeason) { seasonMarkers.push({ season: m.season, idx: i }); lastSeason = m.season; }
  });

  return (
    <div style={{ background: "var(--secondary)", borderRadius: 8, padding: "14px 12px", border: "1px solid var(--border)" }}>
      <svg width="100%" height={H} viewBox={`0 0 ${totalW} ${H}`} preserveAspectRatio="xMidYMid meet">
        <line x1={0} y1={H / 2} x2={totalW} y2={H / 2} style={{ stroke: "var(--border)" }} strokeWidth={1} />
        {seasonMarkers.map((sm, idx) => {
          const x = startX + sm.idx * (barW + gap) - 1;
          return (
            <g key={idx}>
              <line x1={x} y1={8} x2={x} y2={H - 18} style={{ stroke: "var(--border)" }} strokeDasharray="2,3" strokeWidth={1} />
              <text x={x + 4} y={16} style={{ fill: "var(--muted-foreground)" }} fontSize={9} fontFamily={MONO_FONT} fontWeight={600}>{sm.season}</text>
            </g>
          );
        })}
        {matches.map((m, i) => {
          const diff = m.scoreA - m.scoreB;
          const barH = Math.max(2, (Math.abs(diff) / maxAbs) * usableH);
          const x = startX + i * (barW + gap);
          const y = diff > 0 ? (H / 2 - barH) : H / 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={diff > 0 ? dcA.text : dcB.text} opacity={m.playoff ? 1 : 0.78} rx={2}>
                <title>{m.season} W{m.week}: {ownerA} {m.scoreA.toFixed(1)} – {m.scoreB.toFixed(1)} {ownerB}</title>
              </rect>
              {m.playoff && (
                <circle cx={x + barW / 2} cy={diff > 0 ? y - 5 : y + barH + 5} r={2} fill={GOLD} />
              )}
            </g>
          );
        })}
        <text x={4} y={H / 2 - usableH} style={{ fill: dcA.text }} fontSize={10} fontWeight={700} fontFamily={HEADER_FONT} letterSpacing="0.05em">
          {ownerA.toUpperCase()} ↑
        </text>
        <text x={4} y={H / 2 + usableH + 10} style={{ fill: dcB.text }} fontSize={10} fontWeight={700} fontFamily={HEADER_FONT} letterSpacing="0.05em">
          {ownerB.toUpperCase()} ↓
        </text>
      </svg>
    </div>
  );
}

// ── PairDetail ────────────────────────────────────────────────────────────────

function PairDetail({ ownerA, ownerB, activeSeasons, availableSeasons, allMatchups, onClose }: {
  ownerA: string;
  ownerB: string;
  activeSeasons: Set<number>;
  availableSeasons: number[];
  allMatchups: HistoricalMatchup[];
  onClose: () => void;
}) {
  const dcA = getDivColor(ownerA);
  const dcB = getDivColor(ownerB);
  const rec = useMemo(
    () => pairRecord(ownerA, ownerB, activeSeasons, allMatchups),
    [ownerA, ownerB, activeSeasons, allMatchups]
  );
  const ms = rec.matches;

  const streak = useMemo(() => {
    let streakOwner: string | null = null, len = 0;
    for (let i = ms.length - 1; i >= 0; i--) {
      const winner = ms[i].scoreA > ms[i].scoreB ? ownerA : ms[i].scoreB > ms[i].scoreA ? ownerB : null;
      if (!winner) continue;
      if (!streakOwner) { streakOwner = winner; len = 1; }
      else if (winner === streakOwner) len++;
      else break;
    }
    return streakOwner ? { owner: streakOwner, len } : null;
  }, [ms, ownerA, ownerB]);

  const { closest, blowout, blowoutMargin } = useMemo(() => {
    let cl: NormalizedMatchup | null = null, clM = Infinity;
    let bl: NormalizedMatchup | null = null, blM = -Infinity;
    for (const m of ms) {
      const margin = Math.abs(m.scoreA - m.scoreB);
      if (margin < clM) { clM = margin; cl = m; }
      if (margin > blM) { blM = margin; bl = m; }
    }
    return { closest: cl, blowout: bl, blowoutMargin: blM };
  }, [ms]);

  const bySeason = useMemo(() => {
    const map: Record<number, { aw: number; bw: number }> = {};
    for (const yr of availableSeasons) map[yr] = { aw: 0, bw: 0 };
    for (const m of ms) {
      if (m.scoreA > m.scoreB) map[m.season].aw++;
      else if (m.scoreB > m.scoreA) map[m.season].bw++;
    }
    return map;
  }, [ms, availableSeasons]);

  const avgA = rec.count > 0 ? rec.aPts / rec.count : 0;
  const avgB = rec.count > 0 ? rec.bPts / rec.count : 0;
  const winner = rec.aw > rec.bw ? "A" : rec.bw > rec.aw ? "B" : null;
  const activeSeasonsArr = availableSeasons.filter(yr => activeSeasons.has(yr));

  if (rec.count === 0) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 32, textAlign: "center" }}>
        <button onClick={onClose} style={{ float: "right", background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 18 }}>×</button>
        <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontStyle: "italic" }}>
          No head-to-head matchups between {ownerA} and {ownerB} in the selected seasons.
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {/* VS header */}
      <div style={{
        position: "relative", padding: "28px 28px 24px",
        background: `linear-gradient(90deg, ${dcA.bg} 0%, transparent 35%, transparent 65%, ${dcB.bg} 100%)`,
        borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, background: "none", border: "none",
          color: "var(--muted-foreground)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <OwnerAvatar owner={ownerA} size={48} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: dcA.text, marginBottom: 2 }}>
                {OWNER_DIVISION[ownerA] || ""}
              </div>
              <div style={{ fontFamily: HEADER_FONT, fontSize: 28, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.01em", lineHeight: 1 }}>
                {ownerA}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontFamily: HEADER_FONT, fontSize: 64, fontWeight: 900, color: winner === "A" ? WIN_COLOR : "var(--foreground)", lineHeight: 1, letterSpacing: "-0.04em" }}>
              {rec.aw}
            </span>
            <span style={{ fontFamily: HEADER_FONT, fontSize: 22, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>—</span>
            <span style={{ fontFamily: HEADER_FONT, fontSize: 64, fontWeight: 900, color: winner === "B" ? WIN_COLOR : "var(--foreground)", lineHeight: 1, letterSpacing: "-0.04em" }}>
              {rec.bw}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: dcB.text, marginBottom: 2 }}>
                {OWNER_DIVISION[ownerB] || ""}
              </div>
              <div style={{ fontFamily: HEADER_FONT, fontSize: 28, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.01em", lineHeight: 1 }}>
                {ownerB}
              </div>
            </div>
            <OwnerAvatar owner={ownerB} size={48} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <Stat label="All-time meetings" value={rec.count} />
          <Stat label="Avg score" value={`${avgA.toFixed(1)} – ${avgB.toFixed(1)}`} />
          {streak && (
            <Stat label="Active streak" value={`${streak.owner} W${streak.len}`} accent={getDivColor(streak.owner).text} />
          )}
          {ms.some(m => m.playoff) && (
            <Stat label="Playoff games" value={ms.filter(m => m.playoff).length} accent={GOLD} />
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }}>
        <div>
          <ChartLabel label="Score Differential Over Time" subtitle="Positive bar = win for team listed first" />
          <ScoreTimeline ownerA={ownerA} ownerB={ownerB} matches={ms} />

          <div style={{ marginTop: 24 }}>
            <ChartLabel label="Match Log" subtitle={`${ms.length} matchups`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
              {[...ms].reverse().map((m, i) => {
                const aWin = m.scoreA > m.scoreB;
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "60px 56px 1fr auto 1fr",
                    gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 6,
                    background: i === 0 ? "var(--secondary)" : "transparent",
                    border: i === 0 ? "1px solid var(--border)" : "1px solid transparent",
                    fontSize: 12,
                  }}>
                    <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>{m.season}</span>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600, letterSpacing: "0.04em" }}>
                      {m.playoff ? <span style={{ color: GOLD, fontWeight: 700 }}>PLAYOFF</span> : `WK ${m.week}`}
                    </span>
                    <span style={{ textAlign: "right", fontWeight: aWin ? 700 : 500, color: aWin ? WIN_COLOR : "var(--muted-foreground)" }}>
                      {ownerA}{" "}
                      <span style={{ fontFamily: MONO_FONT, marginLeft: 6 }}>{m.scoreA.toFixed(1)}</span>
                    </span>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}>vs</span>
                    <span style={{ fontWeight: m.scoreB > m.scoreA ? 700 : 500, color: m.scoreB > m.scoreA ? WIN_COLOR : "var(--muted-foreground)" }}>
                      <span style={{ fontFamily: MONO_FONT, marginRight: 6 }}>{m.scoreB.toFixed(1)}</span>
                      {ownerB}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <ChartLabel label="By Season" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {activeSeasonsArr.map(yr => {
                const s = bySeason[yr] ?? { aw: 0, bw: 0 };
                const total = s.aw + s.bw;
                if (total === 0) return (
                  <div key={yr} style={{ display: "grid", gridTemplateColumns: "44px 1fr 60px", gap: 8, alignItems: "center", padding: "6px 0" }}>
                    <span style={{ fontFamily: HEADER_FONT, fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)" }}>{yr}</span>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontStyle: "italic" }}>no matchups</span>
                    <span />
                  </div>
                );
                const aPct = (s.aw / total) * 100;
                return (
                  <div key={yr} style={{ display: "grid", gridTemplateColumns: "44px 1fr 70px", gap: 10, alignItems: "center" }}>
                    <span style={{ fontFamily: HEADER_FONT, fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>{yr}</span>
                    <div style={{ height: 10, borderRadius: 2, overflow: "hidden", display: "flex", background: "var(--border)" }}>
                      <div style={{ width: `${aPct}%`, background: dcA.text, opacity: 0.85 }} />
                      <div style={{ width: `${100 - aPct}%`, background: dcB.text, opacity: 0.85 }} />
                    </div>
                    <span style={{ fontFamily: MONO_FONT, fontSize: 11, fontWeight: 600, color: "var(--foreground)", textAlign: "right" }}>
                      {s.aw}–{s.bw}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {closest && <HighlightCard kind="closest" match={closest} ownerA={ownerA} ownerB={ownerB} />}
          {blowout && blowoutMargin > 1 && <HighlightCard kind="blowout" match={blowout} ownerA={ownerA} ownerB={ownerB} />}

          <div style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
            <ChartLabel label="Total Points Scored" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: dcA.text, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>{ownerA}</div>
                <div style={{ fontFamily: HEADER_FONT, fontSize: 22, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{rec.aPts.toFixed(1)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: dcB.text, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>{ownerB}</div>
                <div style={{ fontFamily: HEADER_FONT, fontSize: 22, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{rec.bPts.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar: DominanceBoard ───────────────────────────────────────────────────

function DominanceBoard({ owners, activeSeasons, allMatchups, showDivColors }: {
  owners: string[];
  activeSeasons: Set<number>;
  allMatchups: HistoricalMatchup[];
  showDivColors: boolean;
}) {
  const stats = useMemo(() => {
    return owners.map(owner => {
      let w = 0, l = 0;
      for (const other of owners) {
        if (other === owner) continue;
        const r = pairRecord(owner, other, activeSeasons, allMatchups);
        w += r.aw; l += r.bw;
      }
      const total = w + l;
      return { owner, w, l, pct: total > 0 ? w / total : 0 };
    }).sort((a, b) => b.pct - a.pct);
  }, [owners, activeSeasons, allMatchups]);

  return (
    <div>
      <ChartLabel label="All-Time Win %" subtitle="across selected seasons" />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {stats.map(({ owner, w, l, pct }) => {
          const dc = showDivColors ? getDivColor(owner) : null;
          return (
            <div key={owner} style={{ display: "grid", gridTemplateColumns: "22px 70px 1fr 50px", gap: 8, alignItems: "center" }}>
              <OwnerAvatar owner={owner} size={20} />
              <span style={{ fontSize: 11, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{owner}</span>
              <div style={{ height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", background: dc ? dc.text : ACCENT, opacity: 0.85, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO_FONT, color: "var(--foreground)", textAlign: "right" }}>
                {(pct * 100).toFixed(0)}%{" "}
                <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>{w}-{l}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar: BiggestRivalries ─────────────────────────────────────────────────

function BiggestRivalries({ owners, activeSeasons, allMatchups, onSelect }: {
  owners: string[];
  activeSeasons: Set<number>;
  allMatchups: HistoricalMatchup[];
  onSelect: (i: number, j: number) => void;
}) {
  const top = useMemo(() => {
    const pairs: { i: number; j: number; r: PairRecord; score: number }[] = [];
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const r = pairRecord(owners[i], owners[j], activeSeasons, allMatchups);
        if (r.count === 0) continue;
        const closeness = 1 - Math.abs(r.aw - r.bw) / Math.max(r.count, 1);
        pairs.push({ i, j, r, score: r.count * (0.4 + 0.6 * closeness) });
      }
    }
    return pairs.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [owners, activeSeasons, allMatchups]);

  return (
    <div>
      <ChartLabel label="Top Rivalries" subtitle="by closeness × volume" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map((p, idx) => {
          const ownerA = owners[p.i], ownerB = owners[p.j];
          const dcA = getDivColor(ownerA), dcB = getDivColor(ownerB);
          return (
            <div
              key={idx}
              onClick={() => onSelect(p.i, p.j)}
              style={{
                display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 10, alignItems: "center",
                padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                background: "var(--secondary)", border: "1px solid var(--border)",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ fontFamily: HEADER_FONT, fontSize: 13, fontWeight: 800, color: "var(--muted-foreground)" }}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <OwnerAvatar owner={ownerA} size={18} />
                <span style={{ fontSize: 11, fontWeight: 600, color: dcA.text }}>{ownerA}</span>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 500 }}>vs</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: dcB.text }}>{ownerB}</span>
                <OwnerAvatar owner={ownerB} size={18} />
              </div>
              <span style={{ fontFamily: MONO_FONT, fontSize: 11, fontWeight: 700, color: "var(--foreground)" }}>
                {p.r.aw}-{p.r.bw}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar: MostLopsided ─────────────────────────────────────────────────────

function MostLopsided({ owners, activeSeasons, allMatchups, onSelect }: {
  owners: string[];
  activeSeasons: Set<number>;
  allMatchups: HistoricalMatchup[];
  onSelect: (i: number, j: number) => void;
}) {
  const top = useMemo(() => {
    const pairs: { i: number; j: number; r: PairRecord; diff: number }[] = [];
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const r = pairRecord(owners[i], owners[j], activeSeasons, allMatchups);
        if (r.count < 3) continue;
        const diff = Math.abs(r.aw - r.bw);
        pairs.push({ i, j, r, diff });
      }
    }
    return pairs.sort((a, b) => b.diff - a.diff).slice(0, 4);
  }, [owners, activeSeasons, allMatchups]);

  return (
    <div>
      <ChartLabel label="Most One-Sided" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map((p, idx) => {
          const dom = p.r.aw > p.r.bw ? owners[p.i] : owners[p.j];
          const sub = p.r.aw > p.r.bw ? owners[p.j] : owners[p.i];
          const domDc = getDivColor(dom);
          return (
            <div
              key={idx}
              onClick={() => onSelect(p.i, p.j)}
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center",
                padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                background: "var(--secondary)", border: "1px solid var(--border)",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <OwnerAvatar owner={dom} size={22} />
              <div style={{ minWidth: 0, lineHeight: 1.2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: domDc.text }}>{dom} owns {sub}</div>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", fontFamily: MONO_FONT, marginTop: 2 }}>+{p.diff} margin</div>
              </div>
              <span style={{ fontFamily: MONO_FONT, fontSize: 12, fontWeight: 700, color: WIN_COLOR }}>
                {Math.max(p.r.aw, p.r.bw)}-{Math.min(p.r.aw, p.r.bw)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RivalryClient ─────────────────────────────────────────────────────────────

export function RivalryClient({ allMatchups, availableSeasons }: RivalryClientProps) {
  const seasons = [...availableSeasons].sort((a, b) => b - a);
  const owners = ALL_OWNERS;

  const [selA, setSelA] = useState<number | null>(null);
  const [selB, setSelB] = useState<number | null>(null);
  const [activeSeasonsList, setActiveSeasonsList] = useState<number[]>(seasons);
  const [matrixMode, setMatrixMode] = useState<MatrixMode>("record");
  const [showDivColors, setShowDivColors] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);
  const activeSeasons = useMemo(() => new Set(activeSeasonsList), [activeSeasonsList]);

  const handleSelect = useCallback((i: number, j: number) => {
    if (i === j) return;
    if (selA === i && selB === j) { setSelA(null); setSelB(null); return; }
    setSelA(i); setSelB(j);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [selA, selB]);

  const clearSelection = useCallback(() => { setSelA(null); setSelB(null); }, []);

  const toggleSeason = useCallback((yr: number) => {
    setActiveSeasonsList(s =>
      s.includes(yr) ? (s.length === 1 ? s : s.filter(y => y !== yr)) : [...s, yr].sort((a, b) => a - b)
    );
  }, []);

  const { totalGames, totalPlayoff } = useMemo(() => {
    let games = 0, playoff = 0;
    for (const m of allMatchups) {
      if (!activeSeasons.has(m.season)) continue;
      games++;
      if (m.playoff) playoff++;
    }
    return { totalGames: games, totalPlayoff: playoff };
  }, [allMatchups, activeSeasons]);

  const MODE_LABELS: Record<MatrixMode, string> = { record: "Record", heat: "Win Diff", points: "Points ±" };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Page header */}
      <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <span style={{
                fontFamily: HEADER_FONT, fontSize: 22, fontWeight: 800,
                letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--foreground)",
              }}>Rivalry</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 4,
                background: ACCENT_DIM, color: ACCENT,
                border: "1px solid rgba(253,74,72,0.3)", letterSpacing: "0.04em",
              }}>
                {totalGames} games · {totalPlayoff} playoff · {activeSeasonsList.length} seasons
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Tap any cell in the matrix to dig into a head-to-head matchup. History sourced from Sleeper.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              Lookback
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {seasons.map(yr => {
                const on = activeSeasonsList.includes(yr);
                return (
                  <button key={yr} onClick={() => toggleSeason(yr)} style={{
                    padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                    background: on ? ACCENT : "transparent",
                    border: on ? `1px solid ${ACCENT}` : "1px solid var(--border)",
                    color: on ? "#fff" : "var(--muted-foreground)",
                    fontSize: 13, fontWeight: on ? 700 : 500,
                    fontFamily: HEADER_FONT, letterSpacing: "0.04em",
                    transition: "all 0.15s",
                  }}>{yr}</button>
                );
              })}
              <button onClick={() => setActiveSeasonsList(seasons)} style={{
                padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--muted-foreground)", fontSize: 11, fontWeight: 500,
              }}>All</button>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
        {/* Left: Matrix + detail */}
        <div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontFamily: HEADER_FONT, fontSize: 16, fontWeight: 800, color: "var(--foreground)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                  Head-to-Head Matrix
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                  Row team&apos;s record vs column team
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex" }}>
                  {(["record", "heat", "points"] as MatrixMode[]).map((key, idx) => (
                    <button key={key} onClick={() => setMatrixMode(key)} style={{
                      padding: "5px 10px",
                      borderRadius: idx === 0 ? "4px 0 0 4px" : idx === 2 ? "0 4px 4px 0" : 0,
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                      background: matrixMode === key ? ACCENT : "var(--secondary)",
                      color: matrixMode === key ? "#fff" : "var(--muted-foreground)",
                      border: "1px solid var(--border)",
                      textTransform: "uppercase" as const,
                      cursor: "pointer", marginLeft: idx > 0 ? -1 : 0,
                    }}>{MODE_LABELS[key]}</button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDivColors(v => !v)}
                  title="Toggle division colors"
                  style={{
                    padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                    background: showDivColors ? "rgba(74,222,128,0.1)" : "var(--secondary)",
                    border: showDivColors ? "1px solid rgba(74,222,128,0.3)" : "1px solid var(--border)",
                    color: showDivColors ? "#4ade80" : "var(--muted-foreground)",
                    fontSize: 11, fontWeight: 600,
                  }}
                >Divs</button>
              </div>
            </div>
            <H2HMatrix
              owners={owners}
              activeSeasons={activeSeasons}
              allMatchups={allMatchups}
              mode={matrixMode}
              showDivColors={showDivColors}
              onSelect={handleSelect}
              selA={selA}
              selB={selB}
            />
          </div>

          {selA !== null && selB !== null && (
            <div ref={detailRef} style={{ marginTop: 20 }}>
              <PairDetail
                ownerA={owners[selA]}
                ownerB={owners[selB]}
                activeSeasons={activeSeasons}
                availableSeasons={seasons}
                allMatchups={allMatchups}
                onClose={clearSelection}
              />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 18px 16px" }}>
            <DominanceBoard owners={owners} activeSeasons={activeSeasons} allMatchups={allMatchups} showDivColors={showDivColors} />
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 18px 16px" }}>
            <BiggestRivalries owners={owners} activeSeasons={activeSeasons} allMatchups={allMatchups} onSelect={handleSelect} />
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 18px 16px" }}>
            <MostLopsided owners={owners} activeSeasons={activeSeasons} allMatchups={allMatchups} onSelect={handleSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}
