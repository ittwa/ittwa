import { connection } from "next/server";
import { getLeagueUsers } from "@/lib/data";
import { getDisplayName } from "@/lib/sleeper";
import { OwnerAvatarsProvider } from "@/components/owner-avatar";
import { AuctionBoardClient } from "./auction-client";

export const metadata = { title: "Free Agent Auction" };

export default async function AuctionPage() {
  await connection();
  const users = await getLeagueUsers().catch(() => []);
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return (
    <OwnerAvatarsProvider avatars={ownerAvatars}>
      <AuctionBoardClient />
    </OwnerAvatarsProvider>
  );
}
