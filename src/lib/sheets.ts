import { ContractRow, CapHitRow } from "@/types/contracts";
import { GOOGLE_SHEETS_ID } from "./config";

// Google Sheets API v4 — server-side only
// The GOOGLE_API_KEY env var must NOT be prefixed with NEXT_PUBLIC_ to ensure
// it is never exposed to the browser.

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function fetchSheet(tab: string, range: string): Promise<string[][]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_API_KEY not set — returning empty sheet data");
    return [];
  }

  const url = `${SHEETS_API_BASE}/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(tab)}!${range}?key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error(`Google Sheets API error: ${res.status} for tab "${tab}"`);
    return [];
  }

  const data = await res.json();
  return data.values || [];
}

// --- Scores (historical game-by-game results) ---

export interface ScoreRow {
  season: string;
  week: number;
  owner: string;
  opponent: string;
  points: number;
  opponentPoints: number;
  playoffType: string;
  finalStanding: number;
}

export async function getScores(): Promise<ScoreRow[]> {
  const rows = await fetchSheet("Scores", "A2:L");

  return rows
    .filter((row) => row.length >= 6 && row[2])
    .map((row) => ({
      season: (row[0] || "").trim(),
      week: parseNum(row[1]),
      owner: (row[2] || "").trim(),
      opponent: (row[3] || "").trim(),
      points: parseNum(row[4]),
      opponentPoints: parseNum(row[5]),
      playoffType: (row[6] || "").trim(),
      finalStanding: parseNum(row[8], 99),
    }));
}

// --- Contracts ---
// Joins with Sleeper data via player_id — this is the PRIMARY join key.
// Do NOT join on player name. For rows where player_id is "#N/A" (Sleeper
// doesn't recognize the player), display by name only and skip Sleeper merge.

function parseNum(val: string | undefined, fallback: number = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace("$", "").replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "#N/A" || cleaned === "N/A" || cleaned === "#REF!" || cleaned === "#VALUE!") {
    return fallback;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export async function getContracts(): Promise<ContractRow[]> {
  const rows = await fetchSheet("Contracts", "A2:O");

  return rows
    .filter((row) => row.length >= 7)
    .map((row) => ({
      playerId: (row[0] || "").trim(),
      season: (row[1] || "").trim(),
      owner: (row[2] || "").trim(),
      player: (row[3] || "").trim(),
      position: (row[4] || "").trim(),
      years: parseNum(row[5]),
      salary: parseNum(row[6]),
      dpOriginalOwner: (row[7] || "").trim(),
      draftPickId: (row[8] || "").trim(),
      contractStatus: (row[9] || "Active").trim(),
      contractStartYear: (row[10] || "").trim(),
      originalPick: (row[11] || "").trim(),
      franchiseTag: (row[12] || "").trim().toUpperCase() === "Y",
      fifthYearTag: (row[13] || "").trim().toUpperCase() === "Y",
      fifthYearTagAmount: (row[14] || "").trim(),
    }));
}

// --- Finances ---

export interface FinanceRow {
  season: string;
  owner: string;
  paid: number;
  dues: number;
  winnings: number;
  notes: string;
}

export async function getFinances(): Promise<FinanceRow[]> {
  const rows = await fetchSheet("Finances", "A2:G");

  return rows
    .filter((row) => row.length >= 6 && row[2])
    .map((row) => ({
      season: (row[0] || "").trim(),
      owner: (row[2] || "").trim(),
      paid: parseNum(row[3]),
      dues: parseNum(row[4]),
      winnings: parseNum(row[5]),
      notes: (row[6] || "").trim(),
    }));
}

// --- Cap Hits ---

export async function getCapHits(): Promise<CapHitRow[]> {
  const rows = await fetchSheet("CapHits", "A2:AJ");

  return rows
    .filter((row) => row.length >= 10)
    .map((row) => {
      const yearlyHits: Record<number, number> = {};
      for (let i = 15; i <= 35 && i < row.length; i++) {
        const year = 2015 + (i - 15);
        const val = parseNum(row[i]);
        if (val > 0) yearlyHits[year] = val;
      }

      return {
        season: (row[0] || "").trim(),
        owner: (row[8] || "").trim(),
        player: (row[9] || "").trim(),
        position: (row[10] || "").trim(),
        years: parseNum(row[11]),
        salary: parseNum(row[12]),
        capHit: parseNum(row[13]),
        yearsRemaining: parseNum(row[14]),
        yearlyHits,
      };
    });
}
