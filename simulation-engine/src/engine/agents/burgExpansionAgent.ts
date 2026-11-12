// ─────────────────────────────────────────────────────────────────────────────
//  Burg Expansion Agent
//  Handles both:
//  1. Outlying Regional Growth: Prosperous burgs establish satellite hamlets,
//     farming estates, logging camps, and watchtowers in adjacent cells.
//  2. Grand Faction Colonization: Rich factions fund frontier settlements.
// ─────────────────────────────────────────────────────────────────────────────

import { getWorkplaceForProfession } from "./burgOperationsAgent.js";

type SatelliteType = "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER";

/** The trades a parent burg sends to found each kind of satellite (first choice; anyone fills the rest). */
const FOUNDER_TRADES: Record<SatelliteType, string[]> = {
  HAMLET: ["Farmer", "Miller", "Carpenter", "Baker", "Disenfranchised Laborer", "Stonemason"],
  FARMLAND: ["Farmer", "Miller", "Disenfranchised Laborer", "Brewmaster"],
  LOGGING: ["Carpenter", "Cooper", "Bowyer", "Tanner", "Disenfranchised Laborer"],
  WATCHTOWER: ["City Watchman", "Gate Sentry", "Armorer", "Bowyer", "Blacksmith"],
};

/**
 * Moves real citizens from the parent burg to a newly founded satellite. Expansion used to move a
 * population number only, so every satellite had pop_null > 0 and no people: its maps came out empty
 * and stories there had nobody to involve. Founders are living adult civilians of the parent, preferring
 * the trades the settlement needs, plus children who share a founder's family name. The number of
 * records follows the parent's own people-per-record density, so the hamlet is as detailed as its parent.
 * Returns how many records moved.
 */
export async function settleSatellite(
  client: any,
  parent: { burg_id: number; name: string },
  satellite: { burg_id: number; cell_id: number; name: string; type: SatelliteType; pioneers: number }
): Promise<number> {
  const density = await client.query(`
    SELECT (b.pop_null + COALESCE(b.pop_attuned, 0))::float / NULLIF(COUNT(d.citizen_id), 0) AS per_record
    FROM sim_burg_economy b
    LEFT JOIN population_demographics d ON d.settlement_id = b.burg_id AND d.allegiance_status = 'CIVILIAN'
    WHERE b.burg_id = $1 GROUP BY b.burg_id`, [parent.burg_id]);
  const perRecord = Number(density.rows[0]?.per_record) || 8.5;
  const total = Math.max(3, Math.min(16, Math.round(satellite.pioneers / perRecord)));
  const adultsWanted = Math.max(2, Math.ceil(total * 0.75));

  const adults = await client.query(`
    SELECT citizen_id, profession, split_part(name, ' ', 2) AS family
    FROM population_demographics
    WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN' AND life_stage = 'ADULT'
    ORDER BY (profession = ANY($2)) DESC, random()
    LIMIT $3`, [parent.burg_id, FOUNDER_TRADES[satellite.type], adultsWanted]);
  if (adults.rows.length === 0) return 0;

  const families = [...new Set(adults.rows.map((a: any) => String(a.family)).filter(Boolean))];
  const children = await client.query(`
    SELECT citizen_id FROM population_demographics
    WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN' AND life_stage = 'CHILD'
    ORDER BY (split_part(name, ' ', 2) = ANY($2)) DESC, random()
    LIMIT $3`, [parent.burg_id, families, Math.max(0, total - adults.rows.length)]);

  const motivation = `Left ${parent.name} to help found ${satellite.name}.`;
  for (const a of adults.rows) {
    const wp = getWorkplaceForProfession(String(a.profession), satellite.name);
    await client.query(`
      UPDATE population_demographics
      SET settlement_id = $1, home_cell_id = $2, motivation = $3, birthplace = COALESCE(birthplace, $4),
          workplace_type = $5, workplace_name = $6
      WHERE citizen_id = $7`,
      [satellite.burg_id, satellite.cell_id, motivation, parent.name, wp.type, wp.name, a.citizen_id]);
  }
  if (children.rows.length) {
    await client.query(`
      UPDATE population_demographics
      SET settlement_id = $1, home_cell_id = $2, birthplace = COALESCE(birthplace, $3)
      WHERE citizen_id = ANY($4)`,
      [satellite.burg_id, satellite.cell_id, parent.name, children.rows.map((c: any) => c.citizen_id)]);
  }
  return adults.rows.length + children.rows.length;
}

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
    let satType: SatelliteType = "HAMLET";
    if (biome === 3 || biome === 4) satType = "LOGGING";
    else if (biome === 1 || biome === 2) satType = "FARMLAND";
    else if (Math.random() < 0.25) satType = "WATCHTOWER";

    const hamletName = uniqueBurgName(genHamletName(parent.name, satType), takenNames);
    takenNames.add(hamletName);
    const migratePop = Math.min(120, Math.max(24, Math.floor(parent.pop_null * 0.05)));
    // Pioneers are 80% null, 20% attuned; both leave the parent (the attuned share used to appear from nothing)
    const migrateAttuned = Math.floor(migratePop * 0.2);
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
      migratePop - migrateAttuned,
      migrateAttuned,
      startWealth,
      startFood
    ]);
    const settlers = await settleSatellite(client, parent, {
      burg_id: newBurgId, cell_id: targetCell.id, name: hamletName, type: satType, pioneers: migratePop,
    });

    // Insert industrial stockpile for satellite
    await client.query(
      "INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, '{}') ON CONFLICT DO NOTHING",
      [newBurgId]
    );

    // Subtract migrated pop, wealth, and food from parent burg
    await client.query(`
      UPDATE sim_burg_economy
      SET pop_null = GREATEST(200, pop_null - $1),
          pop_attuned = GREATEST(0, COALESCE(pop_attuned, 0) - $5),
          wealth = GREATEST(100, wealth - $2),
          food = GREATEST(200, food - $3)
      WHERE burg_id = $4
    `, [migratePop - migrateAttuned, startWealth, startFood, parent.burg_id, migrateAttuned]);


    // Its maps are built on demand when a tile is opened (dmRouter /sector_layer), from these settlers.
    // A 256x256 map used to be pre-rendered here into sim_world_vault_sectors at tile (112,112): off the
    // 0-99 grid, never read by anything, and paid for inside the tick.

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

    console.log(`[BurgExpansion] Founded satellite ${satType} "${hamletName}" (Burg #${newBurgId}) in Cell ${targetCell.id} for parent ${parent.name} with ${settlers} settler records`);
  }
}
