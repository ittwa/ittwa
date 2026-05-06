"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SALARY_CAP, YEARS_CAP } from "@/lib/config";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TeamDirectoryEntry {
  owner: string;
  team: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  divRec: string;
  pf: number;
  pa: number;
  streak: string;
  rank: number;
  seed: number | null;
  capCommit: number;
  capDead: number;
  capRem: number;
  yearsUsed: number;
  yearsRem: number;
  picks: number;
  roster: number;
  pos: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#FD4A48";
const ACCENT_DIM = "rgba(253,74,72,0.12)";
const GOLD = "#E8B84B";
const EMERALD = "#4ade80";
const ROSE = "#f87171";
const CARD = "var(--card)";
const CARD_BORDER = "var(--border)";
const SURFACE = "var(--secondary)";
const MUTED = "#555";
const MUTED_TEXT = "#777";
const TEXT = "var(--foreground)";
const TEXT_DIM = "#bbb";
const HEADER_FONT = "'Barlow Condensed', sans-serif";
const MONO_FONT = "'JetBrains Mono', monospace";

const DIV_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Concussion:          { color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.30)" },
  "Hey Arnold":        { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.30)" },
  Replacements:        { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.30)" },
  "Dark Knight Rises": { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
};

const FALLBACK_DC = { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const POS_COLORS: Record<string, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa", TE: "#fb923c", K: "#a78bfa", DEF: "#94a3b8",
};

const DIV_ORDER = ["Concussion", "Hey Arnold", "Replacements", "Dark Knight Rises"];
const LIST_COLS = "32px 44px 1fr 130px 80px 60px 90px 90px 60px 90px";

type ViewMode = "grid" | "list";
type GroupBy = "division" | "none";
type SortKey = "record" | "pf" | "cap" | "alpha";

function getDivColor(division: string) {
  return DIV_COLORS[division] || FALLBACK_DC;
}

function initials(name: string): string {
  if (name === "HoganLamb") return "HL";
  return name.slice(0, 2).toUpperCase();
}

function winPct(t: TeamDirectoryEntry): number {
  return t.wins + t.losses > 0 ? t.wins / (t.wins + t.losses) : 0;
}

// ── Shared Components ────────────────────────────────────────────────────────

function SectionLabel({
  label,
  count,
  right,
  color,
}: {
  label: string;
  count?: string;
  right?: React.ReactNode;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ display: "block", flexShrink: 0, width: 4, height: 20, background: color || GOLD, borderRadius: 2 }} />
        <span style={{ fontFamily: HEADER_FONT, fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: color || TEXT, whiteSpace: "nowrap" }}>
          {label}
        </span>
        {count != null && (
          <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO_FONT }}>{count}</span>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

function DivBadge({ division, size = "md" }: { division: string; size?: "sm" | "md" }) {
  const d = getDivColor(division);
  const fs = size === "sm" ? 9 : 10;
  const pad = size === "sm" ? "1px 6px" : "2px 8px";
  return (
    <span
      style={{
        fontSize: fs, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
        padding: pad, borderRadius: 4,
        background: d.bg, color: d.color, border: `1px solid ${d.border}`,
        lineHeight: 1.6, whiteSpace: "nowrap",
      }}
    >
      {division}
    </span>
  );
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak || streak === "-" || streak === "—") {
    return <span style={{ color: MUTED, fontSize: 11 }}>—</span>;
  }
  const isWin = streak.startsWith("W");
  const color = isWin ? EMERALD : ROSE;
  const bg = isWin ? "rgba(74,222,128,0.10)" : "rgba(248,113,113,0.10)";
  const border = isWin ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)";
  return (
    <span
      style={{
        fontFamily: MONO_FONT, fontSize: 10, fontWeight: 700,
        padding: "1px 6px", borderRadius: 4,
        background: bg, color, border: `1px solid ${border}`,
        lineHeight: 1.6,
      }}
    >
      {streak}
    </span>
  );
}

function SeedPill({ seed }: { seed: number }) {
  return (
    <span
      style={{
        fontFamily: HEADER_FONT, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
        padding: "1px 7px", borderRadius: 4,
        background: ACCENT_DIM, color: ACCENT, border: "1px solid rgba(253,74,72,0.3)",
        lineHeight: 1.6, whiteSpace: "nowrap", textTransform: "uppercase",
      }}
    >
      SEED {seed}
    </span>
  );
}

