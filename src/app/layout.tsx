import type { Metadata } from "next";
import { Inter, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { NavServer } from "@/components/nav-server";
import "./globals.css";

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
  title: "ITTWA",
  description:
    "Contract dynasty fantasy football league, founded 2014. 12 teams, too many opinions.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <ThemeProvider>
          <NavServer />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
          <footer className="border-t border-border mt-12">
            <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-muted-foreground">
              ITTWA — I Thought This Was America &middot; Est. 2014 &middot; A contract dynasty
              league that tries its best.
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
