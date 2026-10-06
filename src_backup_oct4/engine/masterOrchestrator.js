"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeMasterTick = executeMasterTick;
const pool_1 = __importDefault(require("../db/pool"));
const calendarAgent_1 = require("./agents/calendarAgent");
const weatherAgent_1 = require("./agents/weatherAgent");
const burgOperationsAgent_1 = require("./agents/burgOperationsAgent");
const paragonPlanningAgent_1 = require("./agents/paragonPlanningAgent");
const factionPlanningAgent_1 = require("./agents/factionPlanningAgent");
const wardenAgent_1 = require("./agents/wardenAgent");
const cultistAgent_1 = require("./agents/cultistAgent");
const encounterAgent_1 = require("./agents/encounterAgent");
const chroniclerAgent_1 = require("./agents/chroniclerAgent");
const cartelAgent_1 = require("./agents/cartelAgent");
async function executeMasterTick() {
    const client = await pool_1.default.connect();
    try {
        await client.query('BEGIN');
        // Fetch current tick
        const tickRes = await client.query('SELECT MAX(tick) as t FROM sim_events');
        const tick = (tickRes.rows[0].t || 0) + 1;
        // 1. Calendar
        const cal = await (0, calendarAgent_1.runCalendarAgent)(client, tick);
        const loreDate = `Year ${cal.year}, Month ${cal.month}, Day ${cal.dayOfMonth} (${cal.cruorbusPhase})`;
        // 2. Weather
        await (0, weatherAgent_1.runWeatherAgent)(client, tick, cal.season, cal.dayOfMonth, loreDate);
        // 3. Burg Operations
        await (0, burgOperationsAgent_1.runBurgOperationsAgent)(client, tick);
        // 4. Local Paragon AI
        await (0, paragonPlanningAgent_1.runLocalParagonAgent)(client, tick);
        // 5. Faction Planning (Geopolitics)
        await (0, factionPlanningAgent_1.runFactionPlanningAgent)(client, tick, loreDate);
        // 6. Wardens
        await (0, wardenAgent_1.runWardenAgent)(client, tick, loreDate);
        // 7. Cultists
        await (0, cultistAgent_1.runCultistAgent)(client, tick, loreDate);
        // 8. Underworld Cartels (Fringe Factions)
        await (0, cartelAgent_1.runCartelAgent)(client, tick, loreDate);
        // 9. Encounters
        await (0, encounterAgent_1.runEncounterAgent)(client, tick);
        // 10. Chronicler
        await (0, chroniclerAgent_1.runChroniclerAgent)(client, tick, loreDate);
        await client.query('COMMIT');
        return { status: "success", currentTick: tick };
    }
    catch (e) {
        await client.query('ROLLBACK');
        console.error("Master tick failed:", e);
        throw e;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=masterOrchestrator.js.map