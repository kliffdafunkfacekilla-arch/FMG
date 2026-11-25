/**
 * Grind Canyon dynamic abyssal mining & chasm lifecycle (thin DB wrapper).
 */
import { flushStepDeltas } from "../deltas/index.js";
import type { Db } from "../deltas/types.js";
import { loadGrindCanyon } from "../macro/grindCanyon/load.js";
import { DRAGON_DOMAINS, stepGrindCanyon } from "../macro/grindCanyon/step.js";

export { DRAGON_DOMAINS };

export async function runGrindCanyonAgent(client: Db, tick: number, loreDate: string) {
  const snap = await loadGrindCanyon(client, tick, loreDate);
  const deltas = stepGrindCanyon(snap);
  if (deltas.length > 0) await flushStepDeltas(client, "grindCanyon", tick, deltas);
}
