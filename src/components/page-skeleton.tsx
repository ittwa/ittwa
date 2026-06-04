import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

function PageHeaderSkeleton() {
  return (
    <div className="pb-6 border-b border-border mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-7 bg-secondary rounded-sm animate-pulse" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-4 w-80" />
    </div>
  );
}

function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/50">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-4 w-12 hidden sm:block" />
            <Skeleton className="h-4 w-12 hidden md:block" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Generic data-table page: header + optional stat cards + a table. */
export function TablePageSkeleton({
  statCards = 4,
  rows = 10,
}: {
  statCards?: number;
  rows?: number;
}) {
  return (
    <div>
      <PageHeaderSkeleton />
      {statCards > 0 && <StatCardsSkeleton count={statCards} />}
      <TableSkeleton rows={rows} />
    </div>
  );
}

/** Player / team profile page: hero band + stat row + two-column body. */
export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border pb-6">
        <div className="h-1 bg-secondary animate-pulse" />
        <div className="flex items-start gap-6 p-2 sm:p-4">
          <Skeleton className="h-28 w-28 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-5 w-40 mb-3" />
            <Skeleton className="h-12 w-72 mb-4" />
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 px-2 sm:px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-14" />
            </Card>
          ))}
        </div>
      </div>
      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="flex flex-col gap-6 min-w-0">
          <TableSkeleton rows={6} />
          <TableSkeleton rows={4} />
        </div>
        <div className="flex flex-col gap-6">
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}
