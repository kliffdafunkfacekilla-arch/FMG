/**
 * cultistAgent.ts - Autonomous Cultist lifecycle, burg infiltration, and seal siege engine
 *
 * Cultists are not generic faceless monsters; they are real citizens drawn from the
 * municipal population (disenfranchised laborers, bankrupt weavers, or bitter scribes).
 * Their human personalities (Greedy, Fanatical, Scholarly, Desperate) directly influence
 * their behavior: greedy cultists siphon more gold, fanatical ones cause higher unrest,
 * and scholarly ones decipher and drain the ancient dragon seals twice as fast.
 */

import { stepTowardCell, getNearestSacredGrove } from "./agentMovementHelper.js";
import { recruitCultistPersona } from "./citizenPersonaHelper.js";

export async function runCultistAgent(client: any, tick: number, loreDate: string) {
  // Global Cultist Active Cap: 30 active operatives worldwide
  const activeCultistsRes = await client.query("SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Cultist'");
  const cultistCount = parseInt(activeCultistsRes.rows[0].total) || 0;

  // 1. Secret Infiltration Recruitment in Unrestful Burgs
  if (cultistCount < 30) {
    const unrestBurgsRes = await client.query(`
      SELECT b.burg_id, b.cell_id, b.wealth, b.unrest, b.name
      FROM sim_burg_economy b
      WHERE b.unrest >= 20
      ORDER BY b.unrest DESC
      LIMIT 10
    `);

    for (const burg of unrestBurgsRes.rows) {
      if (cultistCount >= 30) break;
      const existingInfiltrator = await client.query(
        "SELECT id FROM sim_agents WHERE role = 'Cultist' AND home_burg_id = $1 AND state = 'INFILTRATING'",
        [burg.burg_id]
      );

      if (existingInfiltrator.rowCount === 0) {
        const spawnChance = Math.min(0.50, burg.unrest / 100);
        if (Math.random() < spawnChance) {
          // Query pre-rendered citizen pool in this burg
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

        if (Math.random() < 0.30) {
          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
            VALUES ($1, 'CULT_INFILTRATION', $2, 'MINOR', $3, $4)
          `, [tick, `Whispers of dark pacts spread in ${burg.name}. ${citizen.citizenName}, a ${citizen.temper.toLowerCase()} ${citizen.profession.toLowerCase()}, was secretly initiated into the cabal.`, burg.burg_id, loreDate]);
        }
      }
    }
  }
  }

  // 2. Process All Active Cultists
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
    const siphonMult = temper === 'GREEDY' ? 2.2 : temper === 'DESPERATE' ? 1.4 : 1.0;
    const unrestSpike = temper === 'FANATICAL' ? 3 : temper === 'BITTER' ? 2 : 1;
    const sealDrainBonus = temper === 'SCHOLARLY' ? 2 : 1;

    // --- PHASE A: SECRET INFILTRATION IN BURG ---
    if (state === 'INFILTRATING') {
      corruption += Math.floor(Math.random() * 3 + 2);
      const burgId = c.home_burg_id;

      // Sabotage influenced by citizen personality
      const baseCoinTheft = Math.floor(Math.random() * 8 + 6);
      const coinTheft = Math.round(baseCoinTheft * siphonMult);

      await client.query(`
        UPDATE sim_burg_economy
        SET wealth = GREATEST(0, wealth - $1),
            unrest = LEAST(100, unrest + $2)
        WHERE burg_id = $3
      `, [coinTheft, unrestSpike, burgId]);

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
        const nearestGrove = await getNearestSacredGrove(client, locCellId);
        if (nearestGrove) {
          state = 'TRAVELING_TO_SEAL';
          subRole = 'Cultist_Pilgrim';
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cell_id;

          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
            VALUES ($1, 'CULT_EXODUS', $2, 'MINOR', $3, $4)
          `, [tick, `Having siphoned ${burgName}'s coffers from within, ${citizenName} (a ${temper.toLowerCase()} ${profession.toLowerCase()}) fled the watch, leading a cabal toward the Prison of ${nearestGrove.dragon_name}!`, burgId || null, loreDate]);
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
      } else if (!targetCellId && targetGroveId) {
        const groveRes = await client.query("SELECT cell_id FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
        targetCellId = groveRes.rows[0]?.cell_id;
      }

      if (targetCellId) {
        const moveResult = await stepTowardCell(client, locCellId, targetCellId, 65);
        locCellId = moveResult.nextCellId;

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
            INSERT INTO sim_events (tick, type, message, tier, lore_date)
            VALUES ($1, 'SEAL_BESIEGED', $2, 'MINOR', $3)
          `, [tick, `${citizenName} (${profession}) and their cabal reached the perimeter of the Prison of ${dragonName}, channeling dark rites to shatter the seal!`, loreDate]);
        }
      }
    }

    // --- PHASE C: BESIEGING & DRAINING THE DRAGON PRISON ---
    else if (state === 'BESIEGING_SEAL') {
      corruption += 2;

      // Promotion to Cult Priest (veteran survival & deep corruption)
      if (subRole !== 'Cult_Priest' && (corruption >= 70 || age >= 30)) {
        subRole = 'Cult_Priest';
        const groveRes = await client.query("SELECT dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
        const dName = groveRes.rows[0]?.dragon_name || 'Chaos';
        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier, lore_date)
          VALUES ($1, 'CULT_PRIEST_ASCENSION', $2, 'MAJOR', $3)
        `, [tick, `The former ${profession.toLowerCase()}, ${citizenName}, has completely succumbed to primordial madness at the Prison of ${dName}, ascending as High Priest of ${dName}!`, loreDate]);
      }

      const isPriest = subRole === 'Cult_Priest';
      const baseDrain = isPriest ? 2 : 1;
      const totalDrain = baseDrain * sealDrainBonus;

      // Drain Dragon Seal Strength
      if (targetGroveId) {
        await client.query(`
          UPDATE sim_sacred_groves
          SET seal_strength = GREATEST(0, seal_strength - $1)
          WHERE id = $2
        `, [totalDrain, targetGroveId]);
      }

      // Ecological chaos blight
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
