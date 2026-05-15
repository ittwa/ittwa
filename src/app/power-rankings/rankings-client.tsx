"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SleeperAvatarImage } from "@/components/owner-avatar";
import { PowerRankingEntry } from "@/lib/power-rankings";
import { getDivisionVariant, getDivisionColor, getDivisionColorAlpha } from "@/lib/ui-utils";

interface RankingsClientProps {
  weeklyRankings: Record<number, PowerRankingEntry[]>;
  allPlayByWeek: Record<number, Record<number, [number, number]>>;
  weeklyRankHistory: Record<number, number[]>;
  teamStreaks: Record<number, string>;
  ownerAvatars: Record<string, string>;
  season: string;
  currentWeek: number;
}

const POWER_HISTORY: {
  year: string;
  powerOne: string;
  champ: string;
  matched: boolean | null;
}[] = [
  { year: "2025", powerOne: "Clancy", champ: "Clancy", matched: true },
  { year: "2024", powerOne: "Chapman", champ: "Collins", matched: false },
  { year: "2023", powerOne: "HoganLamb", champ: "Chapman", matched: false },
  { year: "2022", powerOne: "Peterson", champ: "Bohne", matched: false },
  { year: "2021", powerOne: "Clancy", champ: "Clancy", matched: true },
  { year: "2020", powerOne: "Durkin", champ: "Durkin", matched: true },
  { year: "2019", powerOne: "HoganLamb", champ: "Albarran", matched: false },
  { year: "2018", powerOne: "Cummings", champ: "Cummings", matched: true },
  { year: "2017", powerOne: "Clancy", champ: "HoganLamb", matched: false },
  { year: "2016", powerOne: "Chapman", champ: "Katz", matched: false },
  { year: "2015", powerOne: "Chapman", champ: "Chapman", matched: true },
  { year: "2014", powerOne: "Clancy", champ: "Clancy", matched: true },
];

function scoreForRank(rank: number, n = 12): number {
  const top = 96,
    bottom = 12;
  return +(top - (top - bottom) * Math.pow((rank - 1) / (n - 1), 0.9)).toFixed(
    1,
  );
}

function allOppColor(
  wins: number,
  total: number,
): { bg: string; fg: string } {
  const p = wins / total;
  if (p >= 0.9) return { bg: "rgba(37,73,135,0.92)", fg: "#dbeafe" };
  if (p >= 0.75) return { bg: "rgba(67,109,168,0.78)", fg: "#dbeafe" };
  if (p >= 0.6) return { bg: "rgba(120,159,206,0.55)", fg: "#0b1726" };
  if (p >= 0.45) return { bg: "rgba(218,205,180,0.55)", fg: "#1a1208" };
  if (p >= 0.3) return { bg: "rgba(232,148,98,0.7)", fg: "#2a0a02" };
  if (p >= 0.15) return { bg: "rgba(203,89,52,0.85)", fg: "#fff" };
  return { bg: "rgba(154,55,33,0.95)", fg: "#fff" };
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function OwnerAvatar({
  name,
  avatarId,
  division,
  size = 28,
}: {
  name: string;
  avatarId?: string;
  division?: string;
  size?: number;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  const color = division ? getDivisionColor(division) : "#888";
  const bg = division ? getDivisionColorAlpha(division, 0.1) : "rgba(136,136,136,0.1)";
  const border = division ? getDivisionColorAlpha(division, 0.2) : "rgba(136,136,136,0.2)";
  return (
    <div
      className="rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, background: bg, border: `1px solid ${border}` }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={
          <span
            className="font-heading font-extrabold"
            style={{ color, fontSize: size * 0.38 }}
          >
            {initials}
          </span>
        }
      />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold bg-[#E8B84B]/20 text-[#E8B84B] border border-[#E8B84B]/50">
        {rank}
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold bg-slate-400/15 text-slate-300 border border-slate-400/40">
        {rank}
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold bg-orange-400/15 text-orange-300 border border-orange-400/40">
        {rank}
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded text-xs text-muted-foreground font-mono">
      {rank}
    </span>
  );
}

function MovementIndicator({ change }: { change: number }) {
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
        <span className="text-[10px]">▲</span>
        {change}
      </span>
    );
  if (change < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400">
        <span className="text-[10px]">▼</span>
        {Math.abs(change)}
      </span>
    );
  return <span className="text-xs text-[#555]">—</span>;
}

function PowerBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <span className="font-mono text-xs font-bold text-foreground w-8 text-right tabular-nums">
        {score.toFixed(1)}
      </span>
      <div className="flex-1 h-[6px] bg-[#1f1f1f] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${score}%`,
            background:
              score >= 80 ? "#E8B84B" : score >= 50 ? "#FD4A48" : "#555",
          }}
        />
      </div>
    </div>
  );
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak || streak === "—")
    return <span className="text-xs text-[#555]">—</span>;
  const isWin = streak.startsWith("W");
  const hot = parseInt(streak.slice(1)) >= 3;

  let variant: string;
  if (isWin && hot) variant = "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30";
  else if (isWin) variant = "bg-emerald-400/8 text-emerald-400/70";
  else if (hot) variant = "bg-red-400/15 text-red-400 border border-red-400/30";
  else variant = "bg-red-400/8 text-red-400/70";

  return (
    <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider", variant)}>
      {streak}
    </span>
  );
}

