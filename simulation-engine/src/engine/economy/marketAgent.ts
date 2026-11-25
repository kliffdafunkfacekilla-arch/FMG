/**
 * Regional & World Market Pricing (thin DB wrapper delegating to `engine/macro/market`).
 */
import { DAYS_PER_WEEK } from "../canon/calendar.js";
import { flushStepDeltas } from "../deltas/index.js";
import type { Db } from "../deltas/types.js";
import { loadMarket } from "../macro/market/load.js";
import { stepMarket } from "../macro/market/step.js";

export async function updateRegionalMarkets(
  client: Db,
  tick: number
): Promise<{ marketsUpdated: number; commoditiesUpdated: number }> {
  const snap = await loadMarket(client, tick, true);
  const res = stepMarket(snap);
  await flushStepDeltas(client, "market", tick, res.deltas);
  return { marketsUpdated: res.marketsUpdated, commoditiesUpdated: res.commoditiesUpdated };
}

export async function runMarketAgent(client: Db, tick: number): Promise<number> {
  if (tick % DAYS_PER_WEEK !== 0) return 0;
  const { commoditiesUpdated } = await updateRegionalMarkets(client, tick);
  return commoditiesUpdated;
}
