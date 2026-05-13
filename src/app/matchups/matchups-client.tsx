"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MatchupPair } from "@/types/sleeper";
import { OwnerAvatarsProvider, SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TeamMeta {
  displayName: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  seed: number | null;
  rank: number;
  streak: string;
  teamName: string;
}

interface MatchupsClientProps {
  allPairs: Record<number, MatchupPair[]>;
  season: string;
  currentWeek: number;
  teamMeta: Record<string, TeamMeta>;
  playoffWeekStart: number;
  ownerAvatars: Record<string, string>;
  availableSeasons: string[];
}

interface EnrichedMatchup {
  pair: MatchupPair;
  aName: string;
  bName: string;
  aMeta: TeamMeta | null;
  bMeta: TeamMeta | null;
  status: "live" | "final" | "upcoming";
  aProj: number;
  bProj: number;
  winProb: number;
  spread: number;
  overUnder: number;
}

// ── Design tokens ────────────────────────────────────────────────────────────

const T = {
  card: "var(--card)",
  cardBorder: "var(--border)",
  surface: "var(--secondary)",
  muted: "var(--muted-foreground)",
  text: "var(--foreground)",
  textDim: "var(--muted-foreground)",
  accent: "#FD4A48",
  accentDim: "rgba(253,74,72,0.12)",
  gold: "#E8B84B",
  goldDim: "rgba(232,184,75,0.12)",
  emerald: "#4ade80",
  headerFont: "'Barlow Condensed', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  bodyFont: "'Inter', sans-serif",
};

const DIV_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Concussion:          { color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.3)" },
  "Hey Arnold":        { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)" },
  Replacements:        { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)" },
  "Dark Knight Rises": { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
};

const DEFAULT_DIV = { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

// ── Helpers ──────────────────────────────────────────────────────────────────

function divColor(division: string) {
  return DIV_COLORS[division] || DEFAULT_DIV;
}

function avgPpg(meta: TeamMeta | null): number {
  if (!meta) return 100;
  const games = meta.wins + meta.losses + meta.ties;
  return games > 0 ? meta.pointsFor / games : 100;
}

function enrichMatchup(
  pair: MatchupPair,
  teamMeta: Record<string, TeamMeta>,
  currentWeek: number,
): EnrichedMatchup {
  const aMeta = teamMeta[pair.team1.displayName] || null;
  const bMeta = teamMeta[pair.team2.displayName] || null;

  let status: "live" | "final" | "upcoming" = "upcoming";
  if (pair.completed) {
    status = pair.week === currentWeek ? "live" : "final";
  }

  const aProj = avgPpg(aMeta);
  const bProj = avgPpg(bMeta);
  const winProb = 1 / (1 + Math.exp(-(aProj - bProj) / 6));

  return {
    pair,
    aName: pair.team1.displayName,
    bName: pair.team2.displayName,
    aMeta,
    bMeta,
    status,
    aProj,
    bProj,
    winProb,
    spread: aProj - bProj,
    overUnder: aProj + bProj,
  };
}

function record(meta: TeamMeta | null): string {
  if (!meta) return "0-0";
  return meta.ties > 0 ? `${meta.wins}-${meta.losses}-${meta.ties}` : `${meta.wins}-${meta.losses}`;
}

function weekLabel(w: number, playoffStart: number): string {
  if (w < playoffStart) return `Wk ${w}`;
  const offset = w - playoffStart;
  if (offset === 0) return "WC";
  if (offset === 1) return "Semi";
  if (offset === 2) return "Final";
  return `Wk ${w}`;
}

// ── Small Components ─────────────────────────────────────────────────────────

function OwnerAvatar({ name, division, size = 32 }: { name: string; division: string; size?: number }) {
  const d = divColor(division);
  const avatarId = useOwnerAvatar(name);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size > 40 ? 10 : 8, flexShrink: 0, overflow: "hidden",
      background: d.bg, border: `1px solid ${d.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={
          <span style={{ fontFamily: T.headerFont, fontWeight: 800, fontSize: size * 0.36, color: d.color, letterSpacing: "-0.01em" }}>
            {initials}
          </span>
        }
      />
    </div>
  );
}

function StatusPill({ status }: { status: "live" | "final" | "upcoming" }) {
  if (status === "live") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.accent, fontFamily: T.bodyFont }}>
        <span className="matchup-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, boxShadow: `0 0 8px ${T.accent}` }} />
        LIVE
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: T.muted, fontFamily: T.bodyFont }}>
      {status === "final" ? "FINAL" : "UPCOMING"}
    </span>
  );
}

// ── Season Selector ─────────────────────────────────────────────────────────

function SeasonSelector({ seasons, current }: { seasons: string[]; current: string }) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, fontFamily: T.bodyFont, marginRight: 4 }}>
        Season
      </span>
      {seasons.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            onClick={() => {
              if (!active) router.push(s === seasons[0] ? "/matchups" : `/matchups?season=${s}`);
            }}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "none", cursor: active ? "default" : "pointer",
              background: active ? T.accentDim : "transparent",
              color: active ? T.accent : T.muted,
              fontSize: 12, fontWeight: 700, fontFamily: T.headerFont, letterSpacing: "0.02em",
              transition: "all 0.15s",
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ── Week Selector ────────────────────────────────────────────────────────────

function WeekSelector({
  week, setWeek, playoffStart,
}: {
  week: number;
  setWeek: (w: number) => void;
  playoffStart: number;
}) {
  const tabBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabBar.current?.querySelector(`[data-week="${week}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [week]);

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.cardBorder}`,
    background: T.card, color: disabled ? T.muted : T.text,
    cursor: disabled ? "default" : "pointer", fontSize: 18, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <button onClick={() => setWeek(Math.max(1, week - 1))} style={navBtnStyle(week === 1)}>&#8249;</button>
      <div ref={tabBar} style={{
        flex: 1, display: "flex", gap: 4, overflowX: "auto",
        background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: 4,
        scrollbarWidth: "none",
      }}>
        {WEEKS.map(w => {
          const isPlayoff = w >= playoffStart;
          const on = w === week;
          return (
            <button key={w} data-week={w} onClick={() => setWeek(w)} style={{
              flex: "1 0 auto", minWidth: 56, padding: "8px 10px", border: "none", cursor: "pointer",
              background: on ? T.accent : "transparent",
              color: on ? "#fff" : (isPlayoff ? T.gold : T.textDim),
              borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              fontFamily: T.headerFont, textTransform: "uppercase",
              transition: "all 0.15s",
            }}>
              {weekLabel(w, playoffStart)}
            </button>
          );
        })}
      </div>
      <button onClick={() => setWeek(Math.min(18, week + 1))} style={navBtnStyle(week === 18)}>&#8250;</button>
    </div>
  );
}

// ── Win Probability Bar ──────────────────────────────────────────────────────

function WinProbBar({ winProb, aDivision, bDivision, aName, bName }: {
  winProb: number;
  aDivision: string;
  bDivision: string;
  aName: string;
  bName: string;
}) {
  const aPct = winProb * 100;
  const bPct = 100 - aPct;
  const dcA = divColor(aDivision);
  const dcB = divColor(bDivision);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: T.monoFont, fontSize: 13, fontWeight: 700, color: dcA.color }}>{aPct.toFixed(0)}%</span>
          <span style={{ fontSize: 9, color: T.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}><OwnerLink name={aName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{aName}</OwnerLink></span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 9, color: T.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}><OwnerLink name={bName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{bName}</OwnerLink></span>
          <span style={{ fontFamily: T.monoFont, fontSize: 13, fontWeight: 700, color: dcB.color }}>{bPct.toFixed(0)}%</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, overflow: "hidden", display: "flex", background: T.cardBorder }}>
        <div style={{ width: `${aPct}%`, background: dcA.color, opacity: 0.9 }} />
        <div style={{ width: `${bPct}%`, background: dcB.color, opacity: 0.9 }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: T.muted, fontFamily: T.bodyFont, textAlign: "center", letterSpacing: "0.04em" }}>
        Projected win probability
      </div>
    </div>
  );
}

// ── Hero Matchup Components ──────────────────────────────────────────────────

function TeamSide({ name, meta, align, isWinning }: {
  name: string;
  meta: TeamMeta | null;
  align: "left" | "right";
  isWinning: boolean;
}) {
  const division = meta?.division || "";
  const right = align === "right";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: right ? "row-reverse" : "row" }}>
        <OwnerAvatar name={name} division={division} size={42} />
        <div style={{ minWidth: 0, textAlign: right ? "right" : "left" }}>
          <div style={{
            fontFamily: T.headerFont, fontSize: 18, fontWeight: 800, color: T.text,
            letterSpacing: "-0.005em", lineHeight: 1.05, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <OwnerLink name={name} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{name}</OwnerLink>
          </div>
          {meta?.teamName && (
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.bodyFont, marginTop: 2 }}>
              {meta.teamName}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: right ? "row-reverse" : "row" }}>
        <span style={{ fontFamily: T.monoFont, fontSize: 11, color: T.muted, fontWeight: 600 }}>{record(meta)}</span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.muted }} />
        <span style={{ fontFamily: T.monoFont, fontSize: 11, color: T.muted, fontWeight: 600 }}>PF {(meta?.pointsFor ?? 0).toFixed(0)}</span>
        {meta?.seed && (
          <>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.muted }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: T.gold, letterSpacing: "0.06em" }}>#{meta.seed}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreBlock({ value, proj, isWinning, status }: {
  value: number;
  proj: number;
  isWinning: boolean;
  status: "live" | "final" | "upcoming";
}) {
  const showLive = status === "live" || status === "final";
  return (
    <div style={{ textAlign: "center", lineHeight: 1, minWidth: 80 }}>
      {showLive ? (
        <>
          <div style={{
            fontFamily: T.headerFont, fontSize: 44, fontWeight: 900,
            color: isWinning ? T.emerald : T.text, letterSpacing: "-0.03em",
          }}>{value.toFixed(1)}</div>
          <div style={{ fontSize: 9, color: T.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4, fontFamily: T.bodyFont }}>
            proj <span style={{ color: T.textDim, fontFamily: T.monoFont, marginLeft: 2 }}>{proj.toFixed(1)}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 9, color: T.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: T.bodyFont, marginBottom: 4 }}>Projected</div>
          <div style={{ fontFamily: T.headerFont, fontSize: 36, fontWeight: 800, color: T.textDim, letterSpacing: "-0.03em" }}>{proj.toFixed(1)}</div>
        </>
      )}
    </div>
  );
}

function HeroStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{ padding: "14px 18px", borderRight: `1px solid ${T.cardBorder}` }}>
      <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.bodyFont, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: small ? T.bodyFont : T.headerFont,
        fontSize: small ? 12 : 16, fontWeight: small ? 600 : 800,
        color: T.text, letterSpacing: small ? "0" : "0.02em",
      }}>{value}</div>
    </div>
  );
}

function HeroMatchup({ m, week, season }: { m: EnrichedMatchup; week: number; season: string }) {
  const dcA = divColor(m.aMeta?.division || "");
  const dcB = divColor(m.bMeta?.division || "");
  const aWinning = m.pair.team1.points > m.pair.team2.points;
  const margin = Math.abs(m.pair.team1.points - m.pair.team2.points);
  const spreadOwner = m.spread >= 0 ? m.aName : m.bName;

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 12, overflow: "hidden", marginBottom: 24,
      boxShadow: `0 0 0 1px ${T.cardBorder}, 0 8px 30px rgba(0,0,0,0.12)`,
    }}>
      {/* Top stripe */}
      <div style={{
        background: `linear-gradient(90deg, ${dcA.bg} 0%, transparent 35%, transparent 65%, ${dcB.bg} 100%)`,
        padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${T.cardBorder}`, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: "0.12em",
            padding: "3px 8px", borderRadius: 4, background: T.goldDim,
            border: "1px solid rgba(232,184,75,0.3)", fontFamily: T.bodyFont,
          }}>&#9733; GAME OF THE WEEK</span>
          <StatusPill status={m.status} />
        </div>
        <span style={{ fontSize: 11, color: T.muted, fontFamily: T.monoFont, fontWeight: 600 }}>
          {season} &middot; WEEK {String(week).padStart(2, "0")}
        </span>
      </div>

      {/* Score row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-7 items-center p-4 pb-3 md:px-8 md:pt-8 md:pb-6">
        <TeamSide name={m.aName} meta={m.aMeta} align="left" isWinning={aWinning && m.status !== "upcoming"} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <ScoreBlock value={m.pair.team1.points} proj={m.aProj} isWinning={aWinning && m.status !== "upcoming"} status={m.status} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: T.headerFont, fontSize: 18, color: T.muted, fontWeight: 700, letterSpacing: "0.1em" }}>VS</span>
            {m.status === "live" && (
              <span style={{
                fontFamily: T.monoFont, fontSize: 11, fontWeight: 700,
                color: aWinning ? dcA.color : dcB.color, padding: "2px 8px",
                background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 4,
              }}>&plusmn;{margin.toFixed(1)}</span>
            )}
          </div>
          <ScoreBlock value={m.pair.team2.points} proj={m.bProj} isWinning={!aWinning && m.status !== "upcoming"} status={m.status} />
        </div>
        <TeamSide name={m.bName} meta={m.bMeta} align="right" isWinning={!aWinning && m.status !== "upcoming"} />
      </div>

      {/* Win prob bar */}
      <div className="px-4 pb-4 md:px-8 md:pb-5">
        <WinProbBar
          winProb={m.winProb}
          aDivision={m.aMeta?.division || ""}
          bDivision={m.bMeta?.division || ""}
          aName={m.aName}
          bName={m.bName}
        />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4" style={{
        borderTop: `1px solid ${T.cardBorder}`, background: T.surface,
      }}>
        <HeroStat label="Spread" value={`${spreadOwner} ${Math.abs(m.spread).toFixed(1)}`} />
        <HeroStat label="Over / Under" value={m.overUnder.toFixed(1)} />
        <HeroStat label="Records" value={`${record(m.aMeta)} vs ${record(m.bMeta)}`} />
        <HeroStat label="Streaks" value={`${m.aMeta?.streak || "—"} / ${m.bMeta?.streak || "—"}`} small />
      </div>
    </div>
  );
}

