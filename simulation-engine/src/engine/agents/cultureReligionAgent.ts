/**
 * cultureReligionAgent.ts (Phase B6.5)
 * Autonomous cell-to-cell cultural assimilation, Cult/chaos heresy spread,
 * and `temple = true` burg orthodoxy pushback over `sim_cells`, `sim_cultures`,
 * and `sim_religions`. Zero UI/observer imports (Rule 8).
 */
import { flushStepDeltas, type Db } from "../deltas/index.js";
import { loadCultureReligion } from "../macro/cultureReligion/load.js";
import { stepCultureReligion, type CultureReligionResult } from "../macro/cultureReligion/step.js";

export type { CultureReligionResult };

/** Thin transaction wrapper over loadCultureReligion -> stepCultureReligion -> flushStepDeltas. */
export async function runCultureReligionAgent(
  client: Db,
  tick: number,
  loreDate: string
): Promise<CultureReligionResult> {
  const snap = await loadCultureReligion(client, tick, loreDate);
  const out = stepCultureReligion(snap);
  if (out.deltas.length > 0) {
    await flushStepDeltas(client, "agent:cultureReligion", tick, out.deltas);
  }
  return out.result;
}
