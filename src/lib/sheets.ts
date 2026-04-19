import { ContractRow, CapHitRow } from "@/types/contracts";
import { GOOGLE_SHEETS_ID, REVALIDATE } from "./config";

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
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE.sheets },
  });

  if (!res.ok) {
    console.error(`Google Sheets API error: ${res.status} for tab "${tab}"`);
    return [];
  }

  const data = await res.json();
  return data.values || [];
}

// --- Contracts ---
// Joins with Sleeper data via player_id — this is the PRIMARY join key.
// Do NOT join on player name. For rows where player_id is "#N/A" (Sleeper
// doesn't recognize the player), display by name only and skip Sleeper merge.

export async function getContracts(): Promise<ContractRow[]> {
  const rows = await fetchSheet("Contracts", "A2:O5000");

  return rows
    .filter((row) => row.length >= 10)
    .map((row) => ({
      playerId: (row[0] || "").trim(),
      season: (row[1] || "").trim(),
      owner: (row[2] || "").trim(),
      player: (row[3] || "").trim(),
      position: (row[4] || "").trim(),
      years: parseInt(row[5] || "0", 10) || 0,
      salary: parseFloat((row[6] || "0").replace("$", "")) || 0,
      dpOriginalOwner: (row[7] || "").trim(),
      draftPickId: (row[8] || "").trim(),
      contractStatus: (row[9] || "").trim(),
      contractStartYear: (row[10] || "").trim(),
      originalPick: (row[11] || "").trim(),
      franchiseTag: (row[12] || "").trim().toUpperCase() === "Y",
      fifthYearTag: (row[13] || "").trim().toUpperCase() === "Y",
      fifthYearTagAmount: (row[14] || "").trim(),
    }));
}

// --- Cap Hits ---

export async function getCapHits(): Promise<CapHitRow[]> {
  const rows = await fetchSheet("CapHits", "A2:AJ5000");

  return rows
    .filter((row) => row.length >= 10)
    .map((row) => {
      const yearlyHits: Record<number, number> = {};
      for (let i = 15; i <= 35 && i < row.length; i++) {
        const year = 2015 + (i - 15);
        const val = parseFloat((row[i] || "0").replace("$", "")) || 0;
        if (val > 0) yearlyHits[year] = val;
      }

      return {
        season: (row[0] || "").trim(),
        owner: (row[8] || "").trim(),
        player: (row[9] || "").trim(),
        position: (row[10] || "").trim(),
        years: parseInt(row[11] || "0", 10) || 0,
        salary: parseFloat((row[12] || "0").replace("$", "")) || 0,
        capHit: parseFloat((row[13] || "0").replace("$", "")) || 0,
        yearsRemaining: parseInt(row[14] || "0", 10) || 0,
        yearlyHits,
      };
    });
}
