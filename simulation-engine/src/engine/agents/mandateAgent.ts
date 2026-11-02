/**
 * mandateAgent.ts - Autonomous "Mandate of the Chain" Null Zealot Faction
 *
 * Born from the 50% Null population, the Mandate of the Chain zealously believes
 * that Sparks are the root source of planetary chaos. Armed with elemental chains,
 * they form warbands outside burgs to hunt hedge wizards, draining their sparks to the death.
 * In tragic irony, when they pilgrimage to Dragon Prisons to discharge this power,
 * they inadvertently reinforce and strengthen the ancient seals!
 */

import { stepTowardCell, getNearestSacredGrove } from "./agentMovementHelper.js";

export async function runMandateAgent(client: any, tick: number, loreDate: string) {
  // 1. Warband Formation outside Unrestful Burgs
  const unrestBurgsRes = await client.query(`
    SELECT b.burg_id, b.cell_id, b.unrest, b.name, b.pop_null
    FROM sim_burg_economy b
    WHERE b.unrest >= 28 AND b.pop_null >= 100
    ORDER BY b.unrest DESC
  `);

  for (const burg of unrestBurgsRes.rows) {
    const existingWarband = await client.query(
      "SELECT id FROM sim_agents WHERE role = 'Chain_Zealot' AND home_burg_id = $1",
      [burg.burg_id]
    );

    if (existingWarband.rowCount === 0 && Math.random() < 0.25) {
      await client.query(`
        INSERT INTO sim_agents (
          name, role, sub_role, home_burg_id, location_cell_id,
          state, drained_power, age_ticks, active_plot
        ) VALUES (
          $1, 'Chain_Zealot', 'Chain_Inquisitor', $2, $3,
          'WITCH_HUNTING', 0, 0, 'Hunting hedge wizards with elemental dampening chains'
        )
      `, [`Inquisitors of the Chain (${burg.name || 'Hinterlands'})`, burg.burg_id, burg.cell_id]);

      if (Math.random() < 0.3) {
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier)
          VALUES ($1, 'CHAIN_WARBAND_FORGED', $2, 'BACKGROUND')
        `, [tick, `Fanatical Nulls outside ${burg.name} have forged a chapter of the Mandate of the Chain, vowing to hunt sparkborn practitioners with elemental shackles.`]);
      }
    }
  }

  // 2. Process All Active Mandate of the Chain Warbands
  const warbandsRes = await client.query(`
    SELECT id, name, sub_role, home_burg_id, location_cell_id, target_cell_id,
           target_grove_id, state, drained_power, age_ticks
    FROM sim_agents
    WHERE role = 'Chain_Zealot'
  `);

  for (const wb of warbandsRes.rows) {
    const age = (wb.age_ticks || 0) + 1;
    let drainedPower = wb.drained_power || 0;
    let state = wb.state || 'WITCH_HUNTING';
    let subRole = wb.sub_role || 'Chain_Inquisitor';
    let locCellId = wb.location_cell_id;
    let targetCellId = wb.target_cell_id;
    let targetGroveId = wb.target_grove_id;
    const burgId = wb.home_burg_id;

    // --- PHASE A: WITCH-HUNTING OUTSIDE BURGS ---
    if (state === 'WITCH_HUNTING') {
      // Hunt wandering hedge wizards and drain their spark essence
      if (Math.random() < 0.65) {
        const stolenSpark = Math.floor(Math.random() * 15 + 15);
        drainedPower += stolenSpark;

        // Drain 1 rogue sparkborn from the regional population & relieve fearful nulls
        if (burgId) {
          await client.query(`
            UPDATE sim_burg_economy
            SET pop_attuned = GREATEST(0, pop_attuned - 1),
                unrest = GREATEST(0, unrest - 1)
            WHERE burg_id = $1
          `, [burgId]);
        }

        if (Math.random() < 0.20) {
          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'WITCH_HUNT_EXECUTION', $2, 'BACKGROUND')
          `, [tick, `The Mandate of the Chain captured a wild hedge wizard in the hinterlands, draining their spark into glowing elemental shackles.`]);
        }
      }

      // Check if shackles are saturated (ready for Dragon Prison Pilgrimage)
      if (drainedPower >= 50) {
        const nearestGrove = await getNearestSacredGrove(client, locCellId);
        if (nearestGrove) {
          state = 'PILGRIMAGE_TO_SEAL';
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cell_id;

          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'CHAIN_PILGRIMAGE', $2, 'MINOR')
          `, [tick, `Bearing chains humming with stolen spark essence, ${wb.name} has begun a holy pilgrimage to the Prison of ${nearestGrove.dragon_name} to "dispel the font of chaos."`]);
        }
      }
    }

    // --- PHASE B: PILGRIMAGE TO DRAGON PRISON ---
    else if (state === 'PILGRIMAGE_TO_SEAL') {
      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 65);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          state = 'DISCHARGING_CHAINS';
        }
      }
    }

    // --- PHASE C: DISCHARGING CHAINS INTO DRAGON PRISONS (THE METAPHYSICAL IRONY) ---
    else if (state === 'DISCHARGING_CHAINS') {
      const groveRes = await client.query("SELECT dragon_name, seal_strength FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
      const dragonName = groveRes.rows[0]?.dragon_name || 'Chaos';
      const strengthBonus = Math.floor(Math.random() * 3 + 5); // +5 to +7 strength

      // The Irony: They strengthen the seal!
      if (targetGroveId) {
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = LEAST(100, seal_strength + $1)
          WHERE id = $2
        `, [strengthBonus, targetGroveId]);
      }

      // Reset drained power
      drainedPower = 0;
      state = 'WITCH_HUNTING';

      // Set target back to home burg cell
      if (burgId) {
        const homeCellRes = await client.query("SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1", [burgId]);
        targetCellId = homeCellRes.rows[0]?.cell_id || locCellId;
      }

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier)
        VALUES ($1, 'CHAIN_PURIFICATION_IRON', $2, 'MAJOR')
      `, [tick, `⛓️ THE IRON REINFORCEMENT: The Mandate of the Chain discharged their glowing elemental shackles into the Prison of ${dragonName}! Convinced they purged an unholy font of corruption, their stolen spark energy has inadvertently supercharged the ancient wards (+${strengthBonus}% Seal Strength)!`]);
    }

    // Persist updated state
    await client.query(`
      UPDATE sim_agents
      SET location_cell_id = $1,
          target_cell_id = $2,
          target_grove_id = $3,
          state = $4,
          sub_role = $5,
          drained_power = $6,
          age_ticks = $7
      WHERE id = $8
    `, [locCellId, targetCellId, targetGroveId, state, subRole, drainedPower, age, wb.id]);
  }
}
