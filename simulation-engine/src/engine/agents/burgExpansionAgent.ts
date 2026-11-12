// ─────────────────────────────────────────────────────────────────────────────
//  Burg Expansion Agent
//  Handles both:
//  1. Outlying Regional Growth: Prosperous burgs establish satellite hamlets,
//     farming estates, logging camps, and watchtowers in adjacent cells.
//  2. Grand Faction Colonization: Rich factions fund frontier settlements.
// ─────────────────────────────────────────────────────────────────────────────

import { generateOutlyingSectorMap } from "../maps/SectorMapGenerator.js";

const SETTLEMENT_HAMLET_PREFIXES = [
  "Upper", "Lower", "Little", "Old", "South", "North", "West", "East", "High", "Green", "River", "Stone", "Briar", "Pine"
];
const SETTLEMENT_HAMLET_ROOTS = [
  "croft", "stead", "wick", "holm", "ford", "dell", "gate", "ridge", "vale", "mill", "cross", "hollow", "brook", "copse"
];

function genHamletName(parentName: string, type: "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER"): string {
  const pBase = parentName.split(" ")[0] || parentName;
  const prefix = SETTLEMENT_HAMLET_PREFIXES[Math.floor(Math.random() * SETTLEMENT_HAMLET_PREFIXES.length)] || "Little";
  const root = SETTLEMENT_HAMLET_ROOTS[Math.floor(Math.random() * SETTLEMENT_HAMLET_ROOTS.length)] || "stead";

  if (type === "FARMLAND") return `${prefix} ${pBase} Grange`;
  if (type === "LOGGING") return `${pBase} Timberlands`;
  if (type === "WATCHTOWER") return `${pBase} Sentinel Redoubt`;
  return `${prefix}-${pBase}${root}`;
}

/**
 * Makes a satellite name unique among existing burgs. Timberlands and Sentinel Redoubts are named from
 * the parent's first word only, so a second camp (or two parents sharing a first word) used to collide.
 * Tries the name as is, then with each hamlet prefix ("Upper Ha Timberlands"), then a numeral.
 */
