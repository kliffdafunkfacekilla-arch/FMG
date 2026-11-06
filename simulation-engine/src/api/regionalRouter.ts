import { Router } from "express";
import zlib from "zlib";
import pool from "../db/pool";
import { RegionalInstance } from "../regional/RegionalInstance";
import { getActiveChaosFlows, evaluatePointChaosFlowProximity } from "../engine/agents/chaosFlowAgent.js";

export const regionalRouter = Router();

const activeRegions = new Map<number, RegionalInstance>();

async function enrichCellChaosTelemetry(cellRow: any) {
  if (!cellRow) return cellRow;
  try {
    const flows = await getActiveChaosFlows(pool);
    const cx = Number(cellRow.center_x) || 1409;
    const cy = Number(cellRow.center_y) || 740;
    const prox = evaluatePointChaosFlowProximity(cx, cy, flows);

    return {
      ...cellRow,
      is_flow_cell: prox.intersected,
      is_adjacent_to_flow: prox.isAdjacent,
      flow_name: prox.nearestFlow?.name || null,
      dragon_name: prox.nearestFlow?.dragonName || null,
      elemental_power: prox.nearestFlow?.elementalPower || null,
      current_surge: prox.nearestFlow?.currentSurge || 1.0,
      ambient_chaos: prox.ambientChaos,
      near_narrow_spot: prox.nearNarrowSpot,
      narrow_spot: prox.narrowSpot || null,
      dist_to_flow: prox.distToFlow
    };
  } catch {
    return cellRow;
  }
}


async function getOrCreateRegionalInstance(cellId: number): Promise<RegionalInstance | null> {
  if (activeRegions.has(cellId)) {
    return activeRegions.get(cellId)!;
  }

  const [terrainRes, burgRes, factionRes] = await Promise.all([
    pool.query(`SELECT * FROM sim_cells WHERE id = $1`, [cellId]),
    pool.query(`SELECT * FROM sim_burg_economy WHERE cell_id = $1`, [cellId]),
    pool.query(`SELECT f.name FROM sim_cells c LEFT JOIN sim_factions f ON c.faction_id = f.id WHERE c.id = $1`, [cellId])
  ]);

  if (terrainRes.rowCount === 0) return null;

  const terrain = terrainRes.rows[0];
  const burg = burgRes.rows[0] || null;
  const factionName = factionRes.rows[0]?.name || (burg ? "Provincial Realm" : "The Wild Frontier");

  let isWarzone = false;
  let isFamine = false;

  if (burg) {
    if (burg.food < 100) isFamine = true;
    if (burg.unrest > 70) isWarzone = true;
    
    const warRes = await pool.query(`SELECT 1 FROM sim_diplomacy WHERE (faction_a_id = $1 OR faction_b_id = $1) AND status = 'WAR' LIMIT 1`, [burg.faction_id]);
    if (warRes && warRes.rowCount && warRes.rowCount > 0) isWarzone = true;
  }

  const globalData = { cellId, terrain, burg, features: terrain.cell_features, isWarzone, isFamine, factionName };
  const instance = new RegionalInstance(cellId, globalData);
  activeRegions.set(cellId, instance);
  return instance;
}

