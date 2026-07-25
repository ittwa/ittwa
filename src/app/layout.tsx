import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { NavServer } from "@/components/nav-server";
import { DataFreshness } from "@/components/data-freshness";
import "./globals.css";

// Runs before hydration (see next/script beforeInteractive below) so the
// <html> element gets its theme class before first paint — otherwise the
// page always paints .dark first (see hardcoded default removed below) and
// light-theme users see a flash on every load. Kept intentionally tiny since
// it's render-blocking; wrapped in try/catch for Safari private mode, where
// localStorage access throws.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("ittwa-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.classList.add(theme);
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: ["600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  // Base URL used to resolve relative Open Graph / Twitter image paths (e.g. the
  // generated opengraph-image). Prefer the Vercel-provided production URL.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  // `default` is used on the homepage and any route without its own title;
  // `template` wraps a page's own title, so `title: "Standings"` renders as
  // "Standings · ITTWA".
  title: {
    default: "ITTWA",
    template: "%s · ITTWA",
  },
  description:
    "Contract dynasty fantasy football league, founded 2014. 12 teams, too many opinions.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090909" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <NavServer />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
          <footer className="border-t border-border mt-12">
            <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="text-sm text-muted-foreground">
                ITTWA — I Thought This Was America &middot; Est. 2014 &middot; A contract dynasty
                league that tries its best.
              </div>
              <DataFreshness />
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
