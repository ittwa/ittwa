"use client";

import type { KeyDate } from "@/lib/key-dates";

// Fallback only — used when the Dates sheet can't be read (e.g. missing API key
// in a preview build). The live banner is driven by the `events` prop sourced
// from the Google Sheet so edits there show up here.
const FALLBACK_EVENTS: KeyDate[] = [
  { season: "2026", week: -1, date: "2026-04-27T12:00:00", event: "Rookie Draft", note: "" },
  { season: "2026", week: -1, date: "2026-05-14T12:00:00", event: "5th Year Tag Deadline", note: "" },
  { season: "2026", week: -1, date: "2026-06-19T12:00:00", event: "Franchise Tag Deadline", note: "" },
  { season: "2026", week: -1, date: "2026-08-11T12:00:00", event: "Rosters Lock", note: "Pre-auction" },
  { season: "2026", week: 0, date: "2026-08-18T19:00:00", event: "FA Auction", note: "7:00 PM" },
  { season: "2026", week: 10, date: "2026-11-12T12:00:00", event: "Trade Deadline", note: "Wk 10" },
  { season: "2026", week: 15, date: "2026-12-10T12:00:00", event: "Rosters Lock", note: "Wk 15" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Compact label for the small chips — trims the verbose "Deadline" suffix while
// keeping names that would otherwise read ambiguously.
function shortLabel(event: string) {
  if (event === "Trade Deadline") return event;
  return event.replace(/\s+Deadline$/i, "");
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function dateMono(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDays(target: Date, now: Date) {
  const d = daysBetween(now, target);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 14) return `in ${d} days`;
  const weeks = Math.round(d / 7);
  if (weeks < 9) return `in ${weeks} weeks`;
  return `in ${Math.round(d / 30)} months`;
}

function classify(events: KeyDate[], now: Date) {
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const upcoming = sorted.filter((e) => new Date(e.date) >= now);
  const past = sorted.filter((e) => new Date(e.date) < now);
  return { next: upcoming[0] ?? null, others: upcoming.slice(1), past };
}

export function KeyDatesTicker({ events }: { events?: KeyDate[] }) {
  const list = events && events.length > 0 ? events : FALLBACK_EVENTS;
  const now = new Date();
  const { next, others, past } = classify(list, now);

  return (
    <div className="border-b border-border -mx-4 -mt-10 mb-6" style={{ background: "var(--card)" }}>
      <div className="flex items-stretch min-h-[44px] overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
        {/* Leading label */}
        <div className="flex items-center gap-2.5 pr-4 mr-1 border-r border-border shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#FD4A48] shrink-0 animate-pulse" />
          <span className="font-heading text-[11px] font-extrabold tracking-[0.16em] uppercase hidden sm:inline">
            Key Dates
          </span>
        </div>

        {/* Next event — highlighted */}
        {next && (() => {
          const d = new Date(next.date);
          return (
            <div className="flex items-center gap-3 px-4 shrink-0 border-r border-border">
              <div
                className="flex flex-col items-center rounded-md px-2 py-1 leading-none"
                style={{ background: "rgba(253,74,72,0.12)", border: "1px solid rgba(253,74,72,0.30)" }}
              >
                <span className="font-heading text-[9px] font-extrabold tracking-[0.10em] uppercase text-[#ff7775]">
                  {MONTHS[d.getMonth()]}
                </span>
                <span className="font-heading text-[17px] font-black text-[#ff7775] mt-px">
                  {d.getDate()}
                </span>
              </div>
              <span className="font-heading text-[14px] font-extrabold tracking-[0.08em] uppercase whitespace-nowrap">
                {next.event}
              </span>
              {next.note && (
                <span className="font-code text-[11px] text-muted-foreground whitespace-nowrap">· {next.note}</span>
              )}
              <span
                className="font-code text-[11px] font-bold whitespace-nowrap rounded-full px-2.5 py-0.5"
                style={{ background: "rgba(253,74,72,0.12)", color: "#ff7775" }}
              >
                {fmtDays(d, now)}
              </span>
            </div>
          );
        })()}

        {/* Upcoming + past chips */}
        {others.map((e, i) => {
          const d = new Date(e.date);
          return (
            <div key={i} className="inline-flex items-center gap-2 px-3.5 whitespace-nowrap shrink-0 border-r border-dashed border-border last:border-r-0">
              <span className="font-code text-[11px] font-bold" style={{ color: "#9a9aa6" }}>{dateMono(d)}</span>
              <span className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase">{shortLabel(e.event)}</span>
              {e.note && <span className="font-code text-[10px] text-muted-foreground">{e.note}</span>}
            </div>
          );
        })}
        {past.slice(-2).map((e, i) => {
          const d = new Date(e.date);
          return (
            <div key={`past-${i}`} className="inline-flex items-center gap-2 px-3.5 whitespace-nowrap shrink-0 border-r border-dashed border-border last:border-r-0">
              <span className="text-[11px] font-extrabold text-[#4ade80]">✓</span>
              <span className="font-code text-[11px] font-bold text-muted-foreground line-through">{dateMono(d)}</span>
              <span className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-muted-foreground line-through">{shortLabel(e.event)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
