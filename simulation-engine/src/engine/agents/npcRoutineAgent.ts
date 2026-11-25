import { PoolClient, Pool } from "pg";
import {
  evaluateNPCMind,
  exchangeGossip,
  NPCMindState,
  BurgEnvironmentalContext,
  ActionUtilityChoice
} from "../ai/npcMindPure";
import { flushStepDeltas } from "../deltas/index.js";
import { loadNpcRoutines } from "../macro/npcRoutines/load.js";
import { stepNpcRoutines } from "../macro/npcRoutines/step.js";

/**
 * NPC Routine & Logistics Agent (Two-Speed Cognition Architecture):
 * 1. Macro Daily Pass: Processes trade logistics, casualties, daily metabolic needs decay, and belief aging.
 * 2. Local Sector Pass: Evaluates intraday phase progression (Morning, Midday, Evening, Night)
 *    and emergent choices (Protest, Stay Home, Flee, Work, Hearth Gossip) without hardcoded schedules.
 */
export async function runNPCRoutineAgent(client: PoolClient, tick: number, loreDate: string) {
  const snap = await loadNpcRoutines(client, tick, loreDate);
  const deltas = stepNpcRoutines(snap, { random: Math.random });
  if (deltas.length > 0) {
    await flushStepDeltas(client, "agent:npcRoutines", tick, deltas);
  }
}

/**
 * LOCAL SECTOR INTRADAY PHASE PASS:
 * Evaluates individual citizen positions, routines, and hearth gossip progression
 * for the active sector where the player is currently operating.
 */
export async function updateSectorNPCRoutines(
  client: PoolClient | Pool,
  cellId: number,
  rx: number,
  ry: number,
  diurnalPhase: "MORNING" | "MIDDAY" | "EVENING" | "NIGHT"
) {
  const npcsRes = await client.query(`
    SELECT n.*, b.food as burg_food, b.wealth as burg_wealth, b.unrest as burg_unrest, b.crime_rate as burg_crime
    FROM sim_npc_instances n
    LEFT JOIN sim_burg_economy b ON n.cell_id = b.cell_id
    WHERE n.cell_id = $1 AND n.current_rx = $2 AND n.current_ry = $3 AND n.alive = true ORDER BY n.id
  `, [cellId, rx, ry]);

  if (npcsRes.rows.length === 0) return;

  const env: BurgEnvironmentalContext = {
    burgId: cellId,
    foodStock: Number(npcsRes.rows[0].burg_food) || 300,
    wealth: Number(npcsRes.rows[0].burg_wealth) || 500,
    unrest: Number(npcsRes.rows[0].burg_unrest) || 10,
    crimeRate: Number(npcsRes.rows[0].burg_crime) || 15,
    recentEvents: [],
    isDaytime: diurnalPhase === "MORNING" || diurnalPhase === "MIDDAY",
    diurnalPhase
  };

  const evaluatedStates: Array<{ row: any; mind: NPCMindState; result: any }> = [];

  for (const row of npcsRes.rows) {
    const mindState: NPCMindState = {
      npcId: row.id,
      role: row.role || "Citizen",
      instinct: row.instinct || "WARY",
      temper: row.temper || "STOIC",
      needs: typeof row.needs === "object" && row.needs !== null ? row.needs : { food: 0.8, rest: 0.8, coin: 0.5, safety: 0.8, company: 0.5 },
      mood: typeof row.mood === "object" && row.mood !== null ? row.mood : { fear: 0.1, anger: 0.1, joy: 0.2 },
      beliefs: Array.isArray(row.beliefs) ? row.beliefs : [],
      socialLinks: Array.isArray(row.social_links) ? row.social_links : [],
      lastAction: (row.schedule_state as ActionUtilityChoice) || "ROUTINE_WORK"
    };

    const evalResult = evaluateNPCMind(mindState, env, 6);
    evaluatedStates.push({ row, mind: mindState, result: evalResult });
  }

  // Evening Hearth Gossip Propagation: Beliefs spread along mutual social trust links
  if (diurnalPhase === "EVENING") {
    for (let i = 0; i < evaluatedStates.length; i++) {
      const speaker = evaluatedStates[i];
      if (!speaker || !speaker.result.gossipPayload) continue;

      for (let j = 0; j < evaluatedStates.length; j++) {
        if (i === j) continue;
        const listener = evaluatedStates[j];
        if (!listener) continue;
        // Check if listener has a social link to speaker
        const link = listener.mind.socialLinks.find(l => l.targetNpcId === speaker.row.id);
        const trust = link ? link.trust : 0.2; // Baseline acquaintance trust

        listener.mind = exchangeGossip(listener.mind, speaker.result.gossipPayload, trust);
      }
    }
  }

  // Bulk update spatial coordinates and schedule state based on chosenAction
  for (const item of evaluatedStates) {
    const { row, result } = item;
    let targetPos = row.local_pos;
    let taskName = result.actionReason;

    switch (result.chosenAction) {
      case "ROUTINE_WORK":
        targetPos = row.work_pos || row.local_pos;
        break;
      case "ROUTINE_LEISURE":
        // Central tavern/hearth coordinates
        targetPos = [
          Math.min(240, Math.max(15, Math.floor(((row.home_pos?.[0] || 128) + (row.work_pos?.[0] || 128)) / 2))),
          Math.min(240, Math.max(15, Math.floor(((row.home_pos?.[1] || 128) + (row.work_pos?.[1] || 128)) / 2)))
        ];
        break;
      case "ROUTINE_REST":
      case "STAY_HOME":
        targetPos = row.home_pos || row.local_pos;
        break;
      case "PROTEST_PLAZA":
        // Gather at central paved plaza [128, 128]
        targetPos = [128 + Math.floor(Math.random() * 8 - 4), 128 + Math.floor(Math.random() * 8 - 4)];
        break;
      case "HOARD_FOOD":
        // Move near market stalls
        targetPos = [132 + Math.floor(Math.random() * 6 - 3), 124 + Math.floor(Math.random() * 6 - 3)];
        break;
      case "FLEE_BURG":
        targetPos = [16, 16];
        break;
    }

    await client.query(`
      UPDATE sim_npc_instances
      SET local_pos = ARRAY[$1::integer, $2::integer],
          schedule_state = $3,
          current_task = $4,
          needs = $5,
          mood = $6,
          beliefs = $7,
          disposition = $8,
          trade_price_mult = $9,
          updated_at = NOW()
      WHERE id = $10
    `, [
      targetPos[0],
      targetPos[1],
      result.chosenAction,
      taskName,
      JSON.stringify(result.nextNeeds),
      JSON.stringify(result.nextMood),
      JSON.stringify(result.nextBeliefs),
      result.dispositionToPlayer,
      result.tradePriceMultiplier,
      row.id
    ]);
  }
}
