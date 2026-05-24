import { OWNER_DIVISION } from "./config";

// ── Accent colors ───────────────────────────────────────────────────────────

export const ACCENT = "#FD4A48";
export const ACCENT_DIM = "rgba(253,74,72,0.12)";
export const GOLD = "#E8B84B";
export const WIN_COLOR = "#4ade80";
export const LOSS_COLOR = "#fd7b7a";

// ── Typography ──────────────────────────────────────────────────────────────

export const HEADER_FONT = "'Barlow Condensed', sans-serif";
export const MONO_FONT = "'JetBrains Mono', monospace";

// ── Division colors ─────────────────────────────────────────────────────────

export const DIVISION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  "Concussion":        { text: "#60a5fa", bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.3)" },
  "Hey Arnold":        { text: "#c084fc", bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.3)" },
  "Replacements":      { text: "#4ade80", bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.3)" },
  "Dark Knight Rises": { text: "#fb923c", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.3)" },
};

export const FALLBACK_DIVISION_COLORS = { text: "#999999", bg: "rgba(100,100,100,0.15)", border: "rgba(100,100,100,0.3)" };

export function getDivColors(division: string): { text: string; bg: string; border: string } {
  return DIVISION_COLORS[division] || FALLBACK_DIVISION_COLORS;
}

export function getDivColorsByOwner(owner: string): { text: string; bg: string; border: string } {
  const div = OWNER_DIVISION[owner];
  return div ? getDivColors(div) : FALLBACK_DIVISION_COLORS;
}

// ── Division variants ───────────────────────────────────────────────────────

export function getDivisionVariant(division: string): "concussion" | "hey-arnold" | "replacements" | "dark-knight" | "outline" {
  switch (division) {
    case "Concussion": return "concussion";
    case "Hey Arnold": return "hey-arnold";
    case "Replacements": return "replacements";
    case "Dark Knight Rises": return "dark-knight";
    default: return "outline";
  }
}

export function getPositionVariant(pos: string): "qb" | "rb" | "wr" | "te" | "k" | "secondary" {
  switch (pos) {
    case "QB": return "qb";
    case "RB": return "rb";
    case "WR": return "wr";
    case "TE": return "te";
    case "K": return "k";
    default: return "secondary";
  }
}

export function getSalaryBarColor(salary: number): string {
  if (salary >= 28) return "#EF4444";
  if (salary >= 10) return "#E8B84B";
  return "#52525b";
}

export function getDivisionColor(division: string): string {
  switch (division) {
    case "Concussion": return "#3B82F6";
    case "Hey Arnold": return "#8B5CF6";
    case "Replacements": return "#22C55E";
    case "Dark Knight Rises": return "#F97316";
    default: return "#FD4A48";
  }
}

export function getDivisionColorAlpha(division: string, alpha: number): string {
  const hex = getDivisionColor(division);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getPositionColors(pos: string): { text: string; bg: string; border: string } {
  switch (pos) {
    case "QB": return { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)" };
    case "RB": return { text: "#4ade80", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.25)" };
    case "WR": return { text: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.25)" };
    case "TE": return { text: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.25)" };
    case "K":  return { text: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)" };
    default:   return { text: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
  }
}
