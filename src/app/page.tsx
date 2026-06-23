import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerLink } from "@/components/owner-link";
import { KeyDatesTicker } from "@/components/key-dates-ticker";
import { OwnerBadgeAvatar } from "@/components/home/owner-badge-avatar";
import { HeroCountdown } from "@/components/home/hero-countdown";
import { WeeklyTape } from "@/components/home/weekly-tape";
import { RivalryDesk } from "@/components/home/rivalry-desk";

import { getHomeData, type HomeData, type LeaderCard } from "@/lib/home-data";
import { AUCTION_DATE } from "@/lib/config";
import { getDivColors } from "@/lib/ui-utils";
import type { StandingsEntry } from "@/lib/standings";
import type { AllPlayRecord } from "@/lib/luck-index";

export const metadata: Metadata = {
  description:
    "The ITTWA front office — weekly recaps, luck index, standings, and all-time rivalries for a contract dynasty league founded in 2014.",
  openGraph: {
    title: "ITTWA — Front Office",
    description:
      "Weekly recaps, the Luck Index, standings and all-time rivalries for the ITTWA contract dynasty league.",
    type: "website",
  },
};

// ── Small shared bits ───────────────────────────────────────────────────────

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">{label}</span>
    </div>
  );
}

// The next milestone the countdown points at: the FA auction in the offseason,
// otherwise the next Thursday-night kickoff.
function nextMilestone(): { iso: string; label: string } {
  const now = Date.now();
  const auction = AUCTION_DATE.getTime();
  if (now < auction) return { iso: AUCTION_DATE.toISOString(), label: "FA Auction" };
  const d = new Date();
  let add = (4 - d.getDay() + 7) % 7; // Thursday = 4
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(20, 20, 0, 0);
  return { iso: d.toISOString(), label: "Next Kickoff" };
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ data }: { data: HomeData }) {
  const seasonCount = parseInt(data.season) - 2013;
  const statusLabel = data.isPreseason
    ? "Preseason"
    : data.lastCompletedWeek > 0
      ? `Week ${data.lastCompletedWeek} complete`
      : data.status.replace(/_/g, " ");
  const milestone = nextMilestone();

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-[60px] h-[60px] rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: "rgba(232,184,75,0.13)", border: "2px solid #E8B84B" }}
          >
            <span className="font-heading font-black text-xl text-gold">IW</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="font-heading text-4xl font-black uppercase tracking-wider leading-none">ITTWA</h1>
              <span className="text-[11px] font-bold tracking-widest px-2 py-0.5 bg-ittwa text-white rounded-sm">
                {data.season}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                · {statusLabel}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {data.leagueName} · Est. 2014 · Season {seasonCount}
            </p>
            <p className="text-[12px] text-muted-foreground/80 mt-0.5">{data.capSummary}</p>
          </div>
        </div>

        <HeroCountdown targetIso={milestone.iso} label={milestone.label} />
      </div>

      {/* Defending champion banner */}
      {data.defendingChampion && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(232,184,75,0.35)", background: "rgba(232,184,75,0.07)" }}
        >
          <span className="text-2xl" aria-hidden>🏆</span>
          <OwnerBadgeAvatar owner={data.defendingChampion.owner} avatarId={data.ownerAvatars[data.defendingChampion.owner]} size={36} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              {data.defendingChampion.year} Champion — Defending the crown
            </p>
            <OwnerLink
              name={data.defendingChampion.owner}
              className="font-heading text-xl font-black leading-tight hover:underline block truncate"
            >
              {data.defendingChampion.owner}
            </OwnerLink>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Leaderboard cards ────────────────────────────────────────────────────────

function LeaderboardCards({ data }: { data: HomeData }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionTick label="Leaderboard" />
        {data.isPreseason && (
          <Badge variant="warning" className="text-[10px] uppercase tracking-wider">
            showing {data.dataSeasonYear} finals
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.leaders.map((leader) => (
          <LeaderCardView key={leader.label} leader={leader} avatarId={data.ownerAvatars[leader.owner]} />
        ))}
      </div>
    </section>
  );
}

function LeaderCardView({ leader, avatarId }: { leader: LeaderCard; avatarId?: string }) {
  const dc = leader.division ? getDivColors(leader.division) : null;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{leader.label}</p>
        <div className="mt-2 flex items-center gap-2.5">
          <OwnerBadgeAvatar owner={leader.owner} avatarId={avatarId} size={32} />
          <div className="min-w-0">
            <OwnerLink
              name={leader.owner}
              className="font-heading text-base font-extrabold leading-tight truncate block hover:underline"
              style={dc ? { color: dc.text } : undefined}
            >
              {leader.owner}
            </OwnerLink>
          </div>
        </div>
        <p className="mt-2 font-code text-xl font-bold tabular-nums">{leader.value}</p>
        <p className="text-[10px] text-muted-foreground">{leader.sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Standings strip (top 6) ─────────────────────────────────────────────────

// Diverging luck bar: center = neutral. Green grows right when lucky, red grows
// left when unlucky. Scaled so ±0.5 (a half-game swing) fills its side.
function LuckBar({ luck }: { luck: number }) {
  const MAX = 0.5;
  const pct = Math.min(Math.abs(luck) / MAX, 1) * 50;
  return (
    <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden" title={`Luck ${luck > 0 ? "+" : ""}${(luck * 100).toFixed(0)}%`}>
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
      {luck >= 0 ? (
        <span className="absolute top-0 h-full rounded-full" style={{ left: "50%", width: `${pct}%`, background: "#4ade80", opacity: 0.85 }} />
      ) : (
        <span className="absolute top-0 h-full rounded-full" style={{ right: "50%", width: `${pct}%`, background: "#fd4a48", opacity: 0.85 }} />
      )}
    </div>
  );
}

function StandingsStrip({
  standings,
  luckByRoster,
  ownerAvatars,
}: {
  standings: StandingsEntry[];
  luckByRoster: Record<number, AllPlayRecord>;
  ownerAvatars: Record<string, string>;
}) {
  const top = standings.slice(0, 6);
  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SectionTick label="Standings" />
          <Link href="/standings" className="text-xs text-gold hover:underline font-semibold">
            Full Standings →
          </Link>
        </div>
        <div className="space-y-2">
          {top.map((entry) => {
            const luck = luckByRoster[entry.rosterId]?.luck ?? 0;
            const dc = getDivColors(entry.division);
            return (
              <div
                key={entry.rosterId}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
              >
                <span
                  className={`font-heading inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                    entry.rank <= 3 ? "bg-ittwa text-white" : "border border-border text-muted-foreground"
                  }`}
                >
                  {entry.rank}
                </span>
                <OwnerBadgeAvatar owner={entry.displayName} avatarId={ownerAvatars[entry.displayName]} size={30} />
                <div className="min-w-0 flex-1">
                  <OwnerLink
                    name={entry.displayName}
                    className="text-sm font-semibold truncate block hover:underline"
                    style={{ color: dc.text }}
                  >
                    {entry.displayName}
                  </OwnerLink>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-code text-[11px] text-muted-foreground tabular-nums">
                      {entry.wins}-{entry.losses}{entry.ties ? `-${entry.ties}` : ""}
                    </span>
                    <LuckBar luck={luck} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-code text-xs font-semibold tabular-nums">{entry.pointsFor.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{entry.pointsAgainst.toFixed(1)} PA</p>
                </div>
              </div>
            );
          })}
          {top.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No standings yet — everyone&apos;s 0-0 in their hearts.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  await connection();
  const data = await getHomeData();

  return (
    <div className="space-y-8">
      <KeyDatesTicker />

      <Hero data={data} />

      <LeaderboardCards data={data} />

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <WeeklyTape
          recaps={data.recaps}
          ownerAvatars={data.ownerAvatars}
          isPreseason={data.isPreseason}
          dataSeasonYear={data.dataSeasonYear}
        />
        <div className="space-y-6">
          <StandingsStrip
            standings={data.standings}
            luckByRoster={data.luckByRoster}
            ownerAvatars={data.ownerAvatars}
          />
          <RivalryDesk owners={data.owners} h2h={data.h2h} ownerAvatars={data.ownerAvatars} />
        </div>
      </div>
    </div>
  );
}
