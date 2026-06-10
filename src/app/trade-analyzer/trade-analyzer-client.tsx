"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CONFIG, type Strategy, type TradeAnalyzerConfig } from "@/lib/trade-analyzer/config";
import {
  evaluateSide,
  evaluateAsset,
  computeVerdict,
  computeCapImpact,
  balancingSuggestions,
} from "@/lib/trade-analyzer/engine";
import type { TradeAsset, TradeTeam } from "@/lib/trade-analyzer/types";
import { TeamPanel } from "./team-panel";
import { VerdictBar } from "./verdict-bar";
import { CapImpactCard } from "./cap-impact";
import { Balancing } from "./balancing";
import { TweaksPanel, type Tweaks } from "./tweaks-panel";

interface SharedState {
  a: number | null;
  b: number | null;
  ar: string[]; // ids team A receives (from B)
  br: string[]; // ids team B receives (from A)
  sa: Strategy;
  sb: Strategy;
  t: Tweaks;
}

const DEFAULT_TWEAKS: Tweaks = {
  surplusPerDollar: DEFAULT_CONFIG.SURPLUS_PER_DOLLAR,
  fairPct: DEFAULT_CONFIG.FAIR_PCT,
  valueMode: "adjusted",
};

const LS_KEY = "ittwa-trade-analyzer";

function encodeState(s: SharedState): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(s)));
  } catch {
    return "";
  }
}
function decodeState(raw: string): Partial<SharedState> | null {
  try {
    return JSON.parse(decodeURIComponent(atob(raw)));
  } catch {
    return null;
  }
}

