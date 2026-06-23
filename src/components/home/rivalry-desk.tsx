"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerBadgeAvatar } from "@/components/home/owner-badge-avatar";
import { getSeries, type H2HMatrix } from "@/lib/head-to-head";
import { getDivColorsByOwner, WIN_COLOR, LOSS_COLOR } from "@/lib/ui-utils";

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">{label}</span>
    </div>
  );
}

function TeamSelect({
  value,
  onChange,
  owners,
  exclude,
}: {
  value: string;
  onChange: (v: string) => void;
  owners: string[];
  exclude: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="font-heading w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-bold uppercase tracking-wide text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
    >
      {owners.map((o) => (
        <option key={o} value={o} disabled={o === exclude}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function RivalryDesk({
  owners,
  h2h,
  ownerAvatars,
}: {
  owners: string[];
  h2h: H2HMatrix;
  ownerAvatars: Record<string, string>;
}) {
  const sorted = [...owners].sort();
  const [a, setA] = useState(sorted[0]);
  const [b, setB] = useState(sorted[1] ?? sorted[0]);

  const rec = getSeries(h2h, a, b);
  const total = rec.w + rec.l + rec.t;
  const dcA = getDivColorsByOwner(a);
  const dcB = getDivColorsByOwner(b);

  // Diverging bar: a's share of decisions on the left, b's on the right.
  const aShare = total > 0 ? (rec.w + rec.t * 0.5) / total : 0.5;

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <SectionTick label="Rivalry Desk" />
          <Link href="/rivalry" className="text-xs text-gold hover:underline font-semibold">
            Full Rivalry →
          </Link>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSelect value={a} onChange={setA} owners={sorted} exclude={b} />
          <span className="font-heading text-sm font-bold text-muted-foreground">VS</span>
          <TeamSelect value={b} onChange={setB} owners={sorted} exclude={a} />
        </div>

        {/* Series scoreboard */}
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex flex-col items-center gap-2 min-w-0">
              <OwnerBadgeAvatar owner={a} avatarId={ownerAvatars[a]} size={44} />
              <span className="text-xs font-semibold truncate max-w-full" style={{ color: dcA.text }}>{a}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-heading text-4xl font-black tabular-nums"
                style={{ color: rec.w > rec.l ? WIN_COLOR : "var(--foreground)" }}
              >
                {rec.w}
              </span>
              <span className="font-heading text-lg font-bold text-muted-foreground">–</span>
              <span
                className="font-heading text-4xl font-black tabular-nums"
                style={{ color: rec.l > rec.w ? WIN_COLOR : "var(--foreground)" }}
              >
                {rec.l}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 min-w-0">
              <OwnerBadgeAvatar owner={b} avatarId={ownerAvatars[b]} size={44} />
              <span className="text-xs font-semibold truncate max-w-full" style={{ color: dcB.text }}>{b}</span>
            </div>
          </div>

          {/* Diverging share bar */}
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-border">
            <div style={{ width: `${aShare * 100}%`, background: dcA.text, opacity: 0.85 }} />
            <div style={{ width: `${(1 - aShare) * 100}%`, background: dcB.text, opacity: 0.85 }} />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {total === 0 ? (
              <>These two have never met in the regular season or playoffs.</>
            ) : (
              <>
                {total} all-time meeting{total === 1 ? "" : "s"}
                {rec.t > 0 ? ` · ${rec.t} tie${rec.t === 1 ? "" : "s"}` : ""} ·{" "}
                <span style={{ color: rec.w === rec.l ? LOSS_COLOR : rec.w > rec.l ? dcA.text : dcB.text }}>
                  {rec.w === rec.l ? "dead even" : `${rec.w > rec.l ? a : b} leads`}
                </span>
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
