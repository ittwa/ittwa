import { connection } from "next/server";
import { getTagTrackerData } from "@/lib/tags-data";
import { TagsClient } from "./tags-client";

export const metadata = {
  title: "Tag Tracker · ITTWA",
  description: "Franchise tag and 5th-year option history, insights, and forward-looking eligibility.",
};

export default async function TagsPage() {
  await connection();
  const data = await getTagTrackerData();
  return <TagsClient data={data} />;
}
