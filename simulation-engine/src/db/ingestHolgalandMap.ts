/**
 * ingestHolgalandMap.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Full-fidelity ingestion of Azgaar's Fantasy Map Generator `Ostraka_full.map`:
 *  - 27 Factions (states 0 & 29..54, with fiscal economy, diplomacy & 144 regiments)
 *  - 58,091 Pack Cells (reconstructed Voronoi polygons, height, biomes, culture,
 *    religion, market, river, suitability, flux, base temperature)
 *  - 189 Burgs (population, treasury, production, civic flags, coat of arms)
 *  - 75 Cultures, 42 Religions (incl. 13 canon cults), 71 Trade Goods
 *  - 31 Regional Markets, 3,837 Trade Deals, 1,625 Rivers, 1,685 Routes + 14,984 Route Graph nodes
 *  - 12 Dragon Prisons & Sacred Seals (incl. pinned polar anchors for Tiraton & Gavusrix)
 *  - 15 Pruned Canon Markers (prisons, The Verge, Seven Falls, Nomad's Notch, Icehouse, Tempering)
 */

import pool from "./pool";
import { parseAzgaarMap } from "./parseAzgaarMap";
import { prerenderWorldPopulation } from "./prerenderWorldPopulation";
import { provisionAllBurgParagons } from "./provisionAllBurgParagons";
import { CANON_DRAGON_PRISONS, VERGE_COORD, canonFlowName } from "../engine/canon/dragonPrisons";
import { enhanceAllCriminalSyndicates } from "./enhanceAllCriminalSyndicates";
import { GOOD_ROLE_BY_ID, goodKeyFromName } from "../engine/economy/goodCatalog";
import { DEFAULT_SPECIES } from "../engine/canon/species";

// Lore Profiles for Factions (Aggression, Magic, Economy, Species)
const FACTION_LORE_PROFILES: Record<string, { aggression: number; magic: number; economy: number; species: Record<string, number> }> = {
  "Avian Empire": { aggression: 3, magic: 8, economy: 9, species: { "Avian": 0.875, "Wolf-Kin": 0.125 } },
  "Grey Wardens": { aggression: 2, magic: 10, economy: 5, species: { "Avian": 0.34, "Bear-Folk": 0.33, "Felid": 0.33 } },
  "Gilded Compass": { aggression: 1, magic: 3, economy: 10, species: { "Felid": 0.75, "Saurian": 0.25 } },
  "Ursine Hegemony": { aggression: 7, magic: 2, economy: 5, species: { "Bear-Folk": 0.8, "Porcupine": 0.2 } },
  "The Reliance": { aggression: 4, magic: 4, economy: 7, species: { "Mushroom-Folk": 1.0 } },
  "Sylvan Empire": { aggression: 3, magic: 9, economy: 6, species: { "Plant-Folk": 0.7, "Fae": 0.3 } },
  "Iron Caldera": { aggression: 8, magic: 4, economy: 7, species: { "Lizard-Folk": 0.6, "Shelled Reptile": 0.3, "Salamander": 0.1 } },
  "Heartland Alliance": { aggression: 4, magic: 3, economy: 8, species: { "Horse": 0.57, "Wolf": 0.43 } },
  "Vaneer Concord": { aggression: 5, magic: 5, economy: 6, species: { "Arachnid": 0.6, "Insect": 0.3, "Mouse": 0.1 } },
  "Sump-Kin": { aggression: 6, magic: 6, economy: 4, species: { "Mutant Amphibian": 0.8, "Rat": 0.2 } },
  "River Folk": { aggression: 2, magic: 5, economy: 8, species: { "Frog": 0.5, "Otter": 0.3, "Penguin": 0.2 } },
  "Flower Valley": { aggression: 1, magic: 6, economy: 7, species: { "Red Panda": 0.6, "Simian": 0.4 } },
  "Eastern Hounds": { aggression: 7, magic: 2, economy: 5, species: { "Hound": 0.8, "Wolf": 0.2 } },
  "Canopy Clans": { aggression: 5, magic: 6, economy: 6, species: { "Vulpine": 0.3, "Tarsier": 0.3, "Simian": 0.2, "Sciurini": 0.2 } },
  "Dust-Husk Riders": { aggression: 8, magic: 3, economy: 4, species: { "Dune Dog": 0.5, "Dust-Skipper": 0.3, "Fur-Wyrm": 0.2 } },
  "Hive Commonwealth": { aggression: 4, magic: 5, economy: 9, species: { "Bee": 0.6, "Ant": 0.4 } },
  "Prism-Scale Collective": { aggression: 3, magic: 7, economy: 7, species: { "Peacock": 0.8, "Scarred-Guard": 0.2 } },
  "Opal-Wallow": { aggression: 2, magic: 5, economy: 7, species: { "Frog": 0.71, "Red Panda": 0.29 } },
  "Port Sunder": { aggression: 5, magic: 4, economy: 8, species: { "Felid": 0.6, "Wolf-Kin": 0.4 } },
  "Meridian Chain": { aggression: 3, magic: 4, economy: 8, species: { "Penguin": 0.4, "Walrus": 0.3, "Seal": 0.2, "Otter": 0.1 } },
  "Scute Confederacy": { aggression: 4, magic: 3, economy: 7, species: { "Armadillo": 0.5, "Pangolin": 0.5 } },
  "Guerrilla Clans": { aggression: 9, magic: 3, economy: 4, species: { "Simian": 0.8, "Tarsier": 0.2 } },
  "Coastal Theocracy": { aggression: 6, magic: 9, economy: 7, species: { "Avian": 0.5, "Reptile": 0.5 } },
  "Devil's Island": { aggression: 8, magic: 8, economy: 3, species: { "Demon-Kin": 0.6, "Outcast": 0.4 } },
  "Skyroost Academy": { aggression: 1, magic: 10, economy: 7, species: { "Avian": 1.0 } },
  "Free Sky-Baronies": { aggression: 6, magic: 5, economy: 6, species: { "Avian": 1.0 } },
  "Free Sky Baronies": { aggression: 6, magic: 5, economy: 6, species: { "Avian": 1.0 } },
  "Fuvuiku Legions": { aggression: 9, magic: 4, economy: 5, species: { "Saurian": 1.0 } },
  "Neutrals": { aggression: 1, magic: 1, economy: 3, species: { "Wolf-Kin": 0.5, "Felid": 0.5 } }
};

