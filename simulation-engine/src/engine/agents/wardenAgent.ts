/**
 * wardenAgent.ts - Autonomous Grey Warden lifecycle, Sigil casting, and Kamikaze Martyrdom
 *
 * Wardens are based at the Spire of Convergence at the center of Ostraka. They dispatch
 * across the realm to repair weakened Dragon Seals using sigil casting. Channeling raw cosmic
 * forces slowly corrupts them. Upon reaching terminal corruption, a Warden undertakes a final
 * suicide march to detonate their soul-spark like a tactical nuke over a cultist den.
 */

import { stepTowardCell, getWeakestSacredGrove, getNearestCultistCell } from "./agentMovementHelper.js";

const CONVERGENCE_SPIRE_CELL = 17487;

export async function runWardenAgent(client: any, tick: number, loreDate: string) {
  // 1. Maintain the Order at the Spire of Convergence (capped to active order size)
  const activeWardensRes = await client.query("SELECT COUNT(*) as total FROM sim_agents WHERE role = 'Warden'");
  const wardenCount = parseInt(activeWardensRes.rows[0].total) || 0;

  if (wardenCount < 6 && Math.random() < 0.35) {
    await client.query(`
      INSERT INTO sim_agents (
        name, role, sub_role, location_cell_id, state,
        corruption, age_ticks, active_plot
      ) VALUES (
        $1, 'Warden', 'Warden_Sentinel', $2, 'AT_SPIRE',
        0, 0, 'Guarding cosmic equilibrium from the Spire of Convergence'
      )
    `, [`Grey Warden ${['Theron', 'Kaelen', 'Vael', 'Morrigan', 'Cassian', 'Alys', 'Boran', 'Gareth'][Math.floor(Math.random() * 8)]}`, CONVERGENCE_SPIRE_CELL]);
  }

  // 2. Process All Active Wardens
  const wardensRes = await client.query(`
    SELECT id, name, sub_role, location_cell_id, target_cell_id,
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

    // --- PHASE A: STATIONED AT THE SPIRE ---
    if (state === 'AT_SPIRE') {
      // Find the most weakened or endangered seal
      const endangeredGrove = await getWeakestSacredGrove(client);
      if (endangeredGrove && (endangeredGrove.seal_strength < 100 || Math.random() < 0.25)) {
        state = 'TRAVELING_TO_SEAL';
        targetGroveId = endangeredGrove.id;
        targetCellId = endangeredGrove.cell_id;

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier)
          VALUES ($1, 'WARDEN_DISPATCH', $2, 'BACKGROUND')
        `, [tick, `${w.name} has departed the Spire of Convergence on a mission to reinforce the Prison of ${endangeredGrove.dragon_name} (Current Seal: ${endangeredGrove.seal_strength}%).`]);
      }
    }

    // --- PHASE B: TRAVELING OUTWARD TO SACRED GROVE ---
    else if (state === 'TRAVELING_TO_SEAL' || state === 'RETURNING_TO_SPIRE') {
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
                INSERT INTO sim_events (tick, type, message, tier)
                VALUES ($1, 'WARDEN_CLASH', $2, 'MINOR')
              `, [tick, `⚔️ ${w.name} ambushed and executed ${hc.name} while defending the dragon seal grounds!`]);
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
          SET seal_strength = LEAST(100, seal_strength + 3)
          WHERE id = $1
        `, [targetGroveId]);
      }

      // Cleanse local eco-blight
      await client.query(`
        UPDATE sim_cells
        SET eco_blight = GREATEST(0.0, COALESCE(eco_blight, 0.0) - 0.4)
        WHERE id = $1
      `, [locCellId]);

      // Tragic Cost: Sigil casting against raw primordial chaos inflicts corruption
      corruption += Math.floor(Math.random() * 4 + 3);

      // Check Seal Completion
      const groveCheck = await client.query("SELECT seal_strength, dragon_name FROM sim_sacred_groves WHERE id = $1", [targetGroveId]);
      const currentSeal = groveCheck.rows[0]?.seal_strength || 100;
      const dragonName = groveCheck.rows[0]?.dragon_name || 'Chaos';

      // Terminal Corruption: The Kamikaze Decision
      if (corruption >= 85) {
        state = 'KAMIKAZE_RUN';
        subRole = 'Warden_Martyr';

        // Locate nearest Cultist hideout, cell, or temple to target for destruction
        const cultTarget = await getNearestCultistCell(client, locCellId);
        if (cultTarget) {
          targetCellId = cultTarget.cell_id;
        } else {
          // If no active cultist found, target the nearest high-unrest burg
          const unrestBurg = await client.query("SELECT cell_id FROM sim_burg_economy ORDER BY unrest DESC LIMIT 1");
          targetCellId = unrestBurg.rows[0]?.cell_id || CONVERGENCE_SPIRE_CELL;
        }

        await client.query(`
          INSERT INTO sim_events (tick, type, message, tier)
          VALUES ($1, 'WARDEN_TERMINAL_RESOLVE', $2, 'MAJOR')
        `, [tick, `⚠️ SACRIFICIAL MARCH: ${w.name}, terminally corrupted after anchoring the Prison of ${dragonName}, has refused to become a monster. The Warden has initiated a final suicide march to unleash an apocalyptic sigil overload upon a cult sanctuary!`]);
      } else if (currentSeal >= 100) {
        // Return to Spire if seal is fully restored and corruption is manageable
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
          // 1. Obliterate all Cultists in this cell
          const cultsPurged = await client.query("DELETE FROM sim_agents WHERE role = 'Cultist' AND location_cell_id = $1 RETURNING id", [locCellId]);

          // 2. Completely cleanse blight and corruption in local cell
          await client.query("UPDATE sim_cells SET eco_blight = 0.0 WHERE id = $1", [locCellId]);

          // 3. Relieve municipal unrest if a burg is present
          await client.query("UPDATE sim_burg_economy SET unrest = GREATEST(0, unrest - 25) WHERE cell_id = $1", [locCellId]);

          // 4. Sacrifice the Warden
          await client.query("DELETE FROM sim_agents WHERE id = $1", [w.id]);

          // 5. Broadcast Major Event
          await client.query(`
            INSERT INTO sim_events (tick, type, message, tier)
            VALUES ($1, 'WARDEN_SUPERNOVA', $2, 'MAJOR')
          `, [tick, `💥 HEROIC SUPERNOVA: ${w.name} detonated their remaining soul-spark in a blinding aetheric blast at Cell #${locCellId}! The tactical sigil rupture obliterated ${cultsPurged.rowCount} cultist cabals, cleansed all land corruption, and broke the grip of dark terror!`]);
          continue; // Agent is destroyed
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