// ── Matchup Card ─────────────────────────────────────────────────────────────

function TeamRow({ name, meta, score, proj, status, winner }: {
  name: string;
  meta: TeamMeta | null;
  score: number;
  proj: number;
  status: "live" | "final" | "upcoming";
  winner: boolean;
}) {
  const d = divColor(meta?.division || "");
  const showLive = status === "live" || status === "final";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        <OwnerAvatar name={name} division={meta?.division || ""} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: T.headerFont, fontSize: 16, fontWeight: 800, color: winner ? T.emerald : T.text, letterSpacing: "-0.005em" }}><OwnerLink name={name} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{name}</OwnerLink></span>
            {meta?.seed && <span style={{ fontSize: 9, fontWeight: 700, color: T.gold, letterSpacing: "0.06em" }}>#{meta.seed}</span>}
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.bodyFont, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: d.color }} />
            <span style={{ color: d.color, fontWeight: 600 }}>{meta?.division || "—"}</span>
            <span style={{ color: T.muted }}>&middot;</span>
            <span style={{ fontFamily: T.monoFont, fontWeight: 600 }}>{record(meta)}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", lineHeight: 1, flexShrink: 0 }}>
        {showLive ? (
          <>
            <div style={{ fontFamily: T.headerFont, fontSize: 28, fontWeight: 800, color: winner ? T.emerald : T.text, letterSpacing: "-0.03em" }}>{score.toFixed(1)}</div>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.bodyFont, marginTop: 3, fontWeight: 600, letterSpacing: "0.06em" }}>
              proj <span style={{ fontFamily: T.monoFont, color: T.textDim }}>{proj.toFixed(1)}</span>
            </div>
          </>
        ) : (
          <div style={{ fontFamily: T.headerFont, fontSize: 26, fontWeight: 800, color: T.textDim, letterSpacing: "-0.03em" }}>{proj.toFixed(1)}</div>
        )}
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.bodyFont, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ExpandedDetails({ m }: { m: EnrichedMatchup }) {
  const dcA = divColor(m.aMeta?.division || "");
  const dcB = divColor(m.bMeta?.division || "");
  const spreadOwner = m.spread >= 0 ? m.aName : m.bName;

  return (
    <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.cardBorder}`, background: T.surface }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DetailBlock label="Lines">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Spread</span>
            <span style={{ fontFamily: T.monoFont, fontSize: 12, fontWeight: 700, color: T.text }}>
              {spreadOwner} {Math.abs(m.spread).toFixed(1)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>O/U</span>
            <span style={{ fontFamily: T.monoFont, fontSize: 12, fontWeight: 700, color: T.text }}>{m.overUnder.toFixed(1)}</span>
          </div>
        </DetailBlock>
        <DetailBlock label="Win probability">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: dcA.color, fontWeight: 600 }}><OwnerLink name={m.aName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{m.aName}</OwnerLink></span>
            <span style={{ fontFamily: T.monoFont, fontSize: 14, fontWeight: 700, color: T.text }}>{(m.winProb * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: dcB.color, fontWeight: 600 }}><OwnerLink name={m.bName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{m.bName}</OwnerLink></span>
            <span style={{ fontFamily: T.monoFont, fontSize: 14, fontWeight: 700, color: T.text }}>{((1 - m.winProb) * 100).toFixed(0)}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, overflow: "hidden", display: "flex", background: T.cardBorder, marginTop: 6 }}>
            <div style={{ width: `${m.winProb * 100}%`, background: dcA.color, opacity: 0.85 }} />
            <div style={{ width: `${(1 - m.winProb) * 100}%`, background: dcB.color, opacity: 0.85 }} />
          </div>
        </DetailBlock>
        <DetailBlock label="Season stats">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: dcA.color, fontWeight: 600 }}><OwnerLink name={m.aName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{m.aName}</OwnerLink></span>
            <span style={{ fontFamily: T.monoFont, fontSize: 12, fontWeight: 700, color: T.text }}>
              {record(m.aMeta)} &middot; PF {(m.aMeta?.pointsFor ?? 0).toFixed(0)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: dcB.color, fontWeight: 600 }}><OwnerLink name={m.bName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{m.bName}</OwnerLink></span>
            <span style={{ fontFamily: T.monoFont, fontSize: 12, fontWeight: 700, color: T.text }}>
              {record(m.bMeta)} &middot; PF {(m.bMeta?.pointsFor ?? 0).toFixed(0)}
            </span>
          </div>
        </DetailBlock>
        <DetailBlock label="Divisions">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dcA.color }} />
              <span style={{ fontSize: 11, color: dcA.color, fontWeight: 600 }}>{m.aMeta?.division || "—"}</span>
            </div>
            <span style={{ fontSize: 9, color: T.muted, letterSpacing: "0.1em", fontWeight: 700 }}>VS</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dcB.color }} />
              <span style={{ fontSize: 11, color: dcB.color, fontWeight: 600 }}>{m.bMeta?.division || "—"}</span>
            </div>
          </div>
        </DetailBlock>
      </div>
    </div>
  );
}

function MatchupCard({ m, idx, expanded, onToggle }: {
  m: EnrichedMatchup;
  idx: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dcA = divColor(m.aMeta?.division || "");
  const dcB = divColor(m.bMeta?.division || "");
  const aWinning = m.pair.team1.points > m.pair.team2.points;
  const margin = Math.abs(m.pair.team1.points - m.pair.team2.points);
  const showLive = m.status === "live" || m.status === "final";

  const detailsBtnStyle: React.CSSProperties = {
    padding: "4px 10px", borderRadius: 5, background: "transparent",
    border: `1px solid ${T.cardBorder}`, color: T.textDim,
    fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
    cursor: "pointer", fontFamily: T.bodyFont,
  };

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10,
      overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Top meta bar */}
      <div style={{
        padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${T.cardBorder}`, background: T.surface,
      }}>
        <span style={{ fontSize: 10, color: T.muted, fontFamily: T.monoFont, fontWeight: 600, letterSpacing: "0.04em" }}>
          MATCH {String(idx + 1).padStart(2, "0")}
        </span>
        <StatusPill status={m.status} />
      </div>

      {/* Body */}
      <div style={{ padding: "16px 16px 12px" }}>
        <TeamRow name={m.aName} meta={m.aMeta} score={m.pair.team1.points} proj={m.aProj} status={m.status} winner={aWinning && showLive} />
        <div style={{ height: 1, background: T.cardBorder, margin: "10px 0" }} />
        <TeamRow name={m.bName} meta={m.bMeta} score={m.pair.team2.points} proj={m.bProj} status={m.status} winner={!aWinning && showLive} />
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 16px", borderTop: `1px solid ${T.cardBorder}`,
        background: T.surface, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        {m.status === "upcoming" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.bodyFont }}>Win prob</span>
              <span style={{ fontFamily: T.monoFont, fontSize: 11, fontWeight: 700, color: dcA.color }}>{(m.winProb * 100).toFixed(0)}%</span>
              <div style={{ width: 70, height: 4, borderRadius: 2, overflow: "hidden", display: "flex", background: T.cardBorder }}>
                <div style={{ width: `${m.winProb * 100}%`, background: dcA.color, opacity: 0.85 }} />
                <div style={{ width: `${(1 - m.winProb) * 100}%`, background: dcB.color, opacity: 0.85 }} />
              </div>
              <span style={{ fontFamily: T.monoFont, fontSize: 11, fontWeight: 700, color: dcB.color }}>{((1 - m.winProb) * 100).toFixed(0)}%</span>
            </div>
            <button onClick={onToggle} style={detailsBtnStyle}>{expanded ? "Hide" : "Details"}</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.bodyFont }}>Margin</span>
              <span style={{ fontFamily: T.monoFont, fontSize: 12, fontWeight: 700, color: T.text }}>&plusmn;{margin.toFixed(1)}</span>
            </div>
            <button onClick={onToggle} style={detailsBtnStyle}>{expanded ? "Hide" : "Details"}</button>
          </>
        )}
      </div>

      {expanded && <ExpandedDetails m={m} />}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function PulseStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: T.headerFont, fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4, fontFamily: T.bodyFont }}>{label}</div>
    </div>
  );
}

