import { Router } from "express";
import pool from "../db/pool";
import { fetchGlobalContext, generateRegionGrid } from "../engine/mesoGenerator";

const regionRouter = Router();

regionRouter.get("/generate/:cell_id", async (req, res) => {
  try {
    const cellId = parseInt(req.params.cell_id);
    if (isNaN(cellId)) {
      return res.status(400).json({ error: "Invalid cell_id" });
    }

    const client = await pool.connect();
    try {
      // 1. Fetch Global Data
      const context = await fetchGlobalContext(client, cellId);
      
      // 2. Procedural Generate Meso Grid
      const regionData = generateRegionGrid(context);

      res.json(regionData);
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[RegionRouter] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default regionRouter;
