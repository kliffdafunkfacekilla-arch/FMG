import { PoolClient, Pool } from "pg";
import {
  evaluateNPCMind,
  exchangeGossip,
  NPCMindState,
  BurgEnvironmentalContext,
  ActionUtilityChoice
} from "../ai/npcMindPure";
import { sqlShuffle } from "../rng.js";

/**
 * NPC Routine & Logistics Agent (Two-Speed Cognition Architecture):
 * 1. Macro Daily Pass: Processes trade logistics, casualties, daily metabolic needs decay, and belief aging.
 * 2. Local Sector Pass: Evaluates intraday phase progression (Morning, Midday, Evening, Night)
 *    and emergent choices (Protest, Stay Home, Flee, Work, Hearth Gossip) without hardcoded schedules.
 */
export async function runNPCRoutineAgent(client: PoolClient, tick: number, loreDate: string) {
  // ---------------------------------------------------------------------------
  // 1. MACRO DAILY COGNITION PASS ACROSS PERSISTENT NPCS
  // ---------------------------------------------------------------------------
  // 1 Tick = 1 Full In-Game Day. We evaluate daily metabolic burn & belief decay for all living NPCs.
  const activeNpcsRes = await client.query(`
    SELECT n.*, b.food as burg_food, b.wealth as burg_wealth, b.unrest as burg_unrest, b.crime_rate as burg_crime
    FROM sim_npc_instances n
    LEFT JOIN sim_burg_economy b ON n.cell_id = b.cell_id
    WHERE n.alive = true ORDER BY n.id
    LIMIT 200
  `);

  if (activeNpcsRes.rows.length > 0) {
    // Ingest today's burg events
    const eventsRes = await client.query(`
      SELECT burg_id, type, message, tier
      FROM sim_events
      WHERE tick >= $1 - 1
      ORDER BY id DESC
      LIMIT 100
    `, [tick]);

    const eventsByBurg = new Map<number, Array<{ type: string; message: string; tier?: string }>>();
    for (const ev of eventsRes.rows) {
      const bId = ev.burg_id || 0;
      if (!eventsByBurg.has(bId)) eventsByBurg.set(bId, []);
      eventsByBurg.get(bId)!.push({ type: ev.type, message: ev.message, tier: ev.tier });
    }

    // Process daily mind evaluation
    for (const row of activeNpcsRes.rows) {
      const burgId = row.cell_id;
      const env: BurgEnvironmentalContext = {
        burgId,
        foodStock: Number(row.burg_food) || 300,
        wealth: Number(row.burg_wealth) || 500,
        unrest: Number(row.burg_unrest) || 10,
        crimeRate: Number(row.burg_crime) || 15,
        recentEvents: eventsByBurg.get(burgId) || [],
        isDaytime: true,
        diurnalPhase: "MIDDAY"
      };

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

      const evalResult = evaluateNPCMind(mindState, env, 24);

      await client.query(`
        UPDATE sim_npc_instances
        SET needs = $1,
            mood = $2,
            beliefs = $3,
            disposition = $4,
            trade_price_mult = $5,
            updated_at = NOW()
        WHERE id = $6
      `, [
        JSON.stringify(evalResult.nextNeeds),
        JSON.stringify(evalResult.nextMood),
        JSON.stringify(evalResult.nextBeliefs),
        evalResult.dispositionToPlayer,
        evalResult.tradePriceMultiplier,
        row.id
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. TRADE CONVOYS & LOGISTICS ROUTE MOVEMENT
  // ---------------------------------------------------------------------------
  const activeRoutes = await client.query(`
    SELECT r.*, s.food as src_food, s.wealth as src_wealth, d.food as dst_food, d.unrest as dst_unrest
    FROM sim_trade_routes r
    JOIN sim_burg_economy s ON r.source_burg_id = s.burg_id
    JOIN sim_burg_economy d ON r.dest_burg_id = d.burg_id
    WHERE r.status = 'ACTIVE'
    ORDER BY ${sqlShuffle("r.source_burg_id || '-' || r.dest_burg_id")}
    LIMIT 10
  `);

  for (const route of activeRoutes.rows) {
    if (route.src_food > 400 && route.dst_food < 200) {
      const transferFood = Math.min(60, Math.floor(route.volume * 0.4));
      const ambushRoll = Math.random() * 100;
      const isAmbushed = ambushRoll < (route.risk_level * 15);

      if (isAmbushed) {
        await client.query(`
          UPDATE sim_burg_economy
          SET food = GREATEST(0, food - $1)
          WHERE burg_id = $2
        `, [transferFood, route.source_burg_id]);

        await client.query(`
          UPDATE sim_fringe_lairs
          SET inventory = jsonb_set(
            COALESCE(inventory, '{}'::jsonb),
            '{stolen_rations}',
            (COALESCE(inventory->>'stolen_rations', '0')::int + $1)::text::jsonb
          )
          WHERE burg_id = $2 OR cell_id IN (SELECT cell_id FROM sim_burg_economy WHERE burg_id = $2)
        `, [transferFood, route.dest_burg_id]);

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
          VALUES ($1, 'CARAVAN_AMBUSH', $2, 'MINOR', $3, $4)
        `, [
          tick,
          `Trade convoy from Burg ${route.source_burg_id} toward Burg ${route.dest_burg_id} was plundered by highway outlaws! Food failed to arrive.`,
          route.dest_burg_id,
          loreDate
        ]);
      } else {
        await client.query(`
          UPDATE sim_burg_economy
          SET food = food - $1
          WHERE burg_id = $2
        `, [transferFood, route.source_burg_id]);

        await client.query(`
          UPDATE sim_burg_economy
          SET food = food + $1,
              unrest = GREATEST(0, unrest - 2)
          WHERE burg_id = $2
        `, [transferFood, route.dest_burg_id]);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. CASUALTY CONSEQUENCES OF SLAIN ARTISANS & PRODUCERS
  // ---------------------------------------------------------------------------
  const deceasedProducers = await client.query(`
    SELECT cell_id, role, COUNT(*) as dead_count
    FROM sim_npc_instances
    WHERE alive = false 
      AND updated_at >= NOW() - INTERVAL '1 day'
      AND processed_for_economy IS NOT TRUE
    GROUP BY cell_id, role
  `);

  for (const d of deceasedProducers.rows) {
    if (d.role.includes("Smith") || d.role.includes("Artisan")) {
      await client.query(`
        UPDATE sim_burg_economy
        SET refined_goods = GREATEST(0, refined_goods - ($1 * 15))
        WHERE cell_id = $2
      `, [Number(d.dead_count), d.cell_id]);
    } else if (d.role.includes("Provisioner") || d.role.includes("Trapper") || d.role.includes("Farmer")) {
      await client.query(`
        UPDATE sim_burg_economy
        SET food = GREATEST(0, food - ($1 * 10))
        WHERE cell_id = $2
      `, [Number(d.dead_count), d.cell_id]);
    }
  }

  // Deduplicate: mark all deceased NPCs as processed so their death is not deducted repeatedly on future ticks
  await client.query(`
    UPDATE sim_npc_instances
    SET processed_for_economy = true
    WHERE alive = false AND processed_for_economy IS NOT TRUE
  `);
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
