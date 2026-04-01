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
  return (
    <h2 id={id} className="text-xl font-bold text-ittwa mt-8 mb-4 scroll-mt-20">
      {title}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground/90 leading-relaxed mb-3">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-foreground/90 leading-relaxed">{children}</li>;
}

export default function ConstitutionPage() {
  const [activeSection, setActiveSection] = useState("membership");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
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
        <h1 className="text-2xl font-bold tracking-tight">Constitution</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The governing document of the ITTWA league. Ratified 2014.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop only */}
        <nav className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-0.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeSection === s.id
                    ? "bg-ittwa/10 text-ittwa font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-6 sm:p-8">

              <SectionHeader id="membership" title="1. Membership" />
              <P>12 owners; $150 annual dues due by FA Auction date; platform is Sleeper.</P>

              <SectionHeader id="ownership" title="2. Ownership" />
              <P>Ownership belongs to the League and cannot be sold. Replacements chosen from Waiting List in order joined; must be voted in by majority with a Sponsor.</P>

              <SectionHeader id="governance" title="3. Governance" />
              <h3 className="text-sm font-semibold text-foreground mb-2">Code of Conduct</h3>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <Li>Act like a Gentleman</Li>
                <Li>No collusion</Li>
                <Li>No rage-drops</Li>
                <Li>Be sensitive to Liam&apos;s many disabilities</Li>
              </ul>
              <h3 className="text-sm font-semibold text-foreground mb-2">Rule Changes</h3>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <Li>Majority (&gt;50%) to pass new rules</Li>
                <Li>&#8532; quorum to overturn existing rules</Li>
              </ul>
              <h3 className="text-sm font-semibold text-foreground mb-2">Owner Removal</h3>
              <P>&#8532; quorum vote required.</P>

              <SectionHeader id="administration" title="4. Administration" />
              <P>Commissioner enforces rules and handles admin but cannot unilaterally create or amend rules. Distributes payouts within 10 days of Week 16 Championship.</P>

              <SectionHeader id="team-management" title="5. Team Management" />
              <h3 className="text-sm font-semibold text-foreground mb-2">Roster</h3>
              <P>22 players: start 1 QB / 2 RB / 3 WR / 1 TE / 1 D/ST / 1 Flex; 13 bench + 4 IR; 2 IR returns per season.</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Salary Cap</h3>
              <P>Maximum $270, floor $220 (at FA Auction only — may exceed during season).</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Years Cap</h3>
              <P>Maximum 60 total years (at FA Auction only).</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Salary Timing</h3>
              <P>Paid in full at FA Auction; post-auction cuts incur no current-season penalty.</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Franchise Tag</h3>
              <P>One expired-contract player per year; must have been on roster at season end. Salary = average of 5 highest at position for prior year OR 120% of prior salary (whichever is greater). 2nd consecutive = 120% of prior tag; 3rd consecutive = 144%. Deadline = 3rd Friday in June.</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Retirement</h3>
              <P>Drop remaining contract for 25% of total remaining value; player returns to FA pool if he comes back.</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Cut Penalty</h3>
              <P>50% of remaining contract value, rounded to one decimal.</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Penalty Schedule</h3>
              <P>Lump sum at season end OR spread over remaining years; owner must choose before next FA Auction.</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Waiver Claim</h3>
              <P>If cut player is claimed same week, no penalty to cutter; claimer assumes the contract.</P>

              <SectionHeader id="rookie-draft" title="6. Rookie Draft" />
              <P>2 rounds; post-NFL Draft, pre-FA Auction; NOT a snake draft (same order both rounds).</P>
              <h3 className="text-sm font-semibold text-foreground mb-2">Pick Order</h3>
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
              <P>Contract value multipliers: 1.0 / 1.4 / 1.7 / 1.9 / 2.0 for 1–5 year contracts. Minimum bid $1M; under $10M may use $0.5M increments.</P>

              <SectionHeader id="divisions" title="8. Divisions" />
              <P>Concussion, Hey Arnold, Replacements, Dark Knight Rises — permanent year-over-year.</P>

              <SectionHeader id="schedule-playoffs" title="9. Schedule & Playoffs" />
              <P>13-game regular season; division rivals twice, all others once.</P>
              <h3 className="text-sm font-semibold text-foreground mb-2">Playoffs</h3>
              <P>4 division winners + 2 wild cards; top 2 seeds get byes; 3 vs 6, 4 vs 5 in wildcard round; re-seeded for semis (#1 plays lowest remaining). 3-point home field advantage; ties go to higher seed.</P>

              <SectionHeader id="trades" title="10. Trades" />
              <P>In-season deadline: Thursday of Week 10 at 12PM EST. Off-season trades reopen after season ends. Players and picks only — no real-life incentives.</P>

              <SectionHeader id="waiver-wire" title="11. Waiver Wire" />
              <P>$100 FAAB per season; minimum bid $0.</P>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <Li>Mon/Sun = Free Agents</Li>
                <Li>Thu/Fri/Sat = Waivers (11AM EST)</Li>
                <Li>Tue/Wed = Locked</Li>
              </ul>
              <P>Players on waivers for 1 day.</P>

              <SectionHeader id="scoring" title="12. Scoring" />

              <h3 className="text-sm font-semibold text-foreground mb-2">Passing</h3>
              <P>+0.04/yd (25 yds = 1 pt), +4 TD, +2 two-pt conversion, -2 INT</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Rushing</h3>
              <P>+0.1/yd, +6 TD, +2 two-pt conversion</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Receiving</h3>
              <P>+0.5 per reception, +0.1/yd, +6 TD, +2 two-pt conversion</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Defense</h3>
              <div className="overflow-x-auto mb-3">
                <table className="text-sm w-full">
                  <tbody>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">TD</td><td>+6</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">Points Allowed</td><td>0→+5; 1-6→+4; 7-13→+3; 14-20→+1; 28-34→-1; 35+→-3</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">Yards Allowed</td><td>&lt;100→+5; 100-199→+3; 200-299→+2; 350-399→-1; 400-449→-3; 450-499→-5; 500-549→-6; 550+→-7</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">Sack</td><td>+1</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">INT</td><td>+2</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">Fumble Recovery</td><td>+2</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1 pr-4 text-muted-foreground">Safety</td><td>+2</td></tr>
                    <tr><td className="py-1 pr-4 text-muted-foreground">Blocked Kick</td><td>+2</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-2">Special Teams</h3>
              <P>TD +6; Fumble Recovery +2; ST Player TD +6</P>

              <h3 className="text-sm font-semibold text-foreground mb-2">Misc</h3>
              <P>Fumble Lost -2; Fumble Recovery TD +6</P>

              <SectionHeader id="amendments" title="13. Amendments" />
              <P>Rule changes passed by &#8532; quorum override the Constitution and are tracked in league records.</P>

              <SectionHeader id="payouts" title="14. Payouts" />
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <tbody>
                    <tr className="border-b border-border/50"><td className="py-2 pr-6 font-medium">1st Place</td><td className="text-ittwa font-bold">$1,250</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2 pr-6 font-medium">2nd Place</td><td>$300</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2 pr-6 font-medium">3rd Place</td><td>$150</td></tr>
                    <tr><td className="py-2 pr-6 font-medium">Regular Season Points Leader</td><td>$100</td></tr>
                  </tbody>
                </table>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