function RankSpark({
  ranks,
}: {
  ranks: number[];
}) {
  if (ranks.length < 2) return null;
  const w = 100,
    h = 28,
    pad = 4;
  const points = ranks.map((r, i) => ({
    x: pad + (i / (ranks.length - 1)) * (w - pad * 2),
    y: pad + ((r - 1) / 11) * (h - pad * 2),
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <path
        d={path}
        fill="none"
        stroke="#FD4A48"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill="#FD4A48" />
    </svg>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="py-3.5 px-4 border-b border-border bg-secondary flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-[18px] bg-ittwa rounded-sm" />
        <span className="font-heading font-extrabold text-lg tracking-[0.04em]">
          {title}
        </span>
      </div>
      {subtitle && (
        <span className="text-[11px] text-[#555] font-mono">{subtitle}</span>
      )}
    </div>
  );
}

function LuckBar({
  value,
  max,
  width = 6,
  decimal = false,
}: {
  value: number;
  max: number;
  width?: number;
  decimal?: boolean;
}) {
  const barPct = (Math.abs(value) / max) * 50;
  return (
    <div className="flex items-center gap-2">
      <div className="w-[100px] h-[10px] relative bg-[#1a1a1a] rounded-full overflow-hidden">
        {value !== 0 && (
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left: value > 0 ? "50%" : `${50 - barPct}%`,
              width: `${barPct}%`,
              background: value > 0 ? "#60a5fa" : "#fb923c",
            }}
          />
        )}
        <div className="absolute left-1/2 top-0 w-px h-full bg-[#444]" />
      </div>
      <span
        className={cn(
          "font-mono text-[10px] font-bold",
          value > 0
            ? "text-blue-400"
            : value < 0
              ? "text-orange-400"
              : "text-[#555]",
        )}
        style={{ width: `${width * 4}px` }}
      >
        {value > 0 ? "+" : ""}
        {decimal ? value.toFixed(1) : value}
      </span>
    </div>
  );
}

/* ── Enriched entry type ────────────────────────────────────────────────── */

interface EnrichedEntry extends PowerRankingEntry {
  powerScore: number;
  expectedWins: number;
  expectedLosses: number;
  streak: string;
  weeklyRanks: number[];
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export function RankingsClient({
  weeklyRankings,
  allPlayByWeek,
  weeklyRankHistory,
  teamStreaks,
  ownerAvatars,
  season,
  currentWeek,
}: RankingsClientProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const rankings = weeklyRankings[selectedWeek] || [];

  const enriched: EnrichedEntry[] = useMemo(() => {
    const n = rankings.length || 12;
    return rankings.map((entry) => ({
      ...entry,
      powerScore: scoreForRank(entry.rank, n),
      expectedWins: +(entry.allPlayWinPct * entry.weeksPlayed).toFixed(1),
      expectedLosses: +(
        entry.weeksPlayed -
        entry.allPlayWinPct * entry.weeksPlayed
      ).toFixed(1),
      streak: teamStreaks[entry.rosterId] || "—",
      weeklyRanks: (weeklyRankHistory[entry.rosterId] || []).slice(
        0,
        selectedWeek,
      ),
    }));
  }, [rankings, teamStreaks, weeklyRankHistory, selectedWeek]);

  const statCards = useMemo(() => {
    if (enriched.length === 0) return [];
    const powerOne = enriched[0];
    const sorted = [...enriched].sort(
      (a, b) => b.rankChange - a.rankChange,
    );
    const biggestRiser =
      sorted[0]?.rankChange > 0 ? sorted[0] : null;
    const biggestFaller =
      sorted[sorted.length - 1]?.rankChange < 0
        ? sorted[sorted.length - 1]
        : null;
    const mostUnlucky = [...enriched].sort(
      (a, b) => a.luckIndex - b.luckIndex,
    )[0];

    return [
      {
        label: "Power #1",
        value: powerOne.displayName,
        sub: `${powerOne.actualWins}-${powerOne.actualLosses} · ${powerOne.allPlayWins}-${powerOne.allPlayLosses} AP`,
        color: "#E8B84B",
        icon: "★",
      },
      {
        label: "Biggest Riser",
        value: biggestRiser?.displayName || "—",
        sub: biggestRiser
          ? `▲${biggestRiser.rankChange} spots this week`
          : "No movement",
        color: "#4ade80",
        icon: "◆",
      },
      {
        label: "Biggest Faller",
        value: biggestFaller?.displayName || "—",
        sub: biggestFaller
          ? `▼${Math.abs(biggestFaller.rankChange)} spots this week`
          : "No movement",
        color: "#f87171",
        icon: "◆",
      },
      {
        label: "Most Unlucky",
        value: mostUnlucky.displayName,
        sub: `${(mostUnlucky.luckIndex * 100).toFixed(1)}% luck index`,
        color: "#60a5fa",
        icon: "◎",
      },
    ];
  }, [enriched]);

  const heatmapRows = useMemo(() => {
    return enriched.map((entry) => {
      const records: [number, number][] = [];
      let tw = 0,
        tl = 0;
      for (let w = 1; w <= selectedWeek; w++) {
        const wd = allPlayByWeek[w];
        if (wd?.[entry.rosterId]) {
          const [wins, losses] = wd[entry.rosterId];
          records.push([wins, losses]);
          tw += wins;
          tl += losses;
        } else {
          records.push([0, 0]);
        }
      }
      return {
        rosterId: entry.rosterId,
        displayName: entry.displayName,
        division: entry.division,
        records,
        tw,
        tl,
      };
    });
  }, [enriched, allPlayByWeek, selectedWeek]);

  const luckRows = useMemo(() => {
    const byExp = [...enriched].sort(
      (a, b) => b.allPlayWinPct - a.allPlayWinPct,
    );
    return byExp.map((entry, i) => {
      const expRank = i + 1;
      return {
        displayName: entry.displayName,
        actualRank: entry.rank,
        expRank,
        stLuck: -(entry.rank - expRank),
        actualWins: entry.actualWins,
        expectedWins: entry.expectedWins,
        wLuck: entry.actualWins - entry.expectedWins,
      };
    });
  }, [enriched]);

  const maxStLuck = useMemo(
    () => Math.max(...luckRows.map((r) => Math.abs(r.stLuck)), 1),
    [luckRows],
  );
  const maxWLuck = useMemo(
    () => Math.max(...luckRows.map((r) => Math.abs(r.wLuck)), 0.1),
    [luckRows],
  );

  return (
    <div>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">
                Power Rankings
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground ml-4">
              {season} &middot; All-Play Power Rankings through Week{" "}
              {selectedWeek}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                disabled={selectedWeek <= 1}
                className="w-7 h-7 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs"
              >
                &#8249;
              </button>
              <span className="px-3 py-1 bg-secondary border border-border rounded text-sm font-mono font-medium min-w-[80px] text-center">
                Week {selectedWeek}
              </span>
              <button
                onClick={() =>
                  setSelectedWeek((w) => Math.min(currentWeek, w + 1))
                }
                disabled={selectedWeek >= currentWeek}
                className="w-7 h-7 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center justify-center text-xs"
              >
                &#8250;
              </button>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {enriched.length} teams
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Stat Summary ──────────────────────────────────────────────── */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-card border border-border rounded-[10px] p-3.5 relative overflow-hidden"
            >
              <span
                className="absolute top-2.5 right-3.5 text-sm opacity-70"
                style={{ color: card.color }}
              >
                {card.icon}
              </span>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#555] mb-1.5">
                {card.label}
              </div>
              <div
                className="font-heading text-[22px] font-extrabold leading-none"
                style={{ color: card.color }}
              >
                {card.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Rankings Table ─────────────────────────────────────────────── */}
      {enriched.length === 0 ? (
        <div className="bg-card border border-border rounded-[14px] p-16 text-center">
          <p className="text-muted-foreground italic">
            Not enough data yet. Check back after Week 1.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <SectionHeader
            title="WEEKLY POWER RANKINGS"
            subtitle={`sorted by all-play win% · ${enriched.length} teams`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold tracking-[0.08em] uppercase text-[#555]">
                  <th className="px-3 py-2.5 text-center w-12">#</th>
                  <th className="px-3 py-2.5 text-left">Owner</th>
                  <th className="px-3 py-2.5 text-center w-10">
                    &Delta;
                  </th>
                  <th className="px-3 py-2.5 text-left min-w-[160px]">
                    Power Score
                  </th>
                  <th className="px-3 py-2.5 text-center">Record</th>
                  <th className="px-3 py-2.5 text-center">Expected</th>
                  <th className="px-3 py-2.5 text-center">PF</th>
                  <th className="px-3 py-2.5 text-center">Streak</th>
                  <th className="px-3 py-2.5 text-left min-w-[110px]">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((entry) => (
                  <tr
                    key={entry.rosterId}
                    className="border-b border-[#181818] hover:bg-[#141414] transition-colors"
                  >
                    <td className="px-3 py-3 text-center">
                      <RankBadge rank={entry.rank} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <OwnerAvatar
                          name={entry.displayName}
                          avatarId={ownerAvatars[entry.displayName]}
                          division={entry.division}
                        />
                        <div>
                          <div className="text-[13px] font-semibold">
                            {entry.displayName}
                          </div>
                          <Badge
                            variant={getDivisionVariant(entry.division)}
                            className="text-[9px] mt-0.5 px-1.5 py-0"
                          >
                            {entry.division}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MovementIndicator change={entry.rankChange} />
                    </td>
                    <td className="px-3 py-3">
                      <PowerBar score={entry.powerScore} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-xs tabular-nums">
                        <span className="text-emerald-400">
                          {entry.actualWins}
                        </span>
                        <span className="text-[#555]">-</span>
                        <span className="text-red-400">
                          {entry.actualLosses}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {entry.expectedWins}-{entry.expectedLosses}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-xs tabular-nums">
                        {entry.totalPoints.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StreakBadge streak={entry.streak} />
                    </td>
                    <td className="px-3 py-3">
                      <RankSpark ranks={entry.weeklyRanks} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── All-Opponent Heatmap ───────────────────────────────────────── */}
      {heatmapRows.length > 0 && (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <SectionHeader
            title="ALL-OPPONENT RECORD"
            subtitle="weekly all-play results · hover for details"
          />
          <div className="overflow-x-auto">
            <table
              className="w-full text-[11px]"
              style={{ borderCollapse: "collapse", minWidth: 700 }}
            >
              <thead>
                <tr className="border-b border-border text-[9px] font-bold tracking-[0.08em] uppercase text-[#555]">
                  <th className="px-3 py-2 text-left w-[120px]">Team</th>
                  {Array.from({ length: selectedWeek }, (_, i) => (
                    <th
                      key={i}
                      className="px-0.5 py-2 text-center"
                      style={{ width: 44 }}
                    >
                      W{i + 1}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold border-l border-border">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map((row) => {
                  const total = row.tw + row.tl;
                  return (
                    <tr
                      key={row.rosterId}
                      className="border-b border-[#181818]"
                    >
                      <td className="px-3 py-1.5 text-xs font-medium truncate max-w-[120px]">
                        {row.displayName}
                      </td>
                      {row.records.map(([wins, losses], i) => {
                        const t = wins + losses;
                        if (t === 0)
                          return (
                            <td
                              key={i}
                              className="px-0.5 py-1.5 text-center text-[#333]"
                            >
                              —
                            </td>
                          );
                        const c = allOppColor(wins, t);
                        return (
                          <td
                            key={i}
                            className="px-0.5 py-1.5 text-center"
                          >
                            <span
                              className="inline-block w-[38px] py-[3px] rounded font-mono text-[10px] font-semibold"
                              style={{
                                background: c.bg,
                                color: c.fg,
                              }}
                              title={`Week ${i + 1}: ${wins}-${losses}`}
                            >
                              {wins}-{losses}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center border-l border-border">
                        <span className="font-mono font-bold text-xs">
                          {row.tw}-{row.tl}
                        </span>
                        {total > 0 && (
                          <span className="text-[9px] text-muted-foreground ml-1">
                            ({((row.tw / total) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 px-4 border-t border-border bg-secondary flex items-center gap-4 flex-wrap">
            <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-[#555]">
              Legend
            </span>
            {(
              [
                ["elite", 10, 11],
                ["great", 9, 11],
                ["good", 7, 11],
                ["okay", 6, 11],
                ["poor", 4, 11],
                ["bad", 2, 11],
                ["awful", 0, 11],
              ] as const
            ).map(([label, wins, total]) => {
              const c = allOppColor(wins, total);
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-3 rounded-sm inline-block"
                    style={{ background: c.bg }}
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Luck of Schedule ───────────────────────────────────────────── */}
      {luckRows.length > 0 && (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <SectionHeader
            title="LUCK OF SCHEDULE"
            subtitle="standings luck (rank diff) and wins luck (actual − expected)"
          />
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              style={{ borderCollapse: "collapse", minWidth: 640 }}
            >
              <thead>
                <tr className="border-b border-border text-[10px] font-bold tracking-[0.08em] uppercase text-[#555]">
                  <th className="px-3 py-2.5 text-left w-[120px]">
                    Owner
                  </th>
                  <th className="px-3 py-2.5 text-center">Actual</th>
                  <th className="px-3 py-2.5 text-center">Exp.</th>
                  <th className="px-3 py-2.5 text-left">
                    Standings Luck
                  </th>
                  <th className="px-3 py-2.5 text-center">Wins</th>
                  <th className="px-3 py-2.5 text-center">Exp. W</th>
                  <th className="px-3 py-2.5 text-left">Wins Luck</th>
                </tr>
              </thead>
              <tbody>
                {luckRows.map((row) => (
                    <tr
                      key={row.displayName}
                      className="border-b border-[#181818] hover:bg-[#141414] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-xs font-medium">
                        {row.displayName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs">
                        #{row.actualRank}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs text-muted-foreground">
                        #{row.expRank}
                      </td>
                      <td className="px-3 py-2.5">
                        <LuckBar value={row.stLuck} max={maxStLuck} />
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs">
                        {row.actualWins}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs text-muted-foreground">
                        {row.expectedWins}
                      </td>
                      <td className="px-3 py-2.5">
                        <LuckBar value={row.wLuck} max={maxWLuck} width={8} decimal />
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── History Timeline ───────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-[14px] overflow-hidden">
        <SectionHeader title="POWER #1 HISTORY" />
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {POWER_HISTORY.map((h) => (
            <div
              key={h.year}
              className="bg-secondary border border-border rounded-lg p-3 relative overflow-hidden"
            >
              <div className="font-heading text-[22px] font-black tracking-[0.02em] leading-none mb-2">
                {h.year}
              </div>
              <div className="space-y-1">
                <div>
                  <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[#555]">
                    Power #1
                  </div>
                  <div className="text-[11px] font-semibold">
                    {h.powerOne}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[#555]">
                    Champion
                  </div>
                  <div
                    className={cn(
                      "text-[11px] font-semibold",
                      h.matched && "text-[#E8B84B]",
                    )}
                  >
                    {h.champ}
                    {h.matched && (
                      <span className="ml-1 text-[#E8B84B]">★</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footnote ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-[14px] p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">How Power Rankings work:</strong>{" "}
          Each week, every team&apos;s score is compared against all other
          teams. A win is awarded for each opponent outscored. The cumulative
          All-Play win percentage determines the power ranking. Power Score is
          a 0&ndash;100 normalized value based on rank position. Expected
          Record projects wins based on scoring power vs the field.
        </p>
      </div>
    </div>
  );
}
