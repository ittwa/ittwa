import { SleeperMatchup } from "@/types/sleeper";

// ── Weekly Recap generator ──────────────────────────────────────────────────
//
// For each completed week, derive the week's storylines from the matchup blobs
// and turn them into a short, deterministic prose recap (no LLM call). The Home
// page features the most recent week; older weeks are reachable via the selector.
//
// Fixed awards (always computed, rendered as chips):
//   motw     — Manager of the Week, the highest scorer (+ delta vs the average)
//   toilet   — Toilet Bowl, the lowest scorer
//   blowout  — the matchup with the largest margin of victory
//   close    — the matchup with the smallest non-zero margin
//   unlucky  — the highest-scoring team that still lost its matchup
//   topPlayer / dud — best and worst skill-position starter of the week
//
// The prose is built from a pool of candidate storylines (player booms and
// busts, bench blunders, streaks, first-place changes, lucky/unlucky results…),
// each with a weight for how newsworthy it is this week. The strongest few make
// the write-up, so the recap leads with whatever actually happened rather than
// the same five beats every week. Phrasing is picked from several variants by a
// hash of the week + subject: varied week to week, but stable on every render.

export interface RecapTeam {
  rosterId: number;
  owner: string;
  points: number;
}

export interface RecapMatchup {
  winner: RecapTeam;
  loser: RecapTeam;
  margin: number;
}

export interface RecapPlayer {
  playerId: string;
  name: string;
  position: string;
  points: number;
  owner: string;
  rosterId: number;
}

export interface WeeklyRecap {
  week: number;
  average: number;
  motw: RecapTeam & { delta: number };
  toilet: RecapTeam;
  blowout: RecapMatchup;
  close: RecapMatchup;
  unlucky: RecapTeam | null;
  topPlayer: RecapPlayer | null;
  dud: RecapPlayer | null;
  headline: string;
  body: string;
}

/** player_id → display name + position. Missing entries just skip player storylines. */
export type PlayerLookup = Record<string, { name: string; position: string }>;

const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const pts = (n: number) => n.toFixed(1);
const margin = (n: number) => (n < 1 ? n.toFixed(2) : n.toFixed(1));
const lastName = (name: string) => name.split(" ").slice(-1)[0] || name;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// FNV-1a — a tiny stable string hash for picking phrasing variants.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(variants: T[], seed: string): T {
  return variants[hash(seed) % variants.length];
}

interface Story {
  key: string;
  weight: number;
  owners: string[];
  text: string;
  headline?: string;
}

interface TeamRecord {
  w: number;
  l: number;
  t: number;
  pf: number;
  streak: number; // +N = N straight wins, -N = N straight losses
}

