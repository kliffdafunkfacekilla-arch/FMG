import { hashSeed } from "../../rng.js";
import type { Delta } from "../../deltas/types.js";
import type { EncounterSnapshot } from "./load.js";

export interface StepContext {
  tick: number;
  random: () => number;
}

/**
 * Pure step for wandering beast and criminal encounters. Always draws the salt PRNG sample even
 * when no wandering agents exist so downstream tick RNG streams remain identical.
 */
export function stepEncounter(snap: EncounterSnapshot, ctx: StepContext): Delta[] {
  const salt = Math.floor(ctx.random() * 2147483647);
  if (snap.agents.length === 0 || snap.cellIds.length === 0) return [];

  const deltas: Delta[] = [];
  for (const agent of snap.agents) {
    const idx = hashSeed(`${agent.id}:${salt}`) % snap.cellIds.length;
    const targetCellId = snap.cellIds[idx]!;
    if (agent.location_cell_id !== targetCellId) {
      deltas.push({
        kind: "agent.update",
        agentId: agent.id,
        fields: { location_cell_id: targetCellId },
      });
    }
  }
  return deltas;
}
