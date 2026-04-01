export const dynamic = 'force-dynamic';

import { getContracts, getNFLState } from "@/lib/data";
import { getActiveContractsForSeason } from "@/lib/contracts";
import { ContractsClient } from "./contracts-client";

export const revalidate = 600;

export default async function ContractsPage() {
  const [contracts, nflState] = await Promise.all([getContracts(), getNFLState()]);
  const season = nflState.season;
  const activeContracts = getActiveContractsForSeason(contracts, season);

  return <ContractsClient contracts={activeContracts} season={season} />;
}
