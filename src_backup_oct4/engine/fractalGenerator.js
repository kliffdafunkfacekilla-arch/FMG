"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSubGridCells = generateSubGridCells;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Bilinear interpolation helper between four corner values across normalized coordinates.
 */
function bilinearInterpolate(x, // Range: 0.0 to 1.0 relative to child grid width
y, // Range: 0.0 to 1.0 relative to child grid height
q00, // Top-Left corner
q10, // Top-Right corner
q01, // Bottom-Left corner
q11 // Bottom-Right corner
) {
    const r1 = q00 * (1 - x) + q10 * x;
    const r2 = q01 * (1 - x) + q11 * x;
    return r1 * (1 - y) + r2 * y;
}
/**
 * Generates 10,000 regional sub-cells (100x100 grid) for a specified parent global cell.
 */
async function generateSubGridCells(params) {
    const client = await pool_1.default.connect();
    try {
        console.log(`Generating 10,000 regional sub-cells for Global Cell ID: ${params.globalCellId} (Seed: ${params.seed})...`);
        // 1. Fetch Target Parent Global Cell
        const targetQuery = await client.query(`SELECT cell_id, elevation, base_moisture, base_weekly_temp, chaos_intensity 
       FROM global_cells WHERE cell_id = $1 AND seed = $2`, [params.globalCellId, params.seed]);
        if (targetQuery.rows.length === 0) {
            throw new Error(`Global cell ID ${params.globalCellId} not found for seed ${params.seed}`);
        }
        const center = targetQuery.rows[0];
        const pElevation = center.elevation;
        const pMoisture = center.base_moisture;
        const pTemp = center.base_weekly_temp;
        const pChaos = center.chaos_intensity;
        await client.query('BEGIN');
        // 2. Iterate and generate 10,000 child cells (100 x 100 matrix)
        const gridSize = 100;
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const normX = x / (gridSize - 1);
                const normY = y / (gridSize - 1);
                // Sinusoidal edge weight factor to blend seams smoothly with 3x3 neighbor contexts
                const edgeWeightFactor = Math.sin(normX * Math.PI) * Math.sin(normY * Math.PI);
                const microNoise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1.0;
                const interpolatedElevation = parseFloat((pElevation + (microNoise * 0.1) * edgeWeightFactor).toFixed(4));
                const interpolatedMoisture = parseFloat(Math.max(0.0, Math.min(1.0, pMoisture + (microNoise * 0.05))).toFixed(4));
                const interpolatedTemp = parseFloat((pTemp + (microNoise * 2.0)).toFixed(2));
                // Whittaker-style Biome Classification Heuristic
                let biomeId = 1; // Default: Temperate Forest
                if (interpolatedElevation > 0.6) {
                    biomeId = 5; // Mountain / Alpine
                }
                else if (interpolatedMoisture < 0.2) {
                    biomeId = 3; // Desert / Arid
                }
                else if (interpolatedTemp < -10) {
                    biomeId = 4; // Tundra / Arctic
                }
                else if (interpolatedMoisture > 0.7 && interpolatedElevation < -0.1) {
                    biomeId = 2; // Swamp / Marsh
                }
                const subChaosIntensity = pChaos > 0 ? parseFloat(Math.min(1.0, pChaos + (microNoise * 0.05)).toFixed(4)) : 0.0;
                await client.query(`INSERT INTO regional_cells (global_cell_id, local_x, local_y, elevation, moisture, temperature, biome_id, chaos_intensity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                    params.globalCellId,
                    x,
                    y,
                    interpolatedElevation,
                    interpolatedMoisture,
                    interpolatedTemp,
                    biomeId,
                    subChaosIntensity
                ]);
            }
        }
        await client.query('COMMIT');
        console.log(`Successfully generated and stored 10,000 sub-cells for Global Cell ID: ${params.globalCellId}.`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(`Hierarchical procedural generation failed for cell ${params.globalCellId}:`, error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=fractalGenerator.js.map