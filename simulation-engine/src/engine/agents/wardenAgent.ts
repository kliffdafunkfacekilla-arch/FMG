import { isYearEnd } from "../canon/calendar.js";
/**
 * wardenAgent.ts - Autonomous Grey Warden Lifecycle, Aether-Tech Sigil Magic,
 * Ancient Ward Awakenings, Eyeless Flow-Seers, and Spire Crypt Alcoves.
 *
 * LORE FOUNDATIONS:
 * 1. Self-Sustaining Prisons: The 12 Dragon Prisons are naturally self-sustaining, powered
 *    by the flowing chaos. Wardens do not grind at stone seals; their sacred oath is to maintain
 *    the rest of the world, keeping it free from chaos corruption and hunting down cults.
 * 2. Shlaar's Ritual Flaw: During the ancient ritual, Shlaar introduced a critical flaw—her very
 *    being is part of the containment network. Her psychic whispers slip through into the minds
 *    of the Sparkborn, birthing the Void Cults that the Grey Wardens must eradicate.
 * 3. Aether-Tech Sigils & Martyrdom: Wardens channel chaos through ancient aether-tech sigils.
 *    Routine patrols and minor cleansing cause negligible corruption. Only when forced to wield
 *    vast torrents of chaos in a short window (e.g. against overwhelming cultist cabals or cataclysms)
 *    does their aether-tech overload, forcing an honorable kamikaze supernova (WARDEN_FINAL_SACRIFICE).
 * 4. Eyeless Elders & The Spire Crypt: Experienced wardens perform a sacred ritual to replace physical
 *    sight with direct perception of the Chaos Flows. Armed with signature curved blades, their
 *    uncanny flow-sight makes them lethal blademasters. When their mortal bodies grow too old, they
 *    return to the Spire and descend into the subterranean tomb, standing in carved stone alcoves
 *    watching the planetary chaos flows forever and telepathically guiding active Elders.
 * 5. Ancient Ward Recruitment: Thousands of ancient dormant wards lie along forgotten pilgrimage
 *    paths converging on the Spire. When an unsuspecting Sparkborn crosses a charged ward, a flash of
 *    cosmic vision reveals the entire prison system, the chaos flows, and the dragons' madness.
 *    This either drives them to the Spire to take the Grey Vow, or shatters their mortal sanity,
 *    turning them into an insane wandering hermit in the wilderness.
 */

import { stepTowardCell, getNearestCultistCell } from "./agentMovementHelper.js";
import { recruitWardenPersona, tagSectorEnvironment } from "./citizenPersonaHelper.js";

const CONVERGENCE_SPIRE_CELL = 16166; // The Verge (Sacred Spire)
const TARGET_WARDEN_COUNT = 72; // 12 Crypt Elders in alcoves + 60 active sentinels and flow seers

