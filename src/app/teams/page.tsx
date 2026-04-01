export const dynamic = 'force-dynamic';

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTeamsData, calculateStandings } from "@/lib/data";

export const revalidate = 300;

const DIVISION_COLORS: Record<string, string> = {
  Concussion: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
  "Hey Arnold": "bg-violet-500/20 text-violet-400 border border-violet-500/30",
  Replacements: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  "Dark Knight Rises": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
};

export default async function TeamsPage() {
  const { teams, season, allMatchups } = await getTeamsData();
  const standings = calculateStandings(teams, allMatchups);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">{season} season &middot; 12 teams, 4 divisions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {standings.map((team) => {
          const divColor = DIVISION_COLORS[team.division] || "bg-zinc-500/20 text-zinc-400";
          return (
            <Link key={team.rosterId} href={`/teams/${encodeURIComponent(team.displayName)}`}>
              <Card className="hover:border-ittwa/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{team.displayName}</CardTitle>
                    <span className={`text-lg font-bold ${team.rank <= 3 ? "text-ittwa" : "text-muted-foreground"}`}>
                      #{team.rank}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${divColor}`}>
                      {team.division}
                    </span>
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">{team.wins}-{team.losses}</span>
                      {team.ties > 0 && <span>-{team.ties}</span>}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    PF: {team.pointsFor.toFixed(1)} &middot; PA: {team.pointsAgainst.toFixed(1)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
