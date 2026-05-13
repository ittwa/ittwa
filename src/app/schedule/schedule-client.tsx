"use client";

import { useState, useMemo } from "react";
import { OwnerLink } from "@/components/owner-link";
import { SleeperAvatarImage } from "@/components/owner-avatar";
import { OWNER_DIVISION } from "@/lib/config";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScheduleMatchup {
  week: number;
  matchupId: number;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  completed: boolean;
  playoff: boolean;
}

export interface ScheduleTeamInfo {
  division: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface SeasonData {
  season: string;
  matchups: ScheduleMatchup[];
  teams: Record<string, ScheduleTeamInfo>;
  playoffWeekStart: number;
}

interface ScheduleClientProps {
  seasons: Record<string, SeasonData>;
  currentSeason: string;
  currentWeek: number;
  availableSeasons: string[];
  ownerAvatars: Record<string, string>;
}

// ─── Division colors ────────────────────────────────────────────────────────

const DIVISION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Concussion":        { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  "Hey Arnold":        { bg: "rgba(168,85,247,0.15)", text: "#c084fc", border: "rgba(168,85,247,0.3)" },
  "Replacements":      { bg: "rgba(34,197,94,0.15)",  text: "#4ade80", border: "rgba(34,197,94,0.3)"  },
  "Dark Knight Rises": { bg: "rgba(249,115,22,0.15)", text: "#fb923c", border: "rgba(249,115,22,0.3)" },
};
const FALLBACK_DC = { bg: "rgba(100,100,100,0.15)", text: "#999999", border: "rgba(100,100,100,0.3)" };

function getDivColor(division: string) {
  return DIVISION_COLORS[division] || FALLBACK_DC;
}

// ─── Playoff week labels ────────────────────────────────────────────────────

const PLAYOFF_LABELS: Record<number, { label: string; name: string }> = {
  15: { label: "WC", name: "Wild Card" },
  16: { label: "SEMI", name: "Semifinal" },
  17: { label: "CHIP", name: "Championship" },
};

// ─── Helper: owner avatar ───────────────────────────────────────────────────

