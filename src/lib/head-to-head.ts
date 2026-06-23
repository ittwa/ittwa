// ── Head-to-head series matrix ──────────────────────────────────────────────
//
// Builds an all-time { "a|b": {w,l,t} } matrix from a flat list of historical
// matchups. The record stored under key(a, b) is ALWAYS from a's perspective
// (a's wins over b), so getSeries(matrix, a, b) and getSeries(matrix, b, a) are
// mirror images. Kept as a pure function so the Rivalry Desk can be tested and
// so the matrix can be computed server-side and handed to the client cheaply.

export interface H2HRecord {
  w: number;
  l: number;
  t: number;
}

export type H2HMatrix = Record<string, H2HRecord>;

export interface H2HGame {
  ownerA: string;
  ownerB: string;
  scoreA: number;
  scoreB: number;
}

export function h2hKey(a: string, b: string): string {
  return `${a}|${b}`;
}

export function buildHeadToHeadMatrix(games: H2HGame[]): H2HMatrix {
  const matrix: H2HMatrix = {};
  const bump = (a: string, b: string, result: "w" | "l" | "t") => {
    const k = h2hKey(a, b);
    const rec = (matrix[k] ??= { w: 0, l: 0, t: 0 });
    rec[result]++;
  };

  for (const g of games) {
    if (!g.ownerA || !g.ownerB || g.ownerA === g.ownerB) continue;
    if (g.scoreA <= 0 && g.scoreB <= 0) continue; // unplayed
    if (g.scoreA > g.scoreB) {
      bump(g.ownerA, g.ownerB, "w");
      bump(g.ownerB, g.ownerA, "l");
    } else if (g.scoreB > g.scoreA) {
      bump(g.ownerA, g.ownerB, "l");
      bump(g.ownerB, g.ownerA, "w");
    } else {
      bump(g.ownerA, g.ownerB, "t");
      bump(g.ownerB, g.ownerA, "t");
    }
  }

  return matrix;
}

export function getSeries(matrix: H2HMatrix, a: string, b: string): H2HRecord {
  return matrix[h2hKey(a, b)] ?? { w: 0, l: 0, t: 0 };
}
