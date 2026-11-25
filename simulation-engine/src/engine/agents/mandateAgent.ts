/**
 * mandateAgent.ts - Autonomous "Mandate of the Chain" Null Zealot Faction
 *
 * Drawn strictly from the 50% Null population, these are real cobblers, stonemasons,
 * and laborers embittered by chaos disasters or magical injustice. Their personalities
 * (Vengeful, Devout, Bitter, Desperate) dictate their hunt ferocity as they bind and
 * drain rogue sparkborn with elemental shackles, and then pilgrimage to the Dragon Prisons.
 */
import { flushStepDeltas } from "../deltas/index.js";
import {
  loadMandateRecruitCandidates,
  loadMandateWarbands,
  resolveMandateRecruits,
} from "../macro/mandate/load.js";
import {
  buildMandateRecruitDeltas,
  planMandateRecruits,
  stepMandateWarbands,
} from "../macro/mandate/step.js";

export async function runMandateAgent(client: any, tick: number, loreDate: string) {
  // Stage 1: Warband Formation outside Unrestful Burgs
  const { burgs, existingWarbandBurgIds } = await loadMandateRecruitCandidates(client);
  const chosenBurgs = planMandateRecruits(burgs, existingWarbandBurgIds, { random: Math.random });
  if (chosenBurgs.length > 0) {
    const recruits = await resolveMandateRecruits(client, tick, chosenBurgs);
    const recruitDeltas = buildMandateRecruitDeltas(tick, loreDate, recruits, { random: Math.random });
    if (recruitDeltas.length > 0) {
      await flushStepDeltas(client, "agent:mandateRecruit", tick, recruitDeltas);
    }
  }

  // Stage 2: Process All Active Mandate of the Chain Warbands
  const warbandSnap = await loadMandateWarbands(client, tick, loreDate);
  const warbandDeltas = stepMandateWarbands(warbandSnap, { random: Math.random });
  if (warbandDeltas.length > 0) {
    await flushStepDeltas(client, "agent:mandate", tick, warbandDeltas);
  }
}
