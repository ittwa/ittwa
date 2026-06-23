import { ImageResponse } from "next/og";
import { getHomeData } from "@/lib/home-data";

export const alt = "ITTWA — Front Office";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Renders a championship + standings snapshot for link previews. Falls back to a
// branded card if the data fetch fails (e.g. Sleeper unreachable at build time).
export default async function OpengraphImage() {
  let season = "";
  let champion: string | null = null;
  let championYear = "";
  let top: { rank: number; name: string; record: string; pf: string }[] = [];

  try {
    const data = await getHomeData();
    season = data.season;
    champion = data.defendingChampion?.owner ?? null;
    championYear = data.defendingChampion?.year ?? "";
    top = data.standings.slice(0, 5).map((s) => ({
      rank: s.rank,
      name: s.displayName,
      record: `${s.wins}-${s.losses}`,
      pf: s.pointsFor.toFixed(0),
    }));
  } catch {
    // fall through to branded fallback
  }

  const GOLD = "#e8b84b";
  const ITTWA = "#fd4a48";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#090909",
          color: "#f0f0f0",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(232,184,75,0.13)",
              border: `3px solid ${GOLD}`,
              color: GOLD,
              fontSize: 44,
              fontWeight: 900,
            }}
          >
            IW
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: 4, lineHeight: 1 }}>ITTWA</div>
            <div style={{ fontSize: 26, color: "#888", marginTop: 8 }}>
              {`Contract Dynasty League · Est. 2014${season ? ` · ${season}` : ""}`}
            </div>
          </div>
        </div>

        {/* Defending champion */}
        {champion && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 40,
              padding: "16px 24px",
              borderRadius: 14,
              background: "rgba(232,184,75,0.08)",
              border: `2px solid rgba(232,184,75,0.4)`,
            }}
          >
            <div style={{ fontSize: 40 }}>🏆</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 20, color: GOLD, fontWeight: 700, letterSpacing: 2 }}>
                {`${championYear} CHAMPION`}
              </div>
              <div style={{ fontSize: 40, fontWeight: 800 }}>{champion}</div>
            </div>
          </div>
        )}

        {/* Standings snapshot */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 10 }}>
          {top.map((t) => (
            <div key={t.rank} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: t.rank <= 3 ? ITTWA : "#1f1f1f",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 24,
                }}
              >
                {t.rank}
              </div>
              <div style={{ flex: 1, fontWeight: 700 }}>{t.name}</div>
              <div style={{ color: "#888", width: 120 }}>{t.record}</div>
              <div style={{ color: GOLD, width: 120, textAlign: "right", fontWeight: 700 }}>{`${t.pf} PF`}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", fontSize: 24, color: "#666" }}>
          I Thought This Was America
        </div>
      </div>
    ),
    { ...size },
  );
}
