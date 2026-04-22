"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import { ALL_OWNERS } from "@/lib/config";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/teams", label: "Teams", hasDropdown: true },
  { href: "/schedule", label: "Schedule" },
  { href: "/matchups", label: "Matchups" },
  { href: "/contracts", label: "Contracts" },
  { href: "/trades", label: "Trades" },
  { href: "/drafts", label: "Drafts" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/records", label: "Records" },
  { href: "/rivalry", label: "Rivalry" },
  { href: "/constitution", label: "Constitution" },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function TeamsDropdown() {
  return (
    <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border border-border bg-popover shadow-lg py-1 z-50">
      <Link
        href="/teams"
        className="block px-3 py-1.5 text-sm font-medium text-ittwa hover:bg-accent transition-colors"
      >
        All Teams
      </Link>
      <div className="border-t border-border my-1" />
      {[...ALL_OWNERS].sort((a, b) => a.localeCompare(b)).map((owner) => (
        <Link
          key={owner}
          href={`/teams/${encodeURIComponent(owner)}`}
          className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {owner}
        </Link>
      ))}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [teamsHover, setTeamsHover] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="https://www.ittwa.com/badge.png"
              alt="ITTWA"
              width={32}
              height={32}
              className="rounded"
              unoptimized
            />
            <span className="font-bold text-lg hidden sm:inline">ITTWA</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              if (item.hasDropdown) {
                return (
                  <div
                    key={item.href}
                    className="relative"
                    onMouseEnter={() => setTeamsHover(true)}
                    onMouseLeave={() => setTeamsHover(false)}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1",
                        pathname.startsWith("/teams")
                          ? "bg-ittwa/10 text-ittwa"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {item.label}
                      <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </Link>
                    {teamsHover && <TeamsDropdown />}
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-ittwa/10 text-ittwa"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right side: theme toggle + mobile hamburger */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden pb-4 border-t border-border pt-2">
            <div className="grid grid-cols-2 gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href || (item.hasDropdown && pathname.startsWith("/teams"))
                      ? "bg-ittwa/10 text-ittwa"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            {/* Mobile team links */}
            {pathname.startsWith("/teams") && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="px-3 py-1 text-xs text-muted-foreground uppercase tracking-wider">Teams</p>
                <div className="grid grid-cols-2 gap-1">
                  {[...ALL_OWNERS].sort((a, b) => a.localeCompare(b)).map((owner) => (
                    <Link
                      key={owner}
                      href={`/teams/${encodeURIComponent(owner)}`}
                      onClick={() => setMobileOpen(false)}
                      className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      {owner}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
