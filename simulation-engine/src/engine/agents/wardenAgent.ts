/**
 * wardenAgent.ts - Autonomous Grey Warden lifecycle, Eyeless Elders, Sigil casting, and Kamikaze Martyrdom
 *
 * Wardens are living mortal channelers and adepts drawn from temples, city watches, and
 * apothecaries who heard the cosmic summons. Their personalities (Stoic, Compassionate,
 * Scholarly, Fanatical) influence their service: stoic wardens resist corruption longer
 * and anchor seals firmly; compassionate wardens cleanse double the ecological blight.
 *
 * Survived veterans (age_ticks >= 80, low corruption) undergo the sacred Rite of the Blind Seer
 * to become Eyeless Elders, perceiving pure cosmic leys and anchoring dragon seals with immense power.
 *
 * When terminally corrupted by primordial chaos, their core oath compels a heroic kamikaze sacrifice
 * (WARDEN_FINAL_SACRIFICE) that vaporizes besieging cultists, purifies blight, and reinforces the dragon seal (+45%).
 */

import { stepTowardCell, getWeakestSacredGrove, getNearestCultistCell } from "./agentMovementHelper.js";
import { recruitWardenPersona, tagSectorEnvironment } from "./citizenPersonaHelper.js";

const CONVERGENCE_SPIRE_CELL = 16166; // The Verge (Sacred Spire)
const TARGET_WARDEN_COUNT = 72; // ~6 Wardens per Dragon Prison (12 Sacred Groves * 6 = 72)

