import { getTradeAnalyzerData } from "./data";
import { evaluateAsset } from "./engine";
import { DEFAULT_CONFIG } from "./config";

// Contract-adjusted trade value (the Trade Analyzer's neutral-strategy value)
// for every currently-rostered player, keyed by Sleeper player_id. Other pages
// (Contracts, owner Roster) use this to show a "Value" column without
// re-implementing the matching, exchange-rate, or valuation logic — it all
// lives in the analyzer's data layer + engine. Underlying fetches are cached,
// so calling this alongside a page's own data loads is cheap.

export interface PlayerValueMap {
  valueByPlayerId: Map<string, number>;
  valuePerDollar: number;
}

export async function getPlayerValueMap(): Promise<PlayerValueMap> {
  const data = await getTradeAnalyzerData();
  const config = {
    ...DEFAULT_CONFIG,
    LEAGUE_VALUE_PER_DOLLAR: data.valuePerDollar || DEFAULT_CONFIG.LEAGUE_VALUE_PER_DOLLAR,
  };

  const valueByPlayerId = new Map<string, number>();
  for (const team of data.teams) {
    for (const asset of team.assets) {
      if (asset.type !== "player") continue;
      valueByPlayerId.set(asset.id, evaluateAsset(asset, "neutral", config).adjusted);
    }
  }

  return { valueByPlayerId, valuePerDollar: config.LEAGUE_VALUE_PER_DOLLAR };
}
