"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const mesoGenerator_1 = require("../engine/mesoGenerator");
const regionRouter = (0, express_1.Router)();
regionRouter.get("/generate/:cell_id", async (req, res) => {
    try {
        const cellId = parseInt(req.params.cell_id);
        if (isNaN(cellId)) {
            return res.status(400).json({ error: "Invalid cell_id" });
        }
        const client = await pool_1.default.connect();
        try {
            // 1. Fetch Global Data
            const context = await (0, mesoGenerator_1.fetchGlobalContext)(client, cellId);
            // 2. Procedural Generate Meso Grid
            const regionData = (0, mesoGenerator_1.generateRegionGrid)(context);
            res.json(regionData);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error("[RegionRouter] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
exports.default = regionRouter;
//# sourceMappingURL=regionRouter.js.map