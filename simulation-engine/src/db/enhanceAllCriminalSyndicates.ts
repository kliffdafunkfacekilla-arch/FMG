import pool from "./pool";
import { OUTLAW_SYNDICATES, ensureLairResidents } from "../engine/agents/outlawSyndicates";

export async function enhanceAllCriminalSyndicates() {
  console.log("=== PROVISIONING FULL 10 CRIMINAL SYNDICATES & PERSISTENT OUTLAW OPERATIVES ===");
  const client = await pool.connect();

  try {
    // 1. Ensure table schema enhancements
    await client.query(`
      ALTER TABLE sim_outlaw_factions ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE sim_outlaw_factions ADD COLUMN IF NOT EXISTS contraband_types TEXT[];
      ALTER TABLE sim_fringe_lairs ADD COLUMN IF NOT EXISTS resident_npc_ids TEXT[] DEFAULT '{}';
    `);

    // 2. Upsert all 10 Outlaw Syndicates
    console.log("Upserting 10 Criminal Syndicates into sim_outlaw_factions...");
    for (const syn of OUTLAW_SYNDICATES) {
      // Find actual cell of origin burg
      const cellRes = await client.query(
        `SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1`,
        [syn.originBurgId]
      );
      const actualCellId = cellRes.rows[0]?.cell_id || syn.originCellId;

      await client.query(`
        INSERT INTO sim_outlaw_factions (id, name, type, origin_cell_id, manpower, worker_groups, wealth, heat, description, contraband_types)
        VALUES ($1, $2, $3, $4, 120, 8, 15000, 0, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          origin_cell_id = EXCLUDED.origin_cell_id,
          description = EXCLUDED.description,
          contraband_types = EXCLUDED.contraband_types
      `, [syn.id, syn.name, syn.type, actualCellId, syn.description, syn.contrabandTypes]);

      // Reset sequence if needed
      await client.query(`SELECT setval('sim_outlaw_factions_id_seq', (SELECT MAX(id) FROM sim_outlaw_factions))`);

      // 3. Upsert Syndicate Boss (Paragon)
      console.log(`Setting Syndicate Boss for ${syn.name}: ${syn.bossName} (${syn.bossTitle})...`);
      const existingParagon = await client.query(
        `SELECT id FROM sim_paragons WHERE outlaw_id = $1 LIMIT 1`,
        [syn.id]
      );

      if (existingParagon.rows.length === 0) {
        await client.query(`
          INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits)
          VALUES ($1, $2, $3, $4, $5::jsonb)
        `, [syn.id, syn.originBurgId, syn.bossTitle, syn.bossName, JSON.stringify(syn.bossTraits)]);
      } else {
        await client.query(`
          UPDATE sim_paragons
          SET name = $1, title = $2, traits = $3::jsonb, burg_id = $4
          WHERE outlaw_id = $5
        `, [syn.bossName, syn.bossTitle, JSON.stringify(syn.bossTraits), syn.originBurgId, syn.id]);
      }
    }

    // 4. Seed initial lairs for the 5 new syndicates if they have none
    console.log("Seeding authentic starting lairs for newly integrated syndicates...");
    for (const syn of OUTLAW_SYNDICATES.filter(s => s.id >= 6)) {
      const existingLairs = await client.query(
        `SELECT COUNT(*) FROM sim_fringe_lairs WHERE faction_id = $1`,
        [syn.id]
      );
      if (Number(existingLairs.rows[0].count) === 0) {
        // Find 2 wealthy/suitable candidate burgs near their origin or matching theme
        const candidateBurgs = await client.query(`
          SELECT b.burg_id, b.cell_id, b.name
          FROM sim_burg_economy b
          WHERE b.cell_id IS NOT NULL AND b.wealth > 150
          ORDER BY RANDOM()
          LIMIT 3
        `);

        for (let i = 0; i < candidateBurgs.rows.length; i++) {
          const b = candidateBurgs.rows[i];
          const lairType = syn.lairTypes[i % syn.lairTypes.length];
          await client.query(`
            INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
            VALUES ($1, $2, $3, $4, 60, 15)
          `, [syn.id, b.cell_id, b.burg_id, lairType]);
          console.log(`   + Established ${lairType} for ${syn.name} in Burg ${b.name} (Burg #${b.burg_id}, Cell ${b.cell_id})`);
        }
      }
    }

    // 5. Ensure EVERY active lair across all 10 syndicates has 2 unique individuals in sim_npc_instances
    console.log("Generating and persisting unique named individuals into sim_npc_instances for all active lairs...");
    const allLairs = await client.query(`
      SELECT l.id, l.faction_id, l.cell_id, l.burg_id, l.lair_type, l.manpower, l.heat,
             o.name as cartel_name, o.type as cartel_type
      FROM sim_fringe_lairs l
      JOIN sim_outlaw_factions o ON o.id = l.faction_id
    `);

    let totalResidentNPCs = 0;
    for (const lair of allLairs.rows) {
      const residents = await ensureLairResidents(client, lair);
      totalResidentNPCs += residents.length;
      const residentIds = residents.map(r => r.id);
      await client.query(`
        UPDATE sim_fringe_lairs
        SET resident_npc_ids = $1
        WHERE id = $2
      `, [residentIds, lair.id]);
    }

    console.log(`Successfully verified and persisted ${totalResidentNPCs} unique outlaw operatives across ${allLairs.rowCount} underworld lairs!`);
  } catch (err) {
    console.error("Error enhancing criminal syndicates:", err);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  enhanceAllCriminalSyndicates().then(() => {
    console.log("Done!");
    process.exit(0);
  });
}
