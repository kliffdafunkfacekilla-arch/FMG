"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runChroniclerAgent = runChroniclerAgent;
async function runChroniclerAgent(client, tick, loreDate) {
    // Log the turn
    await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'TURN_LOG', 'The Chronos wheel turns. The agents have executed their plans.', 'MINOR', $2)", [tick, loreDate]);
}
//# sourceMappingURL=chroniclerAgent.js.map