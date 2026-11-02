import pool from "./pool";
import {
  generateBurgSectorMap,
  generateOutlyingSectorMap,
  generateTheVergeSectorMap,
  generateDragonPrisonSectorMap,
  generateCoralCrownSectorMap,
  type SectorMapResult
} from "../engine/maps/SectorMapGenerator";

export async function prerenderAllSectorMaps() {
  console.log("=== STARTING MASTER SECTOR MAP PRE-RENDER PIPELINE ===");
  const startTime = Date.now();

  const client = await pool.connect();
  try {
    // 1. Ensure table schema has required columns
    await client.query(`
      ALTER TABLE sim_world_vault_sectors
        ADD COLUMN IF NOT EXISTS name VARCHAR(128),
        ADD COLUMN IF NOT EXISTS props JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS npcs JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // 2. Fetch all burgs
    const burgQuery = `
      SELECT b.*, c.biome, c.elevation, f.name as faction_name
      FROM sim_burg_economy b
      JOIN sim_cells c ON b.cell_id = c.id
      LEFT JOIN sim_factions f ON c.faction_id = f.id
      ORDER BY b.burg_id ASC
    `;
    const burgsRes = await client.query(burgQuery);
    console.log(`Found ${burgsRes.rows.length} burgs to pre-render.`);

    // Batch map records accumulator
    const recordsToInsert: Array<{
      cell_id: number;
      rx: number;
      ry: number;
      biome_id: number;
      elevation: number;
      moisture: number;
      chaos_radiation: number;
      infrastructure_mask: number;
      poi_type: string;
      compressed_terrain: Buffer;
      name: string;
      props: any[];
      npcs: any[];
      features: any;
    }> = [];

    // Helper to add to accumulator
    const addSector = (
      cellId: number,
      rx: number,
      ry: number,
      biomeId: number,
      elevation: number,
      mapRes: SectorMapResult
    ) => {
      recordsToInsert.push({
        cell_id: cellId,
        rx,
        ry,
        biome_id: biomeId || 6,
        elevation: Math.round((elevation || 50) * 10),
        moisture: 500,
        chaos_radiation: mapRes.poiType.includes("PRISON") ? 40 : mapRes.poiType.includes("VERGE") ? 80 : 5,
        infrastructure_mask: mapRes.poiType.includes("BURG") ? 32 : 8,
        poi_type: mapRes.poiType,
        compressed_terrain: mapRes.compressed,
        name: mapRes.name,
        props: mapRes.props,
        npcs: mapRes.npcs,
        features: mapRes.features
      });
    };

    // Pre-fetch top 3 citizen personas for each cell to make civic NPCs authentic
    const citizensRes = await client.query(`
      SELECT home_cell_id, name, profession, species, temper, instinct, motivation, spark_tier
      FROM population_demographics
      WHERE life_stage = 'ADULT'
      ORDER BY citizen_id ASC
    `);
    const citizenMap = new Map<number, any[]>();
    for (const c of citizensRes.rows) {
      if (!citizenMap.has(c.home_cell_id)) citizenMap.set(c.home_cell_id, []);
      const arr = citizenMap.get(c.home_cell_id)!;
      if (arr.length < 3) arr.push(c);
    }

    console.log("Pre-rendering 346 Burgs and their 4 Outlying Sectors (Hamlets, Farms, Timber, Watchtowers)...");
    for (const burg of burgsRes.rows) {
      const burgCitizens = citizenMap.get(burg.cell_id) || [];
      const factionName = burg.faction_name || "Provincial Sovereignty";
      const cellId = burg.cell_id;
      const biomeId = Number(burg.biome) || 6;
      const elevation = Number(burg.elevation) || 50;

      // A. Center Burg Core (rx: 112, ry: 112)
      const coreMap = generateBurgSectorMap(burg, factionName, cellId, burgCitizens);
      addSector(cellId, 112, 112, biomeId, elevation, coreMap);

      // B. Outlying Sectors around the burg:
      // North: Farmlands & Granaries
      const farmMap = generateOutlyingSectorMap(burg, "FARMLAND", 112, 87, cellId, factionName);
      addSector(cellId, 112, 87, biomeId, elevation, farmMap);

      // South: Rural Hamlet & Cottages
      const hamletMap = generateOutlyingSectorMap(burg, "HAMLET", 112, 137, cellId, factionName);
      addSector(cellId, 112, 137, biomeId, elevation, hamletMap);

      // East: Logging Camp & Timber Saws
      const loggingMap = generateOutlyingSectorMap(burg, "LOGGING", 137, 112, cellId, factionName);
      addSector(cellId, 137, 112, biomeId, elevation, loggingMap);

      // West: Frontier Watchtower & Beacon
      const towerMap = generateOutlyingSectorMap(burg, "WATCHTOWER", 87, 112, cellId, factionName);
      addSector(cellId, 87, 112, biomeId, elevation, towerMap);
    }
    console.log(`Pre-rendered ${recordsToInsert.length} burg & outlying sectors.`);

    // 3. Pre-render The Verge (Sacred Spire) at Cell 16166
    console.log("Pre-rendering The Verge (Sacred Spire) at Cell 16166...");
    const vergeMap = generateTheVergeSectorMap(16166);
    addSector(16166, 112, 112, 1, 990, vergeMap);
    addSector(16166, 43, 121, 1, 990, vergeMap); // Exact landmark coordinate from FMG

    // 4. Pre-render The Eye / Coral Crown at Cell 16777
    console.log("Pre-rendering The Eye / Coral Crown at Cell 16777...");
    const crownMap = generateCoralCrownSectorMap(16777);
    addSector(16777, 112, 112, 0, 10, crownMap);
    addSector(16777, 171, 127, 0, 10, crownMap); // Exact landmark coordinate

    // 5. Pre-render the 12 Dragon Prisons
    console.log("Pre-rendering the 12 Dragon Prisons...");
    const prisonQuery = `
      SELECT g.cell_id, g.dragon_name, g.power_domain, l.sector_x, l.sector_y
      FROM sim_sacred_groves g
      LEFT JOIN sim_world_landmarks l ON g.cell_id = l.cell_id
      ORDER BY g.id ASC
    `;
    const prisonsRes = await client.query(prisonQuery);

    const clockPositions: Record<string, number> = {
      Eldra: 1, Vecelo: 2, Lophex: 3, Sevrath: 4, Grolak: 5,
      Gavusrix: 6, Stagus: 7, Carulkem: 8, Virantor: 9, Ulex: 10,
      Vahn: 11, Tiraton: 12
    };

    for (const pr of prisonsRes.rows) {
      const prisonMap = generateDragonPrisonSectorMap({
        cellId: pr.cell_id,
        dragonName: pr.dragon_name,
        elementalPower: pr.power_domain,
        clockPosition: clockPositions[pr.dragon_name] || 1,
        description: `Dragon Prison containing ${pr.dragon_name}, primordial avatar of ${pr.power_domain}.`
      });

      addSector(pr.cell_id, 112, 112, 11, 400, prisonMap);
      if (pr.sector_x != null && pr.sector_y != null) {
        addSector(pr.cell_id, pr.sector_x, pr.sector_y, 11, 400, prisonMap);
      }
    }

    console.log(`Total sectors ready for database ingestion: ${recordsToInsert.length}`);

    // 6. Batch Upsert into sim_world_vault_sectors (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const chunk = recordsToInsert.slice(i, i + BATCH_SIZE);
      const values: any[] = [];
      const rowPlaceholders: string[] = [];

      chunk.forEach((rec, idx) => {
        const offset = idx * 14;
        rowPlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`
        );
        values.push(
          rec.cell_id,
          rec.rx,
          rec.ry,
          rec.biome_id,
          rec.elevation,
          rec.moisture,
          rec.chaos_radiation,
          rec.infrastructure_mask,
          rec.poi_type,
          rec.compressed_terrain,
          rec.name,
          JSON.stringify(rec.props),
          JSON.stringify(rec.npcs),
          JSON.stringify(rec.features)
        );
      });

      const upsertSql = `
        INSERT INTO sim_world_vault_sectors
          (cell_id, rx, ry, biome_id, elevation, moisture, chaos_radiation, infrastructure_mask, poi_type, compressed_terrain, name, props, npcs, features)
        VALUES ${rowPlaceholders.join(", ")}
        ON CONFLICT (cell_id, rx, ry) DO UPDATE SET
          poi_type = EXCLUDED.poi_type,
          compressed_terrain = EXCLUDED.compressed_terrain,
          name = EXCLUDED.name,
          props = EXCLUDED.props,
          npcs = EXCLUDED.npcs,
          features = EXCLUDED.features;
      `;

      await client.query(upsertSql, values);
      if ((i + BATCH_SIZE) % 250 === 0 || i + BATCH_SIZE >= recordsToInsert.length) {
        console.log(`Inserted ${Math.min(i + BATCH_SIZE, recordsToInsert.length)} / ${recordsToInsert.length} sector maps.`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== PRE-RENDER COMPLETED IN ${elapsed}s ===`);
    console.log(`Total Vault Sectors: ${recordsToInsert.length}`);
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].includes("prerenderSectorMaps")) {
  prerenderAllSectorMaps()
    .then(() => {
      console.log("Sector pre-render completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Sector pre-render failed:", err);
      process.exit(1);
    });
}