export function TradeAnalyzerClient({
  teams,
  ownerAvatars,
  unmatchedCount,
}: {
  teams: TradeTeam[];
  ownerAvatars: Record<string, string>;
  unmatchedCount: number;
}) {
  const [aTeamId, setATeamId] = useState<number | null>(null);
  const [bTeamId, setBTeamId] = useState<number | null>(null);
  const [aReceives, setAReceives] = useState<string[]>([]);
  const [bReceives, setBReceives] = useState<string[]>([]);
  const [strategyA, setStrategyA] = useState<Strategy>("neutral");
  const [strategyB, setStrategyB] = useState<Strategy>("neutral");
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULT_TWEAKS);
  const hydrated = useRef(false);

  // Load shared state from URL hash, else localStorage (once, on mount).
  // Reading persisted state must happen post-mount to avoid an SSR hydration
  // mismatch, so setState-in-effect here is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    const loaded =
      (fromHash && decodeState(fromHash)) ||
      (() => {
        const ls = window.localStorage.getItem(LS_KEY);
        return ls ? decodeState(ls) : null;
      })();
    if (loaded) {
      if (loaded.a !== undefined) setATeamId(loaded.a);
      if (loaded.b !== undefined) setBTeamId(loaded.b);
      if (loaded.ar) setAReceives(loaded.ar);
      if (loaded.br) setBReceives(loaded.br);
      if (loaded.sa) setStrategyA(loaded.sa);
      if (loaded.sb) setStrategyB(loaded.sb);
      if (loaded.t) setTweaks({ ...DEFAULT_TWEAKS, ...loaded.t });
    }
    hydrated.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const teamA = useMemo(() => teams.find((t) => t.rosterId === aTeamId) ?? null, [teams, aTeamId]);
  const teamB = useMemo(() => teams.find((t) => t.rosterId === bTeamId) ?? null, [teams, bTeamId]);

  const config: TradeAnalyzerConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, SURPLUS_PER_DOLLAR: tweaks.surplusPerDollar, FAIR_PCT: tweaks.fairPct }),
    [tweaks.surplusPerDollar, tweaks.fairPct],
  );

  // Resolve received-asset ids to assets, intersected with the source roster so
  // stale ids (after a team swap) are ignored.
  const aAssets = useMemo(() => {
    if (!teamB) return [];
    const byId = new Map(teamB.assets.map((a) => [a.id, a]));
    return aReceives.map((id) => byId.get(id)).filter((a): a is TradeAsset => !!a);
  }, [teamB, aReceives]);
  const bAssets = useMemo(() => {
    if (!teamA) return [];
    const byId = new Map(teamA.assets.map((a) => [a.id, a]));
    return bReceives.map((id) => byId.get(id)).filter((a): a is TradeAsset => !!a);
  }, [teamA, bReceives]);

  const sideA = useMemo(() => evaluateSide(aAssets, strategyA, config), [aAssets, strategyA, config]);
  const sideB = useMemo(() => evaluateSide(bAssets, strategyB, config), [bAssets, strategyB, config]);

  const verdict = useMemo(
    () => computeVerdict(sideA.total, sideB.total, teamA?.owner ?? "Team A", teamB?.owner ?? "Team B", config),
    [sideA.total, sideB.total, teamA, teamB, config],
  );

  const capA = useMemo(() => (teamA ? computeCapImpact(teamA, aAssets, bAssets) : null), [teamA, aAssets, bAssets]);
  const capB = useMemo(() => (teamB ? computeCapImpact(teamB, bAssets, aAssets) : null), [teamB, bAssets, aAssets]);

  const suggestions = useMemo(() => {
    if (verdict.kind === "empty" || verdict.kind === "fair" || !verdict.favored) return [];
    const favoredTeam = verdict.favored === "A" ? teamA : teamB;
    if (!favoredTeam) return [];
    const unfavoredStrategy = verdict.favored === "A" ? strategyB : strategyA;
    const inTrade = new Set([...aReceives, ...bReceives]);
    return balancingSuggestions(favoredTeam, inTrade, Math.abs(verdict.diff), unfavoredStrategy, config);
  }, [verdict, teamA, teamB, strategyA, strategyB, aReceives, bReceives, config]);

  // Persist to URL hash + localStorage whenever state changes (post-hydration).
  useEffect(() => {
    if (!hydrated.current) return;
    const enc = encodeState({ a: aTeamId, b: bTeamId, ar: aReceives, br: bReceives, sa: strategyA, sb: strategyB, t: tweaks });
    window.history.replaceState(null, "", enc ? `#${enc}` : " ");
    window.localStorage.setItem(LS_KEY, enc);
  }, [aTeamId, bTeamId, aReceives, bReceives, strategyA, strategyB, tweaks]);

  function selectA(id: number) {
    setATeamId(id);
    setBReceives([]); // bReceives came from old team A
    if (id === bTeamId) setBTeamId(null);
  }
  function selectB(id: number) {
    setBTeamId(id);
    setAReceives([]); // aReceives came from old team B
    if (id === aTeamId) setATeamId(null);
  }

  function addToSuggestionSide(assetId: string) {
    // The favored team adds an asset to the unfavored side's haul.
    if (verdict.favored === "A") setBReceives((r) => [...r, assetId]);
    else setAReceives((r) => [...r, assetId]);
  }

  function clearAll() {
    setATeamId(null);
    setBTeamId(null);
    setAReceives([]);
    setBReceives([]);
    setStrategyA("neutral");
    setStrategyB("neutral");
    setTweaks(DEFAULT_TWEAKS);
  }

  const [copied, setCopied] = useState(false);
  function copyUrl() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-5 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Trade Analyzer</h1>
              <span className="text-[11px] font-bold px-2 py-1 rounded bg-ittwa/15 text-ittwa border border-ittwa/30">
                Superflex · ½ PPR
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground ml-4">
              Contract-adjusted dynasty values · FantasyCalc + ITTWA cap data
              {unmatchedCount > 0 && <span className="text-amber-400/80"> · {unmatchedCount} unmatched</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyUrl}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-[12px] font-medium hover:border-ittwa/40 transition-colors"
            >
              {copied ? "Copied!" : "Copy Trade URL"}
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <TweaksPanel tweaks={tweaks} onChange={setTweaks} onReset={() => setTweaks(DEFAULT_TWEAKS)} />

      {/* Two-panel builder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamPanel
          teams={teams}
          selectedTeam={teamA}
          sourceTeam={teamA && teamB ? teamB : null}
          onSelectTeam={selectA}
          disabledTeamId={bTeamId}
          ownerAvatars={ownerAvatars}
          strategy={strategyA}
          onStrategyChange={setStrategyA}
          evaluations={sideA.evals}
          total={sideA.total}
          valueMode={tweaks.valueMode}
          excludeIds={new Set(aReceives)}
          valueOf={(a) => evaluateAsset(a, strategyA, config).adjusted}
          onAdd={(a) => setAReceives((r) => [...r, a.id])}
          onRemove={(id) => setAReceives((r) => r.filter((x) => x !== id))}
        />
        <TeamPanel
          teams={teams}
          selectedTeam={teamB}
          sourceTeam={teamA && teamB ? teamA : null}
          onSelectTeam={selectB}
          disabledTeamId={aTeamId}
          ownerAvatars={ownerAvatars}
          strategy={strategyB}
          onStrategyChange={setStrategyB}
          evaluations={sideB.evals}
          total={sideB.total}
          valueMode={tweaks.valueMode}
          excludeIds={new Set(bReceives)}
          valueOf={(a) => evaluateAsset(a, strategyB, config).adjusted}
          onAdd={(a) => setBReceives((r) => [...r, a.id])}
          onRemove={(id) => setBReceives((r) => r.filter((x) => x !== id))}
        />
      </div>

      <VerdictBar verdict={verdict} totalA={sideA.total} totalB={sideB.total} teamA={teamA} teamB={teamB} ownerAvatars={ownerAvatars} fairPct={tweaks.fairPct} />

      {suggestions.length > 0 && teamA && teamB && (
        <Balancing
          suggestions={suggestions}
          favoredOwner={verdict.favored === "A" ? teamA.owner : teamB.owner}
          unfavoredOwner={verdict.favored === "A" ? teamB.owner : teamA.owner}
          favoredDivision={verdict.favored === "A" ? teamA.division : teamB.division}
          unfavoredDivision={verdict.favored === "A" ? teamB.division : teamA.division}
          ownerAvatars={ownerAvatars}
          onAdd={addToSuggestionSide}
        />
      )}

      {capA && capB && teamA && teamB && (sideA.evals.length > 0 || sideB.evals.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CapImpactCard impact={capA} team={teamA} ownerAvatars={ownerAvatars} />
          <CapImpactCard impact={capB} team={teamB} ownerAvatars={ownerAvatars} />
        </div>
      )}

      <div className="bg-card border border-border rounded-[14px] p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">How values work:</strong> Each asset&apos;s value is its contract
          surplus: what its production would cost at auction (from FantasyCalc) minus its actual salary, amplified by
          years remaining (good deals gain, bad deals hurt), plus a small scarcity premium for having the production
          rostered. Value is floored at the cut penalty, and players without an NFL team count as zero production —
          so bad contracts show negative value. Strategy still tilts picks &amp; youth vs. win-now vets. Tune the
          weights above if a verdict feels off.
        </p>
      </div>
    </div>
  );
}
