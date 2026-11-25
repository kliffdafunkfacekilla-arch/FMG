import { flushStepDeltas } from "../deltas/index.js";
import { loadFactionPlanning } from "../macro/factions/load.js";
import {
  evaluateFactionFinances,
  stepFactionPlanning,
  type FactionFinanceResult,
} from "../macro/factions/step.js";

export { evaluateFactionFinances, type FactionFinanceResult };

export async function runFactionPlanningAgent(client: any, tick: number, loreDate: string) {
  const snap = await loadFactionPlanning(client, tick, loreDate);
  const deltas = stepFactionPlanning(snap, { random: Math.random });
  if (deltas.length > 0) {
    await flushStepDeltas(client, "agent:factionPlanning", tick, deltas);
  }
}
