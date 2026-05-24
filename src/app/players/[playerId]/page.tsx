export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  getTeamsData,
  getContracts,
  getAllTransactions,
  getLeagueUsers,
  getNFLPlayers,
  buildRosterOwnerMap,
  getLatestActiveContracts,
} from "@/lib/data";
import { getDisplayName, getPlayerName } from "@/lib/sleeper";
import { resolveOwnerName } from "@/lib/contracts";
import { OWNER_DIVISION, SEASON_LEAGUE_IDS } from "@/lib/config";
import { getPositionColors, getPositionVariant } from "@/lib/ui-utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { SleeperAvatarImage } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";
import { PlayerLink } from "@/components/player-link";
import type { SleeperTransaction, SleeperPlayersMap } from "@/types/sleeper";
import type { ContractRow } from "@/types/contracts";

export const revalidate = 300;

const NFL_TEAMS: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

function SectionTick({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">
        {label}
      </span>
      {sub && (
        <span className="text-[11px] text-muted-foreground font-mono">{sub}</span>
      )}
    </div>
  );
}

function fmtDollar(n: number): string {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(1)}`;
}

function formatHeight(h: string): string {
  const inches = parseInt(h, 10);
  if (!isNaN(inches) && inches > 50 && inches < 100) {
    return `${Math.floor(inches / 12)}'${inches % 12}"`;
  }
  return h;
}

interface WeekScore {
  week: number;
  points: number;
  started: boolean;
}

