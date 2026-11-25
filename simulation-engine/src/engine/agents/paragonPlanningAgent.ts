import { flushStepDeltas } from "../deltas/index.js";
import { loadParagons } from "../macro/paragons/load.js";
import { stepParagons } from "../macro/paragons/step.js";

/**
 * Autonomous Local Paragon Agent:
 * Thin orchestrator wrapper loading snapshot -> running pure stepParagons -> flushing deltas.
 */
export async function runLocalParagonAgent(client: any, tick: number, loreDate: string = "") {
  const snap = await loadParagons(client, tick, loreDate);
  const deltas = stepParagons(snap, { random: Math.random });
  if (deltas.length > 0) {
    await flushStepDeltas(client, "agent:paragons", tick, deltas);
  }
}
