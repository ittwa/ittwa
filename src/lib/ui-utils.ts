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
  if (salary >= 10) return "#EAB308";
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
