import { GOOGLE_SHEETS_ID } from "./config";

// Key league dates — read from the "Dates" tab of the contracts Google Sheet.
// Kept in its own module (rather than lib/sheets.ts, which is a Do-Not-Touch
// file) but mirrors that file's server-side-only API-key approach: GOOGLE_API_KEY
// must NOT be NEXT_PUBLIC_ prefixed so it never reaches the browser.
//
// Dates tab columns: Season | Week | Date | Time | Event | Notes

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export interface KeyDate {
  season: string;
  week: number | null;
  // Local, timezone-naive ISO string ("2026-08-18T19:00:00") so the client's
  // `new Date(...)` reads it in the viewer's local time, matching how the
  // ticker has always rendered.
  date: string;
  event: string;
  note: string;
}

async function fetchDatesRows(): Promise<string[][]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_API_KEY not set — returning empty Dates data");
    return [];
  }

  const url = `${SHEETS_API_BASE}/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent("Dates")}!A2:F?key=${apiKey}`;
  // Dates change rarely; cache in the Data Cache for 10 min like the other tabs.
  const res = await fetch(url, { next: { revalidate: 600 } });

  if (!res.ok) {
    console.error(`Google Sheets API error: ${res.status} for tab "Dates"`);
    return [];
  }

  const data = await res.json();
  return data.values || [];
}

// "8/18/2026" + "7:00:00 PM" → "2026-08-18T19:00:00". Returns null on a bad/empty
// date so callers can skip the row instead of crashing.
function toLocalIso(dateStr: string, timeStr: string): string | null {
  const dm = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dm) return null;
  const [, mo, day, yr] = dm;

  let h = 12;
  let min = 0;
  let sec = 0;
  const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (tm) {
    h = parseInt(tm[1], 10);
    min = parseInt(tm[2], 10);
    sec = tm[3] ? parseInt(tm[3], 10) : 0;
    const ap = (tm[4] || "").toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
  }

  const p = (n: number) => String(n).padStart(2, "0");
  return `${yr}-${p(Number(mo))}-${p(Number(day))}T${p(h)}:${p(min)}:${p(sec)}`;
}

function parseWeek(val: string): number | null {
  const n = parseInt(val.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// All events for a given season, sorted chronologically. Returns [] (not throw)
// on any failure so the homepage banner degrades gracefully.
export async function getKeyDates(season: string): Promise<KeyDate[]> {
  const rows = await fetchDatesRows();

  const out: KeyDate[] = [];
  for (const row of rows) {
    const seasonCol = (row[0] || "").trim();
    const weekCol = (row[1] || "").trim();
    const dateCol = (row[2] || "").trim();
    const timeCol = (row[3] || "").trim();
    const eventCol = (row[4] || "").trim();
    const noteCol = (row[5] || "").trim();

    if (seasonCol !== season) continue;
    if (!eventCol || !dateCol) continue;

    const iso = toLocalIso(dateCol, timeCol);
    if (!iso) continue;

    out.push({ season: seasonCol, week: parseWeek(weekCol), date: iso, event: eventCol, note: noteCol });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