function OwnerAvatar({
  name,
  avatarId,
  size = 28,
  division,
}: {
  name: string;
  avatarId?: string;
  size?: number;
  division?: string;
}) {
  const dc = getDivColor(division || OWNER_DIVISION[name] || "");
  const initials = name.slice(0, 2).toUpperCase();
  const radius = size > 40 ? 10 : size > 24 ? 8 : 6;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: dc.bg,
        border: `1px solid ${dc.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: size * 0.36,
              color: dc.text,
              letterSpacing: "-0.01em",
            }}
          >
            {initials}
          </span>
        }
      />
    </div>
  );
}

// ─── Helper: division dot ───────────────────────────────────────────────────

function DivDot({ division, size = 6 }: { division: string; size?: number }) {
  const dc = getDivColor(division);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: dc.text,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ScheduleClient({
  seasons,
  currentSeason,
  currentWeek,
  availableSeasons,
  ownerAvatars,
}: ScheduleClientProps) {
  const [season, setSeason] = useState(currentSeason);
  const [team, setTeam] = useState<string | null>(null);
  const [view, setView] = useState<"matrix" | "week">("matrix");

  const data = seasons[season];

  const { regularWeeks, playoffWeeks, lookup, sortedTeams } = useMemo(() => {
    if (!data) return { regularWeeks: [] as number[], playoffWeeks: [] as number[], lookup: {} as Record<string, Record<number, { opp: string; my: number; op: number; completed: boolean; playoff: boolean }>>, sortedTeams: [] as [string, ScheduleTeamInfo][] };

    const weekSet = new Set<number>();
    for (const m of data.matchups) weekSet.add(m.week);
    const weeks = Array.from(weekSet).sort((a, b) => a - b);
    const regular = weeks.filter((w) => w < data.playoffWeekStart);
    const playoff = weeks.filter((w) => w >= data.playoffWeekStart);

    const lk: Record<string, Record<number, { opp: string; my: number; op: number; completed: boolean; playoff: boolean }>> = {};
    for (const t of Object.keys(data.teams)) lk[t] = {};

    for (const m of data.matchups) {
      if (lk[m.teamA]) lk[m.teamA][m.week] = { opp: m.teamB, my: m.scoreA, op: m.scoreB, completed: m.completed, playoff: m.playoff };
      if (lk[m.teamB]) lk[m.teamB][m.week] = { opp: m.teamA, my: m.scoreB, op: m.scoreA, completed: m.completed, playoff: m.playoff };
    }

    const sorted = Object.entries(data.teams).sort((a, b) => {
      const wA = a[1].wins, wB = b[1].wins;
      if (wB !== wA) return wB - wA;
      return b[1].pointsFor - a[1].pointsFor;
    });

    return { regularWeeks: regular, playoffWeeks: playoff, lookup: lk, sortedTeams: sorted };
  }, [data]);

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-20">
        No data available for season {season}.
      </div>
    );
  }

  const isCurrentSeason = season === currentSeason;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <PageHeader season={season} currentSeason={currentSeason} currentWeek={currentWeek} />

      {/* Filter bar */}
      <FilterBar
        season={season}
        setSeason={setSeason}
        team={team}
        setTeam={setTeam}
        view={view}
        setView={setView}
        currentSeason={currentSeason}
        availableSeasons={availableSeasons}
        teams={data.teams}
        ownerAvatars={ownerAvatars}
      />

      {/* Body: main content + sidebar */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0, 1fr) 320px", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          {view === "matrix" ? (
            <MatrixView
              data={data}
              regularWeeks={regularWeeks}
              playoffWeeks={playoffWeeks}
              lookup={lookup}
              sortedTeams={sortedTeams}
              focusTeam={team}
              isCurrentSeason={isCurrentSeason}
              currentWeek={currentWeek}
              ownerAvatars={ownerAvatars}
            />
          ) : (
            <WeekView
              data={data}
              focusTeam={team}
              isCurrentSeason={isCurrentSeason}
              currentWeek={currentWeek}
              ownerAvatars={ownerAvatars}
            />
          )}
        </div>
        <div style={{ position: "sticky", top: 70, minWidth: 0 }}>
          {team ? (
            <TeamFocusPanel
              data={data}
              teamKey={team}
              season={season}
              isCurrentSeason={isCurrentSeason}
              currentWeek={currentWeek}
              ownerAvatars={ownerAvatars}
            />
          ) : (
            <SeasonSummaryPanel
              data={data}
              season={season}
              isCurrentSeason={isCurrentSeason}
              ownerAvatars={ownerAvatars}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page Header ────────────────────────────────────────────────────────────

function PageHeader({ season, currentSeason, currentWeek }: { season: string; currentSeason: string; currentWeek: number }) {
  const isCurrentSeason = season === currentSeason;
  return (
    <div className="pb-4 border-b border-border flex items-end justify-between flex-wrap gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-heading text-[32px] font-black tracking-[0.02em] uppercase leading-none text-foreground">
            Schedule
          </span>
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded font-sans tracking-[0.06em]"
            style={{
              background: isCurrentSeason ? "rgba(253,74,72,0.12)" : "rgba(232,184,75,0.12)",
              color: isCurrentSeason ? "#FD4A48" : "#E8B84B",
              border: `1px solid ${isCurrentSeason ? "rgba(253,74,72,0.3)" : "rgba(232,184,75,0.3)"}`,
            }}
          >
            {season} &middot; {isCurrentSeason ? `WK ${String(currentWeek).padStart(2, "0")}` : "ARCHIVE"}
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Every game, every week — filter by team or jump back through the archives to relive past seasons.
        </p>
      </div>
      <div className="flex gap-2 items-center text-[11px] text-muted-foreground font-mono tracking-[0.04em]">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isCurrentSeason ? "#FD4A48" : "var(--muted-foreground)",
            animation: isCurrentSeason ? "pulse 1.5s infinite" : "none",
          }}
        />
        {isCurrentSeason ? "Live season" : "Archived season"}
      </div>
    </div>
  );
}

// ─── Filter Bar ─────────────────────────────────────────────────────────────

function FilterBar({
  season,
  setSeason,
  team,
  setTeam,
  view,
  setView,
  currentSeason,
  availableSeasons,
  teams,
  ownerAvatars,
}: {
  season: string;
  setSeason: (s: string) => void;
  team: string | null;
  setTeam: (t: string | null) => void;
  view: "matrix" | "week";
  setView: (v: "matrix" | "week") => void;
  currentSeason: string;
  availableSeasons: string[];
  teams: Record<string, ScheduleTeamInfo>;
  ownerAvatars: Record<string, string>;
}) {
  return (
    <div
      className="rounded-[10px] p-3 mb-5"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 12,
        alignItems: "stretch",
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Season */}
      <div style={filterCellStyle}>
        <div style={filterLabelStyle}>
          Season
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1.5 tracking-[0.08em] uppercase"
            style={{
              background: season === currentSeason ? "rgba(253,74,72,0.12)" : "var(--secondary)",
              color: season === currentSeason ? "#FD4A48" : "var(--muted-foreground)",
              border: `1px solid ${season === currentSeason ? "rgba(253,74,72,0.3)" : "var(--border)"}`,
            }}
          >
            {season === currentSeason ? "in progress" : "complete"}
          </span>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {availableSeasons.map((s) => {
            const on = s === season;
            const isCurrent = s === currentSeason;
            return (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className="flex items-center gap-1 cursor-pointer transition-all duration-150"
                style={{
                  padding: "5px 10px",
                  border: `1px solid ${on ? "#FD4A48" : "var(--border)"}`,
                  background: on ? "rgba(253,74,72,0.12)" : "var(--secondary)",
                  color: on ? "#FD4A48" : isCurrent ? "#E8B84B" : "var(--muted-foreground)",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {s}
                {isCurrent && <span className="text-[8px] opacity-70">●</span>}
                {!isCurrent && <span className="text-[9px] ml-0.5" style={{ color: "#E8B84B" }}>★</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Team */}
      <div style={filterCellStyle}>
        <div style={filterLabelStyle}>
          Team
          {team && (
            <button
              onClick={() => setTeam(null)}
              className="ml-auto cursor-pointer"
              style={{
                padding: "1px 8px",
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                color: "var(--muted-foreground)",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Clear ✕
            </button>
          )}
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {Object.entries(teams)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, t]) => {
              const on = name === team;
              const dc = getDivColor(t.division);
              return (
                <button
                  key={name}
                  onClick={() => setTeam(on ? null : name)}
                  title={name}
                  className="flex items-center gap-1.5 cursor-pointer transition-all duration-150"
                  style={{
                    padding: "3px 8px 3px 4px",
                    border: `1px solid ${on ? dc.text : "var(--border)"}`,
                    background: on ? dc.bg : "var(--secondary)",
                    color: on ? dc.text : "var(--muted-foreground)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <OwnerAvatar name={name} avatarId={ownerAvatars[name]} size={18} division={t.division} />
                  {name}
                </button>
              );
            })}
        </div>
      </div>

      {/* View */}
      <div style={{ ...filterCellStyle, justifyContent: "space-between" }}>
        <div style={filterLabelStyle}>View</div>
        <div
          className="flex gap-0.5 mt-2 p-0.5 rounded-lg"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          {([{ id: "matrix" as const, label: "Matrix" }, { id: "week" as const, label: "By Week" }]).map((v) => {
            const on = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className="cursor-pointer transition-all duration-150"
                style={{
                  padding: "6px 14px",
                  border: "none",
                  background: on ? "var(--card)" : "transparent",
                  color: on ? "var(--foreground)" : "var(--muted-foreground)",
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-heading)",
                  textTransform: "uppercase",
                  boxShadow: on ? "inset 0 0 0 1px var(--border)" : "none",
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const filterCellStyle: React.CSSProperties = {
  background: "var(--secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--muted-foreground)",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  display: "flex",
  alignItems: "center",
};

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend({ showPlayoff }: { showPlayoff: boolean }) {
  return (
    <div className="flex items-center gap-3.5 text-[10px] text-muted-foreground">
      <LegendDot color="#4ade80" label="Win" />
      <LegendDot color="#f87171" label="Loss" />
      <LegendDot color="#FD4A48" label="Live" />
      {showPlayoff && <LegendDot color="#E8B84B" label="Playoff" />}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-full opacity-85" style={{ width: 7, height: 7, background: color }} />
      <span className="font-semibold tracking-[0.04em]">{label}</span>
    </span>
  );
}

// ─── Matrix View ────────────────────────────────────────────────────────────

function MatrixView({
  data,
  regularWeeks,
  playoffWeeks,
  lookup,
  sortedTeams,
  focusTeam,
  isCurrentSeason,
  currentWeek,
  ownerAvatars,
}: {
  data: SeasonData;
  regularWeeks: number[];
  playoffWeeks: number[];
  lookup: Record<string, Record<number, { opp: string; my: number; op: number; completed: boolean; playoff: boolean }>>;
  sortedTeams: [string, ScheduleTeamInfo][];
  focusTeam: string | null;
  isCurrentSeason: boolean;
  currentWeek: number;
  ownerAvatars: Record<string, string>;
}) {
  const hasPlayoff = playoffWeeks.length > 0;
  const regCount = regularWeeks.length;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {/* Header strip */}
      <div
        className="flex justify-between items-center px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--secondary)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-heading text-sm font-extrabold tracking-[0.06em] uppercase text-foreground">
            Season Matrix
          </span>
          <span className="text-[11px] text-muted-foreground">
            {data.season} &middot; {sortedTeams.length} teams × {regularWeeks.length + playoffWeeks.length} weeks
          </span>
        </div>
        <Legend showPlayoff={hasPlayoff} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 980 }}>
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `220px repeat(${regCount}, minmax(48px, 1fr))${hasPlayoff ? ` repeat(${playoffWeeks.length}, 56px)` : ""}`,
              borderBottom: "1px solid var(--border)",
              background: "var(--secondary)",
            }}
          >
            <div className="px-3.5 py-2.5 text-[10px] text-muted-foreground font-bold tracking-[0.1em] uppercase">
              Team
            </div>
            {regularWeeks.map((w) => {
              const isCurrent = isCurrentSeason && w === currentWeek;
              return (
                <div
                  key={w}
                  className="py-2.5 text-center font-mono text-[11px] font-bold"
                  style={{
                    color: isCurrent ? "#FD4A48" : "var(--muted-foreground)",
                    background: isCurrent ? "rgba(253,74,72,0.12)" : "transparent",
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  {w}
                </div>
              );
            })}
            {playoffWeeks.map((w) => (
              <div
                key={w}
                className="py-2.5 text-center font-heading text-[10px] font-extrabold tracking-[0.08em]"
                style={{
                  color: "#E8B84B",
                  background: "rgba(232,184,75,0.12)",
                  borderLeft: "1px solid var(--border)",
                }}
              >
                {PLAYOFF_LABELS[w]?.label || `W${w}`}
              </div>
            ))}
          </div>

          {/* Team rows */}
          {sortedTeams.map(([name, info]) => {
            const dc = getDivColor(info.division);
            const dim = focusTeam !== null && focusTeam !== name;
            return (
              <div
                key={name}
                style={{
                  display: "grid",
                  gridTemplateColumns: `220px repeat(${regCount}, minmax(48px, 1fr))${hasPlayoff ? ` repeat(${playoffWeeks.length}, 56px)` : ""}`,
                  borderBottom: "1px solid var(--border)",
                  opacity: dim ? 0.35 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <div className="px-3.5 py-2.5 flex items-center gap-2.5" style={{ borderRight: "1px solid var(--border)" }}>
                  <OwnerAvatar name={name} avatarId={ownerAvatars[name]} size={28} division={info.division} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="font-heading text-sm font-extrabold text-foreground leading-tight">
                      <OwnerLink name={name}>{name}</OwnerLink>
                    </div>
                    <div className="text-[10px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: dc.text }}>
                      <DivDot division={info.division} size={5} /> {info.division}
                    </div>
                  </div>
                </div>
                {regularWeeks.map((w) => (
                  <MatrixCell
                    key={w}
                    cell={lookup[name]?.[w]}
                    highlight={isCurrentSeason && w === currentWeek}
                    ownerAvatars={ownerAvatars}
                    teams={data.teams}
                  />
                ))}
                {playoffWeeks.map((w) => (
                  <MatrixCell
                    key={w}
                    cell={lookup[name]?.[w]}
                    playoff
                    ownerAvatars={ownerAvatars}
                    teams={data.teams}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatrixCell({
  cell,
  highlight,
  playoff,
  ownerAvatars,
  teams,
}: {
  cell?: { opp: string; my: number; op: number; completed: boolean; playoff: boolean };
  highlight?: boolean;
  playoff?: boolean;
  ownerAvatars: Record<string, string>;
  teams: Record<string, ScheduleTeamInfo>;
}) {
  if (!cell) {
    return (
      <div
        style={{
          borderLeft: "1px solid var(--border)",
          background: playoff ? "rgba(232,184,75,0.12)" : highlight ? "rgba(253,74,72,0.12)" : "transparent",
          opacity: 0.3,
        }}
      >
        <div className="h-full flex items-center justify-center p-1.5">
          <span className="text-xs text-muted-foreground">—</span>
        </div>
      </div>
    );
  }

  const oppInfo = teams[cell.opp];
  const dc = getDivColor(oppInfo?.division || "");
  const isWin = cell.completed && cell.my > cell.op;
  const isLoss = cell.completed && cell.my < cell.op;

  let bg = "transparent";
  let resultMark = "";
  if (cell.completed) {
    bg = isWin ? "rgba(74,222,128,0.06)" : isLoss ? "rgba(248,113,113,0.06)" : "transparent";
    resultMark = isWin ? "W" : isLoss ? "L" : "T";
  }

  return (
    <div
      className="flex flex-col items-center gap-1 cursor-pointer transition-[background] duration-150"
      style={{
        borderLeft: "1px solid var(--border)",
        background: bg,
        padding: "8px 4px",
      }}
      title={`${cell.opp} · ${cell.completed ? `${cell.my}–${cell.op}` : "upcoming"}`}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = bg; }}
    >
      <OwnerAvatar name={cell.opp} avatarId={ownerAvatars[cell.opp]} size={24} division={oppInfo?.division} />
      {cell.completed ? (
        <div
          className="font-mono text-[9px] font-bold tracking-tight"
          style={{ color: isWin ? "#4ade80" : isLoss ? "#f87171" : "var(--muted-foreground)" }}
        >
          {resultMark} {Math.round(cell.my)}-{Math.round(cell.op)}
        </div>
      ) : (
        <div className="font-mono text-[9px] font-semibold text-muted-foreground">—</div>
      )}
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  data,
  focusTeam,
  isCurrentSeason,
  currentWeek,
  ownerAvatars,
}: {
  data: SeasonData;
  focusTeam: string | null;
  isCurrentSeason: boolean;
  currentWeek: number;
  ownerAvatars: Record<string, string>;
}) {
  const weekGroups = useMemo(() => {
    const groups = new Map<number, ScheduleMatchup[]>();
    for (const m of data.matchups) {
      const arr = groups.get(m.week) ?? [];
      arr.push(m);
      groups.set(m.week, arr);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, matches]) => {
        const filtered = focusTeam
          ? matches.filter((m) => m.teamA === focusTeam || m.teamB === focusTeam)
          : matches;
        return { week, matches: filtered, playoff: matches[0]?.playoff || false };
      })
      .filter((g) => g.matches.length > 0);
  }, [data.matchups, focusTeam]);

  return (
    <div className="flex flex-col gap-3.5">
      {weekGroups.map((wk) => (
        <WeekBlock
          key={wk.week}
          week={wk.week}
          matches={wk.matches}
          playoff={wk.playoff}
          isCurrentSeason={isCurrentSeason}
          currentWeek={currentWeek}
          focusTeam={focusTeam}
          teams={data.teams}
          ownerAvatars={ownerAvatars}
          season={data.season}
        />
      ))}
    </div>
  );
}

function WeekBlock({
  week,
  matches,
  playoff,
  isCurrentSeason,
  currentWeek,
  focusTeam,
  teams,
  ownerAvatars,
  season,
}: {
  week: number;
  matches: ScheduleMatchup[];
  playoff: boolean;
  isCurrentSeason: boolean;
  currentWeek: number;
  focusTeam: string | null;
  teams: Record<string, ScheduleTeamInfo>;
  ownerAvatars: Record<string, string>;
  season: string;
}) {
  const status = getWeekStatus(week, isCurrentSeason, currentWeek);
  const playoffLabel = playoff ? PLAYOFF_LABELS[week]?.name : null;
  const dateLabel = formatWeekDate(week, season);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{
          borderBottom: "1px solid var(--border)",
          background: playoffLabel
            ? "rgba(232,184,75,0.12)"
            : status === "live"
            ? "rgba(253,74,72,0.12)"
            : "var(--secondary)",
        }}
      >
        <div className="flex items-center gap-3">
          {playoffLabel ? (
            <span className="font-heading text-[13px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "#E8B84B" }}>
              ★ {playoffLabel}
            </span>
          ) : (
            <span className="font-heading text-[13px] font-extrabold tracking-[0.06em] uppercase text-foreground">
              Week {week}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
        </div>
        <span
          className="text-[9px] font-bold tracking-[0.12em] uppercase"
          style={{
            color:
              status === "final"
                ? "var(--muted-foreground)"
                : status === "live"
                ? "#FD4A48"
                : "#E8B84B",
          }}
        >
          {status === "final" ? "Final" : status === "live" ? "● Live" : "Upcoming"}
        </span>
      </div>
      <div className="p-2.5 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {matches.map((m, i) => (
          <MatchRow key={i} m={m} focusTeam={focusTeam} teams={teams} ownerAvatars={ownerAvatars} />
        ))}
      </div>
    </div>
  );
}

function MatchRow({
  m,
  focusTeam,
  teams,
  ownerAvatars,
}: {
  m: ScheduleMatchup;
  focusTeam: string | null;
  teams: Record<string, ScheduleTeamInfo>;
  ownerAvatars: Record<string, string>;
}) {
  const aWin = m.completed && m.scoreA > m.scoreB;
  const bWin = m.completed && m.scoreB > m.scoreA;
  const focusA = focusTeam === m.teamA;
  const focusB = focusTeam === m.teamB;
  const hasFocus = focusA || focusB;

  return (
    <div
      className="rounded-lg transition-all duration-150"
      style={{
        background: "var(--secondary)",
        border: `1px solid ${hasFocus ? "#FD4A48" : "var(--border)"}`,
        padding: "8px 12px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 8,
        boxShadow: hasFocus ? "0 0 0 1px rgba(253,74,72,0.12)" : "none",
      }}
    >
      <TeamSide
        name={m.teamA}
        score={m.scoreA}
        completed={m.completed}
        winner={aWin}
        highlight={focusA}
        align="left"
        teams={teams}
        ownerAvatars={ownerAvatars}
      />
      <div className="flex flex-col items-center gap-0.5 min-w-[24px]">
        <span className="font-heading text-[11px] text-muted-foreground font-bold tracking-[0.1em]">VS</span>
      </div>
      <TeamSide
        name={m.teamB}
        score={m.scoreB}
        completed={m.completed}
        winner={bWin}
        highlight={focusB}
        align="right"
        teams={teams}
        ownerAvatars={ownerAvatars}
      />
    </div>
  );
}

function TeamSide({
  name,
  score,
  completed,
  winner,
  highlight,
  align,
  teams,
  ownerAvatars,
}: {
  name: string;
  score: number;
  completed: boolean;
  winner: boolean;
  highlight: boolean;
  align: "left" | "right";
  teams: Record<string, ScheduleTeamInfo>;
  ownerAvatars: Record<string, string>;
}) {
  const info = teams[name];
  const dc = getDivColor(info?.division || "");
  const right = align === "right";

  return (
    <div className="flex items-center gap-2 min-w-0" style={{ flexDirection: right ? "row-reverse" : "row" }}>
      <OwnerAvatar name={name} avatarId={ownerAvatars[name]} size={28} division={info?.division} />
      <div className="min-w-0 flex-1" style={{ textAlign: right ? "right" : "left" }}>
        <div
          className="font-heading text-sm font-extrabold leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ color: winner ? "#4ade80" : highlight ? "var(--foreground)" : "var(--muted-foreground)" }}
        >
          <OwnerLink name={name}>{name}</OwnerLink>
        </div>
        {completed ? (
          <div className="font-mono text-[11px] font-bold mt-0.5" style={{ color: winner ? "#4ade80" : "var(--muted-foreground)" }}>
            {score.toFixed(1)}
          </div>
        ) : (
          <div
            className="text-[10px] font-semibold mt-0.5 flex items-center gap-1"
            style={{ color: dc.text, justifyContent: right ? "flex-end" : "flex-start" }}
          >
            <DivDot division={info?.division || ""} size={4} /> {info?.division}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team Focus Panel ───────────────────────────────────────────────────────

function TeamFocusPanel({
  data,
  teamKey,
  season,
  isCurrentSeason,
  currentWeek,
  ownerAvatars,
}: {
  data: SeasonData;
  teamKey: string;
  season: string;
  isCurrentSeason: boolean;
  currentWeek: number;
  ownerAvatars: Record<string, string>;
}) {
  const info = data.teams[teamKey];
  if (!info) return null;
  const dc = getDivColor(info.division);

  const games = useMemo(() => {
    return data.matchups
      .filter((m) => m.teamA === teamKey || m.teamB === teamKey)
      .map((m) => {
        const isA = m.teamA === teamKey;
        return {
          week: m.week,
          opp: isA ? m.teamB : m.teamA,
          my: isA ? m.scoreA : m.scoreB,
          op: isA ? m.scoreB : m.scoreA,
          completed: m.completed,
          playoff: m.playoff,
        };
      })
      .sort((a, b) => a.week - b.week);
  }, [data.matchups, teamKey]);

  const finals = games.filter((g) => g.completed);
  const w = finals.filter((g) => g.my > g.op).length;
  const l = finals.filter((g) => g.my < g.op).length;
  const pf = finals.reduce((s, g) => s + g.my, 0);
  const pa = finals.reduce((s, g) => s + g.op, 0);
  const remaining = games.filter((g) => !g.completed);

  const sosScore = games.length > 0
    ? games.reduce((s, g) => {
        const opInfo = data.teams[g.opp];
        const factor = opInfo ? Math.max(1, 13 - (opInfo.wins - opInfo.losses + 6)) : 5;
        return s + factor;
      }, 0) / games.length
    : 5;
  const sosLabel = sosScore > 8 ? "Brutal" : sosScore > 6 ? "Tough" : sosScore > 4 ? "Average" : "Light";
  const sosColor = sosScore > 8 ? "#f87171" : sosScore > 6 ? "#E8B84B" : sosScore > 4 ? "var(--muted-foreground)" : "#4ade80";

  return (
    <div className="flex flex-col gap-4">
      {/* Identity card */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div
          className="px-4 pt-4 pb-3"
          style={{
            background: `linear-gradient(180deg, ${dc.bg} 0%, transparent 100%)`,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3 mb-2.5">
            <OwnerAvatar name={teamKey} avatarId={ownerAvatars[teamKey]} size={50} division={info.division} />
            <div>
              <div className="font-heading text-[22px] font-black tracking-[0.02em] uppercase leading-none text-foreground">
                <OwnerLink name={teamKey}>{teamKey}</OwnerLink>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded tracking-[0.08em] uppercase"
              style={{ background: dc.bg, color: dc.text, border: `1px solid ${dc.border}` }}
            >
              {info.division}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3" style={{ borderTop: "1px solid var(--border)" }}>
          <PanelStat label="Record" value={`${w}-${l}`} />
          <PanelStat label="Points For" value={pf.toFixed(0)} divider />
          <PanelStat label="Points Against" value={pa.toFixed(0)} divider />
        </div>
      </div>

      {/* Strength of schedule */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="font-heading text-[13px] font-extrabold tracking-[0.08em] uppercase text-foreground">
            Strength of Schedule
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <span className="font-heading text-[28px] font-black tracking-tight" style={{ color: sosColor }}>{sosLabel}</span>
            <span className="font-mono text-[13px] font-bold" style={{ color: "var(--muted-foreground)" }}>{sosScore.toFixed(2)}</span>
          </div>
          <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: "var(--secondary)", position: "relative" }}>
            <div
              className="h-full opacity-85 transition-[width] duration-300"
              style={{ width: `${Math.min(100, (sosScore / 10) * 100)}%`, background: sosColor }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground font-semibold tracking-[0.08em] uppercase">
            <span>Light</span><span>Average</span><span>Brutal</span>
          </div>
        </div>
      </div>

      {/* Next 5 (current season only) */}
      {isCurrentSeason && remaining.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div className="px-4 py-3 flex justify-between items-baseline" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="font-heading text-[13px] font-extrabold tracking-[0.08em] uppercase text-foreground">Next 5</span>
            <span className="text-[10px] text-muted-foreground">{remaining.length} games left</span>
          </div>
          <div className="py-1.5">
            {remaining.slice(0, 5).map((g) => {
              const opInfo = data.teams[g.opp];
              const opDc = getDivColor(opInfo?.division || "");
              return (
                <div key={g.week} className="grid items-center gap-2.5 px-3.5 py-1.5" style={{ gridTemplateColumns: "36px 22px 1fr auto" }}>
                  <span className="font-mono text-[10px] text-muted-foreground font-bold tracking-[0.04em]">
                    WK {String(g.week).padStart(2, "0")}
                  </span>
                  <OwnerAvatar name={g.opp} avatarId={ownerAvatars[g.opp]} size={22} division={opInfo?.division} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-semibold">vs</span>
                      <OwnerLink name={g.opp}>{g.opp}</OwnerLink>
                    </div>
                    <div className="text-[9px] font-semibold mt-0.5" style={{ color: opDc.text }}>{opInfo?.division}</div>
                  </div>
                  <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-muted-foreground">
                    Upcoming
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelStat({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className="px-3.5 py-3" style={{ borderLeft: divider ? "1px solid var(--border)" : "none" }}>
      <div className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase mb-1">{label}</div>
      <div className="font-heading text-lg font-extrabold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

// ─── Season Summary Panel ───────────────────────────────────────────────────

function SeasonSummaryPanel({
  data,
  season,
  isCurrentSeason,
  ownerAvatars,
}: {
  data: SeasonData;
  season: string;
  isCurrentSeason: boolean;
  ownerAvatars: Record<string, string>;
}) {
  const { totalGames, playedGames, highScore, closest, blowout } = useMemo(() => {
    const completed = data.matchups.filter((m) => m.completed);
    let hi: (ScheduleMatchup & { tot: number }) | null = null;
    let cl: (ScheduleMatchup & { diff: number }) | null = null;
    let bl: (ScheduleMatchup & { diff: number }) | null = null;

    for (const m of completed) {
      const tot = m.scoreA + m.scoreB;
      const diff = Math.abs(m.scoreA - m.scoreB);
      if (!hi || tot > hi.tot) hi = { ...m, tot };
      if (!cl || diff < cl.diff) cl = { ...m, diff };
      if (!bl || diff > bl.diff) bl = { ...m, diff };
    }

    return {
      totalGames: data.matchups.length,
      playedGames: completed.length,
      highScore: hi,
      closest: cl,
      blowout: bl,
    };
  }, [data.matchups]);

  return (
    <div className="flex flex-col gap-4">
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="font-heading text-[13px] font-extrabold tracking-[0.08em] uppercase text-foreground">
            {season} Season
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {isCurrentSeason ? "In progress" : "Final"}
          </div>
        </div>
        <div className="p-4 flex flex-col gap-2">
          <SummaryStatRow label="Games played" value={playedGames} color="var(--foreground)" />
          <SummaryStatRow label="Remaining" value={totalGames - playedGames} color={isCurrentSeason ? "#FD4A48" : "var(--muted-foreground)"} />
          <SummaryStatRow label="Total matchups" value={totalGames} color="var(--muted-foreground)" />
        </div>
      </div>

      {playedGames > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="font-heading text-[13px] font-extrabold tracking-[0.08em] uppercase text-foreground">
              Season Highlights
            </div>
          </div>
          <div className="p-3 flex flex-col gap-2.5">
            {highScore && (
              <HighlightRow
                label="Highest combined"
                teamA={highScore.teamA}
                teamB={highScore.teamB}
                scoreA={highScore.scoreA}
                scoreB={highScore.scoreB}
                week={highScore.week}
                value={`${highScore.tot.toFixed(1)} pts`}
                color="#E8B84B"
                ownerAvatars={ownerAvatars}
                teams={data.teams}
              />
            )}
            {closest && (
              <HighlightRow
                label="Closest finish"
                teamA={closest.teamA}
                teamB={closest.teamB}
                scoreA={closest.scoreA}
                scoreB={closest.scoreB}
                week={closest.week}
                value={`±${closest.diff.toFixed(1)}`}
                color="#4ade80"
                ownerAvatars={ownerAvatars}
                teams={data.teams}
              />
            )}
            {blowout && (
              <HighlightRow
                label="Biggest blowout"
                teamA={blowout.teamA}
                teamB={blowout.teamB}
                scoreA={blowout.scoreA}
                scoreB={blowout.scoreB}
                week={blowout.week}
                value={`±${blowout.diff.toFixed(1)}`}
                color="#f87171"
                ownerAvatars={ownerAvatars}
                teams={data.teams}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-md px-3.5 py-2.5"
      style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <span className="text-[10px] text-muted-foreground font-bold tracking-[0.1em] uppercase">{label}</span>
      <span className="font-heading text-[22px] font-black tracking-tight leading-none" style={{ color }}>{value}</span>
    </div>
  );
}

function HighlightRow({
  label,
  teamA,
  teamB,
  scoreA,
  scoreB,
  week,
  value,
  color,
  ownerAvatars,
  teams,
}: {
  label: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  week: number;
  value: string;
  color: string;
  ownerAvatars: Record<string, string>;
  teams: Record<string, ScheduleTeamInfo>;
}) {
  return (
    <div className="rounded-md p-2.5 px-3" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase">{label}</span>
        <span className="font-mono text-[11px] font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <OwnerAvatar name={teamA} avatarId={ownerAvatars[teamA]} size={20} division={teams[teamA]?.division} />
        <span className="text-[11px] font-semibold text-foreground">{teamA}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{scoreA.toFixed(1)}</span>
        <span className="text-[9px] text-muted-foreground mx-0.5">·</span>
        <OwnerAvatar name={teamB} avatarId={ownerAvatars[teamB]} size={20} division={teams[teamB]?.division} />
        <span className="text-[11px] font-semibold text-foreground">{teamB}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{scoreB.toFixed(1)}</span>
        <span className="flex-1" />
        <span className="text-[9px] text-muted-foreground font-mono">WK {week}</span>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type WeekStatus = "final" | "live" | "upcoming";

function getWeekStatus(week: number, isCurrentSeason: boolean, currentWeek: number): WeekStatus {
  if (!isCurrentSeason) return "final";
  if (week < currentWeek) return "final";
  if (week === currentWeek) return "live";
  return "upcoming";
}

function formatWeekDate(week: number, season: string): string {
  const yr = parseInt(season) || 2026;
  // NFL season starts the Thursday after Labor Day (first Monday of September)
  const laborDay = new Date(yr, 8, 1);
  while (laborDay.getDay() !== 1) laborDay.setDate(laborDay.getDate() + 1);
  const seasonStart = new Date(laborDay);
  seasonStart.setDate(seasonStart.getDate() + 3); // Thursday
  seasonStart.setDate(seasonStart.getDate() + (week - 1) * 7);
  const end = new Date(seasonStart);
  end.setDate(end.getDate() + 3);
  const m1 = seasonStart.toLocaleString("en-US", { month: "short" });
  const m2 = end.toLocaleString("en-US", { month: "short" });
  return m1 === m2
    ? `${m1} ${seasonStart.getDate()}–${end.getDate()}`
    : `${m1} ${seasonStart.getDate()} – ${m2} ${end.getDate()}`;
}
