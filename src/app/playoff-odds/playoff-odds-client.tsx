"use client";

import { useMemo, useState } from "react";
import {
  ODDS_OUTCOMES,
  ODDS_LABELS,
  MODEL_WEEKS,
  getModelOdds,
  oddsForRecord,
  formatPct,
  type Odds,
  type OddsOutcome,
  type HistoryTable,
} from "@/lib/playoff-odds";
import { MODEL_PARAMS, SOURCE_ODDS, SOURCE_WEEK } from "@/lib/playoff-odds-model";
import { getDivisionColor, getDivisionColorAlpha, GOLD, ACCENT } from "@/lib/ui-utils";
import { OwnerAvatarsProvider, SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { OwnerLink } from "@/components/owner-link";
import { SectionLabel } from "@/components/section-label";

export interface OddsTeam {
  rosterId: number;
  displayName: string;
  division: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
}

interface Props {
  teams: OddsTeam[];
  history: HistoryTable;
  season: string;
  ownerAvatars: Record<string, string>;
}

const FIRST_WEEK = MODEL_WEEKS[0];
const LAST_WEEK = MODEL_WEEKS[MODEL_WEEKS.length - 1];

const thCls =
  "px-3 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground whitespace-nowrap";

// Semis and Final are the least-asked columns; drop them on small screens.
function hideCls(k: OddsOutcome): string {
  return k === "semis" || k === "final" ? "hidden md:table-cell" : "";
}

// Heat fill for a percentage: transparent at 0%, solid-ish green at 100%.
function heat(pct: number, max = 100): string {
  const a = Math.min(pct / max, 1);
  return a <= 0 ? "transparent" : `rgba(74,222,128,${(0.06 + a * 0.42).toFixed(3)})`;
}

function OwnerAvatar({ name, division, size = 26 }: { name: string; division: string; size?: number }) {
  const avatarId = useOwnerAvatar(name);
  return (
    <div
      className="rounded-md shrink-0 flex items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        background: getDivisionColorAlpha(division, 0.1),
        border: `1px solid ${getDivisionColorAlpha(division, 0.25)}`,
      }}
      title={name}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={
          <span className="font-heading font-extrabold text-[10px]" style={{ color: getDivisionColor(division) }}>
            {name.slice(0, 2).toUpperCase()}
          </span>
        }
      />
    </div>
  );
}

function RecordText({ wins, losses, ties = 0 }: { wins: number; losses: number; ties?: number }) {
  return (
    <span className="font-code text-[13px] font-bold whitespace-nowrap">
      <span className="text-emerald-400">{wins}</span>
      <span className="text-muted-foreground">–</span>
      <span className="text-red-400">{losses}</span>
      {ties > 0 && (
        <>
          <span className="text-muted-foreground">–</span>
          <span>{ties}</span>
        </>
      )}
    </span>
  );
}

