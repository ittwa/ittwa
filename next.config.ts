import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// ── Content-Security-Policy ──────────────────────────────────────────────────
// Origins are derived from what the app actually loads (verified by grepping the
// codebase), not guessed:
//   • img    sleepercdn.com — owner avatars, player thumbs, NFL team logos
//            www.ittwa.com  — next/image remotePattern host
//            data:          — inline SVG used as a CSS background-image
//   • connect api.sleeper.app, sheets.googleapis.com, api.fantasycalc.com — these
//            are all fetched server-side (Server Components / lib with
//            `next: { revalidate }`), so they bypass browser CSP; they're listed
//            defensively so any future client/RSC streaming to them isn't blocked.
//   • fonts  next/font/google self-hosts the font files at build time (served
//            from /_next, i.e. 'self'); the Google Fonts origins are kept as a
//            harmless belt-and-suspenders in case a fallback is ever requested.
//
// 'unsafe-inline' is required for script-src: the App Router emits inline
// bootstrap/hydration scripts with no nonce, and nonce-based CSP would require
// middleware (out of scope — config-only change). 'unsafe-eval' is intentionally
// omitted. 'unsafe-inline' on style-src covers the app's many inline `style={{…}}`
// attributes plus Next's injected styles.
const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:", "https://sleepercdn.com", "https://www.ittwa.com"],
  "connect-src": [
    "'self'",
    "https://api.sleeper.app",
    "https://sheets.googleapis.com",
    "https://api.fantasycalc.com",
  ],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

if (isDev) {
  // Permit the dev-server HMR websocket so the browser console stays clean while
  // verifying. Not emitted in production.
  cspDirectives["connect-src"].push("ws://localhost:*", "http://localhost:*");
}

const contentSecurityPolicy =
  Object.entries(cspDirectives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ") +
  // Upgrade subresource requests to HTTPS in production only; localhost dev is http.
  (isDev ? "" : "; upgrade-insecure-requests");

// HSTS is intentionally NOT set here — it's already applied correctly upstream.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Stop sending `x-powered-by: Next.js`.
  poweredByHeader: false,
  images: {
    // The Vercel Image Optimization quota is exhausted: every NEW
    // transformation returns 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED and
    // the image breaks (only long-cached variants still serve, which is why
    // breakage appeared gradually as new widths/URLs were requested). All
    // images on this site are tiny Sleeper CDN avatars/thumbs that don't need
    // optimization — serve them as-is, directly from sleepercdn, like the
    // Sleeper app does. Remove this line only if the project moves to a plan
    // with image-optimization headroom.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.ittwa.com",
      },
      {
        protocol: "https",
        hostname: "sleepercdn.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
