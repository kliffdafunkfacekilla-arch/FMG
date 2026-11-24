import { PoolClient } from "pg";
import { flushStepDeltas } from "../deltas/index.js";
import { loadEcology, type TrophicCalendarContext } from "../macro/ecology/load.js";
import { stepEcology } from "../macro/ecology/step.js";

export type { TrophicCalendarContext };

/**
 * Compatibility wrapper around the pure trophic ecology macro step (Phase 2.3 #3).
 */
export async function runTrophicEcologyAgent(
  client: PoolClient,
  tick: number,
  season: string,
  loreDate: string,
  calCtx?: TrophicCalendarContext
) {
  const snap = await loadEcology(client, tick, season, loreDate, calCtx);
  const deltas = stepEcology(snap, { random: Math.random });
  await flushStepDeltas(client, "agent:ecology", tick, deltas);
}
