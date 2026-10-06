"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmergentEvents = generateEmergentEvents;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Scans simulation state changes and writes dynamic narrative event logs for TTRPG campaigns.
 */
async function generateEmergentEvents(seed, currentTick) {
    const client = await pool_1.default.connect();
    try {
        // Check for famine or economic distress in settlements
        const distressedSettlements = await client.query(`SELECT s.settlement_id, s.name, i.food_reserves 
       FROM settlements s 
       JOIN industrial_stockpiles i ON s.settlement_id = i.settlement_id 
       WHERE s.seed = $1 AND i.food_reserves <= 0`, [seed]);
        for (const settlement of distressedSettlements.rows) {
            const headline = `Famine Strikes ${settlement.name}!`;
            const description = `Granaries are completely depleted in ${settlement.name}. Citizens face starvation, and civil unrest is rising.`;
            await client.query(`INSERT INTO campaign_event_logs (seed, tick, event_type, headline, description, target_settlement_id)
         VALUES ($1, $2, $3, $4, $5, $6)`, [seed, currentTick, 'FAMINE', headline, description, settlement.settlement_id]);
        }
        console.log('Emergent event logs updated successfully.');
    }
    catch (error) {
        console.error('Event generator failed:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=eventGenerator.js.map