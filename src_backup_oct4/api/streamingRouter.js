"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamPlayerLODWindow = streamPlayerLODWindow;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Streams the active 3x3 regional sliding window around player coordinates and evaluates temporal deltas.
 */
async function streamPlayerLODWindow(params) {
    const client = await pool_1.default.connect();
    try {
        // 1. Define the 3x3 regional sliding window bounding box around player coordinates (clamp 0 to 99)
        const minX = Math.max(0, params.regionalX - 1);
        const maxX = Math.min(99, params.regionalX + 1);
        const minY = Math.max(0, params.regionalY - 1);
        const maxY = Math.min(99, params.regionalY + 1);
        // 2. Query regional cells within the active 3x3 window bounding box
        const regionalQuery = await client.query(`SELECT regional_id, local_x, local_y, elevation, moisture, temperature, biome_id, chaos_intensity
       FROM regional_cells
       WHERE global_cell_id = $1 AND local_x BETWEEN $2 AND $3 AND local_y BETWEEN $4 AND $5`, [params.globalId, minX, maxX, minY, maxY]);
        // 3. Query historical deltas for these target cells
        const deltasQuery = await client.query(`SELECT target_cell_id, local_coordinate, alteration_type, initial_timestamp, payload
       FROM world_deltas
       WHERE seed = $1 AND tier_level = 3 AND target_cell_id = $2`, [params.seed, params.globalId]);
        // Map deltas by coordinate key for fast O(1) lookup
        const activeDeltas = new Map();
        deltasQuery.rows.forEach((delta) => {
            const coordKey = `${delta.local_coordinate[0]}_${delta.local_coordinate[1]}`;
            activeDeltas.set(coordKey, delta);
        });
        // 4. Process cells through the temporal delta-state decay filter
        const processedCells = regionalQuery.rows.map((cell) => {
            const coordKey = `${cell.local_x}_${cell.local_y}`;
            const delta = activeDeltas.get(coordKey);
            if (delta) {
                const elapsedTicks = params.currentTick - delta.initial_timestamp;
                // Temporal Decay Logic: e.g., Burnt Forest healing over simulation ticks
                if (delta.alteration_type === 'BURNT_FOREST') {
                    if (elapsedTicks < 1000) {
                        return { ...cell, current_state: 'SCORCHED_ASH', historical_tag: delta.payload.historyTag };
                    }
                    else if (elapsedTicks < 5000) {
                        return { ...cell, current_state: 'SAPLING_REGROWTH', historical_tag: delta.payload.historyTag };
                    }
                    else {
                        return { ...cell, current_state: 'NORMAL', historical_tag: '[History: Ravaged by Fire]' };
                    }
                }
            }
            return { ...cell, current_state: 'PRISTINE', historical_tag: null };
        });
        return {
            status: 'success',
            playerWindowCenter: { x: params.regionalX, y: params.regionalY },
            activeStreamingCellsCount: processedCells.length,
            cells: processedCells
        };
    }
    catch (error) {
        console.error('Error streaming player LOD window:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=streamingRouter.js.map