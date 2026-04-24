"use client";

import { useState, useMemo } from "react";
import { SleeperMatchup } from "@/types/sleeper";
import {
  HistoricalChampion,
  AllTimeStanding,
  HistoricalMilestone,
  GameRecordItem,
  SeasonRecordItem,
  SeasonSummary,
} from "@/lib/historical";
import { cn } from "@/lib/utils";

interface TeamRecord {
  rosterId: number;
  displayName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface RecordsClientProps {
  matchupsArray: [number, SleeperMatchup[]][];
  rosterOwnerMap: Record<number, string>;
  teamRecords: TeamRecord[];
  season: string;
  currentWeek: number;
  champions: HistoricalChampion[];
  allTimeStandings: AllTimeStanding[];
  milestones: HistoricalMilestone[];
  gameRecords: GameRecordItem[];
  seasonRecords: SeasonRecordItem[];
  seasonSummaries: Record<string, SeasonSummary>;
  availableSeasons: string[];
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function RCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-[10px] overflow-hidden",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

type SortKey = "owner" | "wins" | "losses" | "winPct" | "pf" | "rings" | "playoffs";

export function RecordsClient({
  matchupsArray,
  rosterOwnerMap,
  teamRecords,
  season,
  currentWeek,
  champions,
  allTimeStandings,
  milestones,
  gameRecords,
  seasonRecords,
  seasonSummaries,
  availableSeasons,
}: RecordsClientProps) {
  const [activeTab, setActiveTab] = useState("all-time");
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const showAllTime = activeTab === "all-time";
  const showCurrentSeason = activeTab === season;

  const yearTabs = useMemo(() => {
    const set = new Set(availableSeasons);
    if (!set.has(season)) set.add(season);
    return [...set].sort().reverse();
  }, [availableSeasons, season]);

  const ringCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of champions) map.set(c.champion, (map.get(c.champion) || 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [champions]);

  const ringLeaders = useMemo(() => {
    return [...allTimeStandings].sort((a, b) => b.rings - a.rings || b.playoffs - a.playoffs);
  }, [allTimeStandings]);

  const sortedAllTime = useMemo(() => {
    const copy = [...allTimeStandings];
    copy.sort((a, b) => {
      let cmp = 0;
      const wa = a.wins + a.losses, wb = b.wins + b.losses;
      switch (sortKey) {
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "wins": cmp = a.wins - b.wins; break;
        case "losses": cmp = a.losses - b.losses; break;
        case "winPct": cmp = (wa > 0 ? a.wins / wa : 0) - (wb > 0 ? b.wins / wb : 0); break;
        case "pf": cmp = a.pf - b.pf; break;
        case "rings": cmp = a.rings - b.rings; break;
        case "playoffs": cmp = a.playoffs - b.playoffs; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [allTimeStandings, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  // Current season data
  let highestScore = { name: "", points: 0, week: 0 };
  let lowestScore = { name: "", points: Infinity, week: 0 };
  for (const [week, matchups] of matchupsArray) {
    for (const m of matchups) {
      if (m.points <= 0) continue;
      const name = rosterOwnerMap[m.roster_id] || `Team ${m.roster_id}`;
      if (m.points > highestScore.points) highestScore = { name, points: m.points, week };
      if (m.points < lowestScore.points) lowestScore = { name, points: m.points, week };
    }
  }
  if (lowestScore.points === Infinity) lowestScore = { name: "N/A", points: 0, week: 0 };

  const sortedByPF = [...teamRecords].sort((a, b) => b.pointsFor - a.pointsFor);
  const sortedByWins = [...teamRecords].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  const sortedByLosses = [...teamRecords].sort((a, b) => b.losses - a.losses || a.pointsFor - b.pointsFor);
  const sortedByPA = [...teamRecords].sort((a, b) => b.pointsAgainst - a.pointsAgainst);
  const streaks = calculateStreaks(matchupsArray, rosterOwnerMap);

  const selectedChamp = !showAllTime && !showCurrentSeason
    ? champions.find((c) => c.year === activeTab)
    : null;
  const selectedSummary = !showAllTime ? seasonSummaries[activeTab] : null;

  const maxPlayoffs = Math.max(...allTimeStandings.map((s) => s.playoffs), 1);
  const maxRings = ringCounts[0]?.count || 1;

  return (
    <div className="space-y-8">
      {/* TODO: PageHeader */}
      {/* TODO: YearFilter */}

      <div className="flex flex-col gap-9">
        {showAllTime && (
          <>
            {/* TODO: TrophyRoom */}
            {/* TODO: GameRecords */}
            {/* TODO: SeasonRecords */}
            {/* TODO: AllTimeStandings */}
            {/* TODO: Milestones */}
            {/* TODO: ChampionshipCount */}
          </>
        )}

        {showCurrentSeason && (
          <>
            {/* TODO: CurrentSeasonView */}
          </>
        )}

        {!showAllTime && !showCurrentSeason && (
          <>
            {/* TODO: PastSeasonView */}
          </>
        )}
      </div>
    </div>
  );
}

function calculateStreaks(
  matchupsArray: [number, SleeperMatchup[]][],
  rosterOwnerMap: Record<number, string>
) {
  const sorted = [...matchupsArray].sort(([a], [b]) => a - b);
  const streaksByRoster = new Map<number, { current: number; type: "W" | "L"; best: { w: number; l: number } }>();

  for (const [, matchups] of sorted) {
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of matchups) {
      const arr = byMatchup.get(m.matchup_id) || [];
      arr.push(m);
      byMatchup.set(m.matchup_id, arr);
    }
    for (const [, pair] of byMatchup) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      if (a.points <= 0 && b.points <= 0) continue;
      for (const [me, opp] of [[a, b], [b, a]] as [SleeperMatchup, SleeperMatchup][]) {
        const s = streaksByRoster.get(me.roster_id) || { current: 0, type: "W" as const, best: { w: 0, l: 0 } };
        const won = me.points > opp.points;
        const type = won ? "W" as const : "L" as const;
        if (type === s.type) s.current++;
        else { s.current = 1; s.type = type; }
        if (type === "W" && s.current > s.best.w) s.best.w = s.current;
        if (type === "L" && s.current > s.best.l) s.best.l = s.current;
        streaksByRoster.set(me.roster_id, s);
      }
    }
  }

  let longestWin = { name: "N/A", count: 0 };
  let longestLoss = { name: "N/A", count: 0 };
  for (const [rosterId, s] of streaksByRoster) {
    const name = rosterOwnerMap[rosterId] || `Team ${rosterId}`;
    if (s.best.w > longestWin.count) longestWin = { name, count: s.best.w };
    if (s.best.l > longestLoss.count) longestLoss = { name, count: s.best.l };
  }
  return { longestWin, longestLoss };
}
