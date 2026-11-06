/**
 * cultistAgent.ts - Autonomous Cultist lifecycle, burg infiltration, and seal siege engine
 *
 * Cultists are real citizens drawn from the municipal population (disenfranchised laborers,
 * bankrupt weavers, or bitter scribes). Their human personalities (Greedy, Fanatical, Scholarly,
 * Desperate) directly influence their behavior: greedy cultists siphon more gold, fanatical ones
 * cause higher unrest, and scholarly ones decipher and drain the ancient dragon seals twice as fast.
 *
 * Cultist Population Distribution:
 * - Total Cap: 288 Cultists worldwide (4x the 72 Wardens).
 * - Roughly half (~144) actively break seals at the 12 Dragon Prisons (BESIEGING_SEAL).
 * - Roughly half (~144) spread corruption and recruit in secret across the burgs (INFILTRATING).
 *
 * WORLD-ENDING APOCALYPSE:
 * If any of the 12 sacred seals breaks (seal_strength <= 0), the Chaos Dragon awakens!
 * A world-ending apocalypse event triggers: skies burn with chaos fire, unrest surges to 100%,
 * extreme eco-blight blankets the world, and reality fractures.
 */

import { stepTowardCell, getNearestSacredGrove } from "./agentMovementHelper.js";
import { recruitCultistPersona, tagSectorEnvironment } from "./citizenPersonaHelper.js";

const TARGET_TOTAL_CULTISTS = 288;
const TARGET_INFILTRATOR_COUNT = 144;
const TARGET_BESIEGER_COUNT = 144;

