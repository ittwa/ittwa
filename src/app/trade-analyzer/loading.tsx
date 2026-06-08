import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="pb-5 border-b border-border">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[320px] rounded-[14px]" />
        <Skeleton className="h-[320px] rounded-[14px]" />
      </div>
      <Skeleton className="h-28 rounded-[14px]" />
    </div>
  );
}