export function uniqueBurgName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (const prefix of SETTLEMENT_HAMLET_PREFIXES) {
    if (base.startsWith(`${prefix} `) || base.startsWith(`${prefix}-`)) continue;
    const candidate = `${prefix} ${base}`;
    if (!taken.has(candidate)) return candidate;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function runBurgExpansionAgent(client: any, tick: number, loreDate: string) {
  // Run expansion checks every 10 ticks
  if (tick % 10 !== 0) return;

  const namesRes = await client.query("SELECT name FROM sim_burg_economy");
  const takenNames = new Set<string>(namesRes.rows.map((r: any) => String(r.name)));

  // 1. Fetch prosperous candidate parent burgs
  const candidateBurgsRes = await client.query(`
    SELECT b.burg_id, b.name, b.cell_id, b.wealth, b.food, b.unrest, b.pop_null, b.pop_attuned,
           c.faction_id, c.center_x, c.center_y, c.biome, f.name as faction_name
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    LEFT JOIN sim_factions f ON c.faction_id = f.id
    WHERE (b.pop_null + COALESCE(b.pop_attuned, 0)) >= 600
      AND b.wealth >= 800
      AND b.food >= 600
      AND b.unrest <= 35
      AND (b.parent_burg_id IS NULL OR b.parent_burg_id = 0)
    ORDER BY b.wealth DESC
    LIMIT 12
  `);

  for (const parent of candidateBurgsRes.rows) {
    // 25% chance per eligible burg per cycle
    if (Math.random() > 0.25) continue;

    // Check how many satellite hamlets this burg already has (max 3 per burg)
    const existingCountRes = await client.query(
      "SELECT count(*) FROM sim_burg_economy WHERE parent_burg_id = $1",
      [parent.burg_id]
    );
    if (Number(existingCountRes.rows[0].count) >= 3) continue;

    // Find a neighboring cell within proximity (dist_sq < 250000) that doesn't have a burg yet
    const neighborRes = await client.query(`
      SELECT c.id, c.biome, c.elevation, c.center_x, c.center_y
      FROM sim_cells c
      WHERE c.id != $1
        AND (c.faction_id = $2 OR c.faction_id IS NULL)
        AND c.id NOT IN (SELECT cell_id FROM sim_burg_economy)
        AND c.elevation < 85
        AND c.biome NOT IN ('11', '2')
        AND ((c.center_x - $3)^2 + (c.center_y - $4)^2) < 40000
      ORDER BY ((c.center_x - $3)^2 + (c.center_y - $4)^2) ASC
      LIMIT 1
    `, [parent.cell_id, parent.faction_id, parent.center_x, parent.center_y]);

    if (neighborRes.rowCount === 0) continue;
    const targetCell = neighborRes.rows[0];

    // Determine satellite settlement type based on biome & needs
    const biome = Number(targetCell.biome) || 6;
    let satType: "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER" = "HAMLET";
    if (biome === 3 || biome === 4) satType = "LOGGING";
    else if (biome === 1 || biome === 2) satType = "FARMLAND";
    else if (Math.random() < 0.25) satType = "WATCHTOWER";

    const hamletName = uniqueBurgName(genHamletName(parent.name, satType), takenNames);
    takenNames.add(hamletName);
    const migratePop = Math.min(120, Math.max(24, Math.floor(parent.pop_null * 0.05)));
    const startWealth = Math.min(300, Math.floor(parent.wealth * 0.1));
    const startFood = migratePop * 12;

    // Get next burg_id
    const maxBurgRes = await client.query("SELECT COALESCE(MAX(burg_id), 1300) as m FROM sim_burg_economy");
    const newBurgId = Number(maxBurgRes.rows[0].m) + 1;

    // Claim cell for faction
    if (parent.faction_id) {
      await client.query("UPDATE sim_cells SET faction_id = $1 WHERE id = $2", [parent.faction_id, targetCell.id]);
    }

    // Insert new satellite hamlet into sim_burg_economy
    await client.query(`
      INSERT INTO sim_burg_economy (
        burg_id, cell_id, name, parent_burg_id, settlement_type,
        pop_null, pop_attuned, wealth, food, unrest, health, crime_rate,
        urban_tier, military_forces, demographics, species_demographics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 85, 0, 1, '{"militia":6}'::jsonb, '{}', '{}')
    `, [
      newBurgId,
      targetCell.id,
      hamletName,
      parent.burg_id,
      satType,
      migratePop,
      Math.floor(migratePop * 0.2),
      startWealth,
      startFood
    ]);

    // Insert industrial stockpile for satellite
    await client.query(
      "INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, '{}') ON CONFLICT DO NOTHING",
      [newBurgId]
    );

    // Subtract migrated pop, wealth, and food from parent burg
    await client.query(`
      UPDATE sim_burg_economy
      SET pop_null = GREATEST(200, pop_null - $1),
          wealth = GREATEST(100, wealth - $2),
          food = GREATEST(200, food - $3)
      WHERE burg_id = $4
    `, [migratePop, startWealth, startFood, parent.burg_id]);

    // Pre-render the 256x256 tactical sector map for the new hamlet
    const factionName = parent.faction_name || "Provincial Sovereignty";
    const mapResult = generateOutlyingSectorMap(
      parent,
      satType,
      112,
      112,
      targetCell.id,
      factionName
    );

    // Insert into sim_world_vault_sectors
    await client.query(`
      INSERT INTO sim_world_vault_sectors (
        cell_id, rx, ry, biome_id, elevation, moisture, chaos_radiation,
        infrastructure_mask, poi_type, compressed_terrain, name, props, npcs, features
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (cell_id, rx, ry) DO UPDATE SET
        poi_type = EXCLUDED.poi_type,
        compressed_terrain = EXCLUDED.compressed_terrain,
        name = EXCLUDED.name,
        props = EXCLUDED.props,
        npcs = EXCLUDED.npcs,
        features = EXCLUDED.features;
    `, [
      targetCell.id,
      112,
      112,
      biome,
      Math.round((Number(targetCell.elevation) || 50) * 10),
      500,
      5,
      8,
      `OUTLYING_${satType}`,
      mapResult.compressed,
      hamletName,
      JSON.stringify(mapResult.props),
      JSON.stringify(mapResult.npcs),
      JSON.stringify(mapResult.features)
    ]);

    // Create trade link / road connecting parent burg cell to the hamlet cell
    await client.query(`
      INSERT INTO sim_roads (name, source_cell_id, dest_cell_id, road_group)
      VALUES ($1, $2, $3, 'HAMLET_TRAIL')
    `, [`${parent.name}-${hamletName} Country Lane`, parent.cell_id, targetCell.id]);

    // Record Event
    await client.query(`
      INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date)
      VALUES ($1, 'OUTLYING_HAMLET_FOUNDED', $2, 'MAJOR', $3, $4)
    `, [
      tick,
      `[Regional Expansion] ${parent.name} has expanded into the surrounding hinterlands! ${hamletName} (${satType.toLowerCase()}) founded in Cell ${targetCell.id} with ${migratePop} pioneers.`,
      parent.faction_id,
      loreDate
    ]);

    console.log(`[BurgExpansion] Founded satellite ${satType} "${hamletName}" (Burg #${newBurgId}) in Cell ${targetCell.id} for parent ${parent.name}`);
  }
}
