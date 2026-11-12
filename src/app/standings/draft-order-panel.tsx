"use client";

import type { ProjectedDraftPick } from "@/lib/standings";
import { ROOKIE_PICK_CONTRACTS } from "@/lib/config";
import { OwnerLink } from "@/components/owner-link";
import { DivisionBadge, OwnerAvatar } from "./standings-ui";

const thCls = "px-4 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground whitespace-nowrap";

export function DraftOrderPanel({
  picks,
  draftSeason,
  seasonStarted,
  pickHolders,
}: {
  picks: ProjectedDraftPick[];
  draftSeason: string;
  seasonStarted: boolean;
  pickHolders: Record<number, string[]>;
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border bg-secondary flex items-baseline justify-between gap-3 flex-wrap">
        <span className="font-heading text-lg font-extrabold tracking-wide">
          Projected {draftSeason} Rookie Draft · Picks 1–{picks.length || 6}
        </span>
        <span className="text-[11px] text-muted-foreground">If the season ended today</span>
      </div>

      {!seasonStarted || picks.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Draft order projection starts once games have been played.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b border-border">
                <th className={`${thCls} text-center w-[64px]`}>Pick</th>
                <th className={`${thCls} text-left`}>Team</th>
                <th className={`${thCls} text-center hidden sm:table-cell`}>Standing</th>
                <th className={`${thCls} text-right`}>Max PF</th>
                <th
                  className={`${thCls} text-right hidden sm:table-cell`}
                  title="Max PF more than the team picking one spot earlier"
                >
                  Margin
                </th>
                <th className={`${thCls} text-right hidden md:table-cell`}>Rookie Deal</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p, i) => {
                const slot = `1.${String(p.pick).padStart(2, "0")}`;
                const contract = ROOKIE_PICK_CONTRACTS[slot];
                const margin = i > 0 ? p.optimalPoints - picks[i - 1].optimalPoints : null;
                // Rounds whose pick has been traded away (same slot every round).
                const traded = (pickHolders[p.rosterId] ?? [])
                  .map((holder, r) => ({ round: r + 1, holder }))
                  .filter((x) => x.holder !== p.displayName);
                return (
                  <tr key={p.rosterId} className="border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <span
                        className="font-heading font-black text-lg"
                        style={{ color: p.pick === 1 ? "#E8B84B" : undefined }}
                      >
                        {slot}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OwnerLink name={p.displayName} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                        <OwnerAvatar name={p.displayName} division={p.division} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-semibold">{p.displayName}</span>
                            <DivisionBadge division={p.division} />
                          </div>
                          {traded.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {traded.map((t) => `Rd ${t.round} → ${t.holder}`).join(" · ")}
                            </div>
                          )}
                        </div>
                      </OwnerLink>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      #{p.rank}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                      {p.optimalPoints.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {margin === null ? "—" : `+${margin.toFixed(1)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {contract ? `$${contract.salary} / ${contract.years}yr` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-border flex items-start gap-2">
        <div className="w-0.5 h-3 bg-ittwa rounded-sm mt-0.5 shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          Picks 1–6 go to non-playoff teams, fewest Max PF (optimal lineup points) first. Record doesn&apos;t matter.
          Same order every round. Picks 7–12 are set by the playoffs: wildcard losers (by Max PF), then the
          3rd-place game, runner-up, and champion.
        </span>
      </div>
    </div>
  );
}