export async function runCultistAgent(client: any, tick: number, loreDate: string) {
  // Self-Sustaining Dragon Prisons: The 12 prisons naturally recharge and hold containment from the flowing chaos.
  // During Shadow Week (Days 529-541), ambient chaos calms, pausing self-regeneration and creating vulnerability.
  const isShadowWeek = loreDate.includes('Shadow Week');
  if (!isShadowWeek) {
    await client.query(`
      UPDATE sim_sacred_groves
      SET seal_strength = LEAST(100, seal_strength + 1)
      WHERE seal_strength > 0 AND seal_strength < 100
    `);
  }

  // Check active cultist population breakdown
  const infiltratorsCountRes = await client.query(
    "SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Cultist' AND state = 'INFILTRATING'"
  );
  const currentInfiltrators = parseInt(infiltratorsCountRes.rows[0].total) || 0;

  const totalCultistsRes = await client.query(
    "SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Cultist'"
  );
  const totalCultists = parseInt(totalCultistsRes.rows[0].total) || 0;

  // 1. Secret Infiltration Recruitment in Unrestful Burgs (maintain ~144 secret infiltrators)
  if (currentInfiltrators < TARGET_INFILTRATOR_COUNT && totalCultists < TARGET_TOTAL_CULTISTS) {
    const recruitBatch = Math.min(10, TARGET_INFILTRATOR_COUNT - currentInfiltrators);
    const unrestBurgsRes = await client.query(`
      SELECT b.burg_id, b.cell_id, b.wealth, b.unrest, b.name
      FROM sim_burg_economy b
      WHERE b.unrest >= 15
      ORDER BY b.unrest DESC, RANDOM()
      LIMIT $1
    `, [recruitBatch * 2]);

    for (const burg of unrestBurgsRes.rows) {
      if (currentInfiltrators >= TARGET_INFILTRATOR_COUNT) break;

      const existingInfiltratorsInBurg = await client.query(
        "SELECT COUNT(*) as cnt FROM sim_agents WHERE role = 'Cultist' AND home_burg_id = $1 AND state = 'INFILTRATING'",
        [burg.burg_id]
      );
      if (parseInt(existingInfiltratorsInBurg.rows[0].cnt) >= 3) continue;

      const recruitRes = await client.query(`
        SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
        FROM population_demographics
        WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
        ORDER BY 
          CASE WHEN temper = 'FANATICAL' THEN 1 WHEN temper = 'DESPERATE' THEN 2 WHEN temper = 'GREEDY' THEN 3 ELSE 4 END,
          RANDOM()
        LIMIT 1
      `, [burg.burg_id]);

      const dbCitizen = recruitRes.rows[0];
      const citizen = dbCitizen ? {
        citizenName: dbCitizen.name,
        profession: dbCitizen.profession,
        species: dbCitizen.species,
        sparkTier: dbCitizen.spark_tier,
        temper: dbCitizen.temper,
        instinct: dbCitizen.instinct,
        motivation: dbCitizen.motivation
      } : recruitCultistPersona(burg.name || `Burg #${burg.burg_id}`);

      if (dbCitizen) {
        await client.query(
          "UPDATE population_demographics SET allegiance_status = 'CULTIST_INFILTRATOR' WHERE citizen_id = $1",
          [dbCitizen.citizen_id]
        );
      }

      await client.query(`
        INSERT INTO sim_agents (
          name, citizen_name, profession, species, spark_tier,
          personality_temper, personality_instinct, motivation,
          role, sub_role, home_burg_id, location_cell_id,
          state, corruption, age_ticks, active_plot
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          'Cultist', 'Cultist_Infiltrator', $9, $10,
          'INFILTRATING', 5, 0, $11
        )
      `, [
        `${citizen.citizenName} (${citizen.profession})`,
        citizen.citizenName,
        citizen.profession,
        citizen.species,
        citizen.sparkTier,
        citizen.temper,
        citizen.instinct,
        citizen.motivation,
        burg.burg_id,
        burg.cell_id,
        `Infiltrating ${burg.name} [${citizen.temper}]: ${citizen.motivation}`
      ]);

      if (Math.random() < 0.20) {
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
          VALUES ($1, 'CULT_INFILTRATION', $2, 'MINOR', $3, $4)
        `, [tick, `Whispers of Shlaar seep through the flawed prison matrix into ${burg.name}, echoing the dragons' madness. ${citizen.citizenName}, a Sparkborn ${citizen.profession.toLowerCase()}, was seduced by the cosmic whispers and initiated into the cabal.`, burg.burg_id, loreDate]);
      }
    }
  }

  // 2. Count Active Besiegers at Dragon Prisons
  const besiegersRes = await client.query(
    "SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Cultist' AND state IN ('BESIEGING_SEAL', 'TRAVELING_TO_SEAL')"
  );
  const currentBesiegers = parseInt(besiegersRes.rows[0].total) || 0;

  // 3. Process All Active Cultists
  const cultistsRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper, personality_instinct,
           spark_tier, sub_role, home_burg_id, location_cell_id, target_cell_id,
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
    const temper = c.personality_temper || 'DESPERATE';
    const citizenName = c.citizen_name || c.name;
    const profession = c.profession || 'Laborer';

    // Personality Multipliers
    const siphonMult = temper === 'GREEDY' ? 2.0 : temper === 'DESPERATE' ? 1.3 : 1.0;
    const unrestSpike = temper === 'FANATICAL' ? 2 : 1;
    const sealDrainBonus = temper === 'SCHOLARLY' ? 2 : 1;

    // --- PHASE A: SECRET INFILTRATION IN BURGS ---
    if (state === 'INFILTRATING') {
      corruption += Math.floor(Math.random() * 2 + 1);
      const burgId = c.home_burg_id;

      // Siphon coin and spike civic unrest
      const coinTheft = Math.round((Math.floor(Math.random() * 6 + 3)) * siphonMult);
      if (burgId) {
        await client.query(`
          UPDATE sim_burg_economy
          SET wealth = GREATEST(0, wealth - $1),
              unrest = LEAST(100, unrest + $2)
          WHERE burg_id = $3
        `, [coinTheft, unrestSpike, burgId]);
      }

      // Seed ecological chaos blight in local cell
      if (locCellId) {
        await client.query(`
          UPDATE sim_cells
          SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0.0) + 0.03)
          WHERE id = $1
        `, [locCellId]);
      }

      // Check for Exodus Trigger to Dragon Prison:
      // If besiegers < 144, or corruption >= 35, or burg unrest >= 60
      const needsBesiegers = currentBesiegers < TARGET_BESIEGER_COUNT;
      const shouldExodus = needsBesiegers || corruption >= 35 || Math.random() < 0.08;

      if (shouldExodus && locCellId) {
        const nearestGrove = await getNearestSacredGrove(client, locCellId);
        if (nearestGrove) {
          state = 'TRAVELING_TO_SEAL';
          subRole = 'Cultist_Zealot';
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cell_id;

          if (Math.random() < 0.25) {
            await client.query(`
              INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
              VALUES ($1, 'CULT_EXODUS', $2, 'MINOR', $3, $4)
            `, [tick, `Having siphoned coin from within the shadows, ${citizenName} (${profession}) slipped past city watchmen, marching a cabal toward the Prison of ${nearestGrove.dragon_name}!`, burgId || null, loreDate]);
          }
        }
      }
    }

    // --- PHASE B: OVERLAND PILGRIMAGE TO DRAGON PRISON ---
    else if (state === 'TRAVELING_TO_SEAL') {
      corruption += 1;
      if (!targetCellId || !targetGroveId) {
        const nearestGrove = await getNearestSacredGrove(client, locCellId);
        if (nearestGrove) {
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cell_id;
        }
      }

      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 65, 'Warden');
        locCellId = moveResult.nextCellId;

        // Leave a trail of chaos blight along march path
        await client.query(`
          UPDATE sim_cells
          SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0.0) + 0.02)
          WHERE id = $1
        `, [locCellId]);

        // Intercepted by Grey Warden patrol along the march
        if (moveResult.collidedWith) {
          corruption = Math.min(100, corruption + 5);
          if (Math.random() < 0.35) {
            await client.query(`
              INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
              VALUES ($1, 'CULT_WARDEN_SKIRMISH', $2, 'MINOR', $3, $4)
            `, [
              tick,
              `⚔️ INTERCEPTION: Cultist ${citizenName} (${profession}) was intercepted by Warden Sentinel ${moveResult.collidedWith.name} at Cell #${locCellId}! The cabal was forced into a desperate retreat into the shadows.`,
              locCellId,
              loreDate
            ]);
          }
        }

        if (moveResult.arrived || locCellId === targetCellId) {
          state = 'BESIEGING_SEAL';
          const groveRes = await client.query("SELECT dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
          const dragonName = groveRes.rows[0]?.dragon_name || 'Chaos';
          if (Math.random() < 0.25) {
            await client.query(`
              INSERT INTO sim_events (tick, type, message, tier, lore_date)
              VALUES ($1, 'SEAL_BESIEGED', $2, 'MINOR', $3)
            `, [tick, `${citizenName} (${profession}) reached the perimeter of the Prison of ${dragonName}, joining the siege circle to shatter the dragon seal!`, loreDate]);
          }
        }
      }
    }

    // --- PHASE C: BESIEGING & DRAINING THE DRAGON PRISON ---
    else if (state === 'BESIEGING_SEAL') {
      corruption += 2;

      // Promotion to Cult Priest (veteran survival & high corruption)
      if (subRole !== 'Cult_Priest' && (corruption >= 70 || age >= 40)) {
        subRole = 'Cult_Priest';
        const groveRes = await client.query("SELECT dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
        const dName = groveRes.rows[0]?.dragon_name || 'Chaos';
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'CULT_PRIEST_ASCENSION', $2, 'MAJOR', $3)
        `, [tick, `The former ${profession.toLowerCase()}, ${citizenName}, has surrendered to primordial madness at the Prison of ${dName}, ascending as High Priest of ${dName}!`, loreDate]);
      }

      const isPriest = subRole === 'Cult_Priest';
      // Balanced drain: Priests channel with 60% chance, Zealots chant with 15% chance
      const doesDrain = isPriest ? (Math.random() < 0.60) : (Math.random() < 0.15);
      const drainAmt = doesDrain ? (isPriest ? 1.0 * sealDrainBonus : 1.0) : 0;

      // Drain Dragon Seal Strength
      if (targetGroveId && drainAmt > 0) {
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = GREATEST(0, seal_strength - $1)
          WHERE id = $2
        `, [drainAmt, targetGroveId]);
      }

      // Ecological chaos blight
      await client.query(`
        UPDATE sim_cells
        SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0.0) + $1)
        WHERE id = $2
      `, [isPriest ? 0.06 : 0.03, locCellId]);
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

  // 4. WORLD-ENDING APOCALYPSE CHECK (Broken Seal = Total Cataclysm)
  const brokenGroves = await client.query(`
    SELECT id, dragon_name, power_domain, cell_id, seal_strength
    FROM sim_sacred_groves
    WHERE seal_strength <= 0
  `);

  for (const bg of brokenGroves.rows) {
    const alreadyLogged = await client.query(
      "SELECT id FROM sim_events WHERE type = 'WORLD_ENDING_APOCALYPSE' AND message LIKE $1",
      [`%${bg.dragon_name}%`]
    );

    if (alreadyLogged.rowCount === 0) {
      await client.query(`
        INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
        VALUES ($1, 'WORLD_ENDING_APOCALYPSE', $2, 'CRITICAL', $3, $4)
      `, [
        tick,
        `☠️ WORLD-ENDING APOCALYPSE: The sacred seal binding the Chaos Dragon ${bg.dragon_name} (${bg.power_domain}) has been completely shattered (0%)! The colossal Primordial Chaos Dragon bursts free from the abyssal subterranean depths into the sky! Reality tears asunder, liquid fire rains across continents, global unrest surges to 100%, and cataclysmic doom descends upon Ostraka!`,
        bg.cell_id,
        loreDate
      ]);

      // Cataclysmic global effects:
      await client.query("UPDATE sim_burg_economy SET unrest = 100");
      await client.query("UPDATE sim_cells SET eco_blight = 100.0 WHERE id = $1", [bg.cell_id]);

      await tagSectorEnvironment(client, bg.cell_id, [
        "#BrokenDragonSeal",
        `#AwakenedChaosDragon_${bg.dragon_name}`,
        "#ApocalypseFire",
        "#PrimordialDoom"
      ], 0);
    }
  }
}
