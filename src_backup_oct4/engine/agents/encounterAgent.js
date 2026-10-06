"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEncounterAgent = runEncounterAgent;
async function runEncounterAgent(client, tick) {
    // Move beasts and chaos anomalies
    await client.query("UPDATE sim_agents SET location_cell_id = (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1) WHERE role IN ('Beasts', 'Criminal')");
}
//# sourceMappingURL=encounterAgent.js.map