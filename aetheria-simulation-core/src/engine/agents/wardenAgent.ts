/**
 * wardenAgent.ts - Autonomous Grey Warden lifecycle, Sigil casting, and Kamikaze Martyrdom
 *
 * Wardens are living mortal channelers and adepts drawn from temples, city watches, and
 * apothecaries who heard the cosmic summons. Their personalities (Stoic, Compassionate,
 * Scholarly, Fanatical) influence their service: stoic wardens resist corruption longer
 * and anchor seals firmly; compassionate wardens cleanse double the ecological blight.
 * Upon terminal corruption, their final heroic kamikaze nuke honors their true soul.
 */

import { stepTowardCell, getWeakestSacredGrove, getNearestCultistCell } from "./agentMovementHelper.js";
import { recruitWardenPersona } from "./citizenPersonaHelper.js";

const CONVERGENCE_SPIRE_CELL = 16166; // The Verge (Sacred Spire)

export async function runWardenAgent(client: any, tick: number, loreDate: string) {
  // 1. Maintain the Order at the Spire of Convergence (draw from civilian adepts & sensitives)
  const activeWardensRes = await client.query("SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Warden'");
  const wardenCount = parseInt(activeWardensRes.rows[0].total) || 0;

  if (wardenCount < 16 && Math.random() < 0.35) {
    // Query pre-rendered citizen pool for civilian Channelers, Adepts, or Sensitives
    const recruitRes = await client.query(`
      SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
      FROM population_demographics
      WHERE spark_tier IN ('CHANNELER', 'ADEPT', 'SENSITIVE')
        AND allegiance_status = 'CIVILIAN'
      ORDER BY 
        CASE WHEN spark_tier = 'ADEPT' THEN 1 WHEN spark_tier = 'CHANNELER' THEN 2 ELSE 3 END,
        RANDOM()
      LIMIT 1
    `);

    const dbCitizen = recruitRes.rows[0];
    const citizen = dbCitizen ? {
      citizenName: dbCitizen.name,
      profession: dbCitizen.profession,
      species: dbCitizen.species,
      sparkTier: dbCitizen.spark_tier,
      temper: dbCitizen.temper,
      instinct: dbCitizen.instinct,
      motivation: dbCitizen.motivation
    } : recruitWardenPersona();

    if (dbCitizen) {
      await client.query(
        "UPDATE population_demographics SET allegiance_status = 'WARDEN_SENTINEL' WHERE citizen_id = $1",
        [dbCitizen.citizen_id]
      );
    }

    await client.query(`
      INSERT INTO sim_agents (
        name, citizen_name, profession, species, spark_tier,
        personality_temper, personality_instinct, motivation,
        role, sub_role, location_cell_id, state,
        corruption, age_ticks, active_plot
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        'Warden', 'Warden_Sentinel', $9, 'AT_SPIRE',
        0, 0, $10
      )
    `, [
      `Warden ${citizen.citizenName} (${citizen.profession})`,
      citizen.citizenName,
      citizen.profession,
      citizen.species,
      citizen.sparkTier,
      citizen.temper,
      citizen.instinct,
      citizen.motivation,
      CONVERGENCE_SPIRE_CELL,
      `Vigil at the Spire of Convergence [${citizen.temper}]: ${citizen.motivation}`
    ]);
  }

  // 2. Process All Active Wardens
  const wardensRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper, personality_instinct,
           spark_tier, sub_role, location_cell_id, target_cell_id,
           target_grove_id, state, corruption, age_ticks
    FROM sim_agents
    WHERE role = 'Warden'
  `);

  for (const w of wardensRes.rows) {
    const age = (w.age_ticks || 0) + 1;
    let corruption = w.corruption || 0;
    let state = w.state || 'AT_SPIRE';
    let subRole = w.sub_role || 'Warden_Sentinel';
    let locCellId = w.location_cell_id || CONVERGENCE_SPIRE_CELL;
    let targetCellId = w.target_cell_id;
    let targetGroveId = w.target_grove_id;
    const temper = w.personality_temper || 'STOIC';
    const citizenName = w.citizen_name || w.name;
    const profession = w.profession || 'Guardian';

    // Personality Multipliers
    const sealRepairBonus = temper === 'STOIC' ? 4 : temper === 'SCHOLARLY' ? 4 : 3;
    const blightCleanseAmt = temper === 'COMPASSIONATE' ? 0.8 : 0.4;
    const terminalCorruptionThreshold = temper === 'STOIC' ? 95 : 85;

    // --- PHASE A: STATIONED AT THE SPIRE ---
    if (state === 'AT_SPIRE') {
      const endangeredGrove = await getWeakestSacredGrove(client);
      if (endangeredGrove && (endangeredGrove.seal_strength < 100 || Math.random() < 0.25)) {
        state = 'TRAVELING_TO_SEAL';
        targetGroveId = endangeredGrove.id;
        targetCellId = endangeredGrove.cell_id;

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'WARDEN_DISPATCH', $2, 'MINOR', $3)
        `, [tick, `${citizenName} (a ${temper.toLowerCase()} former ${profession.toLowerCase()}) departed the Spire to reinforce the Prison of ${endangeredGrove.dragon_name} (Seal: ${endangeredGrove.seal_strength}%).`, loreDate]);
      }
    }

    // --- PHASE B: TRAVELING OUTWARD TO SACRED GROVE ---
    else if (state === 'TRAVELING_TO_SEAL' || state === 'RETURNING_TO_SPIRE') {
      if (state === 'TRAVELING_TO_SEAL' && (!targetCellId || !targetGroveId)) {
        const endangeredGrove = await getWeakestSacredGrove(client);
        if (endangeredGrove) {
          targetGroveId = endangeredGrove.id;
          targetCellId = endangeredGrove.cell_id;
        } else {
          targetCellId = CONVERGENCE_SPIRE_CELL;
        }
      }
      const dest = state === 'RETURNING_TO_SPIRE' ? CONVERGENCE_SPIRE_CELL : targetCellId;
      if (dest) {
        const moveResult = await stepTowardCell(client, locCellId, dest, 70);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === dest) {
          if (state === 'RETURNING_TO_SPIRE') {
            state = 'AT_SPIRE';
            targetGroveId = null;
            targetCellId = null;
          } else {
            state = 'STRENGTHENING_SEAL';
            // Clash with any cultists present at this seal
            const hostileCultists = await client.query(
              "SELECT id, name FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1",
              [locCellId]
            );
            for (const hc of hostileCultists.rows) {
              await client.query("DELETE FROM sim_agents WHERE id = $1", [hc.id]);
              await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, lore_date)
                VALUES ($1, 'WARDEN_CLASH', $2, 'MINOR', $3)
              `, [tick, `⚔️ ${citizenName} (${profession}) drew their halberd and executed ${hc.name} while defending the dragon seal grounds!`, loreDate]);
            }
          }
        }
      }
    }

    // --- PHASE C: SIGIL CASTING & SEAL REINFORCEMENT ---
    else if (state === 'STRENGTHENING_SEAL') {
      // Restore Dragon Seal Strength
      if (targetGroveId) {
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = LEAST(100, seal_strength + $1)
          WHERE id = $2
        `, [sealRepairBonus, targetGroveId]);
      }

      // Cleanse local eco-blight
      await client.query(`
        UPDATE sim_cells
        SET eco_blight = GREATEST(0.0, COALESCE(eco_blight, 0.0) - $1)
        WHERE id = $2
      `, [blightCleanseAmt, locCellId]);

      // Tragic Cost: Sigil casting against raw primordial chaos inflicts corruption
      corruption += Math.floor(Math.random() * 4 + 3);

      const groveCheck = await client.query("SELECT seal_strength, dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
      const currentSeal = groveCheck.rows[0]?.seal_strength || 100;
      const dragonName = groveCheck.rows[0]?.dragon_name || 'Chaos';

      // Terminal Corruption: The Kamikaze Decision
      if (corruption >= terminalCorruptionThreshold) {
        state = 'KAMIKAZE_RUN';
        subRole = 'Warden_Martyr';

        const cultTarget = await getNearestCultistCell(client, locCellId);
        if (cultTarget) {
          targetCellId = cultTarget.cell_id;
        } else {
          const unrestBurg = await client.query("SELECT cell_id FROM sim_burg_economy ORDER BY unrest DESC LIMIT 1");
          targetCellId = unrestBurg.rows[0]?.cell_id || CONVERGENCE_SPIRE_CELL;
        }

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'WARDEN_TERMINAL_RESOLVE', $2, 'MAJOR', $3)
        `, [tick, `⚠️ SACRIFICIAL RESOLVE: ${citizenName} (${profession}), terminally warped by anchoring the Prison of ${dragonName}, has chosen martyrdom over madness. Bearing their ancestral sigil core, they march toward a cult sanctuary to unleash a terminal supernova!`, loreDate]);
      } else if (currentSeal >= 100) {
        state = 'RETURNING_TO_SPIRE';
        targetCellId = CONVERGENCE_SPIRE_CELL;
      }
    }

    // --- PHASE D: THE KAMIKAZE TACTICAL NUKE STRIKE ---
    else if (state === 'KAMIKAZE_RUN') {
      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 80);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          // --- DETONATE MAGICAL TACTICAL NUKE ---
          const cultsPurged = await client.query("DELETE FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1 RETURNING id", [locCellId]);
          await client.query("UPDATE sim_cells SET eco_blight = 0.0 WHERE id = $1", [locCellId]);
          await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25) WHERE cell_id = $1", [locCellId]);
          await client.query("DELETE FROM sim_agents WHERE id = $1", [w.id]);

          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, lore_date)
            VALUES ($1, 'WARDEN_SUPERNOVA', $2, 'MAJOR', $3)
          `, [tick, `💥 HEROIC SUPERNOVA: ${citizenName}, the ${profession.toLowerCase()} turned Grey Warden martyr, detonated their soul-spark in an apocalyptic sigil rupture at Cell #${locCellId}! The explosion incinerated ${cultsPurged.rowCount} cultist cells, cleansed the land of all blight, and honored their mortal oath.`, loreDate]);
          continue;
        }
      }
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
    `, [locCellId, targetCellId, targetGroveId, state, subRole, corruption, age, w.id]);
  }
}
