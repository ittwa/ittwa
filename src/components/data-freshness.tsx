import { getDataFreshness } from "@/lib/data-freshness";

function fmt(ms: number): string {
  // All times across the site render in Eastern; timeZoneName shows EST/EDT.
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

// Footer freshness block: when each upstream data source was last pulled.
// Server component — reads the cached timestamps from getDataFreshness().
export async function DataFreshness() {
  const { sleeperAt, sheetsAt } = await getDataFreshness();
  return (
    <div className="font-code text-[11px] leading-relaxed text-muted-foreground space-y-0.5 sm:text-right">
      <p>
        data via Sleeper API ·{" "}
        <span className="text-emerald-400">● live</span> · updated {fmt(sleeperAt)}
      </p>
      <p>contracts via Google Sheets · synced {fmt(sheetsAt)}</p>
    </div>
  );
}
