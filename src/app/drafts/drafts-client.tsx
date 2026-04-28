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

  return (
    <div>
      {/* TODO: Page Header */}
      {/* TODO: Season Filter */}
      {/* TODO: Two-column layout - Draft Grid + Sidebar */}
    </div>
  );
}
