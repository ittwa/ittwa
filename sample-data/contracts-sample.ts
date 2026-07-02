// Bundled fallback data for the Tag Tracker page (/tags).
//
// Used ONLY when the live Google Sheet can't be reached (e.g. GOOGLE_API_KEY
// missing, network error, or the Contracts tab returns no rows). Shaped
// exactly like real rows from the Contracts sheet so every derivation path in
// lib/tags-data.ts gets exercised: a consecutive franchise-tag chain, both
// 5th-year option tiers (including one position with fewer players than the
// required top-N, and one "messy" multi-season flag streak like real
// historical data sometimes has), a non-Active row (excluded everywhere),
// and a "Draft Pick" placeholder row (excluded everywhere).
//
// All names/owners here are clearly fictional ("Sample Owner A", etc.) so
// this is never mistaken for real league history.

import type { ContractRow } from "@/types/contracts";

function row(r: Partial<ContractRow> & { season: string; owner: string; player: string; position: string }): ContractRow {
  return {
    playerId: r.player.toLowerCase().replace(/\s+/g, "-"),
    season: r.season,
    owner: r.owner,
    player: r.player,
    position: r.position,
    years: r.years ?? 1,
    salary: r.salary ?? 0,
    dpOriginalOwner: r.dpOriginalOwner ?? "",
    draftPickId: r.draftPickId ?? "",
    contractStatus: r.contractStatus ?? "Active",
    contractStartYear: r.contractStartYear ?? "",
    originalPick: r.originalPick ?? "N",
    franchiseTag: r.franchiseTag ?? false,
    fifthYearTag: r.fifthYearTag ?? false,
    fifthYearTagAmount: r.fifthYearTagAmount ?? "",
  };
}