function OwnerAvatar({ name, division, size = 40 }: { name: string; division: string; size?: number }) {
  const d = getDivColor(division);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0,
        background: d.bg, border: `1px solid ${d.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <span style={{ fontFamily: HEADER_FONT, fontWeight: 800, fontSize: size * 0.38, color: d.color, letterSpacing: "0.02em" }}>
        {initials(name)}
      </span>
    </div>
  );
}

function CapBarSmall({ used, cap, color, label }: { used: number; cap: number; color: string; label: string }) {
  const pct = Math.min(used / cap, 1);
  const display = Number.isInteger(used) ? String(used) : used.toFixed(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: TEXT_DIM, fontWeight: 600, whiteSpace: "nowrap" }}>
          <span style={{ color }}>{display}</span><span style={{ color: MUTED }}> / {cap}</span>
        </span>
      </div>
      <div style={{ height: 3, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: MONO_FONT, fontSize: 14, fontWeight: 600, color, whiteSpace: "nowrap" }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Team Card (grid view) ────────────────────────────────────────────────────

function TeamCard({ team }: { team: TeamDirectoryEntry }) {
  const [hover, setHover] = useState(false);
  const d = getDivColor(team.division);
  const pct = winPct(team);
  const capUsed = team.capCommit + team.capDead;

  return (
    <Link
      href={`/teams/${encodeURIComponent(team.owner)}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block", textDecoration: "none", position: "relative",
        background: CARD,
        border: `1px solid ${hover ? d.border : CARD_BORDER}`,
        borderRadius: 10, overflow: "hidden",
        transition: "all 0.18s ease",
        boxShadow: hover ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${d.border}` : "none",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${d.color} 0%, ${d.color}55 60%, transparent 100%)` }} />

      <div style={{ padding: "16px 16px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <OwnerAvatar name={team.owner} division={team.division} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <DivBadge division={team.division} size="sm" />
            {team.seed && <SeedPill seed={team.seed} />}
          </div>
          <h3
            style={{
              fontFamily: HEADER_FONT, fontSize: 22, fontWeight: 800, letterSpacing: "0.01em",
              textTransform: "uppercase", color: TEXT, lineHeight: 1.05,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {team.owner}
          </h3>
          {team.team && (
            <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2, fontStyle: "italic" }}>{team.team}</div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`,
          background: SURFACE,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: HEADER_FONT, fontSize: 26, fontWeight: 800, color: EMERALD, lineHeight: 1 }}>{team.wins}</span>
          <span style={{ fontFamily: HEADER_FONT, fontSize: 18, fontWeight: 600, color: MUTED, lineHeight: 1 }}>–</span>
          <span style={{ fontFamily: HEADER_FONT, fontSize: 26, fontWeight: 800, color: ROSE, lineHeight: 1 }}>{team.losses}</span>
          <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED, marginLeft: 6 }}>
            {(pct * 100).toFixed(0)}%
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>Streak</span>
          <StreakBadge streak={team.streak} />
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat label="Points For" value={team.pf.toFixed(1)} color={GOLD} />
        <Stat label="Points Vs" value={team.pa.toFixed(1)} color={MUTED_TEXT} />
        <Stat label="Div Record" value={team.divRec} color={TEXT_DIM} />
        <Stat label="Roster" value={String(team.roster)} sub={`${team.picks} picks`} color={TEXT_DIM} />
      </div>

      <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        <CapBarSmall used={capUsed} cap={SALARY_CAP} color={ACCENT} label="Salary $" />
        <CapBarSmall used={team.yearsUsed} cap={YEARS_CAP} color={GOLD} label="Years" />
      </div>

      <div
        style={{
          padding: "10px 16px", borderTop: `1px solid ${CARD_BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          background: SURFACE,
        }}
      >
        <span
          style={{
            fontFamily: HEADER_FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: hover ? ACCENT : MUTED, textTransform: "uppercase",
            transition: "color 0.15s",
          }}
        >
          View Team →
        </span>
      </div>
    </Link>
  );
}

// ── Team Row (list view) ─────────────────────────────────────────────────────

function TeamRow({ team, rank }: { team: TeamDirectoryEntry; rank: number }) {
  const [hover, setHover] = useState(false);
  const pct = winPct(team);

  return (
    <Link
      href={`/teams/${encodeURIComponent(team.owner)}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: LIST_COLS,
        gap: 12, alignItems: "center", textDecoration: "none",
        padding: "12px 16px",
        borderBottom: `1px solid ${CARD_BORDER}`,
        background: hover ? SURFACE : "transparent",
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: MUTED, textAlign: "center" }}>{rank}</span>
      <OwnerAvatar name={team.owner} division={team.division} size={32} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: HEADER_FONT, fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: "0.02em", textTransform: "uppercase", lineHeight: 1.1 }}>{team.owner}</div>
        {team.team && <div style={{ fontSize: 10, color: MUTED_TEXT, fontStyle: "italic", marginTop: 1 }}>{team.team}</div>}
      </div>
      <DivBadge division={team.division} size="sm" />
      <span style={{ fontFamily: MONO_FONT, fontSize: 13, fontWeight: 700, color: TEXT }}>
        <span style={{ color: EMERALD }}>{team.wins}</span>
        <span style={{ color: MUTED }}>–</span>
        <span style={{ color: ROSE }}>{team.losses}</span>
      </span>
      <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: TEXT_DIM, textAlign: "right" }}>{(pct * 100).toFixed(1)}%</span>
      <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: GOLD, textAlign: "right" }}>{team.pf.toFixed(1)}</span>
      <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: MUTED_TEXT, textAlign: "right" }}>{team.pa.toFixed(1)}</span>
      <span style={{ textAlign: "center" }}><StreakBadge streak={team.streak} /></span>
      <span
        style={{
          fontFamily: HEADER_FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: hover ? ACCENT : MUTED, textTransform: "uppercase", textAlign: "right",
        }}
      >
        View →
      </span>
    </Link>
  );
}

function ListHeader() {
  const cols = [
    { label: "#", align: "center" as const },
    { label: "", align: "left" as const },
    { label: "Owner", align: "left" as const },
    { label: "Division", align: "left" as const },
    { label: "W-L", align: "left" as const },
    { label: "Win%", align: "right" as const },
    { label: "PF", align: "right" as const },
    { label: "PA", align: "right" as const },
    { label: "Streak", align: "center" as const },
    { label: "", align: "right" as const },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: LIST_COLS,
        gap: 12, alignItems: "center",
        padding: "10px 16px",
        borderBottom: `1px solid ${CARD_BORDER}`,
        background: SURFACE,
      }}
    >
      {cols.map((c, i) => (
        <span
          key={i}
          style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            color: MUTED, textAlign: c.align,
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ── League Insights Charts ───────────────────────────────────────────────────

function InsightLegend({ items, right }: { items: { label: string; color: string }[]; right?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${CARD_BORDER}`, background: SURFACE, gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: "inline-block" }} />
            <span style={{ fontSize: 10, color: MUTED_TEXT, fontWeight: 600, letterSpacing: "0.04em" }}>{it.label}</span>
          </div>
        ))}
      </div>
      {right && <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO_FONT }}>{right}</span>}
    </div>
  );
}

