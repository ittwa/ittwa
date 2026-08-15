"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshLeagueData } from "@/app/actions/refresh-data";

type Status = "idle" | "done" | "error";

// Subtle footer control that force-pulls Sleeper rosters + Google Sheets
// contracts, bypassing the Data Cache revalidate windows. Sits directly under
// the DataFreshness timestamps so "last updated" and "update now" read as one
// unit.
export function RefreshDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>("idle");

  // Let the confirmation fade back to the default label instead of sticking.
  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [status]);

  function handleClick() {
    setStatus("idle");
    startTransition(async () => {
      const res = await refreshLeagueData();
      if (!res.ok) {
        setStatus("error");
        return;
      }
      // Expiring the tags only empties the cache — router.refresh() re-renders
      // the current route so the new data (and the footer timestamps above)
      // appear without the user reloading the page. Awaiting it inside the
      // transition keeps `pending` true until the re-render lands.
      router.refresh();
      setStatus("done");
    });
  }

  const label = pending
    ? "Refreshing…"
    : status === "done"
      ? "Updated"
      : status === "error"
        ? "Refresh failed — try again"
        : "Refresh data";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-live="polite"
      title="Pull the latest Sleeper rosters and Google Sheets contracts now"
      className={`group inline-flex items-center gap-1.5 font-code text-[11px] transition-colors disabled:cursor-wait sm:self-end ${
        status === "error"
          ? "text-red-400"
          : status === "done"
            ? "text-emerald-400"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <svg
        className={`h-3 w-3 ${pending ? "animate-spin" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {label}
    </button>
  );
}
