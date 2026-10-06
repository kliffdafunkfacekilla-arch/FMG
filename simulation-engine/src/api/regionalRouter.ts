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
