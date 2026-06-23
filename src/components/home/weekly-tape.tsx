"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerLink } from "@/components/owner-link";
import { OwnerBadgeAvatar } from "@/components/home/owner-badge-avatar";
import { getDivColorsByOwner } from "@/lib/ui-utils";
import type { WeeklyRecap } from "@/lib/weekly-recap";

function SectionTick({ label, accent = "#E8B84B" }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-1 h-5 rounded-sm shrink-0" style={{ background: accent }} />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">{label}</span>
    </div>
  );
}

// One small award chip — an emoji, a label, the owner, and a stat line.
function AwardChip({
  emoji,
  label,
  owner,
  avatarId,
  detail,
}: {
  emoji: string;
  label: string;
  owner: string;
  avatarId?: string;
  detail: string;
}) {
  const dc = getDivColorsByOwner(owner);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
      <span className="text-lg shrink-0" aria-hidden>{emoji}</span>
      <OwnerBadgeAvatar owner={owner} avatarId={avatarId} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <OwnerLink name={owner} className="text-sm font-semibold truncate block hover:underline" style={{ color: dc.text }}>
          {owner}
        </OwnerLink>
      </div>
      <span className="font-code text-xs text-muted-foreground tabular-nums shrink-0">{detail}</span>
    </div>
  );
}

export function WeeklyTape({
  recaps,
  ownerAvatars,
  isPreseason,
  dataSeasonYear,
}: {
  recaps: WeeklyRecap[];
  ownerAvatars: Record<string, string>;
  isPreseason: boolean;
  dataSeasonYear: string;
}) {
  const weeks = recaps.map((r) => r.week);
  const [selected, setSelected] = useState<number>(weeks.length ? weeks[weeks.length - 1] : 0);
  const recap = recaps.find((r) => r.week === selected) ?? recaps[recaps.length - 1];

  if (!recap) {
    return (
      <Card>
        <CardContent className="p-6">
          <SectionTick label="The Weekly Tape" />
          <p className="mt-3 text-sm text-muted-foreground italic">
            No games on tape yet. The recaps roll in once Week 1 is in the books.
          </p>
        </CardContent>
      </Card>
    );
  }

  const motwColors = getDivColorsByOwner(recap.motw.owner);

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Header + week selector */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionTick label="The Weekly Tape" />
          {isPreseason && (
            <Badge variant="warning" className="text-[10px] uppercase tracking-wider">
              showing {dataSeasonYear} recaps
            </Badge>
          )}
        </div>

        {weeks.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {weeks.map((w) => {
              const active = w === selected;
              return (
                <button
                  key={w}
                  onClick={() => setSelected(w)}
                  className={`font-heading rounded-md px-2.5 py-1 text-xs font-bold tracking-wide transition-colors ${
                    active
                      ? "bg-gold text-black"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  W{w}
                </button>
              );
            })}
          </div>
        )}

        {/* Featured writeup */}
        <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <OwnerBadgeAvatar owner={recap.motw.owner} avatarId={ownerAvatars[recap.motw.owner]} size={56} />
              <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-black shadow">
                MOTW
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: motwColors.text }}>
                Week {recap.week} · Manager of the Week
              </p>
              <h3 className="font-heading text-2xl font-black leading-tight mt-0.5">{recap.headline}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{recap.body}</p>
        </div>

        {/* Award chips */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <AwardChip
            emoji="💥"
            label="Beatdown"
            owner={recap.blowout.winner.owner}
            avatarId={ownerAvatars[recap.blowout.winner.owner]}
            detail={`+${recap.blowout.margin.toFixed(1)}`}
          />
          <AwardChip
            emoji="😬"
            label="Nail-biter"
            owner={recap.close.winner.owner}
            avatarId={ownerAvatars[recap.close.winner.owner]}
            detail={`+${recap.close.margin.toFixed(2)}`}
          />
          {recap.unlucky && (
            <AwardChip
              emoji="🍀"
              label="Hard-luck Loser"
              owner={recap.unlucky.owner}
              avatarId={ownerAvatars[recap.unlucky.owner]}
              detail={recap.unlucky.points.toFixed(1)}
            />
          )}
          <AwardChip
            emoji="🚽"
            label="Toilet Bowl"
            owner={recap.toilet.owner}
            avatarId={ownerAvatars[recap.toilet.owner]}
            detail={recap.toilet.points.toFixed(1)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
