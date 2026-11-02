/**
 * mandateAgent.ts - Autonomous "Mandate of the Chain" Null Zealot Faction
 *
 * Drawn strictly from the 50% Null population, these are real cobblers, stonemasons,
 * and laborers embittered by chaos disasters or magical injustice. Their personalities
 * (Vengeful, Devout, Bitter, Desperate) dictate their hunt ferocity as they bind and
 * drain rogue sparkborn with elemental shackles, and then pilgrimage to the Dragon Prisons.
 */

import { stepTowardCell, getNearestSacredGrove } from "./agentMovementHelper.js";
import { recruitMandatePersona } from "./citizenPersonaHelper.js";

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
      const citizen = recruitMandatePersona(burg.name || `Burg #${burg.burg_id}`);

      await client.query(`
        INSERT INTO sim_agents (
          name, citizen_name, profession, species, spark_tier,
          personality_temper, personality_instinct, motivation,
          role, sub_role, home_burg_id, location_cell_id,
          state, drained_power, age_ticks, active_plot
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          'Chain_Zealot', 'Chain_Inquisitor', $9, $10,
          'WITCH_HUNTING', 0, 0, $11
        )
      `, [
        `Inquisitor ${citizen.citizenName} (${citizen.profession})`,
        citizen.citizenName,
        citizen.profession,
        citizen.species,
        citizen.sparkTier,
        citizen.temper,
        citizen.instinct,
        citizen.motivation,
        burg.burg_id,
        burg.cell_id,
        `Null crusade outside ${burg.name} [${citizen.temper}]: ${citizen.motivation}`
      ]);

      if (Math.random() < 0.3) {
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier)
          VALUES ($1, 'CHAIN_WARBAND_FORGED', $2, 'BACKGROUND')
        `, [tick, `Fanatical Nulls outside ${burg.name} banded together under ${citizen.citizenName}, a ${citizen.temper.toLowerCase()} former ${citizen.profession.toLowerCase()}, forging a chapter of the Mandate of the Chain.`]);
      }
    }
  }

  // 2. Process All Active Mandate of the Chain Warbands
  const warbandsRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper, personality_instinct,
           spark_tier, sub_role, home_burg_id, location_cell_id, target_cell_id,
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
    const temper = wb.personality_temper || 'FANATICAL';
    const citizenName = wb.citizen_name || wb.name;
    const profession = wb.profession || 'Laborer';

    // Personality Multipliers
    const ferocityMult = temper === 'VENGEFUL' ? 1.8 : temper === 'BITTER' ? 1.5 : 1.0;

    // --- PHASE A: WITCH-HUNTING OUTSIDE BURGS ---
    if (state === 'WITCH_HUNTING') {
      if (Math.random() < 0.65) {
        const stolenSpark = Math.round((Math.floor(Math.random() * 12 + 15)) * ferocityMult);
        drainedPower += stolenSpark;

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
          `, [tick, `${citizenName} (${profession}) and their chain-militia cornered a wild sparkborn in the outskirts, draining their power into humming null-iron shackles.`]);
        }
      }

      // Shackles Saturated Check
      if (drainedPower >= 50) {
        const nearestGrove = await getNearestSacredGrove(client, locCellId);
        if (nearestGrove) {
          state = 'PILGRIMAGE_TO_SEAL';
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cell_id;

          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'CHAIN_PILGRIMAGE', $2, 'MINOR')
          `, [tick, `Carrying shackles heavy with stolen spark power, ${citizenName} (${profession}) led their Mandate pilgrimage toward the Prison of ${nearestGrove.dragon_name} to cleanse the land.`]);
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

      // The Great Irony: Stolen sparks strengthen the cosmic wards!
      if (targetGroveId) {
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = LEAST(100, seal_strength + $1)
          WHERE id = $2
        `, [strengthBonus, targetGroveId]);
      }

      drainedPower = 0;
      state = 'WITCH_HUNTING';

      if (burgId) {
        const homeCellRes = await client.query("SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1", [burgId]);
        targetCellId = homeCellRes.rows[0]?.cell_id || locCellId;
      }

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier)
        VALUES ($1, 'CHAIN_PURIFICATION_IRON', $2, 'MAJOR')
      `, [tick, `⛓️ THE IRON REINFORCEMENT: ${citizenName} (${profession}) knelt before the Prison of ${dragonName}, discharging their glowing chains! Convinced they purged a demonic font, their stolen spark energy has reinforced the ancient cosmic seal (+${strengthBonus}% Seal Strength)!`]);
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
