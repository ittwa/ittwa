"use client";

// Last-resort boundary for failures in the root layout itself (e.g. the
// theme-init script or a layout-level throw) — everything above a normal
// error.tsx, including RootLayout, is gone by the time this renders, so it
// can't rely on ThemeProvider, next/font, or globals.css. Kept dependency-free
// and inline-styled on purpose.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090909",
          color: "#f0f0f0",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 4, height: 24, borderRadius: 2, background: "#E8B84B" }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              ITTWA is down
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "#888888", lineHeight: 1.5 }}>
            Something failed while loading the page shell itself. Try again in a moment.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontSize: 13,
              padding: "10px 18px",
              borderRadius: 6,
              cursor: "pointer",
              background: "#FD4A48",
              color: "#ffffff",
              border: "none",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 11, color: "rgba(136,136,136,0.6)", fontFamily: "monospace" }}>
              Error ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