function ScoringChart({
  weeks,
  posColor,
  season,
}: {
  weeks: WeekScore[];
  posColor: string;
  season: string;
}) {
  const scored = weeks.filter((w) => w.points > 0);
  if (scored.length === 0) return null;

  const max = Math.max(...weeks.map((w) => w.points), 10);
  const avg =
    scored.reduce((s, w) => s + w.points, 0) / scored.length;

  const W = Math.max(weeks.length * 52, 400);
  const H = 180;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const colW = (W - padL - padR) / weeks.length;
  const chartH = H - padT - padB;

  const gridLines = [0, 10, 20, 30, 40].filter((v) => v <= max * 1.15);

  return (
    <Card>
      <div className="px-5 pt-4 pb-1">
        <SectionTick
          label={`${season} Scoring`}
          sub={`Wks 1–${weeks.length} · Half-PPR`}
        />
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: posColor }}
            />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Started
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm opacity-40"
              style={{ background: posColor }}
            />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Bench
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground font-mono ml-auto">
            AVG{" "}
            <span className="text-gold font-bold">{avg.toFixed(1)}</span>
          </span>
        </div>
      </div>
      <div className="px-5 pb-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" height={H}>
          {gridLines.map((v) => {
            const y = padT + chartH * (1 - v / (max * 1.15));
            return (
              <g key={v}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="2,4"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  fill="var(--muted-foreground)"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {weeks.map((w, i) => {
            const cx = padL + colW * i + colW / 2;
            const barW = Math.min(colW - 8, 24);
            const barH = (w.points / (max * 1.15)) * chartH;
            const baseY = padT + chartH;

            return (
              <g key={w.week}>
                {w.points > 0 && (
                  <>
                    <rect
                      x={cx - barW / 2}
                      y={baseY - barH}
                      width={barW}
                      height={barH}
                      fill={posColor}
                      opacity={w.started ? 0.85 : 0.35}
                      rx={3}
                    />
                    <text
                      x={cx}
                      y={baseY - barH - 4}
                      fontSize="9"
                      fill={posColor}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      fontWeight="700"
                    >
                      {w.points.toFixed(1)}
                    </text>
                  </>
                )}
                <text
                  x={cx}
                  y={H - 12}
                  fontSize="9"
                  fill="var(--muted-foreground)"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {w.week}
                </text>
              </g>
            );
          })}

          {/* Average line */}
          {(() => {
            const y = padT + chartH * (1 - avg / (max * 1.15));
            return (
              <g>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--color-gold)"
                  strokeWidth="1"
                  strokeDasharray="4,3"
                  opacity="0.6"
                />
                <text
                  x={W - padR}
                  y={y - 4}
                  fill="var(--color-gold)"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  avg {avg.toFixed(1)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </Card>
  );
}

type HeadlinePart = { type: "text"; text: string } | { type: "owner"; name: string };

interface PlayerTransaction {
  type: "trade" | "added" | "dropped";
  timestamp: number;
  date: string;
  season: string;
  week: number;
  headlineParts: HeadlinePart[];
  details: { side: "in" | "out"; label: string }[];
}

function enrichPlayerTransactions(
  txns: SleeperTransaction[],
  playerId: string,
  rosterOwnerMap: Record<number, string>,
  nflPlayers: SleeperPlayersMap,
  season: string,
): PlayerTransaction[] {
  const result: PlayerTransaction[] = [];

  for (const t of txns) {
    const inAdds = t.adds && playerId in t.adds;
    const inDrops = t.drops && playerId in t.drops;
    if (!inAdds && !inDrops) continue;

    const date = new Date(t.created).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (t.type === "trade") {
      const addedTo = inAdds ? rosterOwnerMap[t.adds![playerId]] : null;
      const droppedFrom = inDrops ? rosterOwnerMap[t.drops![playerId]] : null;

      const headlineParts: HeadlinePart[] =
        addedTo && droppedFrom
          ? [{ type: "text", text: "Traded to " }, { type: "owner", name: addedTo }, { type: "text", text: " from " }, { type: "owner", name: droppedFrom }]
          : addedTo
            ? [{ type: "text", text: "Acquired by " }, { type: "owner", name: addedTo }]
            : [{ type: "text", text: "Traded away by " }, { type: "owner", name: droppedFrom! }];

      const details: PlayerTransaction["details"] = [];
      if (t.adds) {
        for (const [pid, rid] of Object.entries(t.adds)) {
          if (pid === playerId) continue;
          const owner = rosterOwnerMap[Number(rid)];
          if (owner === addedTo) {
            const name = getPlayerName(pid, nflPlayers);
            details.push({ side: "in", label: name });
          }
        }
      }
      if (t.draft_picks) {
        for (const pick of t.draft_picks) {
          const pickOwner = rosterOwnerMap[pick.owner_id];
          if (pickOwner === addedTo) {
            const origOwner = rosterOwnerMap[pick.previous_owner_id] || `Team ${pick.previous_owner_id}`;
            details.push({
              side: "in",
              label: `${pick.season} Rd ${pick.round} (via ${origOwner})`,
            });
          }
        }
      }
      if (t.drops) {
        for (const [pid, rid] of Object.entries(t.drops)) {
          if (pid === playerId) continue;
          const owner = rosterOwnerMap[Number(rid)];
          if (owner === addedTo) {
            const name = getPlayerName(pid, nflPlayers);
            details.push({ side: "out", label: name });
          }
        }
      }

      result.push({
        type: "trade",
        timestamp: t.created,
        date,
        season,
        week: t.week,
        headlineParts,
        details,
      });
    } else {
      const addedBy = inAdds ? rosterOwnerMap[t.adds![playerId]] : null;
      const droppedBy = inDrops ? rosterOwnerMap[t.drops![playerId]] : null;

      if (inAdds && addedBy) {
        const txType = t.type === "commissioner" ? "Commissioner" : "Free Agency";
        result.push({
          type: "added",
          timestamp: t.created,
          date,
          season,
          week: t.week,
          headlineParts: [{ type: "text", text: "Added by " }, { type: "owner", name: addedBy }],
          details: [{ side: "in", label: txType }],
        });
      }

      if (inDrops && droppedBy) {
        result.push({
          type: "dropped",
          timestamp: t.created,
          date,
          season,
          week: t.week,
          headlineParts: [{ type: "text", text: "Dropped by " }, { type: "owner", name: droppedBy }],
          details: [{ side: "out", label: "Released" }],
        });
      }
    }
  }

  return result;
}

function TxIcon({ type }: { type: string }) {
  const map: Record<string, { ch: string; color: string }> = {
    trade: { ch: "↔", color: "var(--color-gold)" },
    added: { ch: "+", color: "#4ade80" },
    dropped: { ch: "−", color: "var(--color-ittwa)" },
  };
  const s = map[type] || map.added;
  return (
    <span
      className="w-7 h-7 rounded-md flex items-center justify-center font-heading text-base font-extrabold shrink-0"
      style={{
        background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 25%, transparent)`,
        color: s.color,
      }}
    >
      {s.ch}
    </span>
  );
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  const [teamsData, contracts, nflPlayers, users] = await Promise.all([
    getTeamsData(),
    getContracts(),
    getNFLPlayers(),
    getLeagueUsers(),
  ]);

  const player = nflPlayers[playerId];
  if (!player) return notFound();

  const { teams, season, currentWeek, allMatchups } = teamsData;
  const posColors = getPositionColors(player.position);
  const playerName =
    player.full_name || `${player.first_name} ${player.last_name}`;
  const teamName = player.team ? (NFL_TEAMS[player.team] || player.team) : "Free Agent";

  // Build roster owner map from teams data
  const rosterOwnerMap: Record<number, string> = {};
  for (const team of teams) {
    rosterOwnerMap[team.rosterId] = team.displayName;
  }

  // Find which team currently rostered this player
  const ownerTeam = teams.find((t) => t.players.includes(playerId));
  const ownerName = ownerTeam?.displayName ?? null;
  const ownerDivision = ownerName ? (OWNER_DIVISION[ownerName] || "") : "";

  // Current contract from sheets
  const activeContracts = getLatestActiveContracts(contracts);
  const currentContract = activeContracts.find((c) => c.playerId === playerId);

  // Contract history across seasons
  const contractHistory = contracts
    .filter(
      (c) =>
        c.playerId === playerId &&
        c.contractStatus.toLowerCase() === "active" &&
        c.position.toLowerCase() !== "draft pick",
    )
    .sort((a, b) => a.season.localeCompare(b.season));

  // Owner avatars
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  // Depth chart data
  // Group WR sub-positions (LWR, RWR, SWR) together; same for other position families
  const POSITION_GROUPS: Record<string, string[]> = {
    WR: ["LWR", "RWR", "SWR", "WR"],
    RB: ["RB", "FB"],
    TE: ["TE"],
    QB: ["QB"],
    K: ["K"],
  };
  const depthChartPlayers: { playerId: string; name: string; role: string; isCurrent: boolean; owner: string | null }[] = [];
  const depthChartLabel = player.position;
  if (player.team && player.depth_chart_position) {
    const groupPositions = POSITION_GROUPS[player.position]
      ?? [player.depth_chart_position];

    const teammates = Object.values(nflPlayers)
      .filter((p) => p.team === player.team && p.depth_chart_position && groupPositions.includes(p.depth_chart_position))
      .sort((a, b) => (a.depth_chart_order ?? 99) - (b.depth_chart_order ?? 99));

    for (const mate of teammates) {
      const mateOwnerTeam = teams.find((t) => t.players.includes(mate.player_id));
      depthChartPlayers.push({
        playerId: mate.player_id,
        name: mate.full_name || `${mate.first_name} ${mate.last_name}`,
        role: `${mate.depth_chart_position}${mate.depth_chart_order ?? "?"}`,
        isCurrent: mate.player_id === playerId,
        owner: mateOwnerTeam?.displayName ?? null,
      });
    }

  }

  // Weekly scoring from matchup data
  const weeklyScoring: WeekScore[] = [];
  for (let w = 1; w <= Math.min(currentWeek, 18); w++) {
    const weekMatchups = allMatchups.get(w);
    if (!weekMatchups) continue;

    const matchup = weekMatchups.find(
      (m) =>
        m.players?.includes(playerId) ||
        (m.players_points && playerId in m.players_points),
    );

    if (matchup) {
      weeklyScoring.push({
        week: w,
        points: matchup.players_points?.[playerId] ?? 0,
        started: matchup.starters?.includes(playerId) ?? false,
      });
    }
  }

  // Transaction history — fetch from recent seasons
  const allSeasons = Object.keys(SEASON_LEAGUE_IDS).sort().reverse();
  const recentSeasons = allSeasons.slice(0, 4);
  const txnsBySeasonResults = await Promise.all(
    recentSeasons.map(async (s) => {
      const leagueId = SEASON_LEAGUE_IDS[s];
      const [txns, rom] = await Promise.all([
        getAllTransactions(leagueId).catch(() => [] as SleeperTransaction[]),
        buildRosterOwnerMap(leagueId),
      ]);
      return { season: s, txns, rosterOwnerMap: rom };
    }),
  );

  const allPlayerTxns: PlayerTransaction[] = [];
  for (const { season: s, txns, rosterOwnerMap: rom } of txnsBySeasonResults) {
    const merged: Record<number, string> = { ...rom };
    const enriched = enrichPlayerTransactions(txns, playerId, merged, nflPlayers, s);
    allPlayerTxns.push(...enriched);
  }
  allPlayerTxns.sort((a, b) => b.timestamp - a.timestamp);

  // Stat cards data
  const salary = currentContract?.salary ?? null;
  const yearsLeft = currentContract?.years ?? null;
  const contractValue = currentContract?.contractValue ?? null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-[11px] text-muted-foreground font-mono tracking-wider flex items-center">
        {ownerName ? (
          <>
            <OwnerLink name={ownerName} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <span
                className="w-4 h-4 rounded-sm overflow-hidden inline-flex items-center justify-center shrink-0"
                style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
              >
                <SleeperAvatarImage
                  avatarId={ownerAvatars[ownerName]}
                  name={ownerName}
                  fallback={<span className="font-heading text-[7px] font-bold text-[#60a5fa]">{ownerName.slice(0, 2).toUpperCase()}</span>}
                />
              </span>
              {ownerName}
            </OwnerLink>
            <span className="mx-1.5">/</span>
          </>
        ) : (
          <>
            <span>Free Agent</span>
            <span className="mx-1.5">/</span>
          </>
        )}
        <span className="text-foreground">{playerName}</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border -mt-2">
        {/* Position-color top stripe */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${posColors.text} 0%, transparent 60%)`,
          }}
        />

        {/* Ghost jersey number watermark */}
        {player.number != null && (
          <div
            className="absolute -right-[50px] -top-[60px] select-none pointer-events-none leading-none font-heading font-black hidden sm:block"
            style={{
              fontSize: "380px",
              color: posColors.text,
              opacity: 0.04,
              letterSpacing: "-0.04em",
            }}
          >
            {String(player.number).padStart(2, "0")}
          </div>
        )}

        <div className="py-5 sm:py-8 relative">
          <div className="flex gap-4 sm:gap-7 items-start">
            {/* Player headshot + mobile position/team below */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="sm:hidden">
                <PlayerAvatar
                  playerId={playerId}
                  playerName={playerName}
                  position={player.position}
                  size={100}
                />
              </div>
              <div className="hidden sm:block">
                <PlayerAvatar
                  playerId={playerId}
                  playerName={playerName}
                  position={player.position}
                  size={170}
                />
              </div>
              {/* Mobile: position/team/number under photo */}
              <div className="sm:hidden text-center">
                <div className="font-heading font-extrabold text-sm uppercase tracking-wide">
                  {player.team ? (NFL_TEAMS[player.team]?.split(" ").pop() || player.team) : "Free Agent"}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: posColors.text }}>
                  {player.position}
                  <span className="text-muted-foreground"> · {player.team || "FA"}</span>
                  {player.number != null && <span className="text-muted-foreground"> · #{player.number}</span>}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Desktop: Meta row */}
              <div className="hidden sm:flex items-center gap-2.5 mb-2 flex-wrap">
                <Badge variant={getPositionVariant(player.position)}>
                  {player.position}
                </Badge>
                <span
                  className="text-[11px] font-bold tracking-widest px-2 py-0.5 rounded border border-border bg-secondary font-mono"
                >
                  {player.team || "FA"}
                  {player.number != null && ` · #${player.number}`}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {teamName}
                </span>
                {player.status && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background:
                          player.injury_status
                            ? "var(--color-ittwa)"
                            : "#4ade80",
                        boxShadow: `0 0 8px ${player.injury_status ? "var(--color-ittwa)" : "#4ade80"}`,
                      }}
                    />
                    <span
                      className="text-[11px] font-semibold tracking-wider uppercase"
                      style={{
                        color: player.injury_status
                          ? "var(--color-ittwa)"
                          : "#4ade80",
                      }}
                    >
                      {player.injury_status || "Active"}
                    </span>
                  </span>
                )}
              </div>

              {/* Mobile: status indicator */}
              {player.status && (
                <div className="sm:hidden flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: player.injury_status ? "var(--color-ittwa)" : "#4ade80",
                      boxShadow: `0 0 8px ${player.injury_status ? "var(--color-ittwa)" : "#4ade80"}`,
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-wider uppercase"
                    style={{ color: player.injury_status ? "var(--color-ittwa)" : "#4ade80" }}
                  >
                    {player.injury_status || "Active"}
                  </span>
                </div>
              )}

              {/* Name */}
              <h1
                className="font-heading font-black uppercase leading-[0.95] text-[36px] sm:text-[72px]"
                style={{
                  textShadow: `0 0 60px ${posColors.bg}`,
                }}
              >
                {player.first_name}
                <br />
                <span style={{ color: posColors.text }}>
                  {player.last_name}
                </span>
              </h1>

              {/* Bio stats */}
              <div className="flex gap-4 sm:gap-6 mt-3 sm:mt-4 flex-wrap">
                {(
                  [
                    player.age != null ? ["Age", String(player.age)] : null,
                    player.height ? ["Height", formatHeight(player.height)] : null,
                    player.weight ? ["Weight", `${player.weight} lbs`] : null,
                    player.years_exp != null ? ["Exp", `${player.years_exp} yrs`] : null,
                    player.college ? ["College", player.college] : null,
                    player.depth_chart_position ? ["Depth", player.depth_chart_position] : null,
                  ].filter((item): item is [string, string] => item !== null)
                ).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                      {k}
                    </div>
                    <div className="text-sm font-semibold mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat cards */}
          {(salary != null || ownerName) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
              {salary != null && (
                <div className="px-3.5 py-3 bg-secondary border border-border rounded-lg">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    Salary
                  </div>
                  <div
                    className="font-heading text-[30px] font-extrabold leading-tight mt-0.5"
                    style={{ color: "var(--color-ittwa)" }}
                  >
                    {fmtDollar(salary)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    cap hit &apos;{season.slice(-2)}
                  </div>
                </div>
              )}
              {yearsLeft != null && (
                <div className="px-3.5 py-3 bg-secondary border border-border rounded-lg">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    Years Left
                  </div>
                  <div
                    className="font-heading text-[30px] font-extrabold leading-tight mt-0.5"
                    style={{ color: "var(--color-gold)" }}
                  >
                    {yearsLeft}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    {yearsLeft === 0
                      ? "mid-season pickup"
                      : `thru ${Number(season) + yearsLeft - 1}`}
                  </div>
                </div>
              )}
              {contractValue != null && contractValue > 0 && (
                <div className="px-3.5 py-3 bg-secondary border border-border rounded-lg">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    Contract Value
                  </div>
                  <div className="font-heading text-[30px] font-extrabold leading-tight mt-0.5 text-foreground">
                    {contractValue.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    value units
                  </div>
                </div>
              )}
              {ownerName && (
                <div className="px-3.5 py-3 bg-secondary border border-border rounded-lg">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    Owner
                  </div>
                  <OwnerLink
                    name={ownerName}
                    className="flex items-center gap-2.5 mt-1 hover:opacity-80 transition-opacity"
                  >
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center font-heading font-black text-sm text-white shrink-0 overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${OWNER_DIVISION[ownerName] ? `var(--color-${OWNER_DIVISION[ownerName].toLowerCase().replace(/ /g, "-").replace("rises", "")})` : "#60a5fa"}, transparent)`,
                      }}
                    >
                      <SleeperAvatarImage
                        avatarId={ownerAvatars[ownerName]}
                        name={ownerName}
                        fallback={<span>{ownerName.slice(0, 2).toUpperCase()}</span>}
                      />
                    </div>
                    <div>
                      <div className="font-heading text-lg font-extrabold leading-tight text-foreground">
                        {ownerName}
                      </div>
                      <div
                        className="text-[10px] font-mono font-semibold tracking-wider uppercase"
                        style={{
                          color: ownerDivision
                            ? `var(--color-${ownerDivision.toLowerCase().replace(/ /g, "-").replace("rises", "")})`
                            : undefined,
                        }}
                      >
                        {ownerDivision || "—"}
                      </div>
                    </div>
                  </OwnerLink>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Main column */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Scoring Chart */}
          <ScoringChart
            weeks={weeklyScoring}
            posColor={posColors.text}
            season={season}
          />

          {/* Transaction History */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <SectionTick
                  label="Transaction History"
                  sub="ITTWA · recent seasons"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {allPlayerTxns.length === 0 ? (
                <div className="px-5 pb-5 text-sm text-muted-foreground italic">
                  No recorded transactions for this player.
                </div>
              ) : (
                <div>
                  {allPlayerTxns.map((tx, i) => (
                    <div
                      key={`${tx.timestamp}-${i}`}
                      className="flex flex-col sm:grid gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 items-start"
                      style={{
                        gridTemplateColumns: "36px 100px 1fr 120px",
                        borderBottom:
                          i < allPlayerTxns.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                        borderTop: i === 0 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div className="flex items-center gap-2.5 sm:contents">
                        <TxIcon type={tx.type} />
                        <div className="pt-0.5">
                          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                            {tx.type}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            {tx.week > 0 ? `Week ${tx.week}` : "Off-Season"}
                          </div>
                        </div>
                        <div className="text-right pt-0.5 ml-auto sm:hidden">
                          <div className="text-xs font-mono">{tx.date}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {tx.season} Season
                          </div>
                        </div>
                      </div>
                      <div className="pt-0.5">
                        <div className="text-[13px] font-semibold mb-1.5 flex items-center gap-1 flex-wrap">
                          {tx.headlineParts.map((part, j) =>
                            part.type === "owner" ? (
                              <OwnerLink
                                key={j}
                                name={part.name}
                                className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                              >
                                <span
                                  className="w-4 h-4 rounded-sm overflow-hidden inline-flex items-center justify-center shrink-0"
                                  style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
                                >
                                  <SleeperAvatarImage
                                    avatarId={ownerAvatars[part.name]}
                                    name={part.name}
                                    fallback={<span className="font-heading text-[7px] font-bold text-[#60a5fa]">{part.name.slice(0, 2).toUpperCase()}</span>}
                                  />
                                </span>
                                <span className="underline underline-offset-2">{part.name}</span>
                              </OwnerLink>
                            ) : (
                              <span key={j}>{part.text}</span>
                            ),
                          )}
                        </div>
                        {tx.details.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {tx.details.map((d, j) => (
                              <span
                                key={j}
                                className="text-[11px] px-2 py-0.5 rounded"
                                style={{
                                  background:
                                    d.side === "in"
                                      ? "rgba(74,222,128,0.08)"
                                      : "rgba(253,74,72,0.08)",
                                  color:
                                    d.side === "in" ? "#4ade80" : "var(--color-ittwa)",
                                  border: `1px solid ${d.side === "in" ? "rgba(74,222,128,0.2)" : "rgba(253,74,72,0.2)"}`,
                                }}
                              >
                                <span className="mr-1 opacity-60">
                                  {d.side === "in" ? "+" : "−"}
                                </span>
                                {d.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right pt-0.5 hidden sm:block">
                        <div className="text-xs font-mono">{tx.date}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {tx.season} Season
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* NFL Depth Chart */}
          {depthChartPlayers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <SectionTick
                  label="NFL Depth Chart"
                  sub={`${player.team} · ${depthChartLabel}`}
                />
              </CardHeader>
              <CardContent className="space-y-1.5">
                {depthChartPlayers.map((dc) => (
                  <div
                    key={dc.playerId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{
                      background: dc.isCurrent ? posColors.bg : "var(--secondary)",
                      border: `1px solid ${dc.isCurrent ? posColors.border : "var(--border)"}`,
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center font-heading font-extrabold text-[11px] tracking-wide rounded px-2 py-0.5"
                      style={{
                        background: dc.isCurrent ? posColors.text : "var(--secondary)",
                        color: dc.isCurrent ? "#fff" : "var(--muted-foreground)",
                        border: dc.isCurrent ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {dc.role}
                    </span>
                    <PlayerAvatar
                      playerId={dc.playerId}
                      playerName={dc.name}
                      position={player.position}
                      size={30}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-semibold"
                        style={{ color: dc.isCurrent ? "var(--foreground)" : "#bbb" }}
                      >
                        {dc.isCurrent ? (
                          dc.name
                        ) : (
                          <PlayerLink playerId={dc.playerId} className="hover:underline underline-offset-2">
                            {dc.name}
                          </PlayerLink>
                        )}
                      </div>
                      <div
                        className="text-[10px] mt-0.5 tracking-wider uppercase font-semibold flex items-center gap-1"
                        style={{ color: dc.isCurrent ? posColors.text : "var(--muted-foreground)" }}
                      >
                        {dc.owner ? (
                          <>
                            <span>Owned</span>
                            <span className="text-muted-foreground font-mono normal-case flex items-center gap-1">
                              ·
                              <span
                                className="w-3.5 h-3.5 rounded-sm overflow-hidden inline-flex items-center justify-center shrink-0"
                                style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
                              >
                                <SleeperAvatarImage
                                  avatarId={ownerAvatars[dc.owner]}
                                  name={dc.owner}
                                  fallback={<span className="font-heading text-[6px] font-bold text-[#60a5fa]">{dc.owner.slice(0, 2).toUpperCase()}</span>}
                                />
                              </span>
                              {dc.owner}
                            </span>
                          </>
                        ) : (
                          "Free Agent"
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Contract History */}
          {contractHistory.length >= 1 && (
            <Card>
              <CardHeader className="pb-3">
                <SectionTick label="Contract History" />
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">
                        Season
                      </th>
                      <th className="px-4 py-2 text-left font-medium">
                        Owner
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Salary
                      </th>
                      <th className="px-4 py-2 text-center font-medium">
                        Yrs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...contractHistory].reverse().map((c, i) => (
                      <tr
                        key={`${c.season}-${i}`}
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <td className="px-4 py-2 font-mono tabular-nums">
                          {c.season}
                        </td>
                        <td className="px-4 py-2">
                          <OwnerLink
                            name={resolveOwnerName(c.owner)}
                            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                          >
                            <div
                              className="w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden"
                              style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
                            >
                              <SleeperAvatarImage
                                avatarId={ownerAvatars[resolveOwnerName(c.owner)]}
                                name={resolveOwnerName(c.owner)}
                                fallback={<span className="font-heading text-[8px] font-bold text-[#60a5fa]">{resolveOwnerName(c.owner).slice(0, 2).toUpperCase()}</span>}
                              />
                            </div>
                            {resolveOwnerName(c.owner)}
                          </OwnerLink>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {c.salary > 0 ? (
                            <span className="text-gold">
                              {fmtDollar(c.salary)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center tabular-nums">
                          {c.years > 0 ? (
                            c.years
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
