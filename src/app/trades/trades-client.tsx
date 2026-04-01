"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SleeperTradePick } from "@/types/sleeper";

interface TradeData {
  id: string;
  created: number;
  week: number;
  rosterIds: number[];
  adds: Record<string, number>;
  drops: Record<string, number>;
  draftPicks: SleeperTradePick[];
}

interface TradesClientProps {
  trades: TradeData[];
  rosterOwnerMap: Record<number, string>;
  season: string;
}

export function TradesClient({ trades, rosterOwnerMap, season }: TradesClientProps) {
  const [filterTeam, setFilterTeam] = useState("");

  const teamNames = [...new Set(Object.values(rosterOwnerMap))].sort();

  const filtered = filterTeam
    ? trades.filter((t) =>
        t.rosterIds.some((id) => rosterOwnerMap[id] === filterTeam)
      )
    : trades;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {season} season &middot; {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex gap-3">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Teams</option>
          {teamNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground italic">
              No trades yet. Either everyone is happy or nobody has leverage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((trade) => {
            const date = new Date(trade.created).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            // Group assets by roster
            const byRoster: Record<number, { received: string[]; gave: string[] }> = {};
            for (const rid of trade.rosterIds) {
              byRoster[rid] = { received: [], gave: [] };
            }

            // Players added = received by that roster
            for (const [playerId, rosterId] of Object.entries(trade.adds)) {
              if (byRoster[rosterId]) {
                byRoster[rosterId].received.push(`Player ${playerId}`);
              }
            }

            // Players dropped = given away by that roster
            for (const [playerId, rosterId] of Object.entries(trade.drops)) {
              if (byRoster[rosterId]) {
                byRoster[rosterId].gave.push(`Player ${playerId}`);
              }
            }

            // Draft picks
            for (const pick of trade.draftPicks) {
              const receiverName = rosterOwnerMap[pick.owner_id] || `Team ${pick.owner_id}`;
              const label = `${pick.season} Round ${pick.round} (via ${receiverName})`;
              if (byRoster[pick.owner_id]) {
                byRoster[pick.owner_id].received.push(label);
              }
              if (byRoster[pick.previous_owner_id]) {
                byRoster[pick.previous_owner_id].gave.push(label);
              }
            }

            return (
              <Card key={trade.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="ittwa">Trade</Badge>
                      <span className="text-xs text-muted-foreground">Week {trade.week}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{date}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {trade.rosterIds.map((rid) => {
                      const name = rosterOwnerMap[rid] || `Team ${rid}`;
                      const data = byRoster[rid];
                      return (
                        <div key={rid} className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-sm font-medium mb-1">{name}</p>
                          {data?.received.length ? (
                            <div className="text-xs text-muted-foreground">
                              <span className="text-emerald-400">Received:</span>{" "}
                              {data.received.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