regionalRouter.get("/live/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  if (isNaN(cellId)) return res.status(400).json({ error: "Invalid cell ID" });

  try {
    const instance = await getOrCreateRegionalInstance(cellId);
    if (!instance) return res.status(404).json({ error: "Cell not found" });

    const terrain = instance.globalData.terrain || {};
    const burg = instance.globalData.burg || null;

    res.json({
      success: true,
      cellId,
      width: instance.w,
      height: instance.h,
      biome: instance.getBiomeLabel(),
      biomeId: terrain.biome || 6,
      elevation: terrain.elevation || 50,
      currentTemp: terrain.temperature ?? 15,
      isWarzone: instance.globalData.isWarzone || false,
      isFamine: instance.globalData.isFamine || false,
      burg: burg ? {
        burg_id: burg.burg_id,
        name: burg.name || `Burg #${burg.burg_id}`,
        urban_tier: burg.urban_tier || 1,
        food: burg.food,
        wealth: burg.wealth,
        unrest: burg.unrest,
        crime_rate: burg.crime_rate
      } : null,
      factionName: instance.globalData.factionName || "Wilderness",
      mapData: Array.from(instance.mapData),
      infraMap: Array.from(instance.infraMap),
      agents: instance.agents
    });
  } catch (err: any) {
    console.error("Error in regional live:", err);
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.get("/agents/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  if (isNaN(cellId)) return res.status(400).json({ error: "Invalid cell ID" });

  try {
    const instance = await getOrCreateRegionalInstance(cellId);
    if (!instance) return res.status(404).json({ error: "Cell not found" });

    res.json({
      cellId,
      agents: instance.agents.map(a => ({
        id: a.id,
        type: a.type,
        speciesName: a.speciesName,
        category: a.category,
        color: a.color,
        speed: a.speed,
        disposition: a.disposition,
        x: a.x,
        y: a.y,
        tx: a.tx,
        ty: a.ty
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.post("/start/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  if (activeRegions.has(cellId)) {
    return res.json({ status: "already_running", cellId });
  }

  try {
    const [terrainRes, burgRes, factionRes] = await Promise.all([
      pool.query(`SELECT * FROM sim_cells WHERE id = $1`, [cellId]),
      pool.query(`SELECT * FROM sim_burg_economy WHERE cell_id = $1`, [cellId]),
      pool.query(`SELECT f.name FROM sim_cells c LEFT JOIN sim_factions f ON c.faction_id = f.id WHERE c.id = $1`, [cellId])
    ]);

    if (terrainRes.rowCount === 0) return res.status(404).json({ error: "Cell not found" });

    const terrain = terrainRes.rows[0];
    const burg = burgRes.rows[0] || null;
    const factionName = factionRes.rows[0]?.name || (burg ? "Provincial Realm" : "The Wild Frontier");

    let isWarzone = false;
    let isFamine = false;

    if (burg) {
      if (burg.food < 100) isFamine = true;
      if (burg.unrest > 70) isWarzone = true;
      
      const warRes = await pool.query(`SELECT 1 FROM sim_diplomacy WHERE (faction_a_id = $1 OR faction_b_id = $1) AND status = 'WAR' LIMIT 1`, [burg.faction_id]);
      if (warRes && warRes.rowCount && warRes.rowCount > 0) isWarzone = true;
    }

    const globalData = { cellId, terrain, burg, features: terrain.cell_features, isWarzone, isFamine, factionName };
    const instance = new RegionalInstance(cellId, globalData);
    activeRegions.set(cellId, instance);

    res.json({ status: "started", cellId });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.get("/map/:cell_id", (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  const instance = activeRegions.get(cellId);
  if (!instance) return res.status(404).json({ error: "Region not active." });

  // Convert typed arrays to normal arrays for JSON transfer
  res.json({
    width: instance.w,
    height: instance.h,
    mapData: Array.from(instance.mapData),
    infraMap: Array.from(instance.infraMap)
  });
});

regionalRouter.get("/manifest/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  const rx = parseInt(req.query.x as string);
  const ry = parseInt(req.query.y as string);

  if (isNaN(rx) || isNaN(ry)) return res.status(400).json({ error: "Missing x or y query parameters" });

  const instance = activeRegions.get(cellId);
  if (!instance) return res.status(404).json({ error: "Region not active." });

  if (rx < 0 || rx >= 100 || ry < 0 || ry >= 100) return res.status(400).json({ error: "Coordinates out of bounds (0-99 across 10,000 regional cells)" });

  const manifest = instance.getManifest(rx, ry);

  // Check if sector layers (Layer 0 Surface) or a pre-rendered vault map exists for this sector
  try {
    const layerRes = await pool.query(
      `SELECT layer_name, compressed_terrain, props, npcs, features
       FROM sim_sector_layers
       WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0
       LIMIT 1`,
      [cellId, rx, ry]
    );
    if (layerRes.rowCount && layerRes.rowCount > 0) {
      const lyr = layerRes.rows[0];
      const decompressed = zlib.gunzipSync(lyr.compressed_terrain);
      (manifest as any).pre_rendered = true;
      (manifest as any).grid = Array.from(decompressed);
      (manifest as any).vault_name = lyr.layer_name;
      (manifest as any).poi_type = "SETTLEMENT_CORE";
      (manifest as any).vault_props = lyr.props;
      (manifest as any).vault_npcs = lyr.npcs;
    } else {
      const vaultRes = await pool.query(
        `SELECT name, poi_type, compressed_terrain, props, npcs, features
         FROM sim_world_vault_sectors
         WHERE cell_id = $1 AND rx = $2 AND ry = $3`,
        [cellId, rx, ry]
      );
      if (vaultRes.rowCount && vaultRes.rowCount > 0) {
        const v = vaultRes.rows[0];
        const decompressed = zlib.gunzipSync(v.compressed_terrain);
        (manifest as any).pre_rendered = true;
        (manifest as any).grid = Array.from(decompressed);
        (manifest as any).vault_name = v.name;
        (manifest as any).poi_type = v.poi_type;
        (manifest as any).vault_props = v.props;
        (manifest as any).vault_npcs = v.npcs;
      }
    }
  } catch (err) {
    console.warn("Could not query sim_sector_layers or vault in manifest:", err);
  }

  res.json(manifest);
});

// Explicit endpoint to retrieve a pre-rendered sector from sim_world_vault_sectors
regionalRouter.get("/sector/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  const rx = parseInt(req.query.x as string) || 50;
  const ry = parseInt(req.query.y as string) || 50;

  try {
    const vaultRes = await pool.query(
      `SELECT name, poi_type, compressed_terrain, props, npcs, features, biome_id, elevation
       FROM sim_world_vault_sectors
       WHERE cell_id = $1 AND rx = $2 AND ry = $3`,
      [cellId, rx, ry]
    );

    if (vaultRes.rowCount && vaultRes.rowCount > 0) {
      const v = vaultRes.rows[0];
      const decompressed = zlib.gunzipSync(v.compressed_terrain);
      return res.json({
        success: true,
        pre_rendered: true,
        cell_id: cellId,
        rx,
        ry,
        name: v.name,
        poi_type: v.poi_type,
        grid: Array.from(decompressed),
        props: v.props || [],
        npcs: v.npcs || [],
        features: v.features || {},
        biome_id: v.biome_id,
        elevation: v.elevation
      });
    }

    res.json({
      success: true,
      pre_rendered: false,
      cell_id: cellId,
      rx,
      ry
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.get("/cell/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  try {
    const [cellRes, burgRes, factionRes, calRes] = await Promise.all([
      pool.query(`SELECT id, faction_id, biome, center_x, center_y, elevation, current_temp, eco_plants, eco_prey, eco_predators, eco_health, eco_max FROM sim_cells WHERE id = $1`, [cellId]),
      pool.query(`SELECT b.*, f.name as faction_name FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id LEFT JOIN sim_factions f ON c.faction_id = f.id WHERE b.cell_id = $1`, [cellId]),
      pool.query(`SELECT f.id, f.name, f.color FROM sim_cells c JOIN sim_factions f ON c.faction_id = f.id WHERE c.id = $1`, [cellId]),
      pool.query(`SELECT tick, year, month_name, season, moon_phase, active_flow, dragon_domain FROM sim_calendar ORDER BY id DESC LIMIT 1`)
    ]);

    if (cellRes.rowCount === 0) return res.status(404).json({ error: "Cell not found" });

    res.json({
      cell: await enrichCellChaosTelemetry(cellRes.rows[0]),
      burg: burgRes.rows[0] || null,
      faction: factionRes.rows[0] || { id: null, name: "Wild Frontier", color: "#64748b" },
      calendar: calRes.rows[0] || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.get("/neighbor", async (req, res) => {
  const cellId = parseInt(req.query.cellId as string);
  const dir = (req.query.dir as string || "").toUpperCase();

  if (isNaN(cellId)) return res.status(400).json({ error: "Missing cellId" });

  try {
    const curRes = await pool.query(`SELECT id, center_x, center_y FROM sim_cells WHERE id = $1`, [cellId]);
    if (curRes.rowCount === 0) return res.status(404).json({ error: "Cell not found" });

    const { center_x: cx, center_y: cy } = curRes.rows[0];

    let dirCondition = "";
    if (dir === "W") dirCondition = "AND center_x < $2";
    else if (dir === "E") dirCondition = "AND center_x > $2";
    else if (dir === "N") dirCondition = "AND center_y < $3";
    else if (dir === "S") dirCondition = "AND center_y > $3";

    const query = `
      SELECT c.id, c.center_x, c.center_y, c.biome, c.elevation, f.name as faction_name,
             ((c.center_x - $2)^2 + (c.center_y - $3)^2) as dist_sq
      FROM sim_cells c
      LEFT JOIN sim_factions f ON c.faction_id = f.id
      WHERE c.id != $1 ${dirCondition}
      ORDER BY dist_sq ASC
      LIMIT 1
    `;

    const nbrRes = await pool.query(query, [cellId, cx, cy]);
    if (nbrRes.rowCount === 0) {
      const fallback = await pool.query(`
        SELECT c.id, c.center_x, c.center_y, c.biome, c.elevation, f.name as faction_name
        FROM sim_cells c
        LEFT JOIN sim_factions f ON c.faction_id = f.id
        WHERE c.id != $1
        ORDER BY ((c.center_x - $2)^2 + (c.center_y - $3)^2) ASC
        LIMIT 1
      `, [cellId, cx, cy]);
      return res.json({ neighbor: await enrichCellChaosTelemetry(fallback.rows[0]) || null });
    }

    res.json({ neighbor: await enrichCellChaosTelemetry(nbrRes.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.get("/nearest", async (req, res) => {
  const x = parseFloat(req.query.x as string);
  const y = parseFloat(req.query.y as string);
  if (isNaN(x) || isNaN(y)) return res.status(400).json({ error: "Missing x or y parameters" });

  try {
    const nearestRes = await pool.query(`
      SELECT c.id, c.center_x, c.center_y, c.biome, c.elevation, f.name as faction_name,
             ((c.center_x - $1)^2 + (c.center_y - $2)^2) as dist_sq
      FROM sim_cells c
      LEFT JOIN sim_factions f ON c.faction_id = f.id
      ORDER BY dist_sq ASC
      LIMIT 1
    `, [x, y]);

    res.json({ cell: await enrichCellChaosTelemetry(nearestRes.rows[0]) || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

regionalRouter.post("/stop/:cell_id", (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  const instance = activeRegions.get(cellId);
  if (instance) {
    instance.destroy();
    activeRegions.delete(cellId);
    res.json({ status: "stopped", cellId });
  } else {
    res.status(404).json({ error: "Region not active" });
  }
});

/**
 * POST /api/regional/attempt_crossing - Handles full global-cell scale traversal of a Chaos Flow
 */
regionalRouter.post("/attempt_crossing", async (req, res) => {
  const { cellId, playerId, method } = req.body;
  try {
    const flows = await getActiveChaosFlows(pool);
    const cellCoordRes = await pool.query("SELECT center_x, center_y FROM sim_cells WHERE id = $1", [cellId]);
    const cx = Number(cellCoordRes.rows[0]?.center_x) || 1409;
    const cy = Number(cellCoordRes.rows[0]?.center_y) || 740;
    const prox = evaluatePointChaosFlowProximity(cx, cy, flows);
    const flow = prox.nearestFlow || flows[0];

    const playerRes = await pool.query("SELECT * FROM sim_player_character WHERE id = $1", [playerId]);
    if (playerRes.rowCount === 0) return res.status(404).json({ error: "Player not found" });
    const player = playerRes.rows[0];
    const inventory = typeof player.inventory === "string" ? JSON.parse(player.inventory) : (player.inventory || []);

    if (method === "AIRSHIP_OWNED") {
      const hasAirship = inventory.some((it: string) => /airship|skyship|sky vessel|cloud cruiser/i.test(it));
      if (!hasAirship) {
        return res.status(400).json({ error: "No personal airship found in adventurer inventory." });
      }
      return res.json({
        success: true,
        method: "AIRSHIP_OWNED",
        damageTaken: 0,
        xpAwarded: 150,
        narrative: `Taking to the skies aboard your ${inventory.find((i: string) => /airship|skyship/i.test(i)) || "Aetheric Skyship"}, you soar high above the swirling primordial abyss of ${flow?.name}. The hundreds-of-leagues wide torrent lashes fruitlessly beneath your sealed hull as you cross safely into the new territory!`,
        mutation: null
      });
    }

    if (method === "AIRSHIP_CHARTER") {
      const currentGold = Number(player.gold) || 0;
      const FERRY_COST = 80;
      if (currentGold < FERRY_COST) {
        return res.status(400).json({ error: `Insufficient gold for Imperial Sky-Ferry charter (requires ${FERRY_COST}g, you have ${currentGold}g).` });
      }
      await pool.query("UPDATE sim_player_character SET gold = GREATEST(0, gold - $1) WHERE id = $2", [FERRY_COST, playerId]);
      return res.json({
        success: true,
        method: "AIRSHIP_CHARTER",
        goldCost: FERRY_COST,
        damageTaken: 0,
        xpAwarded: 100,
        narrative: `You pay ${FERRY_COST} gold to the sky-captains of the Sky-Guild ferry. Their armored clipper hoists runic sails and carries your party high above the roaring chasm of ${flow?.name}. The crossing is smooth, insulating you from catastrophic primordial radiation.`,
        mutation: null
      });
    }

    // ON_FOOT_HAZARD - Player attempts to walk across leagues of boiling chaos aether
    const endurance = Number(player.endurance) || 5;
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + endurance;
    const DC = 25;
    const passed = total >= DC;

    const baseDmg = passed ? 25 : Math.floor(35 + Math.random() * 30);
    const newHp = Math.max(0, (Number(player.current_hp) || 20) - baseDmg);
    await pool.query("UPDATE sim_player_character SET current_hp = $1 WHERE id = $2", [newHp, playerId]);

    const { applyPlayerChaosMutation } = await import("../engine/agents/chaosFlowAgent.js");
    const mutation = await applyPlayerChaosMutation(
      pool,
      playerId,
      flow?.elementalPower || "Flux",
      1,
      `Suicidal Foot Crossing (${flow?.name})`
    );

    return res.json({
      success: passed,
      method: "ON_FOOT_HAZARD",
      roll,
      total,
      dc: DC,
      damageTaken: baseDmg,
      remainingHp: newHp,
      incapacitated: newHp <= 0,
      mutation,
      narrative: passed
        ? `Against all mortal odds, you stagger across leagues of boiling primordial terrain through ${flow?.name}! Your boots melt and aetheric lightning scars your marrow, dealing ${baseDmg} damage. You collapse on the far border alive, though permanently scarred by ${mutation.name}!`
        : `Disaster strikes within the churning expanse of ${flow?.name}! The sheer raw fury of ${flow?.elementalPower} aether tears through your body, inflicting ${baseDmg} catastrophic damage! You collapse in agonizing spasms on the far border, your vessel violently mutated: ${mutation.name}!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
