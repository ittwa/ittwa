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
