"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

type NavLink = { href: string; label: string; icon?: string; desc?: string };
type NavGroup =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; panelLabel: string; panelCaption?: string; items: NavLink[] };

const NAV_STRUCTURE: NavGroup[] = [
  { type: "link", href: "/", label: "Home" },
  {
    type: "dropdown", label: "Season", panelLabel: "Season", panelCaption: "2026",
    items: [
      { href: "/standings", label: "Standings", icon: "trophy", desc: "League table & playoff line" },
      { href: "/schedule", label: "Schedule", icon: "calendar", desc: "All 14 weeks + playoffs" },
      { href: "/matchups", label: "Matchups", icon: "swords", desc: "Head-to-head, this week" },
      { href: "/power-rankings", label: "Power Rankings", icon: "bolt", desc: "Weekly tiers & movement" },
    ],
  },
  {
    type: "dropdown", label: "Roster Management", panelLabel: "Roster Management",
    items: [
      { href: "/contracts", label: "Contracts", icon: "doc", desc: "Player deals & extensions" },
      { href: "/cap-hits", label: "Cap Hits", icon: "wallet", desc: "Salary cap, by team" },
      { href: "/free-agents", label: "Free Agents", icon: "search", desc: "Available players" },
      { href: "/trades", label: "Trades", icon: "swap", desc: "Recent deals & history" },
      { href: "/drafts", label: "Drafts", icon: "list", desc: "Rookie & startup drafts" },
    ],
  },
  {
    type: "dropdown", label: "History", panelLabel: "History", panelCaption: "12 seasons",
    items: [
      { href: "/records", label: "Records", icon: "medal", desc: "All-time leaderboards" },
      { href: "/rivalry", label: "Rivalry", icon: "flame", desc: "Head-to-head over time" },
    ],
  },
  {
    type: "dropdown", label: "League", panelLabel: "League", panelCaption: "12 owners",
    items: [
      { href: "/teams", label: "All Teams", icon: "users", desc: "Owner profiles & rosters" },
      { href: "/constitution", label: "Constitution", icon: "scroll", desc: "League bylaws & rules" },
    ],
  },
];

interface MobileNavItem { href: string; label: string; icon: string; desc: string }
interface MobileNavSectionDef { label: string | null; items: MobileNavItem[] }

