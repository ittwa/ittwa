"use client";

import { OwnerLink } from "@/components/owner-link";
import { PlayerLink } from "@/components/player-link";
import { Tooltip } from "@/components/ui/tooltip";
import { getPositionColors } from "@/lib/ui-utils";
import type { TagEligibility } from "@/types/tags";

function PosBadge({ pos }: { pos: string }) {
  const pc = getPositionColors(pos);
  return (
    <span
      className="text-[10px] font-bold tracking-[0.04em] px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
      style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
    >
      {pos}
    </span>
  );
}

export function TagEligibilitySection({ eligibility }: { eligibility: TagEligibility }) {
  const deadlineDate = new Date(eligibility.deadline);
  const deadlineLabel = deadlineDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const ownersWithEligibility = eligibility.byOwner.filter(
    (o) => o.franchiseEligible.length > 0 || o.fifthYearEligible.length > 0,
  );

  return (
    <div>
      <div className="bg-card border border-border rounded-[10px] p-4 mb-5 flex items-center gap-3 flex-wrap">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(253,74,72,0.1)", border: "1px solid rgba(253,74,72,0.3)" }}
        >
          <span className="text-base">⏰</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold">
            Franchise Tag Deadline: <span style={{ color: "#FD4A48" }}>{deadlineLabel}</span>
          </div>
          <div className="text-[12px] text-muted-foreground">
            For the {eligibility.upcomingOffseasonYear} offseason, based on {eligibility.currentSeason} contracts · third Friday in June
          </div>
        </div>
      </div>

      {ownersWithEligibility.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-1">No players are franchise-tag or 5th-year eligible this offseason.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {ownersWithEligibility.map((o) => (
            <div key={o.owner} className="bg-card border border-border rounded-[10px] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-secondary/50">
                <OwnerLink name={o.owner} className="text-[13px] font-heading font-extrabold tracking-[0.04em] uppercase hover:underline underline-offset-2">
                  {o.owner}
                </OwnerLink>
              </div>
              <div className="p-3 flex flex-col gap-3">
                {o.franchiseEligible.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      Franchise-Tag Eligible
                      {o.franchiseEligible.length > 1 && (
                        <Tooltip content="Each owner may franchise tag only ONE player per offseason — this list shows every player who's eligible, not every player who will be tagged.">
                          <span className="text-[#E8B84B]/80 cursor-help normal-case font-normal">
                            (you may tag only ONE player below)
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {o.franchiseEligible.map((p) => (
                        <div key={p.playerId || p.player} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/60">
                          <PosBadge pos={p.position} />
                          <PlayerLink playerId={p.playerId} className="text-[13px] font-medium flex-1 min-w-0 truncate hover:underline underline-offset-2">
                            {p.player}
                          </PlayerLink>
                          <span className="text-[11px] text-muted-foreground font-mono shrink-0">exp ${p.expiringSalary.toFixed(1)}</span>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
                            style={{ background: "rgba(232,184,75,0.1)", color: "#E8B84B", border: "1px solid rgba(232,184,75,0.3)" }}
                          >
                            {p.projectionLabel}
                          </span>
                          <span className="font-mono text-[13px] font-bold shrink-0" style={{ color: "#FD4A48" }}>
                            ${p.projectedTagSalary.toFixed(1)}
                          </span>
                          {p.incompleteData && (
                            <Tooltip content="Not enough prior-season data to fully verify this projection — treat it as approximate.">
                              <span className="text-[10px] text-muted-foreground cursor-help shrink-0">⚠</span>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {o.fifthYearEligible.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted-foreground mb-1.5">
                      5th-Year Option Decision
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {o.fifthYearEligible.map((p) => (
                        <div key={p.playerId || p.player} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/60">
                          <PosBadge pos={p.position} />
                          <PlayerLink playerId={p.playerId} className="text-[13px] font-medium flex-1 min-w-0 truncate hover:underline underline-offset-2">
                            {p.player}
                          </PlayerLink>
                          <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                            pick {p.pickSlot.overallPick} ({p.pickSlot.season})
                          </span>
                          <span className="font-mono text-[13px] font-bold shrink-0" style={{ color: "#a78bfa" }}>
                            ${p.projectedOptionSalary.toFixed(1)}
                          </span>
                          {p.averagedFewerThanRequired && (
                            <Tooltip content="Fewer players at this position than the rule's required top-N — averaged all available salaries instead.">
                              <span className="text-[10px] text-muted-foreground cursor-help shrink-0">⚠</span>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