function SummaryRow({ label, m, kind }: { label: string; m: EnrichedMatchup; kind: "closest" | "biggest" }) {
  const dcA = divColor(m.aMeta?.division || "");
  const dcB = divColor(m.bMeta?.division || "");
  const margin = m.status === "upcoming"
    ? Math.abs(m.aProj - m.bProj)
    : Math.abs(m.pair.team1.points - m.pair.team2.points);
  return (
    <div>
      <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.bodyFont, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 6 }}>
        <OwnerAvatar name={m.aName} division={m.aMeta?.division || ""} size={22} />
        <span style={{ fontSize: 11, fontWeight: 600, color: dcA.color, fontFamily: T.bodyFont }}><OwnerLink name={m.aName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{m.aName}</OwnerLink></span>
        <span style={{ fontSize: 10, color: T.muted }}>vs</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: dcB.color, fontFamily: T.bodyFont }}><OwnerLink name={m.bName} className="hover:underline underline-offset-2" style={{ color: "inherit" }}>{m.bName}</OwnerLink></span>
        <OwnerAvatar name={m.bName} division={m.bMeta?.division || ""} size={22} />
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: T.monoFont, fontSize: 11, fontWeight: 700, color: kind === "closest" ? T.gold : T.accent }}>&plusmn;{margin.toFixed(1)}</span>
      </div>
    </div>
  );
}

