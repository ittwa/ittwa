import { getLeagueUsers } from "@/lib/sleeper";
import { getDisplayName } from "@/lib/sleeper";
import { Nav } from "./nav";

export async function NavServer() {
  let ownerAvatars: Record<string, string> = {};
  try {
    const users = await getLeagueUsers();
    for (const user of users) {
      if (user.avatar) ownerAvatars[getDisplayName(user)] = user.avatar;
    }
  } catch {
    // Nav still works without avatars
  }
  return <Nav ownerAvatars={ownerAvatars} />;
}
