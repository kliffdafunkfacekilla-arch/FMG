"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWardenAgent = runWardenAgent;
async function runWardenAgent(client, tick, loreDate) {
    // 1. Recruit Wardens from Sparkborn
    const popRes = await client.query("SELECT SUM(pop_null) as total FROM sim_burg_economy");
    const sparkborn = (parseInt(popRes.rows[0].total) || 0) * 0.01; // Approx 1% sparkborn
    if (sparkborn > 1000 && Math.random() < 0.2) {
        await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))");
    }
    // 2. Wardens move and hunt Cultists
    const wardens = await client.query("SELECT * FROM sim_agents WHERE role = 'Warden'");
    const cultists = await client.query("SELECT * FROM sim_agents WHERE role = 'Cultist'");
    for (const w of wardens.rows) {
        // Move towards nearest cultist (Simplified: randomly move for now unless they are in the same cell)
        const target = cultists.rows.find((c) => c.location_cell_id === w.location_cell_id);
        if (target) {
            // Resolve conflict: Cultist is destroyed, Warden survives but is exhausted (maybe stays in place)
            await client.query("DELETE FROM sim_agents WHERE id = $1", [target.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier) VALUES ($1, 'WARDEN_CLASH', 'A Warden successfully hunted down and executed a Cultist cell.', 'MINOR')", [tick]);
        }
        else {
            // Move randomly or towards a cultist
            await client.query("UPDATE sim_agents SET location_cell_id = (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1) WHERE id = $1", [w.id]);
        }
    }
}
//# sourceMappingURL=wardenAgent.js.map