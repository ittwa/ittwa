import { connection } from "next/server";

import { getLeagueUsers, getDisplayName } from "@/lib/sleeper";
import { RuleChangesClient } from "./rule-changes-client";

export default async function RuleChangesPage() {
  await connection();
  const users = await getLeagueUsers();
  const ownerAvatars: Record<string, string> = {};
  for (const user of users) {
    if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
  }
  return <RuleChangesClient ownerAvatars={ownerAvatars} />;
}
