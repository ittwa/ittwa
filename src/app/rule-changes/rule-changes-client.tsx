"use client";

import { useState, useMemo } from "react";
import { ruleChanges, type RuleStatus, type RuleChange } from "@/lib/rule-changes";
import { SectionLabel } from "@/components/section-label";
import { GOLD } from "@/lib/ui-utils";

const STATUS_COLORS: Record<RuleStatus, { text: string; bg: string; border: string; dot: string }> = {
  Passed:  { text: "#4ade80", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.25)", dot: "#4ade80" },
  Denied:  { text: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)", dot: "#f87171" },
  Pending: { text: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)", dot: "#fbbf24" },
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

function getSeasons(data: RuleChange[]): number[] {
  return [...new Set(data.map((r) => r.season))].sort((a, b) => b - a);
}

function getProposers(data: RuleChange[]): string[] {
  const set = new Set<string>();
  for (const r of data) {
    if (r.proposedBy !== "—" && r.proposedBy !== "Everyone") {
      for (const p of r.proposedBy.split(",").map((s) => s.trim())) {
        set.add(p);
      }
    }
  }
  return [...set].sort();
}

function StatusBadge({ status, size = "sm" }: { status: RuleStatus; size?: "sm" | "lg" }) {
  const c = STATUS_COLORS[status];
  const isSm = size === "sm";
  return (
    <span
      className="inline-flex items-center gap-1.5 font-heading font-bold uppercase tracking-[0.06em]"
      style={{
        fontSize: isSm ? 10 : 11,
        padding: isSm ? "2px 7px" : "3px 10px",
        borderRadius: 6,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-border"
      style={{ padding: "16px 12px", background: "var(--card)", minWidth: 0 }}
    >
      <span className="font-code text-2xl font-bold" style={{ color: color || "var(--foreground)", lineHeight: 1 }}>
        {value}
      </span>
      <span className="text-[10px] font-heading font-bold uppercase tracking-[0.1em] text-muted-foreground mt-1.5">
        {label}
      </span>
    </div>
  );
}

function SeasonSection({
  season,
  rules,
  defaultOpen,
}: {
  season: number;
  rules: RuleChange[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const passed = rules.filter((r) => r.result === "Passed").length;
  const denied = rules.filter((r) => r.result === "Denied").length;
  const pending = rules.filter((r) => r.result === "Pending").length;

  return (
    <div>
      {/* Timeline dot + connector */}
      <div className="flex gap-4">
        {/* Timeline track */}
        <div className="flex flex-col items-center pt-1" style={{ width: 20 }}>
          <div
            className="rounded-full flex-shrink-0"
            style={{
              width: 12,
              height: 12,
              background: GOLD,
              border: "2px solid var(--background)",
              boxShadow: `0 0 0 2px ${GOLD}`,
            }}
          />
          {open && <div className="w-px flex-1 mt-1" style={{ background: "var(--border)" }} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-6">
          {/* Season header */}
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-3 w-full text-left group cursor-pointer"
          >
            <span className="font-heading text-xl font-extrabold tracking-[0.04em]" style={{ color: GOLD }}>
              {season}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {passed > 0 && (
                <span className="text-[10px] font-code font-bold" style={{ color: STATUS_COLORS.Passed.text }}>
                  {passed} passed
                </span>
              )}
              {denied > 0 && (
                <>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] font-code font-bold" style={{ color: STATUS_COLORS.Denied.text }}>
                    {denied} denied
                  </span>
                </>
              )}
              {pending > 0 && (
                <>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] font-code font-bold" style={{ color: STATUS_COLORS.Pending.text }}>
                    {pending} pending
                  </span>
                </>
              )}
            </div>
            <svg
              className="ml-auto opacity-40 transition-transform duration-150 flex-shrink-0"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              width={16} height={16} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Rules list */}
          {open && (
            <div className="mt-3 flex flex-col gap-2">
              {rules.map((rule, i) => (
                <RuleCard key={i} rule={rule} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule }: { rule: RuleChange }) {
  const sc = STATUS_COLORS[rule.result];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        borderLeft: `3px solid ${sc.dot}`,
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading text-[15px] font-bold tracking-[-0.01em]" style={{ color: "var(--foreground)" }}>
                {rule.rule}
              </span>
              <StatusBadge status={rule.result} />
            </div>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              {rule.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M3 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
            </svg>
            <span className="text-[11px] text-muted-foreground">
              {rule.proposedBy}
            </span>
          </div>
          {rule.result === "Passed" && rule.implementedSeason && (
            <div className="flex items-center gap-1.5">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 3v4M16 3v4" />
              </svg>
              <span className="text-[11px] text-muted-foreground">
                Implemented {rule.implementedSeason}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RuleChangesClient() {
  const stats = useMemo(() => computeStats(ruleChanges), []);
  const allSeasons = useMemo(() => getSeasons(ruleChanges), []);
  const allProposers = useMemo(() => getProposers(ruleChanges), []);

  const [statusFilter, setStatusFilter] = useState<RuleStatus | "All">("All");
  const [proposerFilter, setProposerFilter] = useState("");

  const filtered = useMemo(() => {
    let items = ruleChanges;
    if (statusFilter !== "All") {
      items = items.filter((r) => r.result === statusFilter);
    }
    if (proposerFilter) {
      items = items.filter((r) => r.proposedBy.split(",").map((s) => s.trim()).includes(proposerFilter));
    }
    return items;
  }, [statusFilter, proposerFilter]);

  const filteredSeasons = useMemo(() => {
    const seasons = [...new Set(filtered.map((r) => r.season))].sort((a, b) => b - a);
    return seasons;
  }, [filtered]);

  const statusPills: { label: string; value: RuleStatus | "All"; color?: string }[] = [
    { label: "All", value: "All" },
    { label: "Passed", value: "Passed", color: STATUS_COLORS.Passed.text },
    { label: "Denied", value: "Denied", color: STATUS_COLORS.Denied.text },
    { label: "Pending", value: "Pending", color: STATUS_COLORS.Pending.text },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Page header */}
      <div className="mb-8">
        <SectionLabel label="Rule Changes" count={`${stats.total} proposals`} />
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Every rule proposal voted on since the league was founded. Filter by status or proposer to explore the history.
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Passed" value={stats.passed} color={STATUS_COLORS.Passed.text} />
          <StatCard label="Denied" value={stats.denied} color={STATUS_COLORS.Denied.text} />
          <StatCard label="Pending" value={stats.pending} color={STATUS_COLORS.Pending.text} />
          {stats.topProposer && (
            <StatCard label="Most Proposals" value={`${stats.topProposer.name} (${stats.topProposer.count})`} color={GOLD} />
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 mb-6">
        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          {statusPills.map((pill) => {
            const active = statusFilter === pill.value;
            return (
              <button
                key={pill.value}
                onClick={() => setStatusFilter(pill.value)}
                className="cursor-pointer font-heading font-bold uppercase tracking-[0.06em] transition-colors"
                style={{
                  fontSize: 11,
                  padding: "5px 12px",
                  borderRadius: 8,
                  background: active
                    ? pill.color ? `${pill.color}15` : "var(--secondary)"
                    : "transparent",
                  border: `1px solid ${active
                    ? pill.color || "var(--border)"
                    : "var(--border)"}`,
                  color: active
                    ? pill.color || "var(--foreground)"
                    : "var(--muted-foreground)",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Proposer dropdown */}
        <div className="relative ml-auto">
          <select
            value={proposerFilter}
            onChange={(e) => setProposerFilter(e.target.value)}
            className="appearance-none bg-secondary border border-border rounded-lg py-[6px] pl-3 pr-8 text-[13px] cursor-pointer"
            style={{
              background: proposerFilter ? "rgba(232,184,75,0.08)" : undefined,
              borderColor: proposerFilter ? "rgba(232,184,75,0.35)" : undefined,
              color: proposerFilter ? GOLD : "var(--muted-foreground)",
              fontWeight: proposerFilter ? 600 : 400,
            }}
          >
            <option value="">All Proposers</option>
            {allProposers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]"
            style={{ color: proposerFilter ? GOLD : "var(--muted-foreground)" }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Results count when filtered */}
      {(statusFilter !== "All" || proposerFilter) && (
        <div className="text-xs text-muted-foreground mb-4">
          Showing {filtered.length} of {stats.total} proposals
          {statusFilter !== "All" && <span> · {statusFilter}</span>}
          {proposerFilter && <span> · by {proposerFilter}</span>}
          <button
            onClick={() => { setStatusFilter("All"); setProposerFilter(""); }}
            className="ml-2 underline underline-offset-2 cursor-pointer"
            style={{ color: GOLD }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Timeline */}
      <div>
        {filteredSeasons.map((season, i) => (
          <SeasonSection
            key={season}
            season={season}
            rules={filtered.filter((r) => r.season === season)}
            defaultOpen={i === 0}
          />
        ))}

        {filteredSeasons.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No proposals match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
