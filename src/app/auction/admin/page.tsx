import { connection } from "next/server";
import { getLeagueUsers, getNFLState } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";
import { AuctionAdminClient } from "./admin-client";

export const metadata = { title: "Auction Admin" };

export default async function AuctionAdminPage() {
  await connection();
  const [users, nflState] = await Promise.all([
    getLeagueUsers().catch(() => []),
    getNFLState().catch(() => null),
  ]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  const defaultSeason = nflState?.season || String(new Date().getFullYear());

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
      <AuctionAdminClient defaultSeason={defaultSeason} />
    </OwnerAvatarsProvider>
  );
}
