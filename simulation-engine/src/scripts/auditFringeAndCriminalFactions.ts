import pool from "../db/pool";

async function audit() {
  console.log("=================================================");
  console.log("   AUDIT: CRIMINAL ORGANIZATIONS & FRINGE FACTIONS");
  console.log("=================================================");

  // 1. Check Factions
  const factionsRes = await pool.query(`
    SELECT id, name, trait_aggression, trait_economy, trait_magic, treasury
    FROM sim_factions
    WHERE id IN (3, 25, 26) OR name ILIKE '%sky%' OR name ILIKE '%compass%' OR name ILIKE '%legion%'
    ORDER BY id ASC
  `);
  console.log("\n--- Sovereign Factions ---");
  console.table(factionsRes.rows);

  // 2. Check Underworld / Outlaw Cartels
  const outlawRes = await pool.query(`
    SELECT o.id, o.name, o.type, o.manpower, o.worker_groups, o.wealth, o.heat, p.name as boss_name, p.title as boss_title
    FROM sim_outlaw_factions o
    LEFT JOIN sim_paragons p ON p.outlaw_id = o.id
    ORDER BY o.id ASC
  `);
  console.log("\n--- Outlaw Cartels & Syndicates (sim_outlaw_factions) ---");
  console.table(outlawRes.rows);

  // 3. Check Fringe Lairs
  const lairsRes = await pool.query(`
    SELECT l.id, l.lair_type, l.manpower, l.heat, b.name as burg_name, f.name as cartel_name
    FROM sim_fringe_lairs l
    JOIN sim_burg_economy b ON l.burg_id = b.burg_id
    JOIN sim_outlaw_factions f ON l.faction_id = f.id
    ORDER BY l.faction_id, l.id ASC
  `);
  console.log(`\n--- Active Fringe Lairs (${lairsRes.rowCount} total) ---`);
  console.table(lairsRes.rows.slice(0, 15));

  // 4. Check Burgs owned by the 3 target factions
  const burgsRes = await pool.query(`
    SELECT b.burg_id, b.name as burg_name, b.is_capital, b.urban_tier, b.pop_null, b.wealth,
           c.id as cell_id, f.id as faction_id, f.name as faction_name
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    JOIN sim_factions f ON c.faction_id = f.id
    WHERE f.id IN (3, 25, 26)
    ORDER BY f.id, b.is_capital DESC, b.pop_null DESC
  `);

  console.log(`\n--- Burgs Owned by Target Factions (${burgsRes.rowCount} total) ---`);
  const grouped: Record<string, any[]> = {};
  for (const b of burgsRes.rows) {
    const key = b.faction_name || "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(b);
  }
  for (const [factionName, list] of Object.entries(grouped)) {
    console.log(`\n> ${factionName} (${list.length} burgs):`);
    list.slice(0, 5).forEach((b) => {
      console.log(`   - ${b.burg_name} (Burg #${b.burg_id}, Pop: ${b.pop_null}, Tier: ${b.urban_tier}, Capital: ${b.is_capital})`);
    });
  }

  // 5. Check Paragons & Agents
  const paragonsRes = await pool.query(`
    SELECT p.paragon_id, p.name, p.title, p.burg_id, b.name as burg_name, p.outlaw_id, o.name as outlaw_name
    FROM sim_paragons p
    LEFT JOIN sim_burg_economy b ON p.burg_id = b.burg_id
    LEFT JOIN sim_outlaw_factions o ON p.outlaw_id = o.id
    WHERE p.outlaw_id IS NOT NULL OR b.cell_id IN (SELECT id FROM sim_cells WHERE faction_id IN (3, 25, 26))
    LIMIT 20
  `);
  console.log("\n--- Paragons Associated with Target Factions / Cartels ---");
  console.table(paragonsRes.rows);

  process.exit(0);
}

audit().catch((e) => {
  console.error("Audit error:", e);
  process.exit(1);
});