export async function runWardenAgent(client: any, tick: number, loreDate: string) {
  // 1. Maintain the Order at the Spire of Convergence (target ~72 Wardens worldwide)
  const activeWardensRes = await client.query("SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Warden'");
  const wardenCount = parseInt(activeWardensRes.rows[0].total) || 0;

  if (wardenCount < TARGET_WARDEN_COUNT && Math.random() < 0.65) {
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

    // Determine initial assignment: send directly to the most endangered or understaffed grove
    const weakestGrove = await getWeakestSacredGrove(client);
    const startAtSpire = Math.random() < 0.35 || !weakestGrove;

    await client.query(`
      INSERT INTO sim_agents (
        name, citizen_name, profession, species, spark_tier,
        personality_temper, personality_instinct, motivation,
        role, sub_role, location_cell_id, target_cell_id, target_grove_id, state,
        corruption, age_ticks, active_plot
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        'Warden', 'Warden_Sentinel', $9, $10, $11, $12,
        0, 0, $13
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
      startAtSpire ? CONVERGENCE_SPIRE_CELL : (weakestGrove?.cell_id || CONVERGENCE_SPIRE_CELL),
      startAtSpire ? null : (weakestGrove?.cell_id || null),
      startAtSpire ? null : (weakestGrove?.id || null),
      startAtSpire ? 'AT_SPIRE' : 'TRAVELING_TO_SEAL',
      `Vigil for the Order [${citizen.temper}]: ${citizen.motivation}`
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

  // Check for critical emergencies: any grove with seal_strength <= 35 triggers realm-wide defense
  const criticalGrovesRes = await client.query(`
    SELECT id, dragon_name, cell_id, seal_strength
    FROM sim_sacred_groves
    WHERE seal_strength <= 35
    ORDER BY seal_strength ASC
    LIMIT 1
  `);
  const emergencyGrove = criticalGrovesRes.rows[0] || null;

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

    // --- RITE OF THE BLIND SEER: VETERAN TO EYELESS ELDER ---
    if (subRole !== 'Eyeless_Elder' && age >= 80 && corruption < 50) {
      subRole = 'Eyeless_Elder';
      w.spark_tier = 'EYELESS_ELDER';
      await client.query(`
        UPDATE sim_agents
        SET sub_role = 'Eyeless_Elder', spark_tier = 'EYELESS_ELDER'
        WHERE id = $1
      `, [w.id]);

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, lore_date)
        VALUES ($1, 'WARDEN_BECOMES_EYELESS_ELDER', $2, 'MAJOR', $3)
      `, [tick, `👁️ RITE OF THE BLIND SEER: Having guarded the seals across decades, Warden ${citizenName} surrendered physical sight to perceive pure cosmic leys, ascending as a venerable Eyeless Elder of the Grey Wardens.`, loreDate]);

      await tagSectorEnvironment(client, locCellId, [
        "#GuidanceOfTheEyelessElder",
        "#EyelessSight",
        "#PropheticVigil"
      ], 0);
    }

    const isEyelessElder = subRole === 'Eyeless_Elder';

    // Personality & Elder Multipliers
    let sealRepairBonus = isEyelessElder ? 7 : (temper === 'STOIC' ? 4 : temper === 'SCHOLARLY' ? 4 : 3);
    const blightCleanseAmt = isEyelessElder ? 1.2 : (temper === 'COMPASSIONATE' ? 0.8 : 0.4);
    const terminalCorruptionThreshold = temper === 'STOIC' ? 95 : 85;

    // Check if co-located with an Eyeless Elder for elder guidance
    if (!isEyelessElder && targetGroveId) {
      const elderPresent = await client.query(
        "SELECT id FROM sim_agents WHERE role = 'Warden' AND sub_role = 'Eyeless_Elder' AND target_grove_id = $1 LIMIT 1",
        [targetGroveId]
      );
      if (elderPresent.rowCount > 0) {
        sealRepairBonus += 2; // +2 bonus under Eyeless Elder guidance
      }
    }

    // --- EMERGENCY DISPATCH PROTOCOL: SEAL <= 30% ---
    if (emergencyGrove && emergencyGrove.id !== targetGroveId && (state === 'AT_SPIRE' || (state === 'STRENGTHENING_SEAL' && Math.random() < 0.25))) {
      state = 'TRAVELING_TO_SEAL';
      targetGroveId = emergencyGrove.id;
      targetCellId = emergencyGrove.cell_id;

      if (Math.random() < 0.20) {
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'WARDEN_EMERGENCY_RALLY', $2, 'MAJOR', $3)
        `, [tick, `🚨 DESPERATE DEFENSE: Warden ${citizenName} (${subRole.replace('_', ' ')}) rushed toward the Prison of ${emergencyGrove.dragon_name} (Seal critically fractured at ${emergencyGrove.seal_strength}%) to prevent an apocalyptic dragon awakening!`, loreDate]);
      }
    }

    // --- PHASE A: STATIONED AT THE SPIRE ---
    if (state === 'AT_SPIRE') {
      const targetGroveRes = await client.query(`
        SELECT g.id, g.cell_id, g.dragon_name, g.seal_strength, COUNT(w.id) as warden_count
        FROM sim_sacred_groves g
        LEFT JOIN sim_agents w ON w.role = 'Warden' AND w.target_grove_id = g.id
        GROUP BY g.id, g.cell_id, g.dragon_name, g.seal_strength
        ORDER BY COUNT(w.id) ASC, g.seal_strength ASC
        LIMIT 1
      `);
      const targetGrove = targetGroveRes.rows[0];
      if (targetGrove) {
        state = 'TRAVELING_TO_SEAL';
        targetGroveId = targetGrove.id;
        targetCellId = targetGrove.cell_id;

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'WARDEN_DISPATCH', $2, 'MINOR', $3)
        `, [tick, `${citizenName} (${subRole.replace('_', ' ')}, former ${profession.toLowerCase()}) departed the Spire to reinforce the Prison of ${targetGrove.dragon_name} (Seal: ${targetGrove.seal_strength}%).`, loreDate]);
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
        const moveResult = await stepTowardCell(client, locCellId, dest, 75);
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
              "SELECT id, name FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1 LIMIT 2",
              [locCellId]
            );
            for (const hc of hostileCultists.rows) {
              await client.query("DELETE FROM sim_agents WHERE id = $1", [hc.id]);
              await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, lore_date)
                VALUES ($1, 'WARDEN_CLASH', $2, 'MINOR', $3)
              `, [tick, `⚔️ ${citizenName} (${subRole.replace('_', ' ')}) drew their starlight halberd and executed ${hc.name} defending the dragon seal!`, loreDate]);
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
      // Eyeless Elders resist almost completely (+1), sentinels absorb +2 to +4
      corruption += isEyelessElder ? 1 : Math.floor(Math.random() * 3 + 2);

      const groveCheck = await client.query("SELECT seal_strength, dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
      const currentSeal = groveCheck.rows[0]?.seal_strength || 100;
      const dragonName = groveCheck.rows[0]?.dragon_name || 'Chaos';

      // Clash with cultists in this cell during ongoing defense
      if (Math.random() < 0.40) {
        const hostileCultists = await client.query(
          "SELECT id, name FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1 LIMIT 1",
          [locCellId]
        );
        if (hostileCultists.rowCount > 0) {
          const hc = hostileCultists.rows[0];
          await client.query("DELETE FROM sim_agents WHERE id = $1", [hc.id]);
          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, lore_date)
            VALUES ($1, 'WARDEN_CLASH', $2, 'MINOR', $3)
          `, [tick, `⚔️ ${citizenName} intercepted and purged ${hc.name} before their dark incantation could breach the seal!`, loreDate]);
        }
      }

      // Terminal Corruption or Desperate Defense (preventing World-Ending Apocalypse)
      const desperateDefense = (currentSeal <= 15 && corruption >= 30) || (currentSeal <= 25 && corruption >= 50);
      if (corruption >= terminalCorruptionThreshold || desperateDefense) {
        // If at the grove defending it: immediate heroic sacrifice!
        const cultsAtGrove = await client.query(
          "DELETE FROM sim_agents WHERE role = 'Cultist' AND (location_cell_id = $1 OR target_grove_id = $2) RETURNING id",
          [locCellId, targetGroveId]
        );
        await client.query("UPDATE sim_cells SET eco_blight = 0.0 WHERE id = $1", [locCellId]);
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = LEAST(100, seal_strength + 45)
          WHERE id = $1
        `, [targetGroveId]);
        await client.query("DELETE FROM sim_agents WHERE id = $1", [w.id]);

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
          VALUES ($1, 'WARDEN_FINAL_SACRIFICE', $2, 'MAJOR', $3, $4)
        `, [
          tick,
          `💥 HEROIC KAMIKAZE SACRIFICE: Warden ${citizenName} (${profession}, ${subRole.replace('_', ' ')}), corrupted by primordial chaos beyond mortal endurance, chose martyrdom over madness! Detonating their soul-spark in a blinding supernova of pure aether at the Prison of ${dragonName}, they vaporized ${cultsAtGrove.rowCount} cultists, cleansed all blight, and reinforced the seal (+45%) before perishing honorably!`,
          locCellId,
          loreDate
        ]);

        await tagSectorEnvironment(client, locCellId, [
          "#SacrificialAetherCrater",
          "#HallowedMartyrGround",
          "#PurifiedSanctuary"
        ], 0);
        continue;
      } else if (currentSeal >= 95 && targetGroveId) {
        // Only return to spire if this grove has surplus sentinels (> 6)
        const wardensHere = await client.query(
          "SELECT COUNT(*) as cnt FROM sim_agents WHERE role = 'Warden' AND target_grove_id = $1",
          [targetGroveId]
        );
        if (parseInt(wardensHere.rows[0]?.cnt || '0') > 6 && Math.random() < 0.15) {
          state = 'RETURNING_TO_SPIRE';
          targetCellId = CONVERGENCE_SPIRE_CELL;
        }
      }
    }

    // --- PHASE D: KAMIKAZE RUN (Traveling to target to detonate) ---
    else if (state === 'KAMIKAZE_RUN') {
      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 90);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          // Detonate Pure Aether Supernova
          const cultsPurged = await client.query("DELETE FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1 RETURNING id", [locCellId]);
          await client.query("UPDATE sim_cells SET eco_blight = 0.0 WHERE id = $1", [locCellId]);
          await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 35) WHERE cell_id = $1", [locCellId]);
          if (targetGroveId) {
            await client.query("UPDATE sim_sacred_groves SET seal_strength = LEAST(100, seal_strength + 45) WHERE id = $1", [targetGroveId]);
          }
          await client.query("DELETE FROM sim_agents WHERE id = $1", [w.id]);

          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
            VALUES ($1, 'WARDEN_FINAL_SACRIFICE', $2, 'MAJOR', $3, $4)
          `, [
            tick,
            `💥 HEROIC KAMIKAZE SACRIFICE: Warden ${citizenName}, the ${profession.toLowerCase()} turned Grey Warden martyr, detonated their soul-spark in an apocalyptic sigil rupture at Cell #${locCellId}! The pure aether supernova incinerated ${cultsPurged.rowCount} cultists, cleansed the land of all blight, and honored their mortal oath.`,
            locCellId,
            loreDate
          ]);
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
