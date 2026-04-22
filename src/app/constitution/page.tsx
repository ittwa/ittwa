"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  { id: "membership", title: "1. Membership" },
  { id: "ownership", title: "2. Ownership" },
  { id: "governance", title: "3. Governance" },
  { id: "administration", title: "4. Administration" },
  { id: "team-management", title: "5. Team Management" },
  { id: "rookie-draft", title: "6. Rookie Draft" },
  { id: "free-agency", title: "7. Free Agency" },
  { id: "divisions", title: "8. Divisions" },
  { id: "schedule-playoffs", title: "9. Schedule & Playoffs" },
  { id: "trades", title: "10. Trades" },
  { id: "waiver-wire", title: "11. Waiver Wire" },
  { id: "scoring", title: "12. Scoring" },
  { id: "amendments", title: "13. Amendments" },
  { id: "payouts", title: "14. Payouts" },
];

function SectionHeader({ id, title }: { id: string; title: string }) {
  const [num, ...rest] = title.split(". ");
  const paddedNum = num.padStart(2, "0");
  const sectionTitle = rest.join(". ");
  return (
    <div id={id} className="mt-10 mb-4 scroll-mt-20">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-heading text-2xl font-black text-gold tabular-nums">{paddedNum}</span>
        <span className="font-heading text-2xl font-black uppercase tracking-wide">{sectionTitle}</span>
      </div>
      <div className="h-px bg-border" />
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2 mt-5 text-muted-foreground">
      <span className="shrink-0 rounded-sm bg-gold" style={{ width: "3px", height: "14px" }} />
      {children}
    </h3>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 mb-3"
      style={{
        background: "rgba(232,184,75,0.06)",
        border: "1px solid rgba(232,184,75,0.2)",
        borderLeft: "3px solid #E8B84B",
      }}
    >
      {children}
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-heading text-xl font-black text-gold">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function ScoreChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5">
      <span className="font-heading font-bold text-sm tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground/90 leading-relaxed mb-3">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-foreground/90 leading-relaxed">{children}</li>;
}

const DIVISION_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Concussion: { color: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" },
  "Hey Arnold": { color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)" },
  Replacements: { color: "#22C55E", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)" },
  "Dark Knight Rises": { color: "#F97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)" },
};

const DIVISION_MEMBERS: Record<string, string[]> = {
  Concussion: ["Clancy", "Collins", "Katz"],
  "Hey Arnold": ["Chapman", "Albarran", "Durkin"],
  Replacements: ["Peterson", "Cummings", "Bohne"],
  "Dark Knight Rises": ["HoganLamb", "Brown", "Williams"],
};

const WAIVER_DAYS: { day: string; status: string; color: string; bg: string }[] = [
  { day: "Mon", status: "Free Agent", color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
  { day: "Tue", status: "Locked", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  { day: "Wed", status: "Locked", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  { day: "Thu", status: "Waivers", color: "#E8B84B", bg: "rgba(232,184,75,0.1)" },
  { day: "Fri", status: "Waivers", color: "#E8B84B", bg: "rgba(232,184,75,0.1)" },
  { day: "Sat", status: "Waivers", color: "#E8B84B", bg: "rgba(232,184,75,0.1)" },
  { day: "Sun", status: "Free Agent", color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
];

export default function ConstitutionPage() {
  const [activeSection, setActiveSection] = useState("membership");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">Constitution</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The governing document of the ITTWA league. Ratified 2014.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop only */}
        <nav className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-20 space-y-0.5">
            {SECTIONS.map((s) => {
              const numStr = s.title.split(".")[0].padStart(2, "0");
              const titleStr = s.title.split(". ").slice(1).join(". ");
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-md border-l-2 transition-colors ${
                    activeSection === s.id
                      ? "border-gold text-white font-medium bg-gold/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="font-mono tabular-nums text-xs text-gold shrink-0">{numStr}</span>
                  {titleStr}
                </a>
              );
            })}
            <div className="pt-4 px-3">
              <p className="text-xs text-muted-foreground/50">Ratified 2014</p>
            </div>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-6 sm:p-8">

              <SectionHeader id="membership" title="1. Membership" />
              <InfoBox>
                <div className="flex items-center justify-around gap-4">
                  <InfoStat label="Owners" value="12" />
                  <InfoStat label="Annual Dues" value="$150" />
                  <InfoStat label="Platform" value="Sleeper" />
                </div>
              </InfoBox>
              <P>12 owners; $150 annual dues due by FA Auction date; platform is Sleeper.</P>

              <SectionHeader id="ownership" title="2. Ownership" />
              <P>Ownership belongs to the League and cannot be sold. Replacements chosen from Waiting List in order joined; must be voted in by majority with a Sponsor.</P>

              <SectionHeader id="governance" title="3. Governance" />
              <SubHeader>Code of Conduct</SubHeader>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <Li>Act like a Gentleman</Li>
                <Li>No collusion</Li>
                <Li>No rage-drops</Li>
                <Li>Be sensitive to Liam&apos;s many disabilities</Li>
              </ul>
              <SubHeader>Rule Changes</SubHeader>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <Li>Majority (&gt;50%) to pass new rules</Li>
                <Li>&#8532; quorum to overturn existing rules</Li>
              </ul>
              <SubHeader>Owner Removal</SubHeader>
              <P>&#8532; quorum vote required.</P>

              <SectionHeader id="administration" title="4. Administration" />
              <P>Commissioner enforces rules and handles admin but cannot unilaterally create or amend rules. Distributes payouts within 10 days of Week 16 Championship.</P>

              <SectionHeader id="team-management" title="5. Team Management" />
              <SubHeader>Roster</SubHeader>
              <InfoBox>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { pos: "QB", count: "1" },
                    { pos: "RB", count: "2" },
                    { pos: "WR", count: "3" },
                    { pos: "TE", count: "1" },
                    { pos: "D/ST", count: "1" },
                  ].map((s) => (
                    <div key={s.pos}>
                      <p className="font-heading text-lg font-black text-gold">{s.count}</p>
                      <p className="text-xs text-muted-foreground">{s.pos}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">+ 1 Flex · 13 Bench · 4 IR</p>
              </InfoBox>
              <P>22 players: start 1 QB / 2 RB / 3 WR / 1 TE / 1 D/ST / 1 Flex; 13 bench + 4 IR; 2 IR returns per season.</P>

              <SubHeader>Salary Cap</SubHeader>
              <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 mb-3">
                <span className="text-sm font-medium">Salary Cap</span>
                <span className="font-heading text-2xl font-black text-gold">$270</span>
              </div>
              <P>Floor $220 (at FA Auction only — may exceed during season).</P>

              <SubHeader>Years Cap</SubHeader>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3 mb-3">
                <span className="text-sm font-medium">Years Cap</span>
                <span className="font-heading text-2xl font-black">60</span>
              </div>
              <P>At FA Auction only.</P>

              <SubHeader>Salary Timing</SubHeader>
              <P>Paid in full at FA Auction; post-auction cuts incur no current-season penalty.</P>

              <SubHeader>Franchise Tag</SubHeader>
              <P>One expired-contract player per year; must have been on roster at season end. Salary = average of 5 highest at position for prior year OR 120% of prior salary (whichever is greater). 2nd consecutive = 120% of prior tag; 3rd consecutive = 144%. Deadline = 3rd Friday in June.</P>

              <SubHeader>Retirement</SubHeader>
              <P>Drop remaining contract for 25% of total remaining value; player returns to FA pool if he comes back.</P>

              <SubHeader>Cut Penalty</SubHeader>
              <P>50% of remaining contract value, rounded to one decimal.</P>

              <SubHeader>Penalty Schedule</SubHeader>
              <P>Lump sum at season end OR spread over remaining years; owner must choose before next FA Auction.</P>

              <SubHeader>Waiver Claim</SubHeader>
              <P>If cut player is claimed same week, no penalty to cutter; claimer assumes the contract.</P>

              <SectionHeader id="rookie-draft" title="6. Rookie Draft" />
              <P>2 rounds; post-NFL Draft, pre-FA Auction; NOT a snake draft (same order both rounds).</P>
              <SubHeader>Pick Order</SubHeader>
              <ol className="list-decimal list-inside space-y-1 mb-3">
                <Li>Picks 1–6: non-playoff teams in reverse optimal points order (fewest first)</Li>
                <Li>Picks 7–8: wildcard losers in reverse optimal points order</Li>
                <Li>Pick 9: 3rd place consolation loser</Li>
                <Li>Pick 10: 3rd place consolation winner</Li>
                <Li>Pick 11: runner-up</Li>
                <Li>Pick 12: champion</Li>
              </ol>
              <P>Each owner has 12 hours per pick. See pick contract values on the Drafts page.</P>

              <SectionHeader id="free-agency" title="7. Free Agency" />
              <P>Expired contract players are Free Agents. All rostered players at season end are Restricted Free Agents (RFAs) — previous owner may match any auction offer. Bids include salary + years.</P>
              <SubHeader>Contract Value Multipliers</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { yrs: "1yr", mult: "1.0×" },
                  { yrs: "2yr", mult: "1.4×" },
                  { yrs: "3yr", mult: "1.7×" },
                  { yrs: "4yr", mult: "1.9×" },
                  { yrs: "5yr", mult: "2.0×" },
                ].map((m) => (
                  <div
                    key={m.yrs}
                    className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-center"
                  >
                    <p className="font-heading text-lg font-black text-gold">{m.mult}</p>
                    <p className="text-xs text-muted-foreground">{m.yrs}</p>
                  </div>
                ))}
              </div>
              <P>Minimum bid $1M; under $10M may use $0.5M increments.</P>

              <SectionHeader id="divisions" title="8. Divisions" />
              <P>Permanent year-over-year divisions:</P>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {Object.entries(DIVISION_STYLES).map(([name, style]) => (
                  <div
                    key={name}
                    className="rounded-lg border px-4 py-3"
                    style={{ backgroundColor: style.bg, borderColor: style.border, borderLeft: `3px solid ${style.color}` }}
                  >
                    <p className="font-heading font-bold uppercase tracking-wide text-sm mb-2" style={{ color: style.color }}>
                      {name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {DIVISION_MEMBERS[name]?.map((m) => (
                        <span key={m} className="text-xs text-foreground/80 bg-background/30 rounded px-1.5 py-0.5">{m}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <SectionHeader id="schedule-playoffs" title="9. Schedule & Playoffs" />
              <InfoBox>
                <div className="flex items-center justify-around gap-4">
                  <InfoStat label="Games" value="13" />
                  <InfoStat label="Div Winners" value="4" />
                  <InfoStat label="Wild Cards" value="2" />
                  <InfoStat label="HFA Pts" value="3" />
                </div>
              </InfoBox>
              <P>13-game regular season; division rivals twice, all others once.</P>
              <SubHeader>Playoffs</SubHeader>
              <P>4 division winners + 2 wild cards; top 2 seeds get byes; 3 vs 6, 4 vs 5 in wildcard round; re-seeded for semis (#1 plays lowest remaining). 3-point home field advantage; ties go to higher seed.</P>

              <SectionHeader id="trades" title="10. Trades" />
              <P>In-season deadline: Thursday of Week 10 at 12PM EST. Off-season trades reopen after season ends. Players and picks only — no real-life incentives.</P>

              <SectionHeader id="waiver-wire" title="11. Waiver Wire" />
              <InfoBox>
                <div className="flex items-center justify-around gap-4">
                  <InfoStat label="FAAB Budget" value="$100" />
                  <InfoStat label="Min Bid" value="$0" />
                  <InfoStat label="Waiver Period" value="1 day" />
                </div>
              </InfoBox>
              <SubHeader>Weekly Schedule</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                {WAIVER_DAYS.map((d) => (
                  <div
                    key={d.day}
                    className="rounded-md border px-3 py-1.5 text-center"
                    style={{ borderColor: d.color + "40", backgroundColor: d.bg }}
                  >
                    <p className="text-xs font-bold" style={{ color: d.color }}>{d.day}</p>
                    <p className="text-[10px] text-muted-foreground">{d.status}</p>
                  </div>
                ))}
              </div>
              <P>Players on waivers for 1 day. Waiver claims process at 11AM EST.</P>

              <SectionHeader id="scoring" title="12. Scoring" />
              <SubHeader>Passing</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreChip value="+0.04" label="/yd" />
                <ScoreChip value="+4" label="TD" />
                <ScoreChip value="+2" label="2pt" />
                <ScoreChip value="-2" label="INT" />
              </div>

              <SubHeader>Rushing</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreChip value="+0.1" label="/yd" />
                <ScoreChip value="+6" label="TD" />
                <ScoreChip value="+2" label="2pt" />
              </div>

              <SubHeader>Receiving</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreChip value="+0.5" label="PPR" />
                <ScoreChip value="+0.1" label="/yd" />
                <ScoreChip value="+6" label="TD" />
                <ScoreChip value="+2" label="2pt" />
              </div>

              <SubHeader>Defense</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreChip value="+6" label="TD" />
                <ScoreChip value="+1" label="Sack" />
                <ScoreChip value="+2" label="INT" />
                <ScoreChip value="+2" label="Fum Rec" />
                <ScoreChip value="+2" label="Safety" />
                <ScoreChip value="+2" label="Blk Kick" />
              </div>
              <div className="overflow-x-auto mb-3">
                <table className="text-sm w-full">
                  <tbody>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">Points Allowed</td><td className="text-xs">0→+5; 1-6→+4; 7-13→+3; 14-20→+1; 28-34→-1; 35+→-3</td></tr>
                    <tr><td className="py-1 pr-4 text-muted-foreground">Yards Allowed</td><td className="text-xs">&lt;100→+5; 100-199→+3; 200-299→+2; 350-399→-1; 400-449→-3; 450-499→-5; 500-549→-6; 550+→-7</td></tr>
                  </tbody>
                </table>
              </div>

              <SubHeader>Special Teams</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreChip value="+6" label="TD" />
                <ScoreChip value="+2" label="Fum Rec" />
                <ScoreChip value="+6" label="Player TD" />
              </div>

              <SubHeader>Misc</SubHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <ScoreChip value="-2" label="Fum Lost" />
                <ScoreChip value="+6" label="Fum Rec TD" />
              </div>

              <SectionHeader id="amendments" title="13. Amendments" />
              <P>Rule changes passed by &#8532; quorum override the Constitution and are tracked in league records.</P>

              <SectionHeader id="payouts" title="14. Payouts" />
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border px-5 py-4" style={{ borderColor: "rgba(232,184,75,0.3)", background: "rgba(232,184,75,0.06)" }}>
                  <span className="font-medium">1st Place</span>
                  <span className="font-heading text-4xl font-black text-gold">$1,250</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-5 py-3">
                  <span className="font-medium">2nd Place</span>
                  <span className="font-heading text-2xl font-bold">$300</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-5 py-3">
                  <span className="font-medium">3rd Place</span>
                  <span className="font-heading text-2xl font-bold">$150</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-5 py-3">
                  <span className="font-medium">Regular Season Points Leader</span>
                  <span className="font-heading text-2xl font-bold">$100</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