function WeekSummary({ matchups, week, season }: { matchups: EnrichedMatchup[]; week: number; season: string }) {
  const total = matchups.length;
  if (total === 0) return null;

  const certainty = (m: EnrichedMatchup) => Math.max(m.winProb, 1 - m.winProb);
  const decided = matchups.filter(m => certainty(m) >= 0.70).length;
  const leaning = matchups.filter(m => certainty(m) >= 0.58 && certainty(m) < 0.70).length;
  const tossup = matchups.filter(m => certainty(m) < 0.58).length;
  const avgProj = matchups.reduce((s, m) => s + m.aProj + m.bProj, 0) / (total * 2);

  const sorted = [...matchups];
  const bySpread = sorted.sort((a, b) => Math.abs(a.spread) - Math.abs(b.spread));
  const closest = bySpread[0];
  const biggest = bySpread[bySpread.length - 1];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontFamily: T.headerFont, fontSize: 14, fontWeight: 800, color: T.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>Week {week} Pulse</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontFamily: T.bodyFont }}>{total} matchups &middot; {season}</div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <PulseStat label="Decided" value={decided} color={T.emerald} />
          <PulseStat label="Leaning" value={leaning} color={T.gold} />
          <PulseStat label="Toss-up" value={tossup} color={T.accent} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 10, borderTop: `1px solid ${T.cardBorder}` }}>
          <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.bodyFont }}>Avg projection</span>
          <span style={{ fontFamily: T.monoFont, fontSize: 13, fontWeight: 700, color: T.text }}>{avgProj.toFixed(1)}</span>
        </div>
        {closest && <SummaryRow label="Tightest" m={closest} kind="closest" />}
        {biggest && <SummaryRow label="Biggest gap" m={biggest} kind="biggest" />}
      </div>
    </div>
  );
}

