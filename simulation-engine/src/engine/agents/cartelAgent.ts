import type { PoolClient } from "pg";
import { flushStepDeltas } from "../deltas/index.js";
import { ensureCartelBootstrap, loadCartels } from "../macro/cartels/load.js";
import { stepCartels } from "../macro/cartels/step.js";
import { ensureLairResidents, getCartelLairType } from "./outlawSyndicates.js";

export { getCartelLairType };

/**
 * Autonomous Fringe Factions & Underworld Syndicates Agent:
 * Thin orchestrator wrapper running ensureCartelBootstrap -> loadCartels ->
 * pure split stepCartels -> flushStepDeltas (+ resident seeding for newly founded lairs).
 */
export async function runCartelAgent(client: PoolClient, tick: number, loreDate: string) {
  await ensureCartelBootstrap(client, tick);
  const snap = await loadCartels(client, tick, loreDate);
  const { deltas, newLairsNeedingResidents } = stepCartels(snap, { random: Math.random });

  if (deltas.length > 0) {
    await flushStepDeltas(client, "agent:cartels", tick, deltas);
  }

  for (const req of newLairsNeedingResidents) {
    const lairRes = await client.query(
      `SELECT * FROM sim_fringe_lairs
       WHERE faction_id = $1 AND cell_id = $2 AND lair_type = $3
       ORDER BY id DESC LIMIT 1`,
      [req.factionId, req.cellId, req.lairType]
    );
    const newLair = lairRes.rows[0];
    if (newLair) {
      await ensureLairResidents(client, {
        ...newLair,
        cartel_name: req.cartelName,
        cartel_type: req.cartelType,
      });
    }
  }
}
