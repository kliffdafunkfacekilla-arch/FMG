"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTilePOI = generateTilePOI;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Generates a dynamic Point of Interest (POI) when a map tile is entered.
 */
async function generateTilePOI(context) {
    const client = await pool_1.default.connect();
    try {
        let poiType = 'ENVIRONMENTAL_ODDITY';
        let hookTitle = 'A Whispering Standing Stone';
        let hookDescription = 'An ancient megalith hums with low aetheric frequency, projecting shadowy glyphs onto the grass.';
        // Adapt POI based on simulation conditions
        if (context.hasActiveFamine) {
            poiType = 'DESPERATE_STRANGER';
            hookTitle = 'A Caravan Abandoned to the Dust';
            hookDescription = 'An overturned merchant cart surrounded by crows. Scattered grain sacks have been torn open, but footprints lead deeper into the treeline.';
        }
        else if (context.chaosIntensity > 0.5) {
            poiType = 'REALITY_WARP';
            hookTitle = 'A Fractured Mirror Puddle';
            hookDescription = 'A pool of stagnant water reflects a burning sky that does not match the clouds overhead.';
        }
        // Register quest hook into active database
        const questResult = await client.query(`INSERT INTO campaign_event_logs (seed, tick, event_type, headline, description)
       VALUES ($1, 0, $2, $3, $4) RETURNING event_id;`, [context.seed, poiType, hookTitle, hookDescription]);
        return {
            status: 'success',
            poiType,
            hookId: questResult.rows[0].event_id,
            title: hookTitle,
            description: hookDescription,
            initialTask: 'Investigate the anomaly and follow the trail to determine its origin.'
        };
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=poiGeneratorEngine.js.map