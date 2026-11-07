/**
 * ingestHolgalandMap.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Full-fidelity ingestion of Azgaar's Fantasy Map Generator Holgaland export:
 *  - 27 Factions (Avian Empire, Grey Wardens, Gilded Compass, etc.)
 *  - 34,387 Cells (Height/Elevation, Biomes, Neighbors, Coordinates, Temperature)
 *  - 345 Burgs (Population, Wealth, Infrastructure, Urban Tiers, Dominant Domains)
 *  - 12 Dragon Prisons & Sacred Seals (Eldra, Vecelo, Lophex, Sevrath, Grolak,
 *    Gavusrix, Stagus, Carulkem, Virantor, Ulex, Vahn, Tiraton)
 *  - The Convergence: The Verge (Sacred Spire) & Coral Crown (The Eye)
 *  - 231 World Landmarks & Markers (Volcanoes, Megaliths, Shrines)
 *  - 372 Infrastructure Routes (Highways, Trails, Mountain Passes)
 *  - 12 Primordial Chaos Flows converging from the Prisons to The Verge
 */

import fs from "fs";
import path from "path";
import pool from "./pool";
import { prerenderWorldPopulation } from "./prerenderWorldPopulation";
import { provisionAllBurgParagons } from "./provisionAllBurgParagons";
import { enhanceAllCriminalSyndicates } from "./enhanceAllCriminalSyndicates";

const candidatePaths = [
  path.resolve(__dirname, "../../data/Holgaland.json"),
  path.resolve(__dirname, "../../../data/Holgaland.json"),
  path.resolve(process.cwd(), "simulation-engine/data/Holgaland.json"),
  path.resolve(process.cwd(), "data/Holgaland.json"),
  "C:/Users/krazy/Desktop/FMG/simulation-engine/data/Holgaland.json",
  "C:/Users/krazy/Downloads/Holgaland Full 2026-10-21-20-16.json"
];
const MAP_PATH: string = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0] || "";

// Lore Profiles for Factions (Aggression, Magic, Economy)
const FACTION_LORE_PROFILES: Record<string, { aggression: number; magic: number; economy: number; species: Record<string, number> }> = {
  "Avian Empire": { aggression: 3, magic: 8, economy: 9, species: { "Avian": 0.7, "Human": 0.2, "Wolf-Kin": 0.1 } },
  "Grey Wardens": { aggression: 2, magic: 10, economy: 5, species: { "Human": 0.4, "Avian": 0.2, "Bear-Folk": 0.2, "Felid": 0.2 } },
  "Gilded Compass": { aggression: 1, magic: 3, economy: 10, species: { "Human": 0.6, "Felid": 0.3, "Saurian": 0.1 } },
  "Ursine Hegemony": { aggression: 7, magic: 2, economy: 5, species: { "Bear-Folk": 0.8, "Porcupine": 0.2 } },
  "The Reliance": { aggression: 4, magic: 4, economy: 7, species: { "Mushroom-Folk": 0.8, "Human": 0.2 } },
  "Sylvan Empire": { aggression: 3, magic: 9, economy: 6, species: { "Plant-Folk": 0.7, "Fae": 0.3 } },
  "Iron Caldera": { aggression: 8, magic: 4, economy: 7, species: { "Lizard-Folk": 0.6, "Shelled Reptile": 0.3, "Salamander": 0.1 } },
  "Heartland Alliance": { aggression: 4, magic: 3, economy: 8, species: { "Horse": 0.4, "Wolf": 0.3, "Human": 0.3 } },
  "Vaneer Concord": { aggression: 5, magic: 5, economy: 6, species: { "Arachnid": 0.6, "Insect": 0.3, "Mouse": 0.1 } },
  "Sump-Kin": { aggression: 6, magic: 6, economy: 4, species: { "Mutant Amphibian": 0.8, "Rat": 0.2 } },
  "River Folk": { aggression: 2, magic: 5, economy: 8, species: { "Frog": 0.5, "Otter": 0.3, "Penguin": 0.2 } },
  "Flower Valley": { aggression: 1, magic: 6, economy: 7, species: { "Red Panda": 0.6, "Simian": 0.4 } },
  "Eastern Hounds": { aggression: 7, magic: 2, economy: 5, species: { "Hound": 0.8, "Wolf": 0.2 } },
  "Canopy Clans": { aggression: 5, magic: 6, economy: 6, species: { "Vulpine": 0.3, "Tarsier": 0.3, "Simian": 0.2, "Sciurini": 0.2 } },
  "Dust-Husk Riders": { aggression: 8, magic: 3, economy: 4, species: { "Dune Dog": 0.5, "Dust-Skipper": 0.3, "Fur-Wyrm": 0.2 } },
  "Hive Commonwealth": { aggression: 4, magic: 5, economy: 9, species: { "Bee": 0.6, "Ant": 0.4 } },
  "Prism-Scale Collective": { aggression: 3, magic: 7, economy: 7, species: { "Peacock": 0.8, "Scarred-Guard": 0.2 } },
  "Port Sunder": { aggression: 5, magic: 4, economy: 8, species: { "Human": 0.5, "Felid": 0.3, "Wolf-Kin": 0.2 } },
  "Meridian Chain": { aggression: 3, magic: 4, economy: 8, species: { "Penguin": 0.4, "Walrus": 0.3, "Seal": 0.2, "Otter": 0.1 } },
  "Scute Confederacy": { aggression: 4, magic: 3, economy: 7, species: { "Armadillo": 0.5, "Pangolin": 0.5 } },
  "Guerrilla Clans": { aggression: 9, magic: 3, economy: 4, species: { "Simian": 0.8, "Tarsier": 0.2 } },
  "Coastal Theocracy": { aggression: 6, magic: 9, economy: 7, species: { "Avian": 0.5, "Reptile": 0.5 } },
  "Devil's Island": { aggression: 8, magic: 8, economy: 3, species: { "Demon-Kin": 0.6, "Outcast": 0.4 } },
  "Skyroost Academy": { aggression: 1, magic: 10, economy: 7, species: { "Avian": 0.8, "Human": 0.2 } },
  "Free Sky Baronies": { aggression: 6, magic: 5, economy: 6, species: { "Avian": 0.6, "Human": 0.4 } },
  "Fuvuiku Legions": { aggression: 9, magic: 4, economy: 5, species: { "Saurian": 0.8, "Human": 0.2 } },
  "Neutrals": { aggression: 1, magic: 1, economy: 3, species: { "Human": 0.6, "Wolf-Kin": 0.2, "Felid": 0.2 } }
};

export async function ingestHolgalandMap() {
  console.log(`[Ingest] Reading Holgaland map from: ${MAP_PATH}`);
  if (!MAP_PATH || !fs.existsSync(MAP_PATH)) {
    throw new Error(`Holgaland map JSON not found at: ${MAP_PATH}`);
  }

  const raw: string = fs.readFileSync(MAP_PATH, "utf-8");
  const data = JSON.parse(raw);
  const pack = data.pack;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("[Ingest] Connected to PostgreSQL. Preparing tables...");

    // Ensure tables have needed columns
    await client.query(`
      ALTER TABLE sim_roads ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE sim_roads ADD COLUMN IF NOT EXISTS road_group TEXT;
      ALTER TABLE sim_roads ADD COLUMN IF NOT EXISTS length REAL;
      ALTER TABLE sim_roads ADD COLUMN IF NOT EXISTS points JSONB;

      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS culture_id INT;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS is_capital BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS port BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS dominant_domain VARCHAR(50) DEFAULT 'MATERIAL';
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS hierarchy_tier INT DEFAULT 1;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS pop_growth_pool FLOAT DEFAULT 0.0;

      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS geometry TEXT;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS z_layer INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_plants REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_prey REAL DEFAULT 50.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_predators REAL DEFAULT 10.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_resources REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_health REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_max REAL DEFAULT 100.0;
    `);

    // Clean dependent simulation tables in foreign-key safe order
    console.log("[Ingest] Clearing previous world geography...");
    await client.query("DELETE FROM sim_sacred_groves");
    await client.query("DELETE FROM sim_chaos_flows");
    await client.query("DELETE FROM sim_roads");
    await client.query("DELETE FROM sim_world_landmarks");
    await client.query("DELETE FROM sim_paragons");
    await client.query("DELETE FROM population_demographics");
    await client.query("DELETE FROM sim_fringe_lairs");
    await client.query("DELETE FROM sim_sector_layers");
    await client.query("DELETE FROM sim_burg_economy");
    await client.query("DELETE FROM sim_cells");
    await client.query("DELETE FROM sim_factions");

    // ─────────────────────────────────────────────────────────────────────────
    // 1. INGEST FACTIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Ingest] Ingesting ${pack.states.length} factions/states...`);
    for (const s of pack.states) {
      if (!s || s.name === undefined) continue;
      const lore = FACTION_LORE_PROFILES[s.name] || { aggression: 3, magic: 3, economy: 5, species: { "Human": 1.0 } };
      await client.query(`
        INSERT INTO sim_factions (id, name, color, lore_text, trait_aggression, trait_magic, trait_economy, wealth, treasury)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 10000, 10000)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          trait_aggression = EXCLUDED.trait_aggression,
          trait_magic = EXCLUDED.trait_magic,
          trait_economy = EXCLUDED.trait_economy
      `, [
        s.i,
        s.name,
        s.color || "#888888",
        `Sovereign realm of ${s.name}`,
        lore.aggression,
        lore.magic,
        lore.economy
      ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. INGEST CELLS (Batch unnest with Voronoi geometry)
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Ingest] Ingesting ${pack.cells.length} cells in batches with Voronoi geometry...`);
    const BATCH_SIZE = 1000;
    const vertices = pack.vertices || [];

    for (let i = 0; i < pack.cells.length; i += BATCH_SIZE) {
      const chunk = pack.cells.slice(i, i + BATCH_SIZE);
      const ids: number[] = [];
      const factionIds: (number | null)[] = [];
      const biomes: string[] = [];
      const pops: number[] = [];
      const centerXs: number[] = [];
      const centerYs: number[] = [];
      const elevations: number[] = [];
      const temps: number[] = [];
      const geoms: (string | null)[] = [];

      for (const c of chunk) {
        if (!c || c.i === undefined) continue;
        ids.push(c.i);
        factionIds.push(c.state > 0 ? c.state : null);
        biomes.push(String(c.biome ?? 0));
        pops.push(Math.floor(c.pop || 0));
        centerXs.push(c.p ? c.p[0] : 0);
        centerYs.push(c.p ? c.p[1] : 0);
        elevations.push(c.h || 0);

        // Approximate temperature based on latitude (center_y)
        const latRatio = (c.p ? c.p[1] : 1200) / 2496;
        const baseT = Math.round(30 - Math.abs(latRatio - 0.5) * 35 - ((c.h || 0) > 50 ? ((c.h - 50) * 0.3) : 0));
        temps.push(baseT);

        // Voronoi cell polygon geometry
        let geomStr: string | null = null;
        if (Array.isArray(c.v) && c.v.length >= 3 && vertices.length > 0) {
          const ring = c.v
            .map((vIdx: number) => vertices[vIdx]?.p)
            .filter((p: any) => Array.isArray(p) && p.length === 2)
            .map(([x, y]: [number, number]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

          if (ring.length >= 3) {
            if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
              ring.push([ring[0][0], ring[0][1]]);
            }
            geomStr = JSON.stringify({ type: "Polygon", coordinates: [ring] });
          }
        }
        geoms.push(geomStr);
      }

      await client.query(`
        INSERT INTO sim_cells (
          id, faction_id, biome, population, center_x, center_y,
          elevation, base_temp, current_temp, geometry,
          eco_plants, eco_prey, eco_predators, eco_resources, eco_health, eco_max
        )
        SELECT
          u.id, u.faction_id, u.biome, u.population, u.center_x, u.center_y,
          u.elevation, u.base_temp, u.base_temp, u.geometry,
          100.0, 50.0, 10.0, 100.0, 100.0, 100.0
        FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::int[], $5::real[], $6::real[],
          $7::int[], $8::real[], $9::text[]
        ) AS u(id, faction_id, biome, population, center_x, center_y, elevation, base_temp, geometry)
      `, [ids, factionIds, biomes, pops, centerXs, centerYs, elevations, temps, geoms]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. INGEST BURGS & ECONOMY
    // ─────────────────────────────────────────────────────────────────────────
    const validBurgs = pack.burgs.filter((b: any) => b && b.name);
    console.log(`[Ingest] Ingesting ${validBurgs.length} burgs...`);

    for (const b of validBurgs) {
      const stateName = pack.states[b.state]?.name || "Neutrals";
      const lore = FACTION_LORE_PROFILES[stateName] || { species: { "Human": 1.0 } };
      const rawPop = Math.floor((b.population || 10) * 1000);
      const popNull = Math.floor(rawPop * 0.5);
      const popAttuned = Math.floor(rawPop * 0.5);
      const urbanTier = b.capital ? 3 : (b.population > 12 ? 3 : (b.population > 2 ? 2 : 1));
      const wealth = Math.floor(b.treasury || 500);

      await client.query(`
        INSERT INTO sim_burg_economy (
          burg_id, name, cell_id, food, raw_materials, refined_goods,
          wealth, unrest, pop_null, pop_attuned, urban_tier,
          dominant_domain, species_demographics, health, crime_rate,
          is_capital, port, culture_id
        ) VALUES (
          $1, $2, $3, 2000, 1500, 1500,
          $4, 0, $5, $6, $7,
          'MATERIAL', $8, 100, 0,
          $9, $10, $11
        )
      `, [
        b.i,
        b.name,
        b.cell,
        wealth,
        popNull,
        popAttuned,
        urbanTier,
        JSON.stringify(lore.species),
        Boolean(b.capital),
        Boolean(b.port),
        b.culture || 0
      ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. INGEST MARKERS & WORLD LANDMARKS (Dragon Prisons, Spire, Coral Crown)
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Ingest] Ingesting ${pack.markers.length} world landmarks and dragon prisons...`);
    const markers = pack.markers || [];
    
    // Explicit 12 Dragon Prisons registry
    const DRAGON_PRISONS: {
      clock: number;
      dragon: string;
      power: string;
      cell: number;
      x: number;
      y: number;
      cult: string;
      angleDeg: number;
    }[] = [
      { clock: 1, dragon: "Eldra", power: "Ratio", cell: 12768, x: 2880.00, y: 1004.54, cult: "The Ghost-Light Cartel", angleDeg: 30 },
      { clock: 2, dragon: "Vecelo", power: "Motus", cell: 15004, x: 2787.84, y: 1147.39, cult: "The Strangler Fig", angleDeg: 60 },
      { clock: 3, dragon: "Lophex", power: "Lux", cell: 17855, x: 2769.41, y: 1320.19, cult: "The Blind Spot", angleDeg: 90 },
      { clock: 4, dragon: "Sevrath", power: "Omen", cell: 19502, x: 2827.01, y: 1483.78, cult: "The Rotting Vessel", angleDeg: 120 },
      { clock: 5, dragon: "Grolak", power: "Anumis", cell: 21943, x: 2960.64, y: 1594.37, cult: "The Null-Equation", angleDeg: 150 },
      { clock: 6, dragon: "Gavusrix", power: "Vita", cell: 22175, x: 3138.05, y: 1615.10, cult: "The Quicksilver Mother", angleDeg: 180 },
      { clock: 7, dragon: "Stagus", power: "Ordo", cell: 21260, x: 3297.02, y: 1539.07, cult: "The Frozen Heart", angleDeg: 210 },
      { clock: 8, dragon: "Carulkem", power: "Nexus", cell: 18826, x: 3389.18, y: 1393.92, cult: "True Smelt", angleDeg: 240 },
      { clock: 9, dragon: "Virantor", power: "Aura", cell: 16069, x: 3403.01, y: 1221.12, cult: "Siren Song", angleDeg: 270 },
      { clock: 10, dragon: "Ulex", power: "Flux", cell: 13720, x: 3340.80, y: 1059.84, cult: "Toxic Liquidity", angleDeg: 300 },
      { clock: 11, dragon: "Vahn", power: "Lex", cell: 11502, x: 3207.17, y: 951.55, cult: "The Cult of Identity", angleDeg: 330 },
      { clock: 12, dragon: "Tiraton", power: "Mass", cell: 11708, x: 3036.67, y: 930.82, cult: "The Cult of the Crushed", angleDeg: 360 }
    ];

    // Seed the 12 Dragon Sacred Groves / Seals
    for (const p of DRAGON_PRISONS) {
      await client.query(`
        INSERT INTO sim_sacred_groves (cell_id, dragon_name, power_domain, seal_strength)
        VALUES ($1, $2, $3, 100)
      `, [p.cell, p.dragon, p.power]);
    }

    // Seed all general markers into sim_world_landmarks
    for (const m of markers) {
      const rx = Math.floor((m.x || 0) / 18);
      const ry = Math.floor((m.y || 0) / 10);
      await client.query(`
        INSERT INTO sim_world_landmarks (
          name, cell_id, sector_x, sector_y, landmark_type,
          resource_type, resource_richness, historical_origin, current_status
        ) VALUES (
          $1, $2, $3, $4, $5,
          'AETHER', 100, $6, 'ACTIVE'
        )
      `, [
        m.name || `Landmark #${m.i}`,
        m.cell || 0,
        rx,
        ry,
        m.type || "monument",
        m.note || "Ancient site recorded on the Holgaland atlas"
      ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INGEST ROADS & INFRASTRUCTURE ROUTES
    // ─────────────────────────────────────────────────────────────────────────
    const routes = pack.routes || [];
    console.log(`[Ingest] Ingesting ${routes.length} roads and routes...`);
    for (const r of routes) {
      await client.query(`
        INSERT INTO sim_roads (name, road_group, length, points)
        VALUES ($1, $2, $3, $4)
      `, [
        r.name || `Route #${r.i}`,
        r.group || "roads",
        r.length || 0,
        JSON.stringify(r.points || [])
      ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. INGEST THE 12 PRIMORDIAL CHAOS FLOWS CONVERGING AT THE VERGE
    // ─────────────────────────────────────────────────────────────────────────
    console.log("[Ingest] Synthesizing 12 Primordial Chaos Flows converging to The Verge...");
    const VERGE_COORD = { x: 783.36, y: 1216.51, cell: 16166 };

    for (const p of DRAGON_PRISONS) {
      // Calculate 6 meander waypoints from Prison to The Verge
      const waypoints = [];
      const numPoints = 6;
      for (let step = 0; step <= numPoints; step++) {
        const t = step / numPoints;
        const wx = Math.round(p.x + (VERGE_COORD.x - p.x) * t + (Math.sin(t * Math.PI) * 45));
        const wy = Math.round(p.y + (VERGE_COORD.y - p.y) * t + (Math.cos(t * Math.PI) * 35));
        waypoints.push({ x: wx, y: wy });
      }

      await client.query(`
        INSERT INTO sim_chaos_flows (
          flow_id, name, dragon_name, elemental_power,
          source_angle, source_coord, sink_coord,
          current_surge, current_width, meander_offset,
          waypoints, narrow_spots
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          1.0, 2.5, 0.0,
          $8, $9
        )
        ON CONFLICT (flow_id) DO UPDATE SET
          name = EXCLUDED.name,
          dragon_name = EXCLUDED.dragon_name,
          elemental_power = EXCLUDED.elemental_power,
          source_coord = EXCLUDED.source_coord,
          sink_coord = EXCLUDED.sink_coord,
          waypoints = EXCLUDED.waypoints
      `, [
        p.clock,
        `Primordial Flow of ${p.dragon} (${p.power})`,
        p.dragon,
        p.power,
        p.angleDeg,
        JSON.stringify({ x: p.x, y: p.y, cell: p.cell, cult: p.cult }),
        JSON.stringify(VERGE_COORD),
        JSON.stringify(waypoints),
        JSON.stringify([waypoints[2], waypoints[4]])
      ]);
    }

    // Reset sequences
    const seqTables = ["sim_roads", "sim_world_landmarks", "sim_sacred_groves"];
    for (const t of seqTables) {
      await client.query(`SELECT setval('${t}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${t}))`).catch(() => {});
    }

    await client.query("COMMIT");
    console.log(`[Ingest] SUCCESS! Holgaland map baseline ingested:`);
    console.log(`  - ${pack.states.length} Factions`);
    console.log(`  - ${pack.cells.length} Cells`);
    console.log(`  - ${validBurgs.length} Burgs`);
    console.log(`  - 12 Dragon Prisons & Chaos Flows`);
    console.log(`  - ${markers.length} World Landmarks`);
    console.log(`  - ${routes.length} Roads/Highways`);

    // Create fast spatial and query indices
    console.log("[Ingest] Creating spatial and relational database indices...");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_cells_coords ON sim_cells (center_x, center_y)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_cells_faction ON sim_cells (faction_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_burg_cell ON sim_burg_economy (cell_id)");

    // Run downstream demographic, paragon, and syndicate pipeline for Holgaland
    console.log("[Ingest] Initializing 12:1 world population for 345 burgs...");
    await prerenderWorldPopulation();

    console.log("[Ingest] Provisioning authentic Paragons across all 345 burgs...");
    await provisionAllBurgParagons();

    console.log("[Ingest] Enhancing 10 Criminal Syndicates & Outlaw Lairs...");
    await enhanceAllCriminalSyndicates();

    console.log("[Ingest] Holgaland full ingestion and demographic synthesis complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Ingest] FAILED with error:", err);
    throw err;
  } finally {
    client.release();
  }
}

// CLI runner if invoked directly
if (require.main === module) {
  ingestHolgalandMap().then(() => {
    pool.end();
    process.exit(0);
  }).catch(() => {
    pool.end();
    process.exit(1);
  });
}

