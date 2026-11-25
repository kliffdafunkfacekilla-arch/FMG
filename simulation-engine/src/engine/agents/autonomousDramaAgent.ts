import type { PoolClient } from "pg";
import { flushStepDeltas } from "../deltas/index.js";
import { loadAutonomousDrama } from "../macro/autonomousDrama/load.js";
import { stepAutonomousDrama } from "../macro/autonomousDrama/step.js";

/**
 * Autonomous Drama Agent (Motive vs. Obstacle Loop)
 * Picks restless actors in pressured burgs, collides their `want`/`flaw`/`line_wont_cross`
 * against a real local target and cell tags via deterministic dice, mutates Postgres state,
 * and opens multi-actor `AUTONOMOUS_CLASH` threads that resolve with or without the party.
 */
export async function runAutonomousDramaAgent(
  client: PoolClient,
  tick: number,
  loreDate: string
): Promise<number> {
  const snap = await loadAutonomousDrama(client, tick, loreDate);
  const out = stepAutonomousDrama(snap);
  if (out.deltas.length > 0) {
    await flushStepDeltas(client, "agent:autonomousDrama", tick, out.deltas);
  }
  return out.clashesOpened;
}
