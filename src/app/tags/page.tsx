import { connection } from "next/server";
import { getTagTrackerData } from "@/lib/tags-data";
import { getLeagueUsers, getDisplayName } from "@/lib/sleeper";
import { TagsClient } from "./tags-client";

export const metadata = {
  title: "Tag Tracker · ITTWA",
  description: "Franchise tag and 5th-year option history, insights, and forward-looking eligibility.",
};

export default async function TagsPage() {
  await connection();
  const [data, users] = await Promise.all([getTagTrackerData(), getLeagueUsers()]);

  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }

  return <TagsClient data={data} ownerAvatars={ownerAvatars} />;
}
