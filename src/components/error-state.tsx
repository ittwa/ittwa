"use client";

import Link from "next/link";

// Shared fallback UI for route error.tsx boundaries. Sleeper (and, less
// often, Google Sheets) is the single point of failure behind nearly every
// page here — this names that plainly instead of showing a generic crash
// screen, and never renders error.message (stripped in prod anyway, and
// could leak internals when it isn't).
export function ErrorState({
  error,
  onRetry,
  title = "This page couldn't load",
}: {
  error: Error & { digest?: string };
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="flex items-center gap-2.5">
        <span className="w-1 h-6 rounded-sm shrink-0 bg-gold" />
        <h2 className="font-heading text-2xl font-black uppercase tracking-widest">{title}</h2>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        One of the league&apos;s data sources (Sleeper or Google Sheets) didn&apos;t respond.
        This is usually temporary — try again in a moment.
      </p>
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={onRetry}
          className="font-heading font-bold uppercase tracking-[0.04em] text-[13px] px-4 py-2 rounded-md cursor-pointer bg-ittwa text-white hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/"
          className="font-heading font-bold uppercase tracking-[0.04em] text-[13px] px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Back home
        </Link>
      </div>
      {error.digest && (
        <p className="font-code text-[11px] text-muted-foreground/60 mt-2">
          Error ref: {error.digest}
        </p>
      )}
    </div>
  );
}
