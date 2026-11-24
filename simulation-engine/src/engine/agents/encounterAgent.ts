import { flushStepDeltas } from "../deltas/index.js";
import { loadEncounter } from "../macro/encounter/load.js";
import { stepEncounter } from "../macro/encounter/step.js";

/**
 * Compatibility wrapper around the pure encounter macro step (Phase 2.3 #1).
 */
export async function runEncounterAgent(client: any, tick: number) {
  const snap = await loadEncounter(client);
  const deltas = stepEncounter(snap, { tick, random: Math.random });
  await flushStepDeltas(client, "agent:encounters", tick, deltas);
}
