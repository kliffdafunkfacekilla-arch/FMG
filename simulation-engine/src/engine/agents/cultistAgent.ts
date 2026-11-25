/**
 * cultistAgent.ts - Autonomous Cultist lifecycle, burg infiltration, and seal siege engine
 *
 * Cultists are real citizens drawn from the municipal population (disenfranchised laborers,
 * bankrupt weavers, or bitter scribes). Their human personalities (Greedy, Fanatical, Scholarly,
 * Desperate) directly influence their behavior: greedy cultists siphon more gold, fanatical ones
 * cause higher unrest, and scholarly ones decipher and drain the ancient dragon seals twice as fast.
 */
import { dateForTick } from "../canon/calendar.js";
import { flushStepDeltas } from "../deltas/index.js";
import { sqlChance } from "../rng.js";
import { loadCultistRecruitCandidates, loadCultists } from "../macro/cultist/load.js";
import { stepCultistRecruitment, stepCultists } from "../macro/cultist/step.js";

export async function runCultistAgent(client: any, tick: number, loreDate: string) {
  // Capture ambient recharge RNG draw BEFORE Stage 1 recruitment so tick replay parity holds 100%.
  const isShadowWeek = dateForTick(tick).isShadowfall;
  const rechargeClause = !isShadowWeek ? sqlChance("g.id", 0.15) : "false";

  // Stage 1: Secret Infiltration Recruitment in Unrestful Burgs
  const recruitSnap = await loadCultistRecruitCandidates(client, tick, loreDate);
  if (recruitSnap.candidates.length > 0) {
    const recruitDeltas = stepCultistRecruitment(recruitSnap, { random: Math.random });
    if (recruitDeltas.length > 0) {
      await flushStepDeltas(client, "agent:cultistRecruit", tick, recruitDeltas);
    }
  }

  // Stage 2: Ambient grove recharge, active cultists & broken-seal apocalypse checks
  const snap = await loadCultists(client, tick, loreDate, rechargeClause);
  const deltas = stepCultists(snap, { random: Math.random });
  if (deltas.length > 0) {
    await flushStepDeltas(client, "agent:cultists", tick, deltas);
  }
}
