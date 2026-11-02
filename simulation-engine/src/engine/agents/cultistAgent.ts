/**
 * cultistAgent.ts - Autonomous Cultist lifecycle, burg infiltration, and seal siege engine
 *
 * Cultists spawn in secret inside unrestful burgs, sabotaging them from within by
 * siphoning treasury coin and elevating local chaos. When corruption peaks or the
 * cell is exposed, they make an unhallowed pilgrimage to the nearest Dragon Prison
 * to break the cosmic seal, eventually ascending into ancient Cult Priests.
 */

import { stepTowardCell, getNearestSacredGrove } from "./agentMovementHelper.js";

export async function runCultistAgent(client: any, tick: number, loreDate: string) {
  // 1. Secret Infiltration Recruitment in Unrestful Burgs
  const unrestBurgsRes = await client.query(`
    SELECT b.burg_id, b.cell_id, b.wealth, b.unrest, b.name
    FROM sim_burg_economy b
    WHERE b.unrest >= 25
    ORDER BY b.unrest DESC
  `);

  for (const burg of unrestBurgsRes.rows) {
    // Check if burg already hosts an active infiltrator
    const existingInfiltrator = await client.query(
      "SELECT id FROM sim_agents WHERE role = 'Cultist' AND home_burg_id = $1 AND state = 'INFILTRATING'",
      [burg.burg_id]
    );

    if (existingInfiltrator.rowCount === 0) {
      // Spawn chance scales with unrest (25% at 30 unrest, up to 60% at 80+ unrest)
      const spawnChance = Math.min(0.60, burg.unrest / 130);
      if (Math.random() < spawnChance) {
        await client.query(`
          INSERT INTO sim_agents (
            name, role, sub_role, home_burg_id, location_cell_id,
            state, corruption, age_ticks, active_plot
          ) VALUES (
            $1, 'Cultist', 'Cultist_Infiltrator', $2, $3,
            'INFILTRATING', 5, 0, 'Siphoning municipal wealth and seeding dark rituals'
          )
        `, [`Cabal of ${burg.name || 'Unrest'}`, burg.burg_id, burg.cell_id]);

        if (Math.random() < 0.25) {
          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'CULT_INFILTRATION', $2, 'BACKGROUND')
          `, [tick, `Whispers of blood pacts take root in the shadows of ${burg.name}. A secret Cultist cabal has formed.`]);
        }
      }
    }
  }

  // 2. Process All Active Cultists
  const cultistsRes = await client.query(`
    SELECT id, name, sub_role, home_burg_id, location_cell_id, target_cell_id,
           target_grove_id, state, corruption, age_ticks
    FROM sim_agents
    WHERE role = 'Cultist'
  `);

  for (const c of cultistsRes.rows) {
    const age = (c.age_ticks || 0) + 1;
    let corruption = c.corruption || 0;
    let state = c.state || 'INFILTRATING';
    let subRole = c.sub_role || 'Cultist_Infiltrator';
    let locCellId = c.location_cell_id;
    let targetCellId = c.target_cell_id;
    let targetGroveId = c.target_grove_id;

    // --- PHASE A: SECRET INFILTRATION IN BURG ---
    if (state === 'INFILTRATING') {
      corruption += Math.floor(Math.random() * 3 + 2);
      const burgId = c.home_burg_id;

      // Sabotage: Siphon burg treasury & spike unrest
      const coinTheft = Math.floor(Math.random() * 12 + 6);
      await client.query(`
        UPDATE sim_burg_economy
        SET wealth = GREATEST(0, wealth - $1),
            unrest = LEAST(100, unrest + 2)
        WHERE burg_id = $2
      `, [coinTheft, burgId]);

      // Seed ecological chaos / blight in local cell
      await client.query(`
        UPDATE sim_cells
        SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0.0) + 0.04)
        WHERE id = $1
      `, [locCellId]);

      // Check for Exodus Trigger (corruption >= 35 or burg unrest >= 70)
      const burgStateRes = await client.query("SELECT unrest, name FROM sim_burg_economy WHERE burg_id = $1", [burgId]);
      const currentUnrest = burgStateRes.rows[0]?.unrest || 0;
      const burgName = burgStateRes.rows[0]?.name || 'the province';

      if (corruption >= 35 || currentUnrest >= 70 || Math.random() < 0.08) {
        // Find nearest Sacred Grove (Dragon Prison) to target
        const nearestGrove = await getNearestSacredGrove(client, locCellId);
        if (nearestGrove) {
          state = 'TRAVELING_TO_SEAL';
          subRole = 'Cultist_Pilgrim';
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cell_id;

          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'CULT_EXODUS', $2, 'MINOR')
          `, [tick, `After siphoning municipal vaults and spreading dark blight, the Cultist cabal of ${burgName} fled into the wilderness on a pilgrimage toward the Prison of ${nearestGrove.dragon_name}!`]);
        }
      }
    }

    // --- PHASE B: OVERLAND PILGRIMAGE TO DRAGON PRISON ---
    else if (state === 'TRAVELING_TO_SEAL') {
      corruption += 1;
      if (!targetCellId && targetGroveId) {
        const groveRes = await client.query("SELECT cell_id FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
        targetCellId = groveRes.rows[0]?.cell_id;
      }

      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 65);
        locCellId = moveResult.nextCellId;

        // Radiate minor blight along traveling vector
        await client.query(`
          UPDATE sim_cells
          SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0.0) + 0.02)
          WHERE id = $1
        `, [locCellId]);

        if (moveResult.arrived || locCellId === targetCellId) {
          state = 'BESIEGING_SEAL';
          const groveRes = await client.query("SELECT dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
          const dragonName = groveRes.rows[0]?.dragon_name || 'Chaos';
          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'SEAL_BESIEGED', $2, 'MINOR')
          `, [tick, `Cultist pilgrims have reached the holy precinct of the Prison of ${dragonName}, beginning blasphemous rites to shatter the cosmic seal!`]);
        }
      }
    }

    // --- PHASE C: BESIEGING & DRAINING THE DRAGON PRISON ---
    else if (state === 'BESIEGING_SEAL') {
      corruption += 2;

      // Promotion check to Cult Priest (veteran survival & deep corruption)
      if (subRole !== 'Cult_Priest' && (corruption >= 70 || age >= 30)) {
        subRole = 'Cult_Priest';
        const groveRes = await client.query("SELECT dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
        const dName = groveRes.rows[0]?.dragon_name || 'Chaos';
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier)
          VALUES ($1, 'CULT_PRIEST_ASCENSION', $2, 'MAJOR')
        `, [tick, `A veteran cultist at the Prison of ${dName} has fully succumbed to primordial corruption, ascending as a Hierophant High Priest of Chaos!`]);
      }

      const isPriest = subRole === 'Cult_Priest';
      const sealDrain = isPriest ? 2 : 1;

      // Drain Dragon Seal Strength
      if (targetGroveId) {
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = GREATEST(0, seal_strength - $1)
          WHERE id = $2
        `, [sealDrain, targetGroveId]);
      }

      // Heavily warp local ecology with chaotic blight
      await client.query(`
        UPDATE sim_cells
        SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0.0) + $1)
        WHERE id = $2
      `, [isPriest ? 0.08 : 0.04, locCellId]);
    }

    // Persist updated state
    await client.query(`
      UPDATE sim_agents
      SET location_cell_id = $1,
          target_cell_id = $2,
          target_grove_id = $3,
          state = $4,
          sub_role = $5,
          corruption = $6,
          age_ticks = $7
      WHERE id = $8
    `, [locCellId, targetCellId, targetGroveId, state, subRole, corruption, age, c.id]);
  }
}
