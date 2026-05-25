"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ruleChanges, type RuleStatus, type RuleChange } from "@/lib/rule-changes";
import { GOLD } from "@/lib/ui-utils";
import { OwnerAvatarsProvider, SleeperAvatarImage, useOwnerAvatar } from "@/components/owner-avatar";
import { ProposerAnalytics } from "./proposer-analytics";

const STATUS_META: Record<RuleStatus, { label: string; icon: string; color: string; dim: string }> = {
  Passed:  { label: "Passed",  icon: "✅", color: "#4ade80", dim: "rgba(74,222,128,0.12)" },
  Denied:  { label: "Denied",  icon: "❌", color: "#FD4A48", dim: "rgba(253,74,72,0.12)" },
  Pending: { label: "Pending", icon: "❓", color: "#f59e0b", dim: "rgba(245,158,11,0.12)" },
};

function computeStats(data: RuleChange[]) {
  const total = data.length;
  const passed = data.filter((r) => r.result === "Passed").length;
  const denied = data.filter((r) => r.result === "Denied").length;
  const pending = data.filter((r) => r.result === "Pending").length;

  const proposerCounts: Record<string, number> = {};
  for (const r of data) {
    if (r.proposedBy !== "—" && r.proposedBy !== "Everyone") {
      for (const p of r.proposedBy.split(",").map((s) => s.trim())) {
        proposerCounts[p] = (proposerCounts[p] || 0) + 1;
      }
    }
  }
  const topProposer = Object.entries(proposerCounts).sort((a, b) => b[1] - a[1])[0];
  return { total, passed, denied, pending, topProposer: topProposer ? { name: topProposer[0], count: topProposer[1] } : null };
}

function getProposers(data: RuleChange[]): string[] {
  const set = new Set<string>();
  for (const r of data) {
    if (r.proposedBy !== "—" && r.proposedBy !== "Everyone") {
      for (const p of r.proposedBy.split(",").map((s) => s.trim())) set.add(p);
    }
  }
  return [...set].sort();
}

function OwnerAvatar({ name, size = 22 }: { name: string; size?: number }) {
  const avatarId = useOwnerAvatar(name);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)" }}
    >
      <SleeperAvatarImage
        avatarId={avatarId}
        name={name}
        fallback={<span className="font-heading font-bold text-[#60a5fa]" style={{ fontSize: size * 0.38 }}>{initials}</span>}
      />
    </div>
  );
}

function StatusPill({ status }: { status: RuleStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 py-0.5 text-[11px] font-bold tracking-wide"
      style={{ background: m.dim, color: m.color, border: `1px solid ${m.color}30` }}
    >
      <span>{m.icon}</span>
      <span>{m.label}</span>
    </span>
  );
}

function CountBadge({ count, status }: { count: number; status: RuleStatus }) {
  if (!count) return null;
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] px-[7px] py-0.5 text-[11px] font-bold"
      style={{ background: m.dim, color: m.color, border: `1px solid ${m.color}25` }}
    >
      <span>{count}</span>
      <span className="opacity-90">{m.label.toLowerCase()}</span>
    </span>
  );
}

