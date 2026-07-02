"use client";

import { TagHistoryTable } from "./tag-history-table";
import { TagInsightsSection } from "./tag-insights";
import { TagEligibilitySection } from "./tag-eligibility";
import type { TagTrackerData } from "@/types/tags";

function SectionTick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-1 h-5 rounded-sm shrink-0 bg-gold" />
      <span className="font-heading text-xl font-extrabold uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function TagsClient({ data }: { data: TagTrackerData }) {
  const { history, insights, eligibility, usingSampleData } = data;
  const franchiseCount = history.filter((h) => h.tagType === "franchise").length;
  const fifthYearCount = history.filter((h) => h.tagType === "fifth-year").length;

  return (
    <div>
      {/* Page header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-7 bg-[#E8B84B] rounded-sm" />
          <h1 className="font-heading text-4xl font-black tracking-[0.04em] uppercase">Tag Tracker</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-4">
          {franchiseCount} franchise tag{franchiseCount === 1 ? "" : "s"} · {fifthYearCount} 5th-year option{fifthYearCount === 1 ? "" : "s"} · all-time
        </p>
      </div>

      {usingSampleData && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] mb-6"
          style={{ background: "rgba(232,184,75,0.08)", border: "1px solid rgba(232,184,75,0.3)" }}
        >
          <span className="text-base">⚠</span>
          <div className="text-[13px]">
            <span className="font-semibold" style={{ color: "#E8B84B" }}>Using sample data</span>
            <span className="text-muted-foreground"> — the Contracts sheet isn&apos;t connected right now, so this page is showing illustrative placeholder data instead of real league history.</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <section>
          <div className="mb-4"><SectionTick label="Tag History" /></div>
          <TagHistoryTable history={history} />
        </section>

        <section>
          <div className="mb-4"><SectionTick label="Tag Insights" /></div>
          <TagInsightsSection insights={insights} />
        </section>

        <section>
          <div className="mb-4"><SectionTick label="Tag Eligibility — Forward Looking" /></div>
          <TagEligibilitySection eligibility={eligibility} />
        </section>
      </div>
    </div>
  );
}
