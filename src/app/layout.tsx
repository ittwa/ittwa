import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITTWA — I Thought This Was America",
  description:
    "Contract dynasty fantasy football league, founded 2014. 12 teams, too many opinions.",
  icons: {
    icon: "https://www.ittwa.com/badge.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <ThemeProvider>
          <Nav />
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