function RuleCard({ rule }: { rule: RuleChange }) {
  const m = STATUS_META[rule.result];
  return (
    <div className="flex overflow-hidden bg-card border border-border rounded-[10px]">
      <div className="w-1 shrink-0" style={{ background: m.color }} />
      <div className="flex-1 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-[15px] font-bold leading-snug">{rule.rule}</h3>
          <StatusPill status={rule.result} />
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground mb-3 max-w-[720px]">
          {rule.description}
        </p>
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2.5 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground">Proposed by</span>
            <span className="flex items-center gap-1.5">
              {rule.proposedBy.split(",").map((p) => p.trim()).map((name) => (
                <span key={name} className="inline-flex items-center gap-1">
                  {name !== "—" && name !== "Everyone" && <OwnerAvatar name={name} size={18} />}
                  <span className="text-[13px] font-semibold">{name}</span>
                </span>
              ))}
            </span>
          </div>
          {rule.result === "Passed" && rule.implementedSeason && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground">Implemented in</span>
              <span className="font-code text-[13px] font-bold text-[#E8B84B]">{rule.implementedSeason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeasonGroup({
  season,
  rules,
  forceOpen,
  defaultOpen,
}: {
  season: number;
  rules: RuleChange[];
  forceOpen?: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen ?? open;

  const passed = rules.filter((r) => r.result === "Passed").length;
  const denied = rules.filter((r) => r.result === "Denied").length;
  const pending = rules.filter((r) => r.result === "Pending").length;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 w-full text-left cursor-pointer flex-wrap py-3 px-1 border-b border-border bg-transparent"
        style={{ border: "none", borderBottom: "1px solid var(--border)" }}
      >
        <div className="w-1 h-6 bg-[#E8B84B] rounded-sm shrink-0" />
        <h2 className="font-heading text-2xl font-black tracking-[0.04em] uppercase">
          {season} <span className="text-muted-foreground font-bold">Season</span>
        </h2>
        <div className="flex gap-1.5 flex-wrap">
          <CountBadge count={passed} status="Passed" />
          <CountBadge count={denied} status="Denied" />
          <CountBadge count={pending} status="Pending" />
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="font-code text-[11px] text-muted-foreground">
            {rules.length} proposal{rules.length !== 1 ? "s" : ""}
          </span>
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-secondary border border-border text-muted-foreground text-xs transition-transform"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-2.5 mt-4 mb-2">
          {rules.map((r, i) => (
            <RuleCard key={i} rule={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RuleChangesClient({ ownerAvatars }: { ownerAvatars: Record<string, string> }) {
  const stats = useMemo(() => computeStats(ruleChanges), []);
  const allProposers = useMemo(() => getProposers(ruleChanges), []);

  const [statusFilter, setStatusFilter] = useState<RuleStatus | "all">("all");
  const [proposerFilter, setProposerFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let items = [...ruleChanges];
    if (statusFilter !== "all") {
      items = items.filter((r) => r.result === statusFilter);
    }
    if (proposerFilter !== "all") {
      items = items.filter((r) => r.proposedBy.split(",").map((s) => s.trim()).includes(proposerFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.rule.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.proposedBy.toLowerCase().includes(q),
      );
    }
    return items;
  }, [statusFilter, proposerFilter, search]);

  const grouped = useMemo(() => {
    const seasons = [...new Set(filtered.map((r) => r.season))].sort((a, b) => b - a);
    return seasons.map((s) => ({ season: s, rules: filtered.filter((r) => r.season === s) }));
  }, [filtered]);

  const hasActiveFilter = statusFilter !== "all" || proposerFilter !== "all" || search.trim() !== "";

  const pillItems: { id: RuleStatus | "all"; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "Passed", label: "Passed", count: stats.passed },
    { id: "Denied", label: "Denied", count: stats.denied },
    { id: "Pending", label: "Pending", count: stats.pending },
  ];

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
    <div>
      {/* Page header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
              <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Rule Changes</h1>
            </div>
            <p className="text-[13px] text-muted-foreground ml-4">
              Every proposal. Every vote. Every bad idea Chap ever had.
            </p>
          </div>
          <div className="flex gap-5">
            {([
              [stats.total, "Total", GOLD],
              [stats.passed, "Passed", STATUS_META.Passed.color],
              [stats.denied, "Denied", STATUS_META.Denied.color],
            ] as const).map(([val, lbl, color]) => (
              <div key={lbl} className="text-right">
                <div className="font-heading text-[30px] font-extrabold leading-none" style={{ color }}>{val}</div>
                <div className="text-[10px] text-muted-foreground font-semibold tracking-[0.06em] uppercase mt-0.5">{lbl}</div>
              </div>
            ))}
            {stats.topProposer && (
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <OwnerAvatar name={stats.topProposer.name} size={28} />
                  <div className="font-heading text-[30px] font-extrabold leading-none">
                    {stats.topProposer.name}
                    <span className="font-code text-[14px] text-[#E8B84B] ml-1">·{stats.topProposer.count}</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-semibold tracking-[0.06em] uppercase mt-0.5">Most Prolific</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proposer Analytics */}
      <ProposerAnalytics />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap mb-6">
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {pillItems.map((p) => {
            const active = statusFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setStatusFilter(p.id)}
                className="flex items-center gap-2 whitespace-nowrap cursor-pointer text-[13px] rounded-lg px-3 py-1.5"
                style={{
                  background: active ? "rgba(232,184,75,0.1)" : "var(--secondary)",
                  border: `1px solid ${active ? "rgba(232,184,75,0.35)" : "var(--border)"}`,
                  color: active ? "#E8B84B" : "var(--muted-foreground)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span>{p.label}</span>
                <span className="font-code text-[11px]">{p.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 sm:ml-auto flex-wrap">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              width={14} height={14} viewBox="0 0 24 24" fill="none"
              stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rules…"
              className="bg-secondary border border-border rounded-lg py-1.5 pl-8 pr-3 text-[13px] text-foreground w-48"
            />
          </div>

          <div className="relative">
            <select
              value={proposerFilter}
              onChange={(e) => setProposerFilter(e.target.value)}
              className="appearance-none pr-7 pl-3 py-1.5 text-[13px] rounded-lg cursor-pointer"
              style={{
                background: proposerFilter !== "all" ? "rgba(232,184,75,0.1)" : "var(--secondary)",
                border: `1px solid ${proposerFilter !== "all" ? "rgba(232,184,75,0.35)" : "var(--border)"}`,
                color: proposerFilter !== "all" ? "#E8B84B" : "var(--muted-foreground)",
                fontWeight: proposerFilter !== "all" ? 600 : 400,
              }}
            >
              <option value="all">All Owners</option>
              {allProposers.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-muted-foreground">▼</span>
          </div>
        </div>
      </div>

      {hasActiveFilter && (
        <div className="text-xs text-muted-foreground mb-4">
          Showing {filtered.length} of {stats.total} proposals
          <button
            onClick={() => { setStatusFilter("all"); setProposerFilter("all"); setSearch(""); }}
            className="ml-2 underline underline-offset-2 cursor-pointer text-[#E8B84B]"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {grouped.length === 0 ? (
          <div className="text-center bg-card border border-dashed border-border rounded-[10px] px-6 py-10">
            <div className="text-2xl mb-2">🗳️</div>
            <div className="text-sm font-semibold mb-1">No proposals match these filters</div>
            <div className="text-xs text-muted-foreground">Try widening the status or owner selection.</div>
          </div>
        ) : (
          grouped.map((g, i) => (
            <SeasonGroup
              key={g.season}
              season={g.season}
              rules={g.rules}
              defaultOpen={i === 0}
              forceOpen={hasActiveFilter ? true : undefined}
            />
          ))
        )}
      </div>

      <div className="mt-8 pt-5 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
        Rule amendments require a simple majority of active owners to pass.
        See <Link href="/constitution" className="text-[#E8B84B] no-underline hover:underline">Constitution § 13 — Amendments</Link> for the full ratification procedure.
      </div>
    </div>
    </OwnerAvatarsProvider>
  );
}
