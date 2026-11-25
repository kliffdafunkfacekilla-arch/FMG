/**
 * Autonomous Citizen-Crewed Inter-Faction Logistics & Trade Engine:
 *
 * Thin orchestrator wrapper running ensureRouteGraphCache -> loadTrade -> pure stepTrade ->
 * batched cohort crew promotions -> materializeTradeDispatchDeltas -> flushStepDeltas.
 */
import { flushStepDeltas, type Db } from "../deltas/index.js";
import { promoteBatchFromCohorts } from "../lod/promote.js";
import { LIVE_TRADE_ROUTER, loadTrade } from "../macro/trade/load.js";
import { materializeTradeDispatchDeltas, stepTrade } from "../macro/trade/step.js";
import type {
  TradeCaravanLog,
  TradeEmbargoStall,
  TradeEngineResult,
} from "../macro/trade/types.js";
import { ensureRouteGraphCache } from "./routeGraphRouter.js";

export type { TradeCaravanLog, TradeEmbargoStall, TradeEngineResult };

export async function runInterFactionTradeEngine(
  client: Db,
  tick: number,
  loreDate: string
): Promise<TradeEngineResult> {
  await ensureRouteGraphCache(client);
  const snap = await loadTrade(client, tick, loreDate);
  const out = stepTrade(snap, { random: Math.random, router: LIVE_TRADE_ROUTER });

  const tokenToCitizenId = new Map<number, number>();
  if (out.cohortPromotions.length > 0) {
    const specs = out.cohortPromotions.map((p) => p.spec);
    const promoted = await promoteBatchFromCohorts(client, specs, tick);
    for (let i = 0; i < out.cohortPromotions.length; i++) {
      const p = promoted[i];
      if (p) tokenToCitizenId.set(out.cohortPromotions[i]!.token, p.citizenId);
    }
  }

  const dispatchDeltas = materializeTradeDispatchDeltas(
    out.pendingDispatches,
    tokenToCitizenId,
    tick
  );
  const allDeltas = [...out.deltas, ...dispatchDeltas];
  if (allDeltas.length > 0) {
    await flushStepDeltas(client, "agent:trade", tick, allDeltas);
  }

  return out.result;
}
