import type { Db } from "../deltas/types.js";
import { flushStepDeltas } from "../deltas/index.js";
import { getWorkplaceForProfession } from "../economy/goodCatalog.js";
import {
  adjustCohortsBatch,
  retireFromCohortsBatch,
  zeroBurgsCohorts,
} from "../entities/population.js";
import { prepareAndLoadBurgOperations } from "../macro/burgOperations/load.js";
import { recordLedger, splitByShare } from "../macro/burgOperations/populationLedger.js";
import { computeClimateHarvestModifier } from "../macro/burgOperations/production.js";
import { stepBurgOperations } from "../macro/burgOperations/step.js";
import type { RecordLedger } from "../macro/burgOperations/types.js";

export type { RecordLedger };
export {
  getWorkplaceForProfession,
  recordLedger,
  splitByShare,
  computeClimateHarvestModifier,
};

/**
 * Autonomous Daily Burg Operations Engine:
 * Thin orchestrator wrapper running prepareAndLoadBurgOperations -> pure split
 * stepBurgOperations (production, food, health, infrastructure, population ledger) ->
 * flushStepDeltas -> batched cohort growth/retirement/zeroing.
 */
export async function runBurgOperationsAgent(
  client: Db,
  tick: number,
  loreDate: string = ""
) {
  const snap = await prepareAndLoadBurgOperations(client, tick, loreDate);
  const out = stepBurgOperations(snap, { random: Math.random });

  if (out.deltas.length > 0) {
    await flushStepDeltas(client, "agent:burgOperations", tick, out.deltas);
  }
  if (out.cohortGrowthOps.length > 0) {
    await adjustCohortsBatch(client, out.cohortGrowthOps);
  }
  if (out.cohortRetireReqs.length > 0) {
    await retireFromCohortsBatch(client, out.cohortRetireReqs);
  }
  if (out.emptiedFamineBurgs.length > 0) {
    await zeroBurgsCohorts(client, out.emptiedFamineBurgs, "DECEASED", "Perished in famine.");
  }
  if (out.emptiedRuinedBurgs.length > 0) {
    await zeroBurgsCohorts(
      client,
      out.emptiedRuinedBurgs,
      "DEPARTED",
      "Abandoned a ruined settlement."
    );
  }
}
