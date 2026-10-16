import { Router } from "express";
import pool from "../db/pool";
import { RegionalInstance } from "../regional/RegionalInstance";

export const regionalRouter = Router();

const activeRegions = new Map<number, RegionalInstance>();

regionalRouter.post("/start/:cell_id", async (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  if (activeRegions.has(cellId)) {
    return res.json({ status: "already_running", cellId });
  }

  try {
    const [terrainRes, burgRes] = await Promise.all([
      pool.query(`SELECT * FROM sim_cells WHERE id = $1`, [cellId]),
      pool.query(`SELECT * FROM sim_burg_economy WHERE cell_id = $1`, [cellId])
    ]);

    if (terrainRes.rowCount === 0) return res.status(404).json({ error: "Cell not found" });

    const terrain = terrainRes.rows[0];
    const burg = burgRes.rows[0] || null;

    let isWarzone = false;
    let isFamine = false;

    if (burg) {
      if (burg.food < 100) isFamine = true;
      if (burg.unrest > 70) isWarzone = true;
      
      const warRes = await pool.query(`SELECT 1 FROM sim_diplomacy WHERE (faction_a_id = $1 OR faction_b_id = $1) AND status = 'WAR' LIMIT 1`, [burg.faction_id]);
      if (warRes && warRes.rowCount && warRes.rowCount > 0) isWarzone = true;
    }

    const globalData = { cellId, terrain, burg, features: terrain.cell_features, isWarzone, isFamine };
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

regionalRouter.get("/manifest/:cell_id", (req, res) => {
  const cellId = parseInt(req.params.cell_id);
  const rx = parseInt(req.query.x as string);
  const ry = parseInt(req.query.y as string);

  if (isNaN(rx) || isNaN(ry)) return res.status(400).json({ error: "Missing x or y query parameters" });

  const instance = activeRegions.get(cellId);
  if (!instance) return res.status(404).json({ error: "Region not active." });

  if (rx < 0 || rx >= 225 || ry < 0 || ry >= 225) return res.status(400).json({ error: "Coordinates out of bounds (0-224)" });

  res.json(instance.getManifest(rx, ry));
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
      cell: cellRes.rows[0],
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
      return res.json({ neighbor: fallback.rows[0] || null });
    }

    res.json({ neighbor: nbrRes.rows[0] });
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

    res.json({ cell: nearestRes.rows[0] || null });
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