export async function runWardenAgent(client: any, tick: number, loreDate: string) {
  // ── 1. ANCIENT WARD RECHARGE & ORGANIC RECRUITMENT AWAKENINGS ─────────────
  // Recharge ancient path wards that finished their recharge interval
  await client.query(`
    UPDATE sim_ancient_path_wards
    SET is_charged = true
    WHERE is_charged = false AND ($1 - last_triggered_tick) >= recharge_ticks
  `, [tick]);

  // Check current Warden population (including pilgrims and crypt elders)
  const activeWardensRes = await client.query("SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Warden'");
  const currentWardens = parseInt(activeWardensRes.rows[0].total) || 0;

  // Trigger ancient path wards organically when Sparkborn wander across them.
  // Wards recharge on generational timescales (~20-30 years).
  // Natural recruitment produces ~2 to 5 cosmic awakenings / sanity breaks per year worldwide.
  const shouldTriggerWard = (currentWardens < TARGET_WARDEN_COUNT && Math.random() < 0.04) || (Math.random() < 0.005);
  if (shouldTriggerWard) {
    const chargedWardsRes = await client.query(`
      SELECT w.id, w.cell_id, w.flow_id, w.path_name
      FROM sim_ancient_path_wards w
      WHERE w.is_charged = true
      ORDER BY RANDOM()
      LIMIT 1
    `);

    for (const ward of chargedWardsRes.rows) {
      // Find a civilian Sparkborn in or near this sector (spatial locality)
      let candidateRes = await client.query(`
        SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation, settlement_id
        FROM population_demographics
        WHERE spark_tier IN ('CHANNELER', 'ADEPT', 'SENSITIVE', 'DORMANT_SPARK')
          AND allegiance_status = 'CIVILIAN'
          AND settlement_id IN (
            SELECT burg_id FROM sim_burg_economy
            ORDER BY ABS(cell_id - $1) ASC
            LIMIT 10
          )
        ORDER BY 
          CASE WHEN spark_tier = 'ADEPT' THEN 1 WHEN spark_tier = 'CHANNELER' THEN 2 ELSE 3 END,
          RANDOM()
        LIMIT 1
      `, [ward.cell_id]);

      // Fallback to worldwide civilian sparkborn if local pool exhausted
      if (candidateRes.rows.length === 0) {
        candidateRes = await client.query(`
          SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation, settlement_id
          FROM population_demographics
          WHERE spark_tier IN ('CHANNELER', 'ADEPT', 'SENSITIVE', 'DORMANT_SPARK')
            AND allegiance_status = 'CIVILIAN'
          ORDER BY RANDOM()
          LIMIT 1
        `);
      }

      const dbCitizen = candidateRes.rows[0];
      const citizen = dbCitizen ? {
        id: dbCitizen.citizen_id,
        name: dbCitizen.name,
        profession: dbCitizen.profession,
        species: dbCitizen.species,
        sparkTier: dbCitizen.spark_tier,
        temper: dbCitizen.temper || 'STOIC',
        instinct: dbCitizen.instinct || 'WARY',
        motivation: dbCitizen.motivation || 'Seeking purpose',
        settlementId: dbCitizen.settlement_id
      } : {
        id: null,
        name: recruitWardenPersona().citizenName,
        profession: 'Wayfarer',
        species: 'Human',
        sparkTier: 'SENSITIVE',
        temper: 'STOIC',
        instinct: 'WARY',
        motivation: 'Wandering the ancient overgrown roads',
        settlementId: null
      };

      // Discharge the ancient ward
      await client.query(
        "UPDATE sim_ancient_path_wards SET is_charged = false, last_triggered_tick = $1 WHERE id = $2",
        [tick, ward.id]
      );

      // THE COSMIC AWAKENING FLASH:
      // Willpower test: Stoic, Scholarly, Disciplined or 60% chance -> Awakened to the Grey Order
      // Failed test: Mortal sanity shatters -> Insane Wandering Hermit
      const resistsHorror = ['STOIC', 'SCHOLARLY', 'DISCIPLINED'].includes(citizen.temper) || Math.random() < 0.60;

      if (resistsHorror) {
        // AWAKENED PILGRIMAGE TO THE SPIRE
        if (citizen.id) {
          await client.query(
            "UPDATE population_demographics SET allegiance_status = 'WARDEN_PILGRIM' WHERE citizen_id = $1",
            [citizen.id]
          );
        }

        await client.query(`
          INSERT INTO sim_agents (
            name, citizen_name, profession, species, spark_tier,
            personality_temper, personality_instinct, motivation,
            role, sub_role, location_cell_id, target_cell_id, target_grove_id, state,
            corruption, age_ticks, active_plot
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            'Warden', 'Warden_Pilgrim', $9, $10, $11, 'PILGRIMAGE_TO_SPIRE',
            0, 0, $12
          )
        `, [
          `Pilgrim ${citizen.name} (${citizen.profession})`,
          citizen.name,
          citizen.profession,
          citizen.species,
          citizen.sparkTier,
          citizen.temper,
          citizen.instinct,
          citizen.motivation,
          ward.cell_id,
          CONVERGENCE_SPIRE_CELL,
          ward.flow_id,
          `Compelled by cosmic vision of the 12 Dragon Prisons and Chaos Flows to journey to the Spire of Convergence`
        ]);

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
          VALUES ($1, 'WARDEN_ANCIENT_WARD_AWAKENING', $2, 'MAJOR', $3, $4)
        `, [
          tick,
          `⚡ COSMIC AWAKENING: ${citizen.name} (${citizen.profession}) stepped across an overgrown ancient ward along the ${ward.path_name} (Cell #${ward.cell_id})! A flash of cosmic revelation exposed the 12 Dragon Prisons, the surging Chaos Flows, and Shlaar's whispering horror. Driven by the vision, they began their pilgrimage to the Spire of Convergence to join the Grey Wardens!`,
          ward.cell_id,
          loreDate
        ]);

        await tagSectorEnvironment(client, ward.cell_id, ["#AncientWardDischarge", "#AwakenedSparkborn"], 0);
      } else {
        // SHATTERED SANITY: INSANE WANDERING HERMIT
        if (citizen.id) {
          await client.query(
            "UPDATE population_demographics SET allegiance_status = 'MAD_HERMIT' WHERE citizen_id = $1",
            [citizen.id]
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
            $6, $7, 'Muttering cryptic prophecies of Shlaar and the dragons',
            'Mad_Hermit', 'Mad_Hermit', $8, 'WANDERING_WILDS',
            20, 0, 'Mind shattered by the cosmic horror of the 12 Chaos Dragons and Shlaar'
          )
        `, [
          `Mad Hermit ${citizen.name}`,
          citizen.name,
          citizen.profession,
          citizen.species,
          citizen.sparkTier,
          citizen.temper,
          citizen.instinct,
          ward.cell_id
        ]);

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
          VALUES ($1, 'SPARKBORN_DRIVEN_MAD', $2, 'MINOR', $3, $4)
        `, [
          tick,
          `🌀 PSYCHIC SHATTER: ${citizen.name} (${citizen.profession}) crossed an ancient dormant ward at Cell #${ward.cell_id}. The cosmic terror of the 12 Chaos Dragons and Shlaar's whispering madness shattered their sanity, driving them screaming into the wilderness as an insane wandering hermit!`,
          ward.cell_id,
          loreDate
        ]);

        await tagSectorEnvironment(client, ward.cell_id, ["#MadHermitProphecy", "#VisionsOfTheVoid"], 0);
      }
    }
  }

  // ── 2. PROCESS ALL ACTIVE GREY WARDENS & EYELESS ELDERS ───────────────────
  const wardensRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper, personality_instinct,
           spark_tier, sub_role, location_cell_id, target_cell_id,
           target_grove_id, state, corruption, age_ticks
    FROM sim_agents
    WHERE role = 'Warden'
  `);

  const yearEnded = isYearEnd(tick);

  for (const w of wardensRes.rows) {
    // Wardens age 1 year per in-game year (DAYS_PER_YEAR days), not 1 year per day!
    const age = yearEnded ? ((w.age_ticks || 0) + 1) : (w.age_ticks || 0);
    let corruption = w.corruption || 0;
    let state = w.state || 'PATROLLING_FLOW';
    let subRole = w.sub_role || 'Warden_Sentinel';
    let locCellId = w.location_cell_id || CONVERGENCE_SPIRE_CELL;
    let targetCellId = w.target_cell_id;
    let targetGroveId = w.target_grove_id || 1;
    const temper = w.personality_temper || 'STOIC';
    const citizenName = w.citizen_name || w.name;
    const profession = w.profession || 'Guardian';

    // ── PHASE A: THE UNDER-SPIRE TOMB (EYELESS CRYPT ELDERS) ────────────────
    if (state === 'SPIRE_CRYPT_VIGIL') {
      // Crypt Elders stand eternal vigil in subterranean stone alcoves beneath the Spire.
      // They gaze into the 12 subterranean Chaos Flows forever and telepathically guide surface Wardens.
      if (Math.random() < 0.10) {
        await tagSectorEnvironment(client, CONVERGENCE_SPIRE_CELL, [
          "#WhispersOfTheCryptElders",
          "#GuidanceOfTheAncestors",
          "#PropheticVigil"
        ], 0);
      }
      // Crypt Elders do not suffer road wear or corruption, nor do they die of old age
      if (yearEnded) {
        await client.query("UPDATE sim_agents SET age_ticks = $1 WHERE id = $2", [age, w.id]);
      }
      continue;
    }

    // ── PHASE B: PILGRIMAGE TO THE SPIRE (TAKING THE GREY VOW) ──────────────
    if (state === 'PILGRIMAGE_TO_SPIRE') {
      const moveResult = await stepTowardCell(client, locCellId, CONVERGENCE_SPIRE_CELL, 70);
      locCellId = moveResult.nextCellId;

      if (moveResult.arrived || locCellId === CONVERGENCE_SPIRE_CELL) {
        // Arrival at the Spire: Take the sacred Grey Vow and receive Aether-Tech Sigil equipment
        state = 'PATROLLING_FLOW';
        subRole = 'Warden_Sentinel';
        // Assign to a flow corridor
        targetGroveId = targetGroveId || (Math.floor(Math.random() * 12) + 1);

        // Find a starting waypoint along assigned flow
        const flowWards = await client.query(
          "SELECT cell_id FROM sim_ancient_path_wards WHERE flow_id = $1 ORDER BY RANDOM() LIMIT 1",
          [targetGroveId]
        );
        targetCellId = flowWards.rows[0]?.cell_id || CONVERGENCE_SPIRE_CELL;

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
          VALUES ($1, 'WARDEN_VOW_TAKEN', $2, 'MINOR', $3, $4)
        `, [
          tick,
          `🗡️ GREY VOW TAKEN: Pilgrim ${citizenName} (${profession}) has reached the Spire of Convergence! Swearing the ancient Grey Vow, they were bound with aether-tech sigils to channel primordial chaos safely, deployed to patrol the flow corridors.`,
          CONVERGENCE_SPIRE_CELL,
          loreDate
        ]);
      }
    }

    // ── PHASE C: VETERAN ASCENSION TO EYELESS ELDER (FLOW-SIGHT) ────────────
    if (subRole === 'Warden_Sentinel' && age >= 80 && corruption < 50) {
      subRole = 'Eyeless_Elder';
      w.spark_tier = 'EYELESS_ELDER';
      await client.query(`
        UPDATE sim_agents
        SET sub_role = 'Eyeless_Elder', spark_tier = 'EYELESS_ELDER'
        WHERE id = $1
      `, [w.id]);

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
        VALUES ($1, 'WARDEN_BECOMES_EYELESS_ELDER', $2, 'MAJOR', $3, $4)
      `, [
        tick,
        `👁️ RITE OF THE BLIND SEER: Veteran Warden ${citizenName} surrendered physical sight to perceive pure Chaos Flow currents directly! Armed with their signature curved blade, their flow-sight grants uncanny fighting abilities to strike down cultist abominations with peerless precision.`,
        locCellId,
        loreDate
      ]);

      await tagSectorEnvironment(client, locCellId, ["#EyelessFlowSight", "#SignatureCurvedBlade"], 0);
    }

    const isEyelessElder = subRole === 'Eyeless_Elder';

    // ── PHASE D: EXTREME OLD AGE -> DESCENT INTO THE SPIRE TOMB ─────────────
    if (isEyelessElder && age >= 220 && state !== 'TRAVELING_TO_SPIRE_TOMB') {
      state = 'TRAVELING_TO_SPIRE_TOMB';
      targetCellId = CONVERGENCE_SPIRE_CELL;

      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
        VALUES ($1, 'EYELESS_ELDER_RETIRING', $2, 'MINOR', $3, $4)
      `, [
        tick,
        `🏛️ CALL OF THE CRYPT: Eyeless Elder ${citizenName}, their mortal frame worn from over two centuries of wielding the curved blade along the roaring flows, has turned back toward the Spire of Convergence to enter the eternal subterranean crypt alcoves.`,
        locCellId,
        loreDate
      ]);
    }

    if (state === 'TRAVELING_TO_SPIRE_TOMB') {
      const moveResult = await stepTowardCell(client, locCellId, CONVERGENCE_SPIRE_CELL, 75);
      locCellId = moveResult.nextCellId;

      if (moveResult.arrived || locCellId === CONVERGENCE_SPIRE_CELL) {
        state = 'SPIRE_CRYPT_VIGIL';
        subRole = 'Eyeless_Crypt_Elder';
        targetCellId = null;

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
          VALUES ($1, 'EYELESS_ELDER_CRYPT_VIGIL', $2, 'MAJOR', $3, $4)
        `, [
          tick,
          `🏛️ TOMB OF THE WATCHERS: Venerable Eyeless Elder ${citizenName} has descended into the subterranean tomb beneath the Spire of Convergence. Taking their place in an ancient carved stone alcove, they will watch the 12 Chaos Flows across Ostraka forever, telepathically advising active Elders on the surface.`,
          CONVERGENCE_SPIRE_CELL,
          loreDate
        ]);

        await client.query(`
          UPDATE sim_agents
          SET state = 'SPIRE_CRYPT_VIGIL', sub_role = 'Eyeless_Crypt_Elder', location_cell_id = $1, target_cell_id = NULL
          WHERE id = $2
        `, [CONVERGENCE_SPIRE_CELL, w.id]);
        continue;
      }
    }

    // ── PHASE E: FLOW PATROL & ENVIRONMENTAL CLEANSING ──────────────────────
    if (state === 'PATROLLING_FLOW') {
      // Priority Grove Defense Check: Wardens sense tremors along the Chaos Flows when a sacred prison seal is threatened
      if (Math.random() < 0.40) {
        const endangeredGrove = await client.query(`
          SELECT g.id, g.cell_id, g.dragon_name, g.seal_strength
          FROM sim_sacred_groves g
          WHERE g.seal_strength < 85
             OR g.id IN (SELECT target_grove_id FROM sim_agents WHERE role = 'Cultist' AND state = 'BESIEGING_SEAL')
          ORDER BY g.seal_strength ASC
          LIMIT 1
        `);
        if (endangeredGrove.rowCount > 0) {
          state = 'DEFENDING_SEAL';
          targetGroveId = endangeredGrove.rows[0].id;
          targetCellId = endangeredGrove.rows[0].cell_id;
        }
      }

      // Step along assigned flow corridor
      if (state === 'PATROLLING_FLOW') {
        if (!targetCellId || Math.random() < 0.15) {
          const flowWards = await client.query(
            "SELECT cell_id FROM sim_ancient_path_wards WHERE flow_id = $1 ORDER BY RANDOM() LIMIT 1",
            [targetGroveId]
          );
          targetCellId = flowWards.rows[0]?.cell_id || CONVERGENCE_SPIRE_CELL;
        }

        if (targetCellId) {
          const moveResult = await stepTowardCell(client, locCellId, targetCellId, 65, 'Cultist');
          locCellId = moveResult.nextCellId;
          if (moveResult.collidedWith) {
            // Intercepted a cultist along the movement path!
            state = 'HUNTING_CULTS';
            targetCellId = moveResult.collidedWith.location_cell_id;
          }
        }

        // Cleanse local eco-blight using Aether-Tech Sigil equipment
        const blightCleanse = isEyelessElder ? 1.0 : (temper === 'COMPASSIONATE' ? 0.8 : 0.4);
        await client.query(`
          UPDATE sim_cells
          SET eco_blight = GREATEST(0.0, COALESCE(eco_blight, 0.0) - $1)
          WHERE id = $2
        `, [blightCleanse, locCellId]);

        // Routine patrolling with Aether-Tech produces negligible corruption (only 5% chance of +1)
        if (Math.random() < 0.05) {
          corruption += isEyelessElder ? 0 : 1;
        }

        // Check for nearby cultists (hunting Shlaar's cabals)
        const cultTarget = await getNearestCultistCell(client, locCellId);
        if (cultTarget) {
          state = 'HUNTING_CULTS';
          targetCellId = cultTarget.cell_id;
        }
      }
    }

    // ── PHASE E2: DEFENDING ENDANGERED DRAGON PRISONS ────────────────────────
    else if (state === 'DEFENDING_SEAL') {
      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 85);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          // Arrived at the endangered Sacred Grove!
          // 1. Slay besieging cultists in the cell
          const cultsHere = await client.query(
            "SELECT id, name FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1",
            [locCellId]
          );

          if (cultsHere.rowCount > 0) {
            const slayCount = Math.min(cultsHere.rowCount, isEyelessElder ? 3 : 2);
            for (let k = 0; k < slayCount; k++) {
              await client.query("DELETE FROM sim_agents WHERE id = $1", [cultsHere.rows[k].id]);
            }
            const weaponDesc = isEyelessElder ? "carved curved-blade sweeps" : "aether-sigil charges";
            await client.query(`
              INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
              VALUES ($1, 'WARDEN_DEFENDS_SEAL', $2, 'MINOR', $3, $4)
            `, [
              tick,
              `🛡️ DEFENSE OF THE PRISON: Warden ${citizenName} (${subRole.replace('_', ' ')}) engaged the besieging cultists with ${weaponDesc}, striking down ${slayCount} Shlaar cabalists!`,
              locCellId,
              loreDate
            ]);
          }

          // 2. Channel aether-tech to reinforce and recharge the Dragon Seal
          const repairAmount = isEyelessElder ? 2 : 1;
          await client.query(`
            UPDATE sim_sacred_groves
            SET seal_strength = LEAST(100, seal_strength + $1)
            WHERE id = $2
          `, [repairAmount, targetGroveId]);

          // 3. Purge blight at the grove cell
          await client.query(
            "UPDATE sim_cells SET eco_blight = GREATEST(0.0, COALESCE(eco_blight, 0.0) - 1.5) WHERE id = $1",
            [locCellId]
          );

          // Return to patrol once seal is stabilized and cleared
          const groveCheck = await client.query("SELECT seal_strength FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
          if ((groveCheck.rows[0]?.seal_strength || 0) >= 92 && cultsHere.rowCount <= 1) {
            state = 'PATROLLING_FLOW';
            targetCellId = null;
          }
        }
      }
    }

    // ── PHASE F: HUNTING CULTS & AETHER-TECH COMBAT ─────────────────────────
    else if (state === 'HUNTING_CULTS') {
      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 80);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          // Combat encounter with cultists in this cell
          const cultsHere = await client.query(
            "SELECT id, name FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1",
            [locCellId]
          );

          if (cultsHere.rowCount > 0) {
            const cultCount = cultsHere.rowCount;

            // CRISIS OVERLOAD: If facing an overwhelming cabal (>= 5 cultists) or terminal corruption (>= 85)
            // Forced to wield vast torrents of chaos through aether-tech in a short window -> Supernova!
            const terminalThreshold = temper === 'STOIC' ? 95 : 85;
            const forcedMassiveChanneling = cultCount >= 5 && corruption >= 60;

            if (corruption >= terminalThreshold || forcedMassiveChanneling) {
              // HEROIC KAMIKAZE SACRIFICE (AETHER-TECH OVERLOAD)
              const purged = await client.query(
                "DELETE FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1 RETURNING id",
                [locCellId]
              );
              await client.query("UPDATE sim_cells SET eco_blight = 0.0 WHERE id = $1", [locCellId]);
              await client.query("DELETE FROM sim_agents WHERE id = $1", [w.id]);

              await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
                VALUES ($1, 'WARDEN_FINAL_SACRIFICE', $2, 'MAJOR', $3, $4)
              `, [
                tick,
                `💥 HEROIC KAMIKAZE SACRIFICE: Warden ${citizenName} (${profession}, ${subRole.replace('_', ' ')}), forced to channel an overwhelming torrent of primordial chaos through their aether-tech sigils, suffered a critical core overload! Choosing martyrdom over madness, they detonated their soul-spark in a blinding pure aether supernova at Cell #${locCellId}, incinerating ${purged.rowCount} Shlaar cultists and purging all blight before passing into legend!`,
                locCellId,
                loreDate
              ]);

              await tagSectorEnvironment(client, locCellId, [
                "#SacrificialAetherCrater",
                "#HallowedMartyrGround",
                "#PurifiedSanctuary"
              ], 0);
              continue;
            } else {
              // Standard Skirmish: Eyeless Elders slash with curved blades; Sentinels strike with halberds
              const killCount = Math.min(cultCount, isEyelessElder ? 2 : 1);
              for (let k = 0; k < killCount; k++) {
                const targetCultist = cultsHere.rows[k];
                await client.query("DELETE FROM sim_agents WHERE id = $1", [targetCultist.id]);

                const weaponDesc = isEyelessElder ? "swung their signature curved blade with uncanny flow-sight" : "discharged their aether-tech sigils and halberd";
                await client.query(`
                  INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
                  VALUES ($1, 'WARDEN_CLASH', $2, 'MINOR', $3, $4)
                `, [
                  tick,
                  `⚔️ ${citizenName} (${subRole.replace('_', ' ')}) ${weaponDesc}, striking down ${targetCultist.name} to purge Shlaar's corrupting influence!`,
                  locCellId,
                  loreDate
                ]);
              }

              // Small combat strain on aether-tech sigils (+1 corruption)
              corruption += isEyelessElder ? 0 : 1;
            }
          } else {
            // No more cultists here: resume flow patrol
            state = 'PATROLLING_FLOW';
            targetCellId = null;
          }
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

  // ── 3. PROCESS MAD HERMITS WANDERING THE WILDERNESS ────────────────────────
  const hermitsRes = await client.query(`
    SELECT id, name, location_cell_id, age_ticks
    FROM sim_agents
    WHERE role = 'Mad_Hermit'
  `);

  for (const h of hermitsRes.rows) {
    if (Math.random() < 0.20) {
      // Step randomly through adjacent wilderness cells
      const randAdj = await client.query(
        "SELECT id FROM sim_cells WHERE (id % 50) = ($1 % 50) AND id != $1 ORDER BY RANDOM() LIMIT 1",
        [h.location_cell_id]
      );
      const nextCell = randAdj.rows[0]?.id || h.location_cell_id;

      await client.query(
        "UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2",
        [nextCell, h.id]
      );

      // Spawn cryptic prophetic warnings
      if (Math.random() < 0.15) {
        await tagSectorEnvironment(client, nextCell, ["#MadHermitProphecy", "#VisionsOfTheVoid"], 0);
      }
    }
  }
}
