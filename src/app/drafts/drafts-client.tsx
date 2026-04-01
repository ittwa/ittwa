"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DraftPick {
  pickNo: number;
  round: number;
  rosterId: number;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  ownerName: string;
  contractYears: number;
  contractSalary: number;
}

interface DraftData {
  draftId: string;
  season: string;
  type: string;
  status: string;
  rounds: number;
  picks: DraftPick[];
}

interface DraftsClientProps {
  drafts: DraftData[];
}

export function DraftsClient({ drafts }: DraftsClientProps) {
  const [expandedDraft, setExpandedDraft] = useState<string | null>(
    drafts[0]?.draftId || null
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Draft History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All ITTWA rookie drafts &middot; {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-4">
        {drafts.map((draft) => {
          const isExpanded = expandedDraft === draft.draftId;
          return (
            <Card key={draft.draftId}>
              <CardHeader
                className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedDraft(isExpanded ? null : draft.draftId)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {draft.season} Rookie Draft
                    <Badge variant="outline" className="text-xs">{draft.rounds} rounds</Badge>
                    {draft.status === "complete" && <Badge variant="success">Complete</Badge>}
                  </CardTitle>
                  <span className="text-muted-foreground text-sm">{isExpanded ? "▼" : "▶"}</span>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-card text-muted-foreground">
                          <th className="px-4 py-2 text-center font-medium w-16">Pick</th>
                          <th className="px-4 py-2 text-left font-medium">Owner</th>
                          <th className="px-4 py-2 text-left font-medium">Player</th>
                          <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Pos</th>
                          <th className="px-4 py-2 text-right font-medium">Salary</th>
                          <th className="px-4 py-2 text-center font-medium">Years</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.picks.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground italic">
                              No picks recorded for this draft.
                            </td>
                          </tr>
                        ) : (
                          draft.picks.map((pick) => (
                            <tr key={pick.pickNo} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                              <td className="px-4 py-2 text-center tabular-nums font-mono text-muted-foreground">
                                {pick.round}.{((pick.pickNo - 1) % 12 + 1).toString().padStart(2, "0")}
                              </td>
                              <td className="px-4 py-2">{pick.ownerName}</td>
                              <td className="px-4 py-2 font-medium">{pick.playerName || "—"}</td>
                              <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{pick.position}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {pick.contractSalary > 0 ? `$${pick.contractSalary}` : "—"}
                              </td>
                              <td className="px-4 py-2 text-center tabular-nums">{pick.contractYears || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
