"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLocalEcologicalCycles = updateLocalEcologicalCycles;
const pool_1 = __importDefault(require("../db/pool"));
const ecologyPure_1 = require("../simulation/ecologyPure");
/**
 * Executes the monthly trophic cycle simulation update for all local cells.
 */
async function updateLocalEcologicalCycles(seed) {
    const client = await pool_1.default.connect();
    try {
        console.log(`Executing ecological trophic update for seed: ${seed}...`);
        await client.query('BEGIN');
        const calRes = await client.query('SELECT month FROM sim_calendar LIMIT 1');
        const month = calRes.rows[0]?.month || 1;
        // Fetch local cells and their current ecological vectors stored in JSONB
        const localCellsQuery = await client.query(`SELECT lc.local_id, lc.ecological_vector 
       FROM local_cells lc
       JOIN regional_cells rc ON lc.regional_id = rc.regional_id
       JOIN global_cells gc ON rc.global_cell_id = gc.cell_id
       WHERE gc.seed = $1`, [seed]);
        for (const cell of localCellsQuery.rows) {
            const eco = cell.ecological_vector || { plants: 50.0, prey: 25.0, predators: 10.0, resources: 100.0 };
            // Map to pure state
            const pureState = {
                eco_plants: eco.plants,
                eco_prey: eco.prey,
                eco_predators: eco.predators,
                eco_resources: eco.resources
            };
            // Compute differential updates through the pure function
            const newState = (0, ecologyPure_1.simulateCellEcology)(pureState, 0, month);
            const updatedVector = {
                plants: newState.eco_plants,
                prey: newState.eco_prey,
                predators: newState.eco_predators,
                resources: newState.eco_resources || 100
            };
            // Check for migration or overabundance anomalies
            const anomalyTag = (0, ecologyPure_1.detectEcologyAnomaly)(newState);
            // Update database record
            await client.query(`UPDATE local_cells SET ecological_vector = $1 WHERE local_id = $2`, [JSON.stringify({ ...updatedVector, status: anomalyTag }), cell.local_id]);
        }
        await client.query('COMMIT');
        console.log('Ecological trophic cycle tick successfully completed.');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Ecological simulation tick failed:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=ecologyEngine.js.map