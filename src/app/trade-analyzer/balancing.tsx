"use client";

import Link from "next/link";
import type { BalancingSuggestion } from "@/lib/trade-analyzer/engine";
import { AssetAvatar, OwnerAvatar, PosBadge, ContractChip } from "./ui";

export function Balancing({
  suggestions,
  favoredOwner,
  unfavoredOwner,
  favoredDivision,
  unfavoredDivision,
  ownerAvatars,
  onAdd,
}: {
  suggestions: BalancingSuggestion[];
  favoredOwner: string;
  unfavoredOwner: string;
  favoredDivision: string;
  unfavoredDivision: string;
  ownerAvatars: Record<string, string>;
  onAdd: (assetId: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-[14px] overflow-hidden">
      <div className="py-3 px-4 border-b border-border bg-secondary flex items-center gap-2.5">
        <div className="w-[3px] h-[16px] bg-ittwa rounded-sm" />
        <span className="font-heading font-extrabold text-sm tracking-[0.04em]">TO BALANCE</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono ml-1">
          <OwnerAvatar name={favoredOwner} avatarId={ownerAvatars[favoredOwner]} division={favoredDivision} size={18} />
          <Link href={`/teams/${encodeURIComponent(favoredOwner)}`} className="hover:underline underline-offset-2">{favoredOwner}</Link>
          {" could add for "}
          <OwnerAvatar name={unfavoredOwner} avatarId={ownerAvatars[unfavoredOwner]} division={unfavoredDivision} size={18} />
          <Link href={`/teams/${encodeURIComponent(unfavoredOwner)}`} className="hover:underline underline-offset-2">{unfavoredOwner}</Link>
        </span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.asset.id}
            onClick={() => onAdd(s.asset.id)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/60 border border-border hover:border-ittwa/40 transition-colors text-left"
          >
            <AssetAvatar id={s.asset.id} name={s.asset.name} position={s.asset.position} size={28} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate">{s.asset.name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <PosBadge pos={s.asset.position} />
                <ContractChip salary={s.asset.salary} years={s.asset.years} isPick={s.asset.type === "pick"} />
              </div>
            </div>
            <span
              className="font-mono text-xs font-bold tabular-nums text-muted-foreground"
              style={s.adjusted < 0 ? { color: "#f87171" } : undefined}
            >
              {Math.round(s.adjusted)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
