/**
 * wardenAgent.ts - Autonomous Grey Warden Lifecycle, Aether-Tech Sigil Magic,
 * Ancient Ward Awakenings, Eyeless Flow-Seers, and Spire Crypt Alcoves.
 */
import { flushStepDeltas } from "../deltas/index.js";
import { loadWardenAwakening, loadWardens } from "../macro/warden/load.js";
import { stepWardenAwakening, stepWardens } from "../macro/warden/step.js";

export async function runWardenAgent(client: any, tick: number, loreDate: string) {
  // Stage 1: Ancient Ward Recharge & Organic Recruitment Awakenings
  const awakeSnap = await loadWardenAwakening(client, tick, loreDate, { random: Math.random });
  const awakeDeltas = stepWardenAwakening(awakeSnap, { random: Math.random });
  if (awakeDeltas.length > 0) {
    await flushStepDeltas(client, "agent:wardenAwaken", tick, awakeDeltas);
  }

  // Stage 2: Process All Active Grey Wardens, Eyeless Elders & Mad Hermits
  const wardenSnap = await loadWardens(client, tick, loreDate);
  const wardenDeltas = stepWardens(wardenSnap, { random: Math.random });
  if (wardenDeltas.length > 0) {
    await flushStepDeltas(client, "agent:wardens", tick, wardenDeltas);
  }
}