function ChartFrame({
  title, color, subtitle, children, footer,
}: {
  title: string; color: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 3, height: 14, background: color, borderRadius: 2 }} />
          <span style={{ fontFamily: HEADER_FONT, fontSize: 14, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT }}>{title}</span>
        </div>
        {subtitle && <div style={{ fontSize: 10, color: MUTED, marginTop: 4, marginLeft: 13 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: "10px 12px 12px", flex: 1 }}>{children}</div>
      {footer}
    </div>
  );
}

const LBL_W = 64;

function CapBarRow({ team, max, isHover, onHover }: {
  team: TeamDirectoryEntry; max: number; isHover: boolean;
  onHover: (name: string | null) => void;
}) {
  const pctCommit = team.capCommit / max;
  const pctDead = team.capDead / max;
  const pctRem = Math.max(team.capRem, 0) / max;

  return (
    <div
      onMouseEnter={() => onHover(team.owner)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: "grid", gridTemplateColumns: `${LBL_W}px 1fr`, gap: 8, alignItems: "center",
        padding: "3px 4px", borderRadius: 4,
        background: isHover ? SURFACE : "transparent", transition: "background 0.12s",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: isHover ? TEXT : TEXT_DIM, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.owner}</span>
      <div style={{ position: "relative", height: 16, background: "#15151a", borderRadius: 3, overflow: "hidden", border: `1px solid ${CARD_BORDER}` }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pctCommit * 100}%`, background: EMERALD }} />
        <div style={{ position: "absolute", left: `${pctCommit * 100}%`, top: 0, bottom: 0, width: `${pctDead * 100}%`, background: ROSE }} />
        <div style={{ position: "absolute", left: `${(pctCommit + pctDead) * 100}%`, top: 0, bottom: 0, width: `${pctRem * 100}%`, background: GOLD, opacity: 0.85 }} />
        <div style={{ position: "absolute", left: `${(SALARY_CAP / max) * 100}%`, top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.45)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, fontFamily: MONO_FONT, fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.55)", pointerEvents: "none" }}>
          {pctCommit > 0.18 && (
            <span style={{ position: "absolute", left: `${pctCommit * 50}%`, transform: "translateX(-50%)", color: "#0a1f0e" }}>${team.capCommit.toFixed(0)}</span>
          )}
          {pctDead > 0.07 && (
            <span style={{ position: "absolute", left: `${(pctCommit + pctDead / 2) * 100}%`, transform: "translateX(-50%)", color: "#3b0d0f" }}>${team.capDead.toFixed(0)}</span>
          )}
          {pctRem > 0.10 && (
            <span style={{ position: "absolute", left: `${(pctCommit + pctDead + Math.max(team.capRem, 0) / max / 2) * 100}%`, transform: "translateX(-50%)", color: "#3a2c08" }}>${team.capRem.toFixed(0)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CapChart({ teams, hovered, onHover }: { teams: TeamDirectoryEntry[]; hovered: string | null; onHover: (n: string | null) => void }) {
  const { sorted, max } = useMemo(() => {
    const s = [...teams].sort((a, b) => b.capCommit - a.capCommit);
    return { sorted: s, max: Math.max(SALARY_CAP, ...s.map((t) => t.capCommit + t.capDead + Math.max(t.capRem, 0))) };
  }, [teams]);
  return (
    <ChartFrame
      title="Cap Breakdown"
      color={EMERALD}
      subtitle={`Committed + Dead + Remaining · Cap floor $${SALARY_CAP}`}
      footer={
        <InsightLegend
          items={[
            { label: "Committed", color: EMERALD },
            { label: "Dead", color: ROSE },
            { label: "Remaining", color: GOLD },
          ]}
          right={`Floor line @ $${SALARY_CAP}`}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {sorted.map((t) => (
          <CapBarRow key={t.owner} team={t} max={max} isHover={hovered === t.owner} onHover={onHover} />
        ))}
      </div>
    </ChartFrame>
  );
}

function RosterRow({ team, maxRoster, isHover, onHover }: {
  team: TeamDirectoryEntry; maxRoster: number; isHover: boolean;
  onHover: (n: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(team.owner)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: "grid", gridTemplateColumns: `${LBL_W}px 1fr 24px`, gap: 8, alignItems: "center",
        padding: "3px 4px", borderRadius: 4,
        background: isHover ? SURFACE : "transparent", transition: "background 0.12s",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: isHover ? TEXT : TEXT_DIM, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.owner}</span>
      <div style={{ position: "relative", height: 16, background: "#15151a", borderRadius: 3, overflow: "hidden", border: `1px solid ${CARD_BORDER}`, display: "flex" }}>
        {POS_ORDER.map((pos) => {
          const n = team.pos[pos] || 0;
          if (!n) return null;
          const pctW = (n / maxRoster) * 100;
          return (
            <div
              key={pos}
              style={{
                width: `${pctW}%`, background: POS_COLORS[pos],
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRight: "1px solid rgba(0,0,0,0.25)",
                fontFamily: MONO_FONT, fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.65)",
              }}
            >
              {pctW > 5 && n}
            </div>
          );
        })}
      </div>
      <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: isHover ? TEXT : MUTED, textAlign: "right", fontWeight: 700 }}>{team.roster}</span>
    </div>
  );
}

function RosterChart({ teams, hovered, onHover }: { teams: TeamDirectoryEntry[]; hovered: string | null; onHover: (n: string | null) => void }) {
  const { sorted, maxRoster } = useMemo(() => {
    const s = [...teams].sort((a, b) => b.roster - a.roster || a.owner.localeCompare(b.owner));
    return { sorted: s, maxRoster: Math.max(...s.map((t) => t.roster), 18) };
  }, [teams]);
  return (
    <ChartFrame
      title="Roster Mix"
      color="#60a5fa"
      subtitle="Player counts by position"
      footer={
        <InsightLegend
          items={POS_ORDER.map((p) => ({ label: p, color: POS_COLORS[p] }))}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {sorted.map((t) => (
          <RosterRow key={t.owner} team={t} maxRoster={maxRoster} isHover={hovered === t.owner} onHover={onHover} />
        ))}
      </div>
    </ChartFrame>
  );
}

function YearsRow({ team, max, isHover, onHover }: {
  team: TeamDirectoryEntry; max: number; isHover: boolean;
  onHover: (n: string | null) => void;
}) {
  const used = Math.max(0, team.yearsUsed);
  const rem = team.yearsRem;
  const isOver = rem < 0;
  const pctUsed = used / max;
  const pctRem = Math.max(rem, 0) / max;
  const pctOver = isOver ? Math.abs(rem) / max : 0;

  return (
    <div
      onMouseEnter={() => onHover(team.owner)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: "grid", gridTemplateColumns: `${LBL_W}px 1fr`, gap: 8, alignItems: "center",
        padding: "3px 4px", borderRadius: 4,
        background: isHover ? SURFACE : "transparent", transition: "background 0.12s",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: isHover ? TEXT : TEXT_DIM, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.owner}</span>
      <div style={{ position: "relative", height: 16, background: "#15151a", borderRadius: 3, overflow: "hidden", border: `1px solid ${CARD_BORDER}`, display: "flex" }}>
        {isOver && (
          <div style={{ width: `${pctOver * 100}%`, background: ROSE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO_FONT, fontSize: 9, fontWeight: 700, color: "#3b0d0f" }}>
            {rem}
          </div>
        )}
        <div style={{ width: `${pctUsed * 100}%`, background: "#f9a8d4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO_FONT, fontSize: 9, fontWeight: 700, color: "#3b0d2a" }}>
          {pctUsed > 0.06 && used}
        </div>
        {!isOver && (
          <div style={{ width: `${pctRem * 100}%`, background: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO_FONT, fontSize: 9, fontWeight: 700, color: "#1e1633" }}>
            {pctRem > 0.06 && rem}
          </div>
        )}
        <div style={{ position: "absolute", left: `${(YEARS_CAP / max) * 100}%`, top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.45)" }} />
      </div>
    </div>
  );
}

function YearsChart({ teams, hovered, onHover }: { teams: TeamDirectoryEntry[]; hovered: string | null; onHover: (n: string | null) => void }) {
  const { sorted, max } = useMemo(() => {
    const s = [...teams].sort((a, b) => b.yearsUsed - a.yearsUsed);
    return {
      sorted: s,
      max: Math.max(
        YEARS_CAP,
        ...s.map((t) => t.yearsUsed + Math.max(t.yearsRem, 0)),
        ...s.map((t) => t.yearsUsed + Math.abs(Math.min(t.yearsRem, 0))),
      ),
    };
  }, [teams]);
  return (
    <ChartFrame
      title="Years Allocated"
      color="#a78bfa"
      subtitle={`Used + Remaining · Years floor ${YEARS_CAP}`}
      footer={
        <InsightLegend
          items={[
            { label: "Years Used", color: "#f9a8d4" },
            { label: "Years Remaining", color: "#a78bfa" },
            { label: "Over Cap", color: ROSE },
          ]}
          right={`Floor line @ ${YEARS_CAP}`}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {sorted.map((t) => (
          <YearsRow key={t.owner} team={t} max={max} isHover={hovered === t.owner} onHover={onHover} />
        ))}
      </div>
    </ChartFrame>
  );
}

function InsightsBoard({ teams }: { teams: TeamDirectoryEntry[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const overCap = useMemo(() => teams.filter((t) => t.yearsRem < 0), [teams]);
  const tightOnSpace = useMemo(() => teams.filter((t) => t.capRem < 30), [teams]);
  const flush = useMemo(() => teams.filter((t) => t.capRem > 80), [teams]);

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionLabel
        label="League Insights"
        count="Cap · Roster · Years"
        color={GOLD}
        right={
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO_FONT, letterSpacing: "0.04em" }}>
            Hover any row to highlight across charts
          </span>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Tight on Cap", count: tightOnSpace.length, names: tightOnSpace.map((t) => t.owner).join(" · ") || "—", color: ACCENT, hint: "<$30 remaining" },
          { label: "Cap Flush", count: flush.length, names: flush.map((t) => t.owner).join(" · ") || "—", color: GOLD, hint: ">$80 remaining" },
          { label: "Years Over", count: overCap.length, names: overCap.map((t) => t.owner).join(" · ") || "—", color: ROSE, hint: "Past 60-yr floor" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "10px 14px", background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div
              style={{
                minWidth: 36, height: 36, borderRadius: 8,
                background: `${s.color}1a`, border: `1px solid ${s.color}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: HEADER_FONT, fontSize: 18, fontWeight: 900, color: s.color,
              }}
            >
              {s.count}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
                {s.label} <span style={{ color: MUTED, fontWeight: 500, marginLeft: 4 }}>· {s.hint}</span>
              </div>
              <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.names}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr 0.95fr", gap: 12 }}>
        <CapChart teams={teams} hovered={hovered} onHover={setHovered} />
        <RosterChart teams={teams} hovered={hovered} onHover={setHovered} />
        <YearsChart teams={teams} hovered={hovered} onHover={setHovered} />
      </div>
    </section>
  );
}