/** A percentage with a thin bar under it. `sub` renders a small second line. */
function OddsCell({
  pct,
  sub,
  strong,
  className = "",
}: {
  pct: number;
  sub?: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 text-right align-middle ${className}`}>
      <div className={`font-code text-[12px] ${strong ? "font-bold" : "font-semibold"}`}>{formatPct(pct)}</div>
      <div className="h-[3px] mt-1 rounded-sm bg-border/60 ml-auto w-full max-w-[72px] overflow-hidden">
        <div className="h-full rounded-sm bg-emerald-400" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {sub}
    </td>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer border"
      style={{
        background: active ? "rgba(253,74,72,0.12)" : "transparent",
        color: active ? ACCENT : undefined,
        borderColor: active ? "rgba(253,74,72,0.3)" : "var(--border)",
      }}
    >
      {children}
    </button>
  );
}

export function PlayoffOddsClient({ teams, history, season, ownerAvatars }: Props) {
  // Games played so far (a team's W+L+T). Teams can be a game apart mid-week,
  // so use the most common count.
  const gamesPlayed = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of teams) {
      const g = t.wins + t.losses + t.ties;
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    let best = 0;
    let bestN = -1;
    for (const [g, n] of counts) if (n > bestN || (n === bestN && g > best)) [best, bestN] = [g, n];
    return best;
  }, [teams]);
  const inSeason = gamesPlayed >= FIRST_WEEK && gamesPlayed <= LAST_WEEK;

  const [week, setWeek] = useState(inSeason ? gamesPlayed : SOURCE_WEEK);
  const [mapOutcome, setMapOutcome] = useState<OddsOutcome>("playoffs");

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
      <div>
        {/* Page header */}
        <div className="pb-6 border-b border-border mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-1 h-7 rounded-sm" style={{ background: GOLD }} />
                <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Playoff Odds</h1>
              </div>
              <p className="text-[13px] text-muted-foreground ml-4 max-w-2xl">
                How often a team with your record makes the playoffs, earns a bye, and wins it all, after every
                week of the regular season. Record only: it doesn&apos;t know your roster or your schedule.
              </p>
            </div>
            <div
              className="px-3 py-1.5 rounded-md text-[11px] font-bold"
              style={{ background: "rgba(232,184,75,0.12)", color: GOLD, border: "1px solid rgba(232,184,75,0.3)" }}
            >
              {season} · {gamesPlayed > 0 ? `Through week ${gamesPlayed}` : "Preseason"}
            </div>
          </div>
        </div>
        {/* Where every ITTWA team stands right now */}
        <section className="mb-8">
          <SectionLabel
            label="Where ITTWA Stands"
            count={inSeason ? `after week ${gamesPlayed}` : undefined}
          />
          {inSeason ? (
            <div className="bg-card border border-border rounded-[10px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`${thCls} text-center w-10`}>#</th>
                      <th className={`${thCls} text-left`}>Team</th>
                      <th className={`${thCls} text-center`}>Record</th>
                      {ODDS_OUTCOMES.map((k) => (
                        <th key={k} className={`${thCls} text-right ${hideCls(k)}`}>
                          {ODDS_LABELS[k]}
                        </th>
                      ))}
                      <th className={`${thCls} text-right hidden sm:table-cell`}>Next game</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => {
                      const odds = oddsForRecord(t.wins, t.losses, t.ties);
                      // What's riding on the next game: playoff odds after a win vs. a loss.
                      const ifWin = oddsForRecord(t.wins + 1, t.losses, t.ties);
                      const ifLoss = oddsForRecord(t.wins, t.losses + 1, t.ties);
                      return (
                        <tr key={t.rosterId} className="border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors">
                          <td className="px-3 py-2 text-center font-code text-xs text-muted-foreground">{t.rank}</td>
                          <td className="px-3 py-2">
                            <OwnerLink name={t.displayName} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                              <OwnerAvatar name={t.displayName} division={t.division} />
                              <span className="text-[13px] font-semibold">{t.displayName}</span>
                            </OwnerLink>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <RecordText wins={t.wins} losses={t.losses} ties={t.ties} />
                          </td>
                          {ODDS_OUTCOMES.map((k) =>
                            odds ? (
                              <OddsCell key={k} pct={odds[k]} strong={k === "playoffs"} className={hideCls(k)} />
                            ) : (
                              <td key={k} className={`px-3 py-2 text-right text-muted-foreground ${hideCls(k)}`}>—</td>
                            ),
                          )}
                          <td className="px-3 py-2 text-right hidden sm:table-cell whitespace-nowrap">
                            {ifWin && ifLoss ? (
                              <span className="font-code text-[11px]">
                                <span className="text-emerald-400">W {formatPct(ifWin.playoffs)}</span>
                                <span className="text-muted-foreground"> / </span>
                                <span className="text-red-400">L {formatPct(ifLoss.playoffs)}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
                Odds for each team&apos;s record alone. The model doesn&apos;t see points scored, rosters, or who&apos;s left on
                the schedule. &ldquo;Next game&rdquo; shows playoff odds after a win vs. a loss.
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-[10px] px-4 py-5 text-[13px] text-muted-foreground">
              {gamesPlayed === 0
                ? "No games played yet. Team-by-team odds show up after Week 1."
                : "The regular season is in its final week or over. Check the standings for the playoff field."}
            </div>
          )}
        </section>
        {/* Full table for any week */}
        <section className="mb-8">
          <SectionLabel label="Odds by Record" count={`after week ${week}`} />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {MODEL_WEEKS.map((w) => (
              <Pill key={w} active={w === week} onClick={() => setWeek(w)}>
                Wk {w}
              </Pill>
            ))}
          </div>
          <div className="bg-card border border-border rounded-[10px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${thCls} text-left`}>Record</th>
                    {ODDS_OUTCOMES.map((k) => (
                      <th key={k} className={`${thCls} text-right ${hideCls(k)}`}>
                        {ODDS_LABELS[k]}
                      </th>
                    ))}
                    <th className={`${thCls} text-right hidden sm:table-cell`} title="Past ITTWA teams with this record after this week">
                      ITTWA History
                    </th>
                    {week === gamesPlayed && <th className={`${thCls} text-left`}>Teams Now</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: week + 1 }, (_, i) => week - i).map((wins) => {
                    const odds = getModelOdds(week, wins) as Odds;
                    const published = week === SOURCE_WEEK ? SOURCE_ODDS[wins] : undefined;
                    const hist = history[week]?.[wins];
                    const here = teams.filter((t) => t.ties === 0 && t.wins === wins && t.wins + t.losses === week);
                    return (
                      <tr key={wins} className="border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="px-3 py-2">
                          <RecordText wins={wins} losses={week - wins} />
                        </td>
                        {ODDS_OUTCOMES.map((k, i) => (
                          <OddsCell
                            key={k}
                            pct={odds[k]}
                            strong={k === "playoffs"}
                            className={hideCls(k)}
                            sub={
                              published && (
                                <div className="font-code text-[10px] text-muted-foreground mt-0.5" title="Published Roster Audit figure">
                                  pub. {formatPct(published[i])}
                                </div>
                              )
                            }
                          />
                        ))}
                        <td className="px-3 py-2 text-right hidden sm:table-cell whitespace-nowrap">
                          {hist ? (
                            <div className="font-code text-[11px]">
                              <span className="font-semibold">{hist.playoffs}</span>
                              <span className="text-muted-foreground"> of {hist.teams} made it</span>
                              {hist.title > 0 && (
                                <div className="text-[10px]" style={{ color: GOLD }}>
                                  {hist.title} {hist.title === 1 ? "title" : "titles"}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                        {week === gamesPlayed && (
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {here.map((t) => (
                                <OwnerLink key={t.rosterId} name={t.displayName} className="hover:opacity-80 transition-opacity">
                                  <OwnerAvatar name={t.displayName} division={t.division} size={22} />
                                </OwnerLink>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground space-y-1">
              <p>
                Model odds for ITTWA&apos;s format: 4 division winners + 2 wild cards, top 2 seeds get byes.
                &ldquo;ITTWA History&rdquo; counts every team since 2014 that had this exact record after this week.
              </p>
              {week === SOURCE_WEEK && (
                <p>
                  <span className="font-semibold">pub.</span> = Roster Audit&apos;s published Week {SOURCE_WEEK} figure
                  (pooled across many Sleeper leagues and formats), which the model is calibrated to.
                </p>
              )}
            </div>
          </div>
        </section>
        {/* Every week × every win total at a glance */}
        <section className="mb-8">
          <SectionLabel
            label="Odds Map"
            count="week × wins"
            right={
              <div className="flex gap-1.5">
                {(["playoffs", "bye", "title"] as const).map((k) => (
                  <Pill key={k} active={mapOutcome === k} onClick={() => setMapOutcome(k)}>
                    {ODDS_LABELS[k]}
                  </Pill>
                ))}
              </div>
            }
          />
          <div className="bg-card border border-border rounded-[10px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-sm mx-auto" style={{ borderCollapse: "separate", borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className={`${thCls} text-left`}>After</th>
                    {Array.from({ length: LAST_WEEK + 1 }, (_, w) => (
                      <th key={w} className={`${thCls} text-center px-1 min-w-[38px]`}>
                        {w}W
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODEL_WEEKS.map((wk) => {
                    // Title odds top out near 35%, so stretch their scale to stay readable.
                    const max = mapOutcome === "title" ? 40 : 100;
                    return (
                      <tr key={wk}>
                        <td className="pr-2">
                          <button
                            onClick={() => setWeek(wk)}
                            className="font-code text-[11px] whitespace-nowrap cursor-pointer hover:underline underline-offset-2"
                            style={{ color: wk === week ? ACCENT : undefined, fontWeight: wk === week ? 700 : 500 }}
                          >
                            Wk {wk}
                          </button>
                        </td>
                        {Array.from({ length: LAST_WEEK + 1 }, (_, wins) => {
                          if (wins > wk) return <td key={wins} />;
                          const pct = getModelOdds(wk, wins)![mapOutcome];
                          const occupied = wk === gamesPlayed && teams.some((t) => t.ties === 0 && t.wins === wins && t.wins + t.losses === wk);
                          return (
                            <td
                              key={wins}
                              className="text-center font-code text-[10px] rounded-[4px] py-1.5 cursor-pointer"
                              style={{
                                background: heat(pct, max),
                                outline: occupied ? `1.5px solid ${GOLD}` : undefined,
                                outlineOffset: -1.5,
                              }}
                              title={`${wins}–${wk - wins} after week ${wk}: ${formatPct(pct)} ${ODDS_LABELS[mapOutcome].toLowerCase()}`}
                              onClick={() => setWeek(wk)}
                            >
                              {pct >= 99.5 ? "99+" : pct < 0.5 ? (pct > 0 ? "<1" : "0") : Math.round(pct)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              Percent chance by wins (columns) after each week (rows). Read across a row to see what one more win is
              worth; read down a diagonal to see how a .500 team&apos;s odds hold up.
              {inSeason && (
                <>
                  {" "}
                  <span style={{ color: GOLD }}>Outlined</span> cells are records an ITTWA team holds right now.
                </>
              )}
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section>
          <SectionLabel label="How It Works" />
          <div className="bg-card border border-border rounded-[10px] px-5 py-4 text-[13px] text-muted-foreground space-y-3 max-w-3xl">
            <p>
              <span className="text-foreground font-semibold">The data.</span>{" "}
              {`Roster Audit published how Sleeper teams at every record after Week ${SOURCE_WEEK} went on to finish.
              That's one week of real numbers. Every other week here is an extrapolation.`}
            </p>
            <p>
              <span className="text-foreground font-semibold">The model.</span>{" "}
              {`We simulated ${(MODEL_PARAMS.seasonsSimulated / 1e6).toFixed(0)} million ITTWA seasons. Every team gets
              a hidden true strength, and each week's score is that strength plus a lot of luck. The one tuning knob is
              how much teams really differ compared with week-to-week noise. It was set so the simulated Week
              ${SOURCE_WEEK} curves have the same shape as the published ones. The answer was`}{" "}
              <span className="font-code text-foreground">{MODEL_PARAMS.strengthSpread}</span>
              {`: one week of luck is about ${Math.round(1 / MODEL_PARAMS.strengthSpread)}× bigger than the typical
              gap between teams.`}
            </p>
            <p>
              <span className="text-foreground font-semibold">ITTWA rules.</span>{" "}
              {`The simulations use the real ${MODEL_PARAMS.scheduleTemplate} schedule (division rivals twice, 14
              weeks). They also use our playoff format: 4 division winners seeded 1–4, 2 wild cards, byes for the top
              2, 3v6 and 4v5, re-seeding for the semis, and 3 points of home field for the higher seed. So the Week
              ${SOURCE_WEEK} numbers won't exactly match the published ones. The published table pools leagues where
              more teams make the playoffs, which lifts its middle records a few points. In ITTWA exactly half the
              league gets in, and a 3-team division gives bad records a slightly better chance to sneak in as a
              division winner.`}
            </p>
            <p>
              <span className="text-foreground font-semibold">What it can&apos;t see.</span>{" "}
              {`Points for, roster strength, injuries, and who's left on your schedule. A 4–3 team that lost close
              games to the top of the league is in better shape than a 4–3 team that beat the bottom three. The ITTWA
              History column is real but small (12 seasons), so treat it as color, not as odds.`}
            </p>
          </div>
        </section>
      </div>
    </OwnerAvatarsProvider>
  );
}
