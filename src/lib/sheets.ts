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
      // player_id is the primary join key between Sheets and Sleeper data.
      // Some rows show "#N/A" when Sleeper doesn't recognize the player —
      // for these, display by name only and skip Sleeper merge.
      playerId: row[0] || "",
      season: row[1] || "",
      owner: row[2] || "",
      player: row[3] || "",
      position: row[4] || "",
      years: parseInt(row[5] || "0", 10) || 0,
      salary: parseFloat((row[6] || "0").replace("$", "")) || 0,
      dpOriginalOwner: row[7] || "",
      draftPickId: row[8] || "",
      contractStatus: row[9] || "",
      contractStartYear: row[10] || "",
      originalPick: row[11] || "",
      franchiseTag: (row[12] || "").toUpperCase() === "Y",
      fifthYearTag: (row[13] || "").toUpperCase() === "Y",
      fifthYearTagAmount: row[14] || "",
    }));
}

// --- Cap Hits ---
// Active cap penalties for players cut with years remaining on their contract.
// Penalty = 50% of remaining contract value.

export async function getCapHits(): Promise<CapHitRow[]> {
  const rows = await fetchSheet("CapHits", "A2:F500");

  return rows
    .filter((row) => row.length >= 3)
    .map((row) => ({
      owner: row[0] || "",
      player: row[1] || "",
      position: row[2] || "",
      penalty: parseFloat((row[3] || "0").replace("$", "")) || 0,
      season: row[4] || "",
      yearsRemaining: parseInt(row[5] || "0", 10) || undefined,
    }));
}
