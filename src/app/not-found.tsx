import Link from "next/link";

export const metadata = { title: "Not Found" };

// Renders inside RootLayout, same as error.tsx, so nav/footer stay on
// screen — reached both for unmatched routes and for notFound() calls in
// teams/[owner] and players/[playerId].
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="flex items-center gap-2.5">
        <span className="w-1 h-6 rounded-sm shrink-0 bg-gold" />
        <h1 className="font-heading text-2xl font-black uppercase tracking-widest">
          Page not found
        </h1>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        Nothing here — the roster, page, or player you&apos;re looking for doesn&apos;t exist.
      </p>
      <div className="flex items-center gap-3 mt-1">
        <Link
          href="/"
          className="font-heading font-bold uppercase tracking-[0.04em] text-[13px] px-4 py-2 rounded-md bg-ittwa text-white hover:opacity-90 transition-opacity"
        >
          Home
        </Link>
        <Link
          href="/teams"
          className="font-heading font-bold uppercase tracking-[0.04em] text-[13px] px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          All teams
        </Link>
      </div>
    </div>
  );
}