const recStr = (r: TeamRecord) => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`);

function leaderOf(records: Map<number, TeamRecord>): number | null {
  let best: [number, TeamRecord] | null = null;
  for (const entry of records) {
    const [, r] = entry;
    if (!best || r.w > best[1].w || (r.w === best[1].w && r.pf > best[1].pf)) best = entry;
  }
  return best ? best[0] : null;
}

export function computeWeeklyRecaps(
  weeklyMatchups: Map<number, SleeperMatchup[]>,
  rosterOwnerMap: Record<number, string>,
  players: PlayerLookup = {},
): WeeklyRecap[] {
  const ownerOf = (id: number) => rosterOwnerMap[id] ?? `Team ${id}`;
  const recaps: WeeklyRecap[] = [];

  // Running season records, so each week can speak to streaks and standings.
  const records = new Map<number, TeamRecord>();
  const recordOf = (id: number) => {
    let r = records.get(id);
    if (!r) records.set(id, (r = { w: 0, l: 0, t: 0, pf: 0, streak: 0 }));
    return r;
  };
  let seasonHigh = 0;

  const weeks = [...weeklyMatchups.keys()].sort((a, b) => a - b);

  for (const week of weeks) {
    const matchups = weeklyMatchups.get(week) ?? [];
    const scored = matchups.filter((m) => m.points > 0);
    if (scored.length < 2) continue;

    const teams: RecapTeam[] = scored.map((m) => ({
      rosterId: m.roster_id,
      owner: ownerOf(m.roster_id),
      points: m.points,
    }));

    const average = teams.reduce((s, t) => s + t.points, 0) / teams.length;

    // Highest / lowest scorers.
    const sorted = [...teams].sort((a, b) => b.points - a.points);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const scoreRank = (id: number) => sorted.findIndex((t) => t.rosterId === id) + 1;

    // Build matchup pairs to find margins + the unlucky loser.
    const byMatchup = new Map<number, SleeperMatchup[]>();
    for (const m of scored) {
      const arr = byMatchup.get(m.matchup_id) ?? [];
      arr.push(m);
      byMatchup.set(m.matchup_id, arr);
    }

    const pairs: RecapMatchup[] = [];
    const losers: RecapTeam[] = [];
    const opponentOf = new Map<number, RecapTeam>();
    const resultOf = new Map<number, "W" | "L" | "T">();
    const marginOf = new Map<number, number>();
    for (const [, pair] of byMatchup) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      const ta: RecapTeam = { rosterId: a.roster_id, owner: ownerOf(a.roster_id), points: a.points };
      const tb: RecapTeam = { rosterId: b.roster_id, owner: ownerOf(b.roster_id), points: b.points };
      opponentOf.set(ta.rosterId, tb);
      opponentOf.set(tb.rosterId, ta);
      if (a.points === b.points) {
        // ties produce no winner/loser
        resultOf.set(ta.rosterId, "T");
        resultOf.set(tb.rosterId, "T");
        continue;
      }
      const winner = a.points > b.points ? ta : tb;
      const loser = a.points > b.points ? tb : ta;
      const m = round2(winner.points - loser.points);
      pairs.push({ winner, loser, margin: m });
      losers.push(loser);
      resultOf.set(winner.rosterId, "W");
      resultOf.set(loser.rosterId, "L");
      marginOf.set(winner.rosterId, m);
      marginOf.set(loser.rosterId, m);
    }

    // Update running records (before the all-ties bail-out, so they stay accurate).
    const prevLeader = leaderOf(records);
    const prevStreak = new Map<number, number>();
    const prevRecord = new Map<number, TeamRecord>();
    for (const t of teams) {
      const r = recordOf(t.rosterId);
      prevStreak.set(t.rosterId, r.streak);
      prevRecord.set(t.rosterId, { ...r });
      const res = resultOf.get(t.rosterId);
      r.pf += t.points;
      if (res === "W") { r.w++; r.streak = r.streak > 0 ? r.streak + 1 : 1; }
      else if (res === "L") { r.l++; r.streak = r.streak < 0 ? r.streak - 1 : -1; }
      else if (res === "T") { r.t++; r.streak = 0; }
    }
    const newLeader = leaderOf(records);

    if (pairs.length === 0) continue; // every game tied — nothing to recap

    const blowout = pairs.reduce((m, p) => (p.margin > m.margin ? p : m));
    const close = pairs.reduce((m, p) => (p.margin < m.margin ? p : m));
    const unlucky = losers.length
      ? losers.reduce((m, t) => (t.points > m.points ? t : m))
      : null;

    const delta = round2(top.points - average);
    const motw = { ...top, delta };
    const toilet = bottom;

    const isSeasonHigh = seasonHigh > 0 && top.points > seasonHigh;
    seasonHigh = Math.max(seasonHigh, top.points);

    // ── Player-level detail (starters + bench) ──────────────────────────────
    const startersByRoster = new Map<number, RecapPlayer[]>();
    const benchByRoster = new Map<number, RecapPlayer[]>();
    for (const m of scored) {
      const owner = ownerOf(m.roster_id);
      const toPlayer = (pid: string, p: number): RecapPlayer | null => {
        const info = players[pid];
        if (!info || !pid || pid === "0") return null;
        return { playerId: pid, name: info.name, position: info.position, points: p, owner, rosterId: m.roster_id };
      };
      const starters = (m.starters ?? [])
        .map((pid, i) => toPlayer(pid, m.starters_points?.[i] ?? m.players_points?.[pid] ?? 0))
        .filter((p): p is RecapPlayer => p !== null);
      const starterSet = new Set(m.starters ?? []);
      const bench = (m.players ?? [])
        .filter((pid) => !starterSet.has(pid))
        .map((pid) => toPlayer(pid, m.players_points?.[pid] ?? 0))
        .filter((p): p is RecapPlayer => p !== null);
      startersByRoster.set(m.roster_id, starters);
      benchByRoster.set(m.roster_id, bench);
    }
    const allStarters = [...startersByRoster.values()].flat();
    const topPlayer = allStarters.length
      ? allStarters.reduce((b, p) => (p.points > b.points ? p : b))
      : null;
    const skillStarters = allStarters.filter((p) => SKILL_POSITIONS.has(p.position));
    const dud = skillStarters.length
      ? skillStarters.reduce((w, p) => (p.points < w.points ? p : w))
      : null;
    const bestStarterOf = (id: number) =>
      (startersByRoster.get(id) ?? []).reduce<RecapPlayer | null>((b, p) => (!b || p.points > b.points ? p : b), null);
    const worstSkillStarterOf = (id: number) =>
      (startersByRoster.get(id) ?? [])
        .filter((p) => SKILL_POSITIONS.has(p.position))
        .reduce<RecapPlayer | null>((w, p) => (!w || p.points < w.points ? p : w), null);

    const seed = (k: string) => `${week}|${k}`;
    const stories: Story[] = [];

    // ── Lead: Manager of the Week ───────────────────────────────────────────
    const motwStar = bestStarterOf(motw.rosterId);
    const carry =
      motwStar && motwStar.points >= 20
        ? pick(
            [
              `, with ${motwStar.name} doing the heavy lifting (${pts(motwStar.points)})`,
              `, led by ${pts(motwStar.points)} from ${motwStar.name}`,
              ` behind a big day from ${motwStar.name} (${pts(motwStar.points)})`,
            ],
            seed(`carry|${motwStar.playerId}`),
          )
        : "";
    let lead = pick(
      [
        `${motw.owner} set the pace with ${pts(motw.points)}, ${pts(delta)} clear of the league average${carry}.`,
        `Nobody touched ${motw.owner} in Week ${week}: ${pts(motw.points)} points, ${pts(delta)} above the field${carry}.`,
        `${motw.owner} was the class of Week ${week}, hanging ${pts(motw.points)}${carry}.`,
        `Take a bow, ${motw.owner}: ${pts(motw.points)} points and the Manager of the Week nod${carry}.`,
        `${motw.owner} took Manager of the Week with ${pts(motw.points)}, ${pts(delta)} above the weekly average${carry}.`,
      ],
      seed(`lead|${motw.owner}`),
    );
    if (resultOf.get(motw.rosterId) === "L") {
      lead += ` The kicker? ${opponentOf.get(motw.rosterId)?.owner} still beat them.`;
    }
    if (isSeasonHigh) lead += ` That's the highest score of the season so far.`;

    // ── Blowout ─────────────────────────────────────────────────────────────
    {
      const { winner: W, loser: L, margin: m } = blowout;
      const weight = m >= 55 ? 8 : m >= 40 ? 6 : m >= 20 ? 3 : 1;
      stories.push({
        key: "blowout",
        weight,
        owners: [W.owner, L.owner],
        text: pick(
          [
            `${W.owner} buried ${L.owner} by ${margin(m)}. Someone check on ${L.owner}.`,
            `${W.owner} ran ${L.owner} out of the building, ${pts(W.points)} to ${pts(L.points)}.`,
            `${L.owner} never stood a chance: ${W.owner} won by ${margin(m)}.`,
            `${W.owner} over ${L.owner} by ${margin(m)}. Mercy-rule talks are ongoing.`,
            `${W.owner} handed ${L.owner} a ${margin(m)}-point beatdown. ${L.owner} may want to look away from the film.`,
            `It was over early: ${W.owner} ${pts(W.points)}, ${L.owner} ${pts(L.points)}.`,
          ],
          seed(`blowout|${W.owner}`),
        ),
        headline: pick(
          [`${W.owner} buries ${L.owner} by ${margin(m)}`, `${W.owner} rolls ${L.owner}`, `No mercy: ${W.owner} over ${L.owner}`],
          seed(`blowout-h|${W.owner}`),
        ),
      });
    }

    // ── Nail-biter ──────────────────────────────────────────────────────────
    if (close !== blowout && close.margin < 10) {
      const { winner: W, loser: L, margin: m } = close;
      stories.push({
        key: "close",
        weight: m < 2 ? 7 : m < 5 ? 5 : 2,
        owners: [W.owner, L.owner],
        text: pick(
          [
            `${W.owner} survived ${L.owner} by ${margin(m)}. That one will sting all week for ${L.owner}.`,
            `${W.owner} edged ${L.owner} by just ${margin(m)}, and ${L.owner} will be replaying every lineup call.`,
            `${L.owner} came up ${margin(m)} short against ${W.owner}. So close.`,
            ...(m < 2 ? [`Photo finish: ${W.owner} ${pts(W.points)}, ${L.owner} ${pts(L.points)}.`] : []),
          ],
          seed(`close|${W.owner}`),
        ),
        headline: pick(
          [`${W.owner} escapes ${L.owner} by ${margin(m)}`, `${W.owner} survives a scare`],
          seed(`close-h|${W.owner}`),
        ),
      });
    }

    // ── Hard-luck loser: a top-3 score that still lost ──────────────────────
    if (unlucky && unlucky.rosterId !== motw.rosterId && scoreRank(unlucky.rosterId) <= 4) {
      const rank = scoreRank(unlucky.rosterId);
      const beat = teams.filter((t) => t.points < unlucky.points).length;
      const opp = opponentOf.get(unlucky.rosterId);
      stories.push({
        key: "unlucky",
        weight: rank === 2 ? 6 : rank === 3 ? 5 : 2,
        owners: [unlucky.owner],
        text: pick(
          [
            `${unlucky.owner} put up ${pts(unlucky.points)}, the ${ordinal(rank)}-best score of the week, and still took an L.`,
            `Spare a thought for ${unlucky.owner}: ${pts(unlucky.points)} would've beaten ${beat} teams this week. It didn't beat ${opp?.owner}.`,
            `${unlucky.owner} dropped ${pts(unlucky.points)} and lost anyway. Wrong week to draw ${opp?.owner}.`,
          ],
          seed(`unlucky|${unlucky.owner}`),
        ),
      });
    }

    // ── Lucky winner: won with a clearly below-average score ────────────────
    const winners = pairs.map((p) => p.winner);
    const luckiest = winners.reduce((m, t) => (t.points < m.points ? t : m));
    if (luckiest.points < average - 10) {
      const lostTo = teams.filter((t) => t.points > luckiest.points && t.rosterId !== luckiest.rosterId).length;
      stories.push({
        key: "lucky",
        weight: 4,
        owners: [luckiest.owner],
        text: pick(
          [
            `${luckiest.owner} won with ${pts(luckiest.points)}, a score that would've lost to ${lostTo} other teams. Better lucky than good.`,
            `${luckiest.owner} got the W with ${pts(luckiest.points)}. It wasn't pretty, but the standings don't ask.`,
            `${luckiest.owner} should send ${opponentOf.get(luckiest.rosterId)?.owner} a thank-you note: ${pts(luckiest.points)} was enough to win.`,
          ],
          seed(`lucky|${luckiest.owner}`),
        ),
      });
    }

    // ── Toilet Bowl ─────────────────────────────────────────────────────────
    {
      const bust = worstSkillStarterOf(toilet.rosterId);
      const bustLine =
        bust && bust.points <= 5
          ? pick(
              [` ${bust.name}'s ${pts(bust.points)} didn't help.`, ` ${bust.name} (${pts(bust.points)}) was no help at all.`],
              seed(`toilet-bust|${bust.playerId}`),
            )
          : "";
      stories.push({
        key: "toilet",
        weight: toilet.points < average - 30 ? 5 : 3,
        owners: [toilet.owner],
        text: pick(
          [
            `Bringing up the rear: ${toilet.owner} with ${pts(toilet.points)}.${bustLine}`,
            `${toilet.owner} posted ${pts(toilet.points)}, the lowest total of the week.${bustLine}`,
            `The Toilet Bowl trophy goes to ${toilet.owner} at ${pts(toilet.points)}.${bustLine}`,
            `And someone has to clean the toilet: ${toilet.owner} brought up the rear with ${pts(toilet.points)}.${bustLine}`,
          ],
          seed(`toilet|${toilet.owner}`),
        ),
      });
    }

    // ── Player boom ─────────────────────────────────────────────────────────
    // Skipped when it's the MOTW's star, who already got a mention in the lead.
    if (topPlayer && topPlayer.points >= 30 && !(carry && topPlayer.playerId === motwStar?.playerId)) {
      const lost = resultOf.get(topPlayer.rosterId) === "L";
      const tail = lost ? pick([`, and ${topPlayer.owner} still lost`, ` in a losing effort`, `. It wasn't enough`], seed("boom-tail")) : "";
      stories.push({
        key: "boom",
        weight: topPlayer.points >= 45 ? 9 : topPlayer.points >= 38 ? 7 : 5,
        owners: [topPlayer.owner],
        text: pick(
          [
            `${topPlayer.name} went off for ${pts(topPlayer.points)} for ${topPlayer.owner}${tail}.`,
            `${topPlayer.name} had a monster week: ${pts(topPlayer.points)} for ${topPlayer.owner}${tail}.`,
            `Game ball to ${topPlayer.name}, who put up ${pts(topPlayer.points)} for ${topPlayer.owner}${tail}.`,
          ],
          seed(`boom|${topPlayer.playerId}`),
        ),
        headline: pick(
          [`${lastName(topPlayer.name)} goes off for ${pts(topPlayer.points)}`, `The ${lastName(topPlayer.name)} show`],
          seed(`boom-h|${topPlayer.playerId}`),
        ),
      });
    }

    // ── Bench blunders: a same-position swap would have flipped a loss ──────
    let blunder: Story | null = null;
    let blunderGain = 0;
    for (const loser of losers) {
      const m = marginOf.get(loser.rosterId) ?? Infinity;
      const starters = startersByRoster.get(loser.rosterId) ?? [];
      for (const b of benchByRoster.get(loser.rosterId) ?? []) {
        const worst = starters
          .filter((s) => s.position === b.position)
          .reduce<RecapPlayer | null>((w, s) => (!w || s.points < w.points ? s : w), null);
        if (!worst) continue;
        const gain = b.points - worst.points;
        if (b.points >= 15 && gain > m && gain > blunderGain) {
          blunderGain = gain;
          const opp = opponentOf.get(loser.rosterId)?.owner;
          blunder = {
            key: "blunder",
            weight: m < 10 ? 7 : 5,
            owners: [loser.owner],
            text: pick(
              [
                `${loser.owner} left ${b.name} (${pts(b.points)}) on the bench and started ${worst.name} (${pts(worst.points)}). That swap flips a ${margin(m)}-point loss to ${opp}.`,
                `Lineup review for ${loser.owner}: ${b.name} scored ${pts(b.points)} on the bench, and the loss to ${opp} was by ${margin(m)}.`,
                `${loser.owner} will not enjoy this one: ${b.name}'s ${pts(b.points)} sat on the bench in a ${margin(m)}-point loss.`,
              ],
              seed(`blunder|${b.playerId}`),
            ),
            headline: pick(
              [`${loser.owner} loses it on the bench`, `${loser.owner}'s lineup call backfires`],
              seed(`blunder-h|${loser.owner}`),
            ),
          };
        }
      }
    }
    if (blunder) stories.push(blunder);
    else {
      // No costly blunder — still worth a jab for a huge game left on a bench.
      let bigBench: RecapPlayer | null = null;
      for (const [, bench] of benchByRoster) {
        for (const b of bench) {
          if (b.points >= 25 && (!bigBench || b.points > bigBench.points)) bigBench = b;
        }
      }
      if (bigBench) {
        const b = bigBench;
        stories.push({
          key: "bench",
          weight: 3,
          owners: [b.owner],
          text: pick(
            [
              `${b.owner} had ${b.name} on the bench for ${pts(b.points)}. Rough.`,
              `${b.name} scored ${pts(b.points)} for ${b.owner}. Unfortunately it was from the bench.`,
            ],
            seed(`bench|${b.playerId}`),
          ),
        });
      }
    }

    // ── Skill-position dud in a close loss ──────────────────────────────────
    if (!blunder) {
      let worstDud: { p: RecapPlayer; m: number } | null = null;
      for (const loser of losers) {
        const d = worstSkillStarterOf(loser.rosterId);
        const m = marginOf.get(loser.rosterId) ?? Infinity;
        if (d && d.points <= 3 && m < 15 && (!worstDud || m < worstDud.m)) worstDud = { p: d, m };
      }
      if (worstDud) {
        const { p, m } = worstDud;
        stories.push({
          key: "dud",
          weight: 4,
          owners: [p.owner],
          text: pick(
            [
              `${p.name} gave ${p.owner} ${pts(p.points)} points. ${p.owner} lost by ${margin(m)}.`,
              `${p.name} scored ${pts(p.points)} for ${p.owner}, a problem when you lose by ${margin(m)}.`,
              `${p.owner} started ${p.name} and got ${pts(p.points)} back. The loss came by ${margin(m)}.`,
            ],
            seed(`dud|${p.playerId}`),
          ),
        });
      }
    }

    // ── Streaks & records (one storyline per team, the strongest) ───────────
    for (const t of teams) {
      const r = recordOf(t.rosterId);
      const before = prevRecord.get(t.rosterId)!;
      const was = prevStreak.get(t.rosterId) ?? 0;
      const res = resultOf.get(t.rosterId);
      const o = t.owner;
      const opp = opponentOf.get(t.rosterId)?.owner;
      let s: Story | null = null;

      if (r.l === 0 && r.t === 0 && r.w >= 3) {
        s = {
          key: `perfect|${o}`, weight: 5 + Math.min(r.w - 3, 2), owners: [o],
          text: pick([`${o} is ${recStr(r)} and still hasn't lost.`, `Still perfect: ${o} moves to ${recStr(r)}.`, `${o} keeps rolling at ${recStr(r)}. Somebody stop them.`], seed(`perfect|${o}`)),
          headline: pick([`${o} stays perfect at ${recStr(r)}`, `${o} is still unbeaten`], seed(`perfect-h|${o}`)),
        };
      } else if (r.w === 0 && r.t === 0 && r.l >= 3) {
        s = {
          key: `winless|${o}`, weight: 4 + Math.min(r.l - 3, 2), owners: [o],
          text: pick([`${o} falls to ${recStr(r)}. The search for win No. 1 continues.`, `${o} is ${recStr(r)}. Thoughts and prayers.`, `Still no wins for ${o}, now ${recStr(r)}.`], seed(`winless|${o}`)),
        };
      } else if (res === "W" && before.w === 0 && before.l >= 2) {
        s = {
          key: `first-win|${o}`, weight: 5, owners: [o],
          text: pick([`${o} is finally on the board! First win of the year, over ${opp}.`, `Break up the ${o} dynasty: a first win, at ${opp}'s expense, moves them to ${recStr(r)}.`], seed(`first-win|${o}`)),
        };
      } else if (res === "L" && was >= 3) {
        s = {
          key: `snapped|${o}`, weight: 5, owners: [o, opp ?? ""],
          text: pick([`${opp} snapped ${o}'s ${was}-game win streak.`, `${o}'s ${was}-game heater is over, courtesy of ${opp}.`], seed(`snapped|${o}`)),
        };
      } else if (r.streak >= 3) {
        s = {
          key: `hot|${o}`, weight: 3 + Math.min(r.streak - 3, 2), owners: [o],
          text: pick([`${o} has won ${r.streak} straight and sits at ${recStr(r)}.`, `${o} is heating up: ${r.streak} wins in a row.`], seed(`hot|${o}`)),
        };
      } else if (r.streak <= -3) {
        s = {
          key: `cold|${o}`, weight: 3, owners: [o],
          text: pick([`${o} has dropped ${-r.streak} straight and slides to ${recStr(r)}.`, `${o}'s skid hits ${-r.streak} games (${recStr(r)}).`], seed(`cold|${o}`)),
        };
      }
      if (s) stories.push(s);
    }

    // ── First place changes hands ───────────────────────────────────────────
    if (newLeader != null && prevLeader != null && newLeader !== prevLeader) {
      const o = ownerOf(newLeader);
      const r = recordOf(newLeader);
      stories.push({
        key: "leader",
        weight: 6,
        owners: [o],
        text: pick(
          [`${o} takes over first place at ${recStr(r)}.`, `New leader: ${o} climbs to the top of the standings at ${recStr(r)}.`, `There's a new No. 1: ${o}, now ${recStr(r)}.`],
          seed(`leader|${o}`),
        ),
        headline: pick([`${o} takes over first place`, `${o} climbs to No. 1`], seed(`leader-h|${o}`)),
      });
    }

    // ── Pick the strongest storylines ───────────────────────────────────────
    // Up to 4 beyond the lead, with no owner named in more than two lines.
    // A bench blunder already tells the nail-biter loser's story, so drop the
    // plain nail-biter line when they're the same game.
    const blunderOwner = blunder?.owners[0];
    const ranked = stories
      .filter((s) => s.weight >= 2)
      .filter((s) => !(s.key === "close" && close.loser.owner === blunderOwner))
      .map((s, i) => ({ s, i }))
      .sort((a, b) => b.s.weight - a.s.weight || a.i - b.i)
      .map(({ s }) => s);
    const mentions = new Map<string, number>([[motw.owner, 1]]);
    const chosen: Story[] = [];
    for (const s of ranked) {
      if (chosen.length >= 4) break;
      if (s.owners.some((o) => o && (mentions.get(o) ?? 0) >= 2)) continue;
      chosen.push(s);
      for (const o of s.owners) if (o) mentions.set(o, (mentions.get(o) ?? 0) + 1);
    }
    // The toilet jab always reads best as the closer.
    chosen.sort((a, b) => (a.key === "toilet" ? 1 : 0) - (b.key === "toilet" ? 1 : 0));

    const body = [lead, ...chosen.map((s) => s.text)].join(" ");

    // Headline: the week's biggest story if it's big enough, else the MOTW.
    const headlineStory = ranked.find((s) => s.headline && s.weight >= 7);
    const headline =
      headlineStory?.headline ??
      (isSeasonHigh
        ? `${motw.owner} posts a season-high ${pts(motw.points)}`
        : pick(
            [
              `${motw.owner} is your Week ${week} Manager of the Week`,
              `${motw.owner} runs Week ${week}`,
              `Week ${week} belongs to ${motw.owner}`,
              `${motw.owner} tops the board with ${pts(motw.points)}`,
            ],
            seed(`headline|${motw.owner}`),
          ));

    recaps.push({
      week,
      average: round2(average),
      motw,
      toilet,
      blowout,
      close,
      unlucky,
      topPlayer,
      dud,
      headline,
      body,
    });
  }

  return recaps;
}
