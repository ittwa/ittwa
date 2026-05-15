"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import { ALL_OWNERS } from "@/lib/config";

type NavLink = { href: string; label: string };
type NavGroup =
  | { type: "link"; href: string; label: string; muted?: boolean; teamsDropdown?: boolean }
  | { type: "dropdown"; label: string; items: NavLink[] };

const NAV_STRUCTURE: NavGroup[] = [
  { type: "link", href: "/", label: "Home" },
  {
    type: "dropdown", label: "Season", items: [
      { href: "/standings", label: "Standings" },
      { href: "/schedule", label: "Schedule" },
      { href: "/matchups", label: "Matchups" },
      { href: "/power-rankings", label: "Power Rankings" },
    ],
  },
  {
    type: "dropdown", label: "Roster Mgmt", items: [
      { href: "/contracts", label: "Contracts" },
      { href: "/cap-hits", label: "Cap Hits" },
      { href: "/free-agents", label: "Free Agents" },
      { href: "/trades", label: "Trades" },
      { href: "/drafts", label: "Drafts" },
    ],
  },
  {
    type: "dropdown", label: "History", items: [
      { href: "/records", label: "Records" },
      { href: "/rivalry", label: "Rivalry" },
    ],
  },
  { type: "link", href: "/teams", label: "Teams", teamsDropdown: true },
  { type: "link", href: "/constitution", label: "Constitution", muted: true },
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

function ChevronDown() {
  return (
    <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function useHoverDelay(enterMs = 150, leaveMs = 300) {
  const [open, setOpen] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onEnter = useCallback(() => {
    clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => setOpen(true), enterMs);
  }, [enterMs]);
  const onLeave = useCallback(() => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), leaveMs);
  }, [leaveMs]);
  return { open, onEnter, onLeave };
}

function NavDropdownPanel({ items, pathname }: { items: NavLink[]; pathname: string }) {
  return (
    <div className="absolute top-full left-0 pt-1 z-50">
      <div className="w-48 rounded-lg border border-border bg-popover shadow-md p-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-ittwa/10 text-ittwa font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function TeamsDropdownPanel() {
  return (
    <div className="absolute top-full left-0 pt-1 z-50">
      <div className="w-48 rounded-lg border border-border bg-popover shadow-md p-2">
        <Link
          href="/teams"
          className="block px-3 py-2 rounded-md text-sm font-medium text-ittwa hover:bg-accent transition-colors"
        >
          All Teams
        </Link>
        <div className="border-t border-border my-1" />
        {[...ALL_OWNERS].sort((a, b) => a.localeCompare(b)).map((owner) => (
          <Link
            key={owner}
            href={`/teams/${encodeURIComponent(owner)}`}
            className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            {owner}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DesktopDropdownItem({ group, pathname }: { group: Extract<NavGroup, { type: "dropdown" }>; pathname: string }) {
  const { open, onEnter, onLeave } = useHoverDelay();
  const isActive = group.items.some((item) => pathname === item.href);
  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1",
          isActive
            ? "bg-ittwa/10 text-ittwa"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        {group.label}
        <ChevronDown />
      </button>
      {open && <NavDropdownPanel items={group.items} pathname={pathname} />}
    </div>
  );
}

function DesktopTeamsItem({ pathname }: { pathname: string }) {
  const { open, onEnter, onLeave } = useHoverDelay();
  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <Link
        href="/teams"
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1",
          pathname.startsWith("/teams")
            ? "bg-ittwa/10 text-ittwa"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        Teams
        <ChevronDown />
      </Link>
      {open && <TeamsDropdownPanel />}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="ITTWA"
              width={32}
              height={32}
              unoptimized
            />
            <span className="font-bold text-lg hidden sm:inline">ITTWA</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_STRUCTURE.map((group) => {
              if (group.type === "dropdown") {
                return <DesktopDropdownItem key={group.label} group={group} pathname={pathname} />;
              }
              if (group.teamsDropdown) {
                return <DesktopTeamsItem key={group.href} pathname={pathname} />;
              }
              return (
                <Link
                  key={group.href}
                  href={group.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    pathname === group.href
                      ? "bg-ittwa/10 text-ittwa"
                      : group.muted
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {group.label}
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
            <div className="flex flex-col gap-0.5">
              {NAV_STRUCTURE.map((group) => {
                if (group.type === "dropdown") {
                  return (
                    <div key={group.label}>
                      <p className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-2 gap-0.5 pl-2">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                              pathname === item.href
                                ? "bg-ittwa/10 text-ittwa"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <Link
                    key={group.href}
                    href={group.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname === group.href || (group.teamsDropdown && pathname.startsWith("/teams"))
                        ? "bg-ittwa/10 text-ittwa"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {group.label}
                  </Link>
                );
              })}
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
