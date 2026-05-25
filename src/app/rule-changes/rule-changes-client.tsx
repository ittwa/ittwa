"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ruleChanges, type RuleStatus, type RuleChange } from "@/lib/rule-changes";
import { GOLD } from "@/lib/ui-utils";

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

function StatusPill({ status }: { status: RuleStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: m.dim,
        color: m.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        border: `1px solid ${m.color}30`,
      }}
    >
      <span style={{ fontSize: 11 }}>{m.icon}</span>
      <span>{m.label}</span>
    </span>
  );
}

function CountBadge({ count, status }: { count: number; status: RuleStatus }) {
  if (!count) return null;
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        padding: "3px 9px",
        borderRadius: 999,
        background: m.dim,
        color: m.color,
        fontSize: 11,
        fontWeight: 700,
        border: `1px solid ${m.color}25`,
      }}
    >
      <span>{count}</span>
      <span style={{ opacity: 0.9 }}>{m.label.toLowerCase()}</span>
    </span>
  );
}

function RuleCard({ rule }: { rule: RuleChange }) {
  const m = STATUS_META[rule.result];
  return (
    <div
      className="flex overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <div style={{ width: 4, background: m.color, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: "16px 18px 14px" }}>
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 }}>
            {rule.rule}
          </h3>
          <StatusPill status={rule.result} />
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#a8a8a8", marginBottom: 12, maxWidth: 720 }}>
          {rule.description}
        </p>
        <div
          className="flex items-center justify-between gap-3 flex-wrap"
          style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Proposed by
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              {rule.proposedBy}
            </span>
          </div>
          {rule.result === "Passed" && rule.implementedSeason && (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                Implemented in
              </span>
              <span className="font-code" style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>
                {rule.implementedSeason}
              </span>
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
        className="flex items-center gap-4 w-full text-left cursor-pointer flex-wrap"
        style={{
          background: "transparent",
          border: "none",
          padding: "14px 4px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="flex-shrink-0" style={{ width: 4, height: 24, background: GOLD, borderRadius: 2 }} />
        <h2 className="font-heading" style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--foreground)" }}>
          {season} <span style={{ color: "var(--muted-foreground)", fontWeight: 700 }}>Season</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <CountBadge count={passed} status="Passed" />
          <CountBadge count={denied} status="Denied" />
          <CountBadge count={pending} status="Pending" />
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="font-code" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {rules.length} proposal{rules.length !== 1 ? "s" : ""}
          </span>
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              color: "var(--muted-foreground)",
              fontSize: 12,
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.18s",
            }}
          >
            ▾
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-2.5" style={{ marginTop: 16, marginBottom: 8 }}>
          {rules.map((r, i) => (
            <RuleCard key={i} rule={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RuleChangesClient() {
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
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 60px" }}>
      {/* Page header */}
      <div style={{ padding: "32px 0 24px", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
              <span style={{ display: "block", width: 4, height: 28, background: GOLD, borderRadius: 2 }} />
              <h1 className="font-heading" style={{ fontSize: 40, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Rule Changes
              </h1>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginLeft: 16, maxWidth: 540, lineHeight: 1.5 }}>
              Every proposal. Every vote. Every bad idea Chap ever had.
            </p>
          </div>
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:flex gap-4 lg:gap-6 items-end">
            <div className="text-right">
              <div className="font-heading" style={{ fontSize: 28, fontWeight: 800, color: GOLD, lineHeight: 1 }}>
                {stats.total}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
                Total Proposals
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading" style={{ fontSize: 28, fontWeight: 800, color: STATUS_META.Passed.color, lineHeight: 1 }}>
                {stats.passed}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
                Passed
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading" style={{ fontSize: 28, fontWeight: 800, color: STATUS_META.Denied.color, lineHeight: 1 }}>
                {stats.denied}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
                Denied
              </div>
            </div>
            {stats.topProposer && (
              <div className="text-right">
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", lineHeight: 1, whiteSpace: "nowrap" }}>
                  {stats.topProposer.name}{" "}
                  <span className="font-code" style={{ color: GOLD, fontSize: 14 }}>·{stats.topProposer.count}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
                  Most Prolific
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-wrap" style={{ marginBottom: 36 }}>
        {/* Status pills */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {pillItems.map((p) => {
            const active = statusFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setStatusFilter(p.id)}
                className="flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all"
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  background: active ? "rgba(232,184,75,0.1)" : "var(--secondary)",
                  border: `1px solid ${active ? "rgba(232,184,75,0.4)" : "var(--border)"}`,
                  color: active ? GOLD : "var(--muted-foreground)",
                }}
              >
                <span>{p.label}</span>
                <span
                  className="font-code"
                  style={{
                    fontSize: 11,
                    color: active ? GOLD : "var(--muted-foreground)",
                    background: active ? "rgba(232,184,75,0.08)" : "transparent",
                    padding: "1px 6px",
                    borderRadius: 3,
                  }}
                >
                  {p.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 sm:ml-auto flex-wrap">
          {/* Search */}
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
              className="bg-secondary border border-border rounded-lg py-[6px] pl-8 pr-3 text-[12px] w-48"
              style={{
                color: "var(--foreground)",
                fontWeight: 500,
              }}
            />
          </div>

          {/* Proposer dropdown */}
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Proposed By
            </span>
            <div className="relative">
              <select
                value={proposerFilter}
                onChange={(e) => setProposerFilter(e.target.value)}
                className="appearance-none border rounded-[7px] cursor-pointer"
                style={{
                  background: "var(--secondary)",
                  borderColor: proposerFilter !== "all" ? "rgba(232,184,75,0.4)" : "var(--border)",
                  color: proposerFilter !== "all" ? GOLD : "var(--foreground)",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "6px 32px 6px 12px",
                }}
              >
                <option value="all">All Owners</option>
                {allProposers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--muted-foreground)", fontSize: 10 }}
              >
                ▼
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active filter summary */}
      {hasActiveFilter && (
        <div className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Showing {filtered.length} of {stats.total} proposals
          <button
            onClick={() => { setStatusFilter("all"); setProposerFilter("all"); setSearch(""); }}
            className="ml-2 underline underline-offset-2 cursor-pointer"
            style={{ color: GOLD }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Season groups */}
      <div className="flex flex-col gap-7">
        {grouped.length === 0 ? (
          <div
            className="text-center"
            style={{
              background: "var(--card)",
              border: "1px dashed var(--border)",
              borderRadius: 10,
              padding: "40px 24px",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>🗳️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No proposals match these filters</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Try widening the status or owner selection.</div>
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

      {/* Footnote */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        Rule amendments require a simple majority of active owners to pass.
        See <Link href="/constitution" style={{ color: GOLD, textDecoration: "none" }}>Constitution § 13 — Amendments</Link> for the full ratification procedure.
      </div>
    </div>
  );
}