export const SAMPLE_CONTRACTS: ContractRow[] = [
  // ── A "Draft Pick" placeholder row — must be filtered out of everything ──
  row({ season: "2027", owner: "Sample Owner A", player: "2027 1st - Sample Owner A", position: "Draft Pick", draftPickId: "202700" }),

  // ── Consecutive franchise-tag chain: Sample RB One, 2023 (pre-tag) → 2024 (1st tag) → 2025 (2nd) → 2026 (3rd, current) ──
  row({ season: "2023", owner: "Sample Owner A", player: "Sample RB One", position: "RB", salary: 25, years: 1 }),
  // 2023 RB peers, for the top-5 positional average that produced the 2024 tag ($36 avg)
  row({ season: "2023", owner: "Sample Owner B", player: "Sample RB Peer 1", position: "RB", salary: 40, years: 2 }),
  row({ season: "2023", owner: "Sample Owner C", player: "Sample RB Peer 2", position: "RB", salary: 38, years: 2 }),
  row({ season: "2023", owner: "Sample Owner D", player: "Sample RB Peer 3", position: "RB", salary: 36, years: 3 }),
  row({ season: "2023", owner: "Sample Owner E", player: "Sample RB Peer 4", position: "RB", salary: 34, years: 1 }),
  row({ season: "2023", owner: "Sample Owner F", player: "Sample RB Peer 5", position: "RB", salary: 32, years: 2 }),
  row({ season: "2024", owner: "Sample Owner A", player: "Sample RB One", position: "RB", salary: 36, years: 1, franchiseTag: true }),
  row({ season: "2025", owner: "Sample Owner A", player: "Sample RB One", position: "RB", salary: 43.2, years: 1, franchiseTag: true }),
  row({ season: "2026", owner: "Sample Owner A", player: "Sample RB One", position: "RB", salary: 51.8, years: 1, franchiseTag: true }),

  // ── A fresh franchise-tag-eligible QB: expiring this season, with peers for the top-5 QB average ──
  row({ season: "2026", owner: "Sample Owner B", player: "Sample QB One", position: "QB", salary: 34, years: 1 }),
  row({ season: "2026", owner: "Sample Owner C", player: "Sample QB Peer 1", position: "QB", salary: 42, years: 3 }),
  row({ season: "2026", owner: "Sample Owner D", player: "Sample QB Peer 2", position: "QB", salary: 39, years: 2 }),
  row({ season: "2026", owner: "Sample Owner E", player: "Sample QB Peer 3", position: "QB", salary: 37, years: 1 }),
  row({ season: "2026", owner: "Sample Owner F", player: "Sample QB Peer 4", position: "QB", salary: 33, years: 4 }),
  row({ season: "2026", owner: "Sample Owner A", player: "Sample QB Peer 5", position: "QB", salary: 30, years: 2 }),

  // ── A standalone historical franchise tag with an "Unknown" basis (doesn't match either formula — demonstrates that fallback) ──
  row({ season: "2022", owner: "Sample Owner B", player: "Sample WR Legacy", position: "WR", salary: 61, years: 1, franchiseTag: true }),
  row({ season: "2021", owner: "Sample Owner B", player: "Sample WR Legacy", position: "WR", salary: 20, years: 1 }),

  // ── A couple more historical tags across positions/seasons/owners for the Insights charts ──
  row({ season: "2023", owner: "Sample Owner C", player: "Sample TE Star", position: "TE", salary: 22, years: 1, franchiseTag: true }),
  row({ season: "2022", owner: "Sample Owner C", player: "Sample TE Star", position: "TE", salary: 18, years: 1 }),
  row({ season: "2024", owner: "Sample Owner D", player: "Sample WR Second", position: "WR", salary: 45, years: 1, franchiseTag: true }),
  row({ season: "2023", owner: "Sample Owner D", player: "Sample WR Second", position: "WR", salary: 37.5, years: 1 }),

  // ── 5th-year option, "clean" pattern: flag on the final rookie-year row only (matches the Constitution's literal timing) ──
  row({ season: "2021", owner: "Sample Owner E", player: "Sample Rookie Clean", position: "WR", salary: 9, years: 4, draftPickId: "202106", originalPick: "Y" }),
  row({ season: "2022", owner: "Sample Owner E", player: "Sample Rookie Clean", position: "WR", salary: 9, years: 3, draftPickId: "202106" }),
  row({ season: "2023", owner: "Sample Owner E", player: "Sample Rookie Clean", position: "WR", salary: 9, years: 2, draftPickId: "202106" }),
  row({ season: "2024", owner: "Sample Owner E", player: "Sample Rookie Clean", position: "WR", salary: 9, years: 1, draftPickId: "202106", fifthYearTag: true }),
  row({ season: "2025", owner: "Sample Owner E", player: "Sample Rookie Clean", position: "WR", salary: 39, years: 1, draftPickId: "202106" }),

  // ── 5th-year option, "messy" pattern: flag persists across multiple seasons with different salaries —
  // real historical sheets look like this; Tag History shows each flagged row as its own entry, unmerged.
  row({ season: "2024", owner: "Sample Owner F", player: "Sample Rookie Messy", position: "RB", salary: 14, years: 1, draftPickId: "202401", fifthYearTag: true }),
  row({ season: "2025", owner: "Sample Owner F", player: "Sample Rookie Messy", position: "RB", salary: 43, years: 1, draftPickId: "202401", fifthYearTag: true, franchiseTag: true }),
  row({ season: "2026", owner: "Sample Owner F", player: "Sample Rookie Messy", position: "RB", salary: 51.6, years: 1, draftPickId: "202401", fifthYearTag: true }),

  // ── Current-season 5th-year-eligible rookie, early tier (picks 1-6, top-10 avg) — WR position deliberately
  // has FEWER than 10 salaried peers below, to demonstrate the "averaged fewer than required" fallback.
  row({ season: "2024", owner: "Sample Owner A", player: "Sample Rookie Early Tier", position: "WR", salary: 9, years: 4, draftPickId: "202403" }),
  row({ season: "2025", owner: "Sample Owner A", player: "Sample Rookie Early Tier", position: "WR", salary: 9, years: 3, draftPickId: "202403" }),
  row({ season: "2026", owner: "Sample Owner A", player: "Sample Rookie Early Tier", position: "WR", salary: 9, years: 2, draftPickId: "202403" }),
  row({ season: "2026", owner: "Sample Owner B", player: "Sample WR Salary Peer 1", position: "WR", salary: 41, years: 2 }),
  row({ season: "2026", owner: "Sample Owner C", player: "Sample WR Salary Peer 2", position: "WR", salary: 38, years: 3 }),
  row({ season: "2026", owner: "Sample Owner D", player: "Sample WR Salary Peer 3", position: "WR", salary: 33, years: 1 }),
  row({ season: "2026", owner: "Sample Owner E", player: "Sample WR Salary Peer 4", position: "WR", salary: 28, years: 2 }),
  row({ season: "2026", owner: "Sample Owner F", player: "Sample WR Salary Peer 5", position: "WR", salary: 22, years: 1 }),

  // ── Current-season 5th-year-eligible rookie, late tier (picks 7-12, top-25 avg) ──
  row({ season: "2024", owner: "Sample Owner B", player: "Sample Rookie Late Tier", position: "TE", salary: 8, years: 4, draftPickId: "202409" }),
  row({ season: "2025", owner: "Sample Owner B", player: "Sample Rookie Late Tier", position: "TE", salary: 8, years: 3, draftPickId: "202409" }),
  row({ season: "2026", owner: "Sample Owner B", player: "Sample Rookie Late Tier", position: "TE", salary: 8, years: 2, draftPickId: "202409" }),
  row({ season: "2026", owner: "Sample Owner C", player: "Sample TE Salary Peer 1", position: "TE", salary: 26, years: 2 }),
  row({ season: "2026", owner: "Sample Owner D", player: "Sample TE Salary Peer 2", position: "TE", salary: 19, years: 3 }),
  row({ season: "2026", owner: "Sample Owner E", player: "Sample TE Salary Peer 3", position: "TE", salary: 15, years: 1 }),

  // ── A Cut (non-Active) row — must never appear in eligibility or history ──
  row({ season: "2026", owner: "Sample Owner A", player: "Sample Cut Player", position: "RB", salary: 12, years: 1, contractStatus: "Cut" }),
];