function StandingsSnapshot({ teamMeta }: { teamMeta: Record<string, TeamMeta> }) {
  const sorted = Object.values(teamMeta).sort((a, b) => a.rank - b.rank);
  const playoffCount = sorted.filter(t => t.seed !== null).length;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: T.headerFont, fontSize: 14, fontWeight: 800, color: T.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>Power Rank</div>
        <a href="/standings" style={{ fontSize: 10, color: T.muted, textDecoration: "none", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: T.bodyFont }}>
          full standings &rarr;
        </a>
      </div>
      <div style={{ padding: "8px 0" }}>
        {sorted.slice(0, 8).map((t, i) => {
          const d = divColor(t.division);
          const isPlayoff = i < playoffCount;
          return (
            <div key={t.displayName} style={{
              display: "grid", gridTemplateColumns: "22px 22px 1fr auto", gap: 8, alignItems: "center",
              padding: "6px 16px", borderLeft: isPlayoff ? `2px solid ${T.accent}` : "2px solid transparent",
            }}>
              <span style={{ fontFamily: T.monoFont, fontSize: 10, color: T.muted, fontWeight: 700, textAlign: "center" }}>{i + 1}</span>
              <OwnerAvatar name={t.displayName} division={t.division} size={20} />
              <div style={{ minWidth: 0 }}>
                <OwnerLink name={t.displayName} className="hover:underline underline-offset-2" style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.bodyFont }}>{t.displayName}</OwnerLink>
              </div>
              <span style={{ fontFamily: T.monoFont, fontSize: 11, color: T.textDim, fontWeight: 600 }}>{record(t)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function MatchupsClient({ allPairs, season, currentWeek, teamMeta, playoffWeekStart, ownerAvatars, availableSeasons }: MatchupsClientProps) {
  const defaultWeek = Math.max(currentWeek - 1, 1);
  const [week, setWeek] = useState(defaultWeek);
  const [expanded, setExpanded] = useState<number | null>(null);

  const matchups = useMemo(() => {
    const pairs = allPairs[week] || [];
    return pairs.map(p => enrichMatchup(p, teamMeta, currentWeek));
  }, [allPairs, week, teamMeta, currentWeek]);

  const heroIdx = useMemo(() => {
    if (matchups.length === 0) return -1;
    let bestIdx = 0;
    let bestDiff = Infinity;
    matchups.forEach((m, i) => {
      const d = Math.abs(m.spread);
      if (d < bestDiff) { bestDiff = d; bestIdx = i; }
    });
    return bestIdx;
  }, [matchups]);

  const hero = heroIdx >= 0 ? matchups[heroIdx] : null;
  const others = matchups.filter((_, i) => i !== heroIdx);

  if (matchups.length === 0) {
    return (
      <OwnerAvatarsProvider avatars={ownerAvatars}>
      <div style={{ fontFamily: T.bodyFont }}>
        <div className="pb-6 border-b border-border mb-6">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
            <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Matchups</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-4">
            Live scoring, projected outcomes, and key matchup intel for every game on the slate.
          </p>
        </div>
        <SeasonSelector seasons={availableSeasons} current={season} />
        <WeekSelector week={week} setWeek={setWeek} playoffStart={playoffWeekStart} />
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: 48, textAlign: "center" }}>
          <p style={{ color: T.muted, fontStyle: "italic" }}>There are no games right now. This is a crisis.</p>
        </div>
      </div>
      </OwnerAvatarsProvider>
    );
  }

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
    <div style={{ fontFamily: T.bodyFont }}>
      {/* Page header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
          <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Matchups</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-4">
          {season} · Week {week} · Live scoring, projected outcomes, and key matchup intel.
        </p>
      </div>

      {/* Season + Week selectors */}
      <SeasonSelector seasons={availableSeasons} current={season} />
      <WeekSelector week={week} setWeek={setWeek} playoffStart={playoffWeekStart} />

      {/* Hero */}
      {hero && <HeroMatchup m={hero} week={week} season={season} />}

      {/* Two-column: matchup grid + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: T.headerFont, fontSize: 14, fontWeight: 800, color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              The rest of the slate
            </span>
            <span style={{ fontSize: 11, color: T.muted, fontFamily: T.bodyFont }}>{others.length} matchups</span>
          </div>
          <div className="grid grid-cols-1" style={{ gap: 14 }}>
            {others.map((m) => {
              const realIdx = matchups.indexOf(m);
              return (
                <MatchupCard
                  key={`${m.aName}-${m.bName}`}
                  m={m}
                  idx={realIdx}
                  expanded={expanded === realIdx}
                  onToggle={() => setExpanded(expanded === realIdx ? null : realIdx)}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[70px]">
          <WeekSummary matchups={matchups} week={week} season={season} />
          <StandingsSnapshot teamMeta={teamMeta} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 56, paddingTop: 20, borderTop: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
        <span style={{ fontSize: 11, color: T.muted, fontFamily: T.bodyFont, letterSpacing: "0.04em" }}>
          ITTWA — I Thought This Was America &middot; Est. 2014 &middot; A contract dynasty league that tries its best.
        </span>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes matchup-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .matchup-pulse-dot {
          animation: matchup-pulse 1.4s infinite;
        }
      `}</style>
    </div>
    </OwnerAvatarsProvider>
  );
}