const MOBILE_NAV_SECTIONS: MobileNavSectionDef[] = [
  { label: null, items: [
    { href: "/", label: "Home", icon: "home", desc: "League dashboard" },
  ]},
  { label: "Season", items: [
    { href: "/standings", label: "Standings", icon: "trophy", desc: "League table" },
    { href: "/schedule", label: "Schedule", icon: "calendar", desc: "Weekly games" },
    { href: "/matchups", label: "Matchups", icon: "swords", desc: "Head-to-head" },
    { href: "/power-rankings", label: "Power Rankings", icon: "bolt", desc: "Weekly tiers" },
  ]},
  { label: "Roster Management", items: [
    { href: "/contracts", label: "Contracts", icon: "doc", desc: "Player deals" },
    { href: "/cap-hits", label: "Cap Hits", icon: "wallet", desc: "Salary cap" },
    { href: "/free-agents", label: "Free Agents", icon: "search", desc: "Available players" },
    { href: "/trades", label: "Trades", icon: "swap", desc: "Deal history" },
    { href: "/drafts", label: "Drafts", icon: "list", desc: "Draft results" },
  ]},
  { label: "History", items: [
    { href: "/records", label: "Records", icon: "medal", desc: "All-time records" },
    { href: "/rivalry", label: "Rivalry", icon: "flame", desc: "Head-to-head history" },
  ]},
  { label: "League", items: [
    { href: "/teams", label: "Teams", icon: "users", desc: "Owner profiles" },
    { href: "/constitution", label: "Constitution", icon: "scroll", desc: "League bylaws" },
  ]},
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

function NavIcon({ name, size = 20, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return <svg {...p}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z" /></svg>;
    case "trophy":
      return <svg {...p}><path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M5 4H3v2a3 3 0 0 0 3 3"/><path d="M19 4h2v2a3 3 0 0 1-3 3"/><path d="M10 14h4v3h-4z"/><path d="M8 20h8"/><path d="M12 17v3"/></svg>;
    case "calendar":
      return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>;
    case "swords":
      return <svg {...p}><path d="M14.5 3.5l6 6-4 4-6-6 4-4z"/><path d="M3 21l5-5"/><path d="M9.5 14.5l-6-6 4-4 6 6"/><path d="M21 21l-5-5"/></svg>;
    case "bolt":
      return <svg {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
    case "doc":
      return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>;
    case "wallet":
      return <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h14v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7v0a2 2 0 0 0 2 2h14"/><circle cx="16" cy="14" r="1.5" fill={color}/></svg>;
    case "search":
      return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "swap":
      return <svg {...p}><path d="M7 3L3 7l4 4"/><path d="M3 7h13a4 4 0 0 1 4 4v0"/><path d="M17 21l4-4-4-4"/><path d="M21 17H8a4 4 0 0 1-4-4v0"/></svg>;
    case "list":
      return <svg {...p}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill={color}/><circle cx="4" cy="12" r="1" fill={color}/><circle cx="4" cy="18" r="1" fill={color}/></svg>;
    case "medal":
      return <svg {...p}><circle cx="12" cy="15" r="6"/><path d="M8 9L5 2h4l3 5"/><path d="M16 9l3-7h-4l-3 5"/><path d="M12 12v6M9 15h6"/></svg>;
    case "flame":
      return <svg {...p}><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 2-3 2-5 1 1 2 2 2 5z"/><path d="M8 14a4 4 0 0 0 8 0c0-2-1-3-2-4-1 1-3 2-3 4-1-1-2-2-3 0z"/></svg>;
    case "users":
      return <svg {...p}><circle cx="9" cy="8" r="3.5"/><path d="M3 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><circle cx="17" cy="9" r="2.5"/><path d="M21 18v-.5a3.5 3.5 0 0 0-3.5-3.5"/></svg>;
    case "scroll":
      return <svg {...p}><path d="M6 3h12a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v0"/><path d="M6 9v9a3 3 0 0 0 6 0v-1h6a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H9"/></svg>;
    case "chevron":
      return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case "football":
      return <svg {...p}><ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-30 12 12)" fill={color} stroke="none"/><path d="M8 12h8M10 10v4M12 9v6M14 10v4" stroke="#0a0a0a" strokeWidth="1.5"/></svg>;
    default:
      return null;
  }
}

function DesktopNavPanel({
  panelLabel, panelCaption, items, pathname, onNavigate,
}: {
  panelLabel: string;
  panelCaption?: string;
  items: NavLink[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div
      className="absolute top-full left-0 z-50 w-[380px] bg-popover border border-border rounded-[14px] overflow-hidden"
      style={{ marginTop: 12, boxShadow: "0 20px 48px rgba(20,16,8,0.14), 0 4px 12px rgba(20,16,8,0.06)" }}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-3.5 rounded-sm bg-[#E8B84B]" />
          <span className="font-heading text-[13px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground">
            {panelLabel}
          </span>
        </div>
        {panelCaption && (
          <span className="text-[11px] text-muted-foreground font-mono">{panelCaption}</span>
        )}
      </div>
      <div className="px-3 pb-3">
        <div className="bg-popover border border-border rounded-xl overflow-hidden">
          {items.map((item, i) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-3.5 no-underline transition-colors hover:bg-accent/50"
                style={{
                  padding: "12px 13px",
                  minHeight: 56,
                  background: active ? "rgba(253,74,72,0.08)" : undefined,
                  borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {item.icon && (
                  <div
                    className="flex items-center justify-center shrink-0 rounded-[9px]"
                    style={{
                      width: 36, height: 36,
                      background: active ? "rgba(253,74,72,0.10)" : "var(--secondary)",
                      border: `1px solid ${active ? "rgba(253,74,72,0.28)" : "var(--border)"}`,
                    }}
                  >
                    <NavIcon name={item.icon} size={17} color={active ? "#FD4A48" : "var(--muted-foreground)"} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm tracking-[-0.005em]",
                    active ? "font-semibold text-ittwa" : "font-medium text-foreground"
                  )}>
                    {item.label}
                  </div>
                  {item.desc && (
                    <div
                      className="text-xs mt-0.5 truncate"
                      style={{ color: active ? "rgba(253,74,72,0.7)" : "var(--muted-foreground)" }}
                    >
                      {item.desc}
                    </div>
                  )}
                </div>
                <NavIcon name="chevron" size={13} color={active ? "#FD4A48" : "var(--muted-foreground)"} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DesktopDropdownItem({
  group, pathname, isOpen, onToggle, onNavigate,
}: {
  group: Extract<NavGroup, { type: "dropdown" }>;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const isActive = group.items.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-sm font-semibold transition-all duration-150 cursor-pointer hover:scale-105",
          isActive
            ? "bg-ittwa/[0.08] text-ittwa"
            : isOpen
              ? "bg-secondary text-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        {group.label}
        <svg
          className={cn("opacity-50 transition-transform duration-100", isOpen && "rotate-180")}
          width={11} height={11} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {isOpen && (
        <DesktopNavPanel
          panelLabel={group.panelLabel}
          panelCaption={group.panelCaption}
          items={group.items}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openPanel && desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPanel]);

  useEffect(() => {
    setOpenPanel(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 mb-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-[72px] items-center justify-between gap-7">
          {/* Logo lockup */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center justify-center rounded-[10px] bg-ittwa"
              style={{ width: 36, height: 36, boxShadow: "0 6px 16px rgba(253,74,72,0.28)" }}
            >
              <NavIcon name="football" size={20} color="#fff" />
            </div>
            <div>
              <div className="font-heading font-extrabold text-[19px] tracking-[0.04em] leading-none">ITTWA</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 tracking-[0.14em] uppercase font-bold">S13 · 2026</div>
            </div>
          </Link>

          {/* Divider */}
          <div className="hidden lg:block w-px self-stretch bg-border mx-1" />

          {/* Desktop nav */}
          <div ref={desktopNavRef} className="hidden lg:flex items-center gap-2 flex-1">
            {NAV_STRUCTURE.map((group) => {
              if (group.type === "dropdown") {
                return (
                  <DesktopDropdownItem
                    key={group.label}
                    group={group}
                    pathname={pathname}
                    isOpen={openPanel === group.label}
                    onToggle={() => setOpenPanel(openPanel === group.label ? null : group.label)}
                    onNavigate={() => setOpenPanel(null)}
                  />
                );
              }
              return (
                <Link
                  key={group.href}
                  href={group.href}
                  className={cn(
                    "px-3.5 py-2 rounded-[10px] text-sm font-semibold transition-all duration-150 hover:scale-105",
                    pathname === group.href
                      ? "bg-ittwa/[0.08] text-ittwa"
                      : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {group.label}
                </Link>
              );
            })}
          </div>

          {/* Right side: theme toggle + mobile hamburger */}
          <div className="flex items-center gap-2.5 shrink-0">
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
          <div className="lg:hidden border-t border-border overflow-y-auto" style={{ maxHeight: "calc(100vh - 56px)" }}>
            {/* Sections as cards */}
            <div className="px-4 pt-3.5 pb-6">
              {MOBILE_NAV_SECTIONS.map((sec, si) => (
                <div key={si} style={{ marginTop: si === 0 ? 0 : 18 }}>
                  {sec.label && (
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <span className="w-[3px] h-[13px] rounded-sm bg-[#E8B84B]" />
                      <span className="font-heading text-[13px] font-extrabold tracking-[0.14em] uppercase" style={{ color: "#a0a0a0" }}>
                        {sec.label}
                      </span>
                    </div>
                  )}
                  <div className="bg-card border border-border rounded-[14px] overflow-hidden">
                    {sec.items.map((item, i) => {
                      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3.5 px-3.5 no-underline"
                          style={{
                            padding: "14px 14px",
                            minHeight: 60,
                            background: active ? "rgba(253,74,72,0.12)" : "transparent",
                            borderBottom: i < sec.items.length - 1 ? "1px solid #2a2a2a" : "none",
                          }}
                        >
                          <div
                            className="flex items-center justify-center shrink-0 rounded-[10px]"
                            style={{
                              width: 38, height: 38,
                              background: active ? "rgba(253,74,72,0.18)" : "var(--secondary)",
                              border: `1px solid ${active ? "rgba(253,74,72,0.4)" : "var(--border)"}`,
                            }}
                          >
                            <NavIcon name={item.icon} size={18} color={active ? "#FD4A48" : "#a0a0a0"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn("text-[15px]", active ? "font-semibold text-ittwa" : "font-medium text-foreground")}>
                              {item.label}
                            </div>
                            <div
                              className="text-xs mt-0.5 truncate"
                              style={{ color: active ? "rgba(253,74,72,0.7)" : "var(--muted-foreground)" }}
                            >
                              {item.desc}
                            </div>
                          </div>
                          <NavIcon name="chevron" size={14} color={active ? "#FD4A48" : "#444"} />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