// ── League Ribbon ────────────────────────────────────────────────────────────

function LeagueRibbon({ teams }: { teams: TeamDirectoryEntry[] }) {
  const items = useMemo(() => {
    const top = [...teams].sort((a, b) => b.wins - a.wins || b.pf - a.pf)[0];
    const topPF = [...teams].sort((a, b) => b.pf - a.pf)[0];
    const hot = [...teams]
      .filter((t) => t.streak.startsWith("W"))
      .sort((a, b) => parseInt(b.streak.slice(1)) - parseInt(a.streak.slice(1)))[0];
    const cold = [...teams]
      .filter((t) => t.streak.startsWith("L"))
      .sort((a, b) => parseInt(b.streak.slice(1)) - parseInt(a.streak.slice(1)))[0];
    const mostCapUsed = [...teams].sort((a, b) => (b.capCommit + b.capDead) - (a.capCommit + a.capDead))[0];
    return [
      { label: "Standings Leader", value: top?.owner || "—", sub: top ? `${top.wins}-${top.losses}` : "", color: EMERALD },
      { label: "Points Leader", value: topPF?.owner || "—", sub: topPF ? `${topPF.pf.toFixed(1)} PF` : "", color: GOLD },
      { label: "Hottest", value: hot?.owner || "—", sub: hot?.streak || "—", color: ACCENT },
      { label: "Coldest", value: cold?.owner || "—", sub: cold?.streak || "—", color: ROSE },
      { label: "Most Cap Used", value: mostCapUsed?.owner || "—", sub: mostCapUsed ? `$${(mostCapUsed.capCommit + mostCapUsed.capDead).toFixed(0)}` : "", color: GOLD },
    ];
  }, [teams]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
      {items.map((s) => (
        <div key={s.label} style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontFamily: HEADER_FONT, fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "0.02em", textTransform: "uppercase" }}>{s.value}</div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_TEXT, marginTop: 4 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Segmented Control ────────────────────────────────────────────────────────

function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", padding: 2, gap: 2, background: SURFACE, border: `1px solid ${CARD_BORDER}`, borderRadius: 7 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "5px 10px", borderRadius: 5, border: "none", cursor: "pointer",
              background: active ? ACCENT_DIM : "transparent",
              color: active ? ACCENT : MUTED,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
              fontFamily: HEADER_FONT, transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Client Component ────────────────────────────────────────────────────

export function TeamsClient({ teams, season }: { teams: TeamDirectoryEntry[]; season: string }) {
  const [view, setView] = useState<ViewMode>("grid");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sort, setSort] = useState<SortKey>("cap");

  const sorted = useMemo(() => {
    const arr = [...teams];
    switch (sort) {
      case "record": arr.sort((a, b) => b.wins - a.wins || b.pf - a.pf); break;
      case "pf":     arr.sort((a, b) => b.pf - a.pf); break;
      case "alpha":  arr.sort((a, b) => a.owner.localeCompare(b.owner)); break;
      case "cap":    arr.sort((a, b) => (b.capCommit + b.capDead) - (a.capCommit + a.capDead)); break;
    }
    return arr;
  }, [teams, sort]);

  const grouped = useMemo(() => {
    if (groupBy !== "division") return null;
    const out: Record<string, TeamDirectoryEntry[]> = {};
    for (const d of DIV_ORDER) out[d] = [];
    for (const t of sorted) {
      if (out[t.division]) out[t.division].push(t);
    }
    return out;
  }, [groupBy, sorted]);

  const sortLabel: Record<SortKey, string> = {
    record: "Record",
    pf: "Points For",
    alpha: "Alphabetical",
    cap: "Cap Usage",
  };

  const renderGrid = (teamList: TeamDirectoryEntry[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      {teamList.map((t) => <TeamCard key={t.owner} team={t} />)}
    </div>
  );

  const renderList = (teamList: TeamDirectoryEntry[]) => (
    <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <ListHeader />
      {teamList.map((t, i) => <TeamRow key={t.owner} team={t} rank={i + 1} />)}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>{season} Season</span>
          <span style={{ height: 12, width: 1, background: CARD_BORDER }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>League Directory</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: HEADER_FONT, fontSize: 64, fontWeight: 900, letterSpacing: "0.01em", textTransform: "uppercase", color: TEXT, lineHeight: 1 }}>
            Teams
          </h1>
          <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: MUTED_TEXT, whiteSpace: "nowrap" }}>
            <span style={{ color: TEXT, fontWeight: 700 }}>{teams.length}</span> franchises
            <span style={{ color: MUTED }}> · </span>
            <span style={{ color: TEXT, fontWeight: 700 }}>{DIV_ORDER.length}</span> divisions
          </span>
        </div>
      </div>

      <LeagueRibbon teams={teams} />

      <InsightsBoard teams={teams} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Segmented<ViewMode>
            value={view}
            onChange={setView}
            options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]}
          />
          <Segmented<GroupBy>
            value={groupBy}
            onChange={setGroupBy}
            options={[{ value: "division", label: "By Division" }, { value: "none", label: "All Teams" }]}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              background: SURFACE, color: TEXT,
              border: `1px solid ${CARD_BORDER}`, borderRadius: 6,
              padding: "5px 28px 5px 10px", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.04em", textTransform: "uppercase",
              fontFamily: HEADER_FONT, cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
            }}
          >
            <option value="record">Record</option>
            <option value="pf">Points For</option>
            <option value="cap">Cap Usage</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </div>
      </div>

      {groupBy === "division" && grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {Object.entries(grouped).map(([divName, divTeams]) => {
            const d = getDivColor(divName);
            return (
              <section key={divName}>
                <SectionLabel
                  label={divName}
                  count={`${divTeams.length} teams`}
                  color={d.color}
                  right={
                    <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_TEXT }}>
                      Combined:{" "}
                      <span style={{ color: TEXT, fontWeight: 700 }}>
                        {divTeams.reduce((s, t) => s + t.wins, 0)}–{divTeams.reduce((s, t) => s + t.losses, 0)}
                      </span>
                    </span>
                  }
                />
                {view === "grid" ? renderGrid(divTeams) : renderList(divTeams)}
              </section>
            );
          })}
        </div>
      ) : (
        <section>
          <SectionLabel
            label={`All Teams · ${sortLabel[sort]}`}
            count={`${sorted.length} franchises`}
            color={GOLD}
          />
          {view === "grid" ? renderGrid(sorted) : renderList(sorted)}
        </section>
      )}

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO_FONT }}>
          {season} season
        </span>
        <span style={{ fontSize: 10, color: MUTED, fontFamily: HEADER_FONT, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          ITTWA · Est. 2014
        </span>
      </div>
    </div>
  );
}