function diplomacyTension(status: string): number {
  switch (String(status || "").toLowerCase()) {
    case "ally": return 0;
    case "friendly": return 10;
    case "neutral": return 25;
    case "suspicion": return 55;
    case "rival": return 75;
    case "enemy": return 95;
    default: return 35; // Unknown / Suzerain / Vassal
  }
}

function polylineLength(pts: any[]): number {
  if (!Array.isArray(pts) || pts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1] || [0, 0];
    const [x2, y2] = pts[i] || [0, 0];
    total += Math.hypot((Number(x2) || 0) - (Number(x1) || 0), (Number(y2) || 0) - (Number(y1) || 0));
  }
  return Math.round(total * 100) / 100;
}

export async function ingestHolgalandMap() {
  const parsed = parseAzgaarMap();
  console.log(`[Ingest] Parsed Ostraka_full.map (${parsed.width}x${parsed.height}, ${parsed.cells.length} cells, ${parsed.burgs.length} burgs, ${parsed.states.length} states) from: ${parsed.mapPath}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("[Ingest] Connected to PostgreSQL. Preparing tables...");

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
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS x REAL DEFAULT 0;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS y REAL DEFAULT 0;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS citadel BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS walls BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS shanty BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS temple BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS plaza BOOLEAN DEFAULT FALSE;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS product_value REAL DEFAULT 0;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS production JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS coa JSONB DEFAULT '{}'::jsonb;

      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS geometry TEXT;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS z_layer INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_plants REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_prey REAL DEFAULT 50.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_predators REAL DEFAULT 10.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_resources REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_health REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS eco_max REAL DEFAULT 100.0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS culture_id INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS religion_id INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS market_id INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS river_id INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS suitability INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS flux INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS feature_id INT DEFAULT 0;
      ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS cell_type SMALLINT DEFAULT 0;

      ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS culture_id INT DEFAULT 0;
      ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS capital_burg_id INT DEFAULT NULL;
      ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS expansionism REAL DEFAULT 1.0;
      ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS state_type TEXT DEFAULT 'Generic';
      ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS fiscal_economy JSONB DEFAULT '{}'::jsonb;
    `);

    // Clean dependent simulation tables in foreign-key safe order
    console.log("[Ingest] Clearing previous world geography and simulation history...");
    await client.query("DELETE FROM sim_story_arcs");
    await client.query("DELETE FROM sim_threads");
    await client.query("DELETE FROM sim_cell_tags");
    await client.query("DELETE FROM sim_events");
    await client.query("DELETE FROM sim_calendar");
    await client.query("DELETE FROM sim_diplomacy");
    await client.query("DELETE FROM sim_faction_units");
    await client.query("DELETE FROM sim_faction_borders");
    await client.query("DELETE FROM sim_agents");
    await client.query("DELETE FROM sim_npc_instances");
    await client.query("DELETE FROM sim_industrial_stockpiles");
    await client.query("DELETE FROM sim_chaos_zones");
    await client.query("DELETE FROM sim_grind_canyons");
    await client.query("DELETE FROM sim_sacred_groves");
    await client.query("DELETE FROM sim_chaos_flows");
    await client.query("DELETE FROM sim_route_graph");
    await client.query("DELETE FROM sim_trade_deals");
    await client.query("DELETE FROM sim_markets");
    await client.query("DELETE FROM sim_goods");
    await client.query("DELETE FROM sim_rivers");
    await client.query("DELETE FROM sim_religions");
    await client.query("DELETE FROM sim_cultures");
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
    // 1. INGEST FACTIONS, BORDERS, DIPLOMACY & STANDING MILITARY REGIMENTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Ingest] Ingesting ${parsed.states.length} factions/states...`);
    const activeStateIds = new Set<number>(parsed.states.map((s) => Number(s.i)));

    for (const s of parsed.states) {
      const lore = FACTION_LORE_PROFILES[s.name] || { aggression: 3, magic: 3, economy: 5, species: { [DEFAULT_SPECIES]: 1.0 } };
      const treasuryVal = Math.max(1000, Math.round(Number(s.economy?.treasury) || 10000));
      await client.query(`
        INSERT INTO sim_factions (
          id, name, color, lore_text, trait_aggression, trait_magic, trait_economy,
          wealth, treasury, culture_id, capital_burg_id, expansionism, state_type, fiscal_economy
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          trait_aggression = EXCLUDED.trait_aggression,
          trait_magic = EXCLUDED.trait_magic,
          trait_economy = EXCLUDED.trait_economy,
          culture_id = EXCLUDED.culture_id,
          capital_burg_id = EXCLUDED.capital_burg_id,
          expansionism = EXCLUDED.expansionism,
          state_type = EXCLUDED.state_type,
          fiscal_economy = EXCLUDED.fiscal_economy
      `, [
        s.i,
        s.name,
        s.color || "#888888",
        `Sovereign realm of ${s.name}`,
        lore.aggression,
        lore.magic,
        lore.economy,
        treasuryVal,
        treasuryVal,
        Number(s.culture) || 0,
        s.capital ? Number(s.capital) : null,
        Number(s.expansionism) || 1.0,
        String(s.type || "Generic"),
        JSON.stringify(s.economy || {})
      ]);
    }
    await client.query(`SELECT setval('sim_factions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sim_factions))`);

    // Faction Adjacency Borders & Diplomatic Relations
    let diplomacyRows = 0;
    let regimentRows = 0;
    for (const s of parsed.states) {
      if (Array.isArray(s.neighbors)) {
        for (const n of s.neighbors) {
          if (n > 0 && n !== s.i && activeStateIds.has(n)) {
            await client.query(
              "INSERT INTO sim_faction_borders (faction_id, faction_a, faction_b, is_border) VALUES ($1, $2, $3, true)",
              [s.i, s.i, n]
            );
          }
        }
      }

      if (s.i > 0 && Array.isArray(s.diplomacy)) {
        for (let otherId = 1; otherId < s.diplomacy.length; otherId++) {
          if (otherId <= s.i || !activeStateIds.has(otherId)) continue;
          const rel = s.diplomacy[otherId];
          if (!rel || rel === "x") continue;
          const status = String(rel).toUpperCase();
          await client.query(`
            INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = EXCLUDED.status, tension = EXCLUDED.tension
          `, [s.i, otherId, status, diplomacyTension(status)]);
          diplomacyRows++;
        }
      }

      if (s.i > 0 && Array.isArray(s.military)) {
        for (const reg of s.military) {
          if (!reg) continue;
          const troopCount = Math.max(10, Math.round((Number(reg.a) || 0.2) * 1000));
          const locCell = Number(reg.cell);
          await client.query(`
            INSERT INTO sim_faction_units (faction_id, unit_type, count, status, location_cell_id, experience)
            VALUES ($1, $2, $3, 'ACTIVE', $4, 1)
          `, [s.i, String(reg.name || "Regiment").slice(0, 50), troopCount, Number.isFinite(locCell) ? locCell : null]);
          regimentRows++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. INGEST CULTURES (75), RELIGIONS (42), GOODS (71), MARKETS (31)
    // ─────────────────────────────────────────────────────────────────────────
    for (const c of parsed.cultures) {
      await client.query(`
        INSERT INTO sim_cultures (id, name, type, base, origins, urban, rural, area, cells, tags)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb)
      `, [c.i, c.name, c.type || "Generic", Number(c.base) || 0, JSON.stringify(c.origins || []), Number(c.urban) || 0, Number(c.rural) || 0, Number(c.area) || 0, Number(c.cells) || 0, JSON.stringify(c.tags || [])]);
    }

    for (const r of parsed.religions) {
      await client.query(`
        INSERT INTO sim_religions (id, name, type, origins, urban, rural, area, cells, tags)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb)
      `, [r.i, r.name, r.type || "Folk", JSON.stringify(r.origins || []), Number(r.urban) || 0, Number(r.rural) || 0, Number(r.area) || 0, Number(r.cells) || 0, JSON.stringify(r.tags || [])]);
    }

    for (const g of parsed.goods) {
      await client.query(`
        INSERT INTO sim_goods (id, name, unit, value, carriage, color, tags, distribution, demand_coverage, biome_output, multipliers, recipes, development)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13)
      `, [
        g.i,
        g.name,
        g.unit || "unit",
        Number(g.value) || 1,
        Number(g.carriage) || 1,
        g.color || "#888888",
        JSON.stringify(g.tags || []),
        String(g.distribution || ""),
        JSON.stringify(g.demandCoverage || {}),
        JSON.stringify(g.biomeOutput || {}),
        JSON.stringify(g.multipliers || {}),
        JSON.stringify(g.recipes || []),
        Number(g.development) || 0
      ]);
    }

    for (const m of parsed.markets) {
      await client.query(`
        INSERT INTO sim_markets (id, center_burg_id, color, fee_paid, rural, goods)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `, [m.i, Number(m.centerBurgId) || null, m.color || "#888888", Number(m.feePaid) || 0, JSON.stringify(m.rural || {}), JSON.stringify(m.goods || {})]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. INGEST CELLS (58,091 reconstructed pack cells in UNNEST batches)
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Ingest] Ingesting ${parsed.cells.length} cells with reconstructed Voronoi geometry & map metadata...`);
    const BATCH_SIZE = 2000;
    const maxY = parsed.height || 2496;

    for (let i = 0; i < parsed.cells.length; i += BATCH_SIZE) {
      const chunk = parsed.cells.slice(i, i + BATCH_SIZE);
      const ids: number[] = [];
      const factionIds: (number | null)[] = [];
      const biomes: string[] = [];
      const pops: number[] = [];
      const centerXs: number[] = [];
      const centerYs: number[] = [];
      const elevations: number[] = [];
      const temps: number[] = [];
      const geoms: (string | null)[] = [];
      const cultureIds: number[] = [];
      const religionIds: number[] = [];
      const marketIds: number[] = [];
      const riverIds: number[] = [];
      const suitabilities: number[] = [];
      const fluxes: number[] = [];
      const featureIds: number[] = [];
      const cellTypes: number[] = [];

      for (const c of chunk) {
        ids.push(c.i);
        factionIds.push(c.state > 0 && activeStateIds.has(c.state) ? c.state : null);
        biomes.push(String(c.biome ?? 0));
        pops.push(Math.floor(c.pop || 0));
        centerXs.push(c.p[0]);
        centerYs.push(c.p[1]);
        elevations.push(c.elevation || 0);
        const fallbackTemp = Math.round(30 - Math.abs(c.p[1] / maxY - 0.5) * 35 - (c.elevation > 50 ? (c.elevation - 50) * 0.3 : 0));
        temps.push(Number.isFinite(c.baseTemp) ? c.baseTemp : fallbackTemp);
        geoms.push(c.geometry);
        cultureIds.push(c.culture || 0);
        religionIds.push(c.religion || 0);
        marketIds.push(c.market || 0);
        riverIds.push(c.river || 0);
        suitabilities.push(c.suitability || 0);
        fluxes.push(c.flux || 0);
        featureIds.push(c.featureId || 0);
        cellTypes.push(c.cellType || 0);
      }

      await client.query(`
        INSERT INTO sim_cells (
          id, faction_id, biome, population, center_x, center_y,
          elevation, base_temp, current_temp, geometry,
          eco_plants, eco_prey, eco_predators, eco_resources, eco_health, eco_max,
          culture_id, religion_id, market_id, river_id, suitability, flux, feature_id, cell_type
        )
        SELECT
          u.id, u.faction_id, u.biome, u.population, u.center_x, u.center_y,
          u.elevation, u.base_temp, u.base_temp, u.geometry,
          100.0, 50.0, 10.0, 100.0, 100.0, 100.0,
          u.culture_id, u.religion_id, u.market_id, u.river_id, u.suitability, u.flux, u.feature_id, u.cell_type
        FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::int[], $5::real[], $6::real[],
          $7::int[], $8::real[], $9::text[],
          $10::int[], $11::int[], $12::int[], $13::int[], $14::int[], $15::int[], $16::int[], $17::smallint[]
        ) AS u(
          id, faction_id, biome, population, center_x, center_y,
          elevation, base_temp, geometry,
          culture_id, religion_id, market_id, river_id, suitability, flux, feature_id, cell_type
        )
      `, [
        ids, factionIds, biomes, pops, centerXs, centerYs,
        elevations, temps, geoms,
        cultureIds, religionIds, marketIds, riverIds, suitabilities, fluxes, featureIds, cellTypes
      ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. INGEST BURGS & ECONOMY (189 active burgs with civic & production data)
    // ─────────────────────────────────────────────────────────────────────────
    const stateNameById = new Map<number, string>(parsed.states.map((s) => [Number(s.i), s.name]));
    const marketById = new Map<number, any>(parsed.markets.map((m) => [Number(m.i), m]));
    const goodById = new Map<number, any>(parsed.goods.map((g) => [Number(g.i), g]));
    const marketPopTotals = new Map<number, number>();
    for (const b of parsed.burgs) {
      const mId = Number(parsed.cells[Number(b.cell)]?.market) || 0;
      marketPopTotals.set(mId, (marketPopTotals.get(mId) || 0) + Math.max(0.2, Number(b.population) || 0.2));
    }

    const stockpileBurgIds: number[] = [];
    const stockpileInvs: string[] = [];

    console.log(`[Ingest] Ingesting ${parsed.burgs.length} burgs...`);

    for (const b of parsed.burgs) {
      const stateName = stateNameById.get(Number(b.state)) || "Neutrals";
      const lore = FACTION_LORE_PROFILES[stateName] || { species: { [DEFAULT_SPECIES]: 1.0 } };
      const rawPop = Math.max(100, Math.floor((Number(b.population) || 0.2) * 1000));
      const popNull = Math.max(50, Math.floor(rawPop * 0.5));
      const popAttuned = Math.max(50, Math.floor(rawPop * 0.5));
      const urbanTier = b.capital ? 3 : (Number(b.population) > 12 ? 3 : (Number(b.population) > 2 ? 2 : 1));
      const wealth = Math.max(250, Math.floor(Number(b.treasury) || 500));

      const startingFood = Math.max(2000, Math.floor(popNull * 5));
      const startingMats = Math.max(1500, Math.floor(popNull * 3));
      const startingRefined = Math.max(1500, Math.floor(popNull * 3));

      const cell = parsed.cells[Number(b.cell)];
      const mId = Number(cell?.market) || 0;
      const market = marketById.get(mId);
      const hasAquatic =
        Boolean(b.port) ||
        (Number(cell?.river) || 0) > 0 ||
        (Array.isArray(b.production) && b.production.some(([gid]: [number, number]) => GOOD_ROLE_BY_ID[Number(gid)]?.isAquatic));

      const keptPairs: Array<[number, number]> = Array.isArray(market?.rural?.kept) ? market.rural.kept : [];
      const filteredPrimary = keptPairs
        .map(([gid, qty]) => ({ goodId: Number(gid), qty: Number(qty) || 0, role: GOOD_ROLE_BY_ID[Number(gid)] }))
        .filter((e) => e.goodId > 0 && e.qty > 0 && e.role && (!e.role.isAquatic || hasAquatic))
        .sort((a, b2) => b2.qty - a.qty)
        .slice(0, 10);

      const totalPrimaryQty = filteredPrimary.reduce((sum, e) => sum + e.qty, 0);
      const primaryProfile =
        filteredPrimary.length > 0 && totalPrimaryQty > 0
          ? filteredPrimary.map((e) => ({
              goodId: e.goodId,
              key: goodKeyFromName(goodById.get(e.goodId)?.name || e.role!.goodKey),
              share: Math.round((e.qty / totalPrimaryQty) * 10000) / 10000,
              marketRuralQty: Math.round(e.qty * 100) / 100,
            }))
          : [
              { goodId: 9, key: "grain", share: 0.6, marketRuralQty: 20 },
              { goodId: 1, key: "wood", share: 0.4, marketRuralQty: 20 },
            ];

      const craftedProfile = (Array.isArray(b.production) ? b.production : [])
        .map(([gid, out]: [number, number]) => {
          const gId = Number(gid);
          const key = goodKeyFromName(goodById.get(gId)?.name || GOOD_ROLE_BY_ID[gId]?.goodKey || "");
          return { goodId: gId, key, targetOutput: Number(out) || 0 };
        })
        .filter((x: { goodId: number; key: string; targetOutput: number }) => x.goodId > 0 && x.key);

      const resourceProfile = JSON.stringify({ marketId: mId, primary: primaryProfile, crafted: craftedProfile });

      const inv: Record<string, number> = {};
      const marketPop = Math.max(0.2, marketPopTotals.get(mId) || 1);
      const burgWeight = Math.max(0.05, Math.min(1.0, (Number(b.population) || 0.2) / marketPop));
      if (market?.goods && typeof market.goods === "object") {
        for (const [gidStr, entry] of Object.entries(market.goods as Record<string, any>)) {
          const gId = Number(gidStr);
          const stock = Number(entry?.stock) || 0;
          const role = GOOD_ROLE_BY_ID[gId];
          if (stock <= 0 || !role || (role.isAquatic && !hasAquatic)) continue;
          const key = goodKeyFromName(goodById.get(gId)?.name || role.goodKey);
          inv[key] = Math.max(10, Math.round(stock * burgWeight * 4));
        }
      }
      for (const p of primaryProfile) {
        if ((inv[p.key] || 0) < 20) inv[p.key] = 20;
      }
      for (const cSpec of craftedProfile) {
        const gObj = goodById.get(cSpec.goodId);
        const firstRecipe = Array.isArray(gObj?.recipes) ? gObj.recipes[0] : null;
        if (firstRecipe && typeof firstRecipe === "object") {
          for (const inpIdStr of Object.keys(firstRecipe)) {
            const inpId = Number(inpIdStr);
            const inpKey = goodKeyFromName(goodById.get(inpId)?.name || GOOD_ROLE_BY_ID[inpId]?.goodKey || "");
            if (inpKey) inv[inpKey] = Math.max(inv[inpKey] || 0, 40);
          }
        }
      }
      stockpileBurgIds.push(b.i);
      stockpileInvs.push(JSON.stringify(inv));

      await client.query(`
        INSERT INTO sim_burg_economy (
          burg_id, name, cell_id, food, raw_materials, refined_goods,
          wealth, unrest, pop_null, pop_attuned, urban_tier,
          dominant_domain, species_demographics, health, crime_rate,
          is_capital, port, culture_id,
          x, y, citadel, walls, shanty, temple, plaza, product_value, production, coa, resource_profile
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, 0, $8, $9, $10,
          'MATERIAL', $11, 100, 0,
          $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb, $24::jsonb, $25
        )
      `, [
        b.i,
        b.name,
        b.cell,
        startingFood,
        startingMats,
        startingRefined,
        wealth,
        popNull,
        popAttuned,
        urbanTier,
        JSON.stringify(lore.species),
        Boolean(b.capital),
        Boolean(b.port),
        Number(b.culture) || 0,
        Number(b.x) || 0,
        Number(b.y) || 0,
        Boolean(b.citadel),
        Boolean(b.walls),
        Boolean(b.shanty),
        Boolean(b.temple),
        Boolean(b.plaza),
        Number(b.product) || 0,
        JSON.stringify(b.production || []),
        JSON.stringify(b.coa || {}),
        resourceProfile
      ]);

      if (b.state > 0 && activeStateIds.has(Number(b.state)) && b.cell) {
        await client.query("UPDATE sim_cells SET faction_id = $1 WHERE id = $2", [b.state, b.cell]);
      }
    }

    if (stockpileBurgIds.length > 0) {
      await client.query(`
        INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory)
        SELECT u.id, u.inv::jsonb
        FROM UNNEST($1::int[], $2::text[]) AS u(id, inv)
        ON CONFLICT (burg_id) DO UPDATE SET complex_inventory = EXCLUDED.complex_inventory
      `, [stockpileBurgIds, stockpileInvs]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INGEST TRADE DEALS (3,837), RIVERS (1,625), ROADS (1,685) & ROUTE GRAPH
    // ─────────────────────────────────────────────────────────────────────────
    if (parsed.deals.length > 0) {
      for (let i = 0; i < parsed.deals.length; i += BATCH_SIZE) {
        const chunk = parsed.deals.slice(i, i + BATCH_SIZE);
        const fromB: number[] = [], toM: number[] = [], goodId: number[] = [], dType: number[] = [];
        const qty: number[] = [], price: number[] = [], tCost: number[] = [], tariff: number[] = [], margin: number[] = [];
        for (const d of chunk) {
          if (!Array.isArray(d)) continue;
          fromB.push(Number(d[0]) || 0);
          toM.push(Number(d[1]) || 0);
          goodId.push(Number(d[2]) || 0);
          dType.push(Number(d[3]) || 0);
          qty.push(Number(d[4]) || 0);
          price.push(Number(d[5]) || 0);
          tCost.push(Number(d[6]) || 0);
          tariff.push(Number(d[7]) || 0);
          margin.push(Number(d[8]) || 0);
        }
        await client.query(`
          INSERT INTO sim_trade_deals (from_burg_id, to_market_id, good_id, deal_type, quantity, price, transport_cost, tariff, margin)
          SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[], $5::real[], $6::real[], $7::real[], $8::real[], $9::real[])
        `, [fromB, toM, goodId, dType, qty, price, tCost, tariff, margin]);
      }
    }

    if (parsed.rivers.length > 0) {
      for (let i = 0; i < parsed.rivers.length; i += BATCH_SIZE) {
        const chunk = parsed.rivers.slice(i, i + BATCH_SIZE);
        const rId: number[] = [], rName: string[] = [], rType: string[] = [], srcC: number[] = [], mthC: number[] = [];
        const basin: number[] = [], parent: number[] = [], disch: number[] = [], len: number[] = [], wid: number[] = [], rCells: string[] = [];
        for (const r of chunk) {
          rId.push(Number(r.i));
          rName.push(String(r.name || `River #${r.i}`));
          rType.push(String(r.type || "River"));
          srcC.push(Number(r.source) || 0);
          mthC.push(Number(r.mouth) || 0);
          basin.push(Number(r.basin) || 0);
          parent.push(Number(r.parent) || 0);
          disch.push(Number(r.discharge) || 0);
          len.push(Number(r.length) || 0);
          wid.push(Number(r.width) || 0);
          rCells.push(JSON.stringify(r.cells || []));
        }
        await client.query(`
          INSERT INTO sim_rivers (id, name, type, source_cell, mouth_cell, basin, parent, discharge, length, width, cells)
          SELECT u.id, u.name, u.type, u.src, u.mth, u.basin, u.parent, u.disch, u.len, u.wid, u.cells::jsonb
          FROM UNNEST($1::int[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[], $7::int[], $8::real[], $9::real[], $10::real[], $11::text[])
            AS u(id, name, type, src, mth, basin, parent, disch, len, wid, cells)
        `, [rId, rName, rType, srcC, mthC, basin, parent, disch, len, wid, rCells]);
      }
    }

    console.log(`[Ingest] Ingesting ${parsed.routes.length} roads/trails/searoutes...`);
    if (parsed.routes.length > 0) {
      for (let i = 0; i < parsed.routes.length; i += BATCH_SIZE) {
        const chunk = parsed.routes.slice(i, i + BATCH_SIZE);
        const rNames: string[] = [], rGroups: string[] = [], rLens: number[] = [], rPts: string[] = [], srcCs: (number | null)[] = [], dstCs: (number | null)[] = [];
        for (const r of chunk) {
          const pts = Array.isArray(r.points) ? r.points : [];
          const firstCell = Array.isArray(pts[0]) && pts[0][2] !== undefined ? Number(pts[0][2]) : null;
          const lastPt = pts[pts.length - 1];
          const lastCell = Array.isArray(lastPt) && lastPt[2] !== undefined ? Number(lastPt[2]) : null;
          rNames.push(String(r.name || `Route #${r.i}`));
          rGroups.push(String(r.group || "roads"));
          rLens.push(Number(r.length) || polylineLength(pts));
          rPts.push(JSON.stringify(pts));
          srcCs.push(firstCell);
          dstCs.push(lastCell);
        }
        await client.query(`
          INSERT INTO sim_roads (name, road_group, length, points, source_cell_id, dest_cell_id)
          SELECT u.name, u.grp, u.len, u.pts::jsonb, u.src, u.dst
          FROM UNNEST($1::text[], $2::text[], $3::real[], $4::text[], $5::int[], $6::int[])
            AS u(name, grp, len, pts, src, dst)
        `, [rNames, rGroups, rLens, rPts, srcCs, dstCs]);
      }
    }

    const rgEntries = Object.entries(parsed.routeGraph || {});
    if (rgEntries.length > 0) {
      for (let i = 0; i < rgEntries.length; i += BATCH_SIZE) {
        const chunk = rgEntries.slice(i, i + BATCH_SIZE);
        const cIds: number[] = [];
        const linksJson: string[] = [];
        for (const [k, v] of chunk) {
          cIds.push(Number(k));
          linksJson.push(JSON.stringify(v || {}));
        }
        await client.query(`
          INSERT INTO sim_route_graph (cell_id, links)
          SELECT u.id, u.links::jsonb
          FROM UNNEST($1::int[], $2::text[]) AS u(id, links)
        `, [cIds, linksJson]);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. INGEST MARKERS (15) & 12 CANON DRAGON PRISONS / CHAOS FLOWS
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Ingest] Ingesting ${parsed.markers.length} canon markers and 12 Dragon Prisons...`);
    for (const p of CANON_DRAGON_PRISONS) {
      await client.query(`
        INSERT INTO sim_sacred_groves (cell_id, dragon_name, power_domain, seal_strength)
        VALUES ($1, $2, $3, 100)
      `, [p.cell, p.dragon, p.power]);
    }

    for (const m of parsed.markers) {
      const rx = Math.floor((Number(m.x) || 0) / 18);
      const ry = Math.floor((Number(m.y) || 0) / 10);
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
        Number(m.cell) || 0,
        rx,
        ry,
        m.type || "Landmark",
        m.note || "Canon site recorded on the Ostraka atlas"
      ]);
    }

    for (const p of CANON_DRAGON_PRISONS) {
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
        canonFlowName(p),
        p.dragon,
        p.power,
        p.angleDeg,
        JSON.stringify({ x: p.x, y: p.y, cell: p.cell, cult: p.cult }),
        JSON.stringify(VERGE_COORD),
        JSON.stringify(waypoints),
        JSON.stringify([waypoints[2], waypoints[4]])
      ]);
    }

    const seqTables = ["sim_roads", "sim_world_landmarks", "sim_sacred_groves", "sim_trade_deals", "sim_faction_units", "sim_diplomacy"];
    for (const t of seqTables) {
      await client.query(`SELECT setval('${t}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${t}))`).catch(() => {});
    }

    await client.query("COMMIT");
    console.log(`[Ingest] SUCCESS! Ostraka_full.map baseline ingested:`);
    console.log(`  - ${parsed.states.length} Factions (${diplomacyRows} diplomacy links, ${regimentRows} standing regiments)`);
    console.log(`  - ${parsed.cells.length} Cells (${rgEntries.length} route graph nodes)`);
    console.log(`  - ${parsed.burgs.length} Burgs (${parsed.markets.length} markets, ${parsed.deals.length} trade deals)`);
    console.log(`  - ${parsed.cultures.length} Cultures, ${parsed.religions.length} Religions, ${parsed.goods.length} Goods`);
    console.log(`  - ${parsed.rivers.length} Rivers, ${parsed.routes.length} Routes, ${parsed.markers.length} Landmarks, 12 Dragon Prisons`);

    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_cells_coords ON sim_cells (center_x, center_y)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_cells_pt ON sim_cells USING GIST (point(center_x, center_y))");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_cells_faction ON sim_cells (faction_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_burg_cell ON sim_burg_economy (cell_id)");

    console.log(`[Ingest] Initializing 12:1 world population for ${parsed.burgs.length} burgs...`);
    await prerenderWorldPopulation();

    console.log(`[Ingest] Provisioning authentic Paragons across all ${parsed.burgs.length} burgs...`);
    await provisionAllBurgParagons();

    console.log("[Ingest] Enhancing 10 Criminal Syndicates & Outlaw Lairs...");
    await enhanceAllCriminalSyndicates();

    console.log("[Ingest] Ostraka full ingestion and demographic synthesis complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Ingest] FAILED with error:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  ingestHolgalandMap().then(() => {
    pool.end();
    process.exit(0);
  }).catch(() => {
    pool.end();
    process.exit(1);
  });
}
