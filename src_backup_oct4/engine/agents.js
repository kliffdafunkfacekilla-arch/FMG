"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAgents = processAgents;
async function processAgents(client, tick) {
    // --- DYNAMIC AGENT SPAWNING, MIGRATION, AND OPPORTUNISTS ---
    // We only spawn merchants organically along trade routes where there is a wealth/demand disparity
    if (Math.random() < 0.8) {
        // Find a route where source has wealth and destination has unrest (demand)
        const routeRes = await client.query(`
            SELECT r.source_burg_id, r.dest_burg_id, s.cell_id as s_cell, d.cell_id as d_cell
            FROM sim_trade_routes r
            JOIN sim_burg_economy s ON r.source_burg_id = s.burg_id
            JOIN sim_burg_economy d ON r.dest_burg_id = d.burg_id
            WHERE s.wealth > 100 AND d.unrest > 40
            ORDER BY RANDOM() LIMIT 1
        `);
        if (routeRes.rows.length > 0) {
            const route = routeRes.rows[0];
            // Check for blockades
            const sFaction = await client.query("SELECT faction_id FROM sim_cells WHERE id = $1", [route.s_cell]);
            const dFaction = await client.query("SELECT faction_id FROM sim_cells WHERE id = $1", [route.d_cell]);
            const isBlockaded = await client.query("SELECT 1 FROM sim_diplomacy WHERE (faction_a_id = $1 OR faction_b_id = $1 OR faction_a_id = $2 OR faction_b_id = $2) AND status = 'WAR'", [sFaction.rows[0]?.faction_id, dFaction.rows[0]?.faction_id]);
            if (isBlockaded.rows.length > 0) {
                // Compass blockades it, so Smugglers spawn instead of Merchants
                await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Smuggler', $1)", [route.s_cell]);
            }
            else {
                // Normal caravan
                await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Merchant', $1)", [route.s_cell]);
            }
        }
    }
    // Spawn Criminals near high wealth
    if (Math.random() < 0.4) {
        const cBurg = await client.query("SELECT cell_id FROM sim_burg_economy WHERE wealth > 500 ORDER BY RANDOM() LIMIT 1");
        if (cBurg.rows.length > 0) {
            await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Criminal', $1)", [cBurg.rows[0].cell_id]);
        }
    }
    const allAgentsRes = await client.query("SELECT id, role, location_cell_id FROM sim_agents");
    for (const agent of allAgentsRes.rows) {
        if (agent.role === 'Merchant' || agent.role === 'Smuggler') {
            // Seek demand (unrest/need)
            const moveRes = await client.query("SELECT b.cell_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE b.unrest >= 30 ORDER BY RANDOM() LIMIT 1");
            if (moveRes.rows.length > 0) {
                const targetCell = moveRes.rows[0].cell_id;
                await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [targetCell, agent.id]);
                // Trade executed:
                if (agent.role === 'Smuggler') {
                    // High cost, adds crime, but lowers unrest
                    await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 20), unrest = GREATEST(0, unrest - 15), crime_rate = LEAST(100, crime_rate + 5) WHERE cell_id = $1", [targetCell]);
                }
                else {
                    // Normal trade
                    await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 10), unrest = GREATEST(0, unrest - 10), health = LEAST(100, health + 5) WHERE cell_id = $1 AND wealth >= 10", [targetCell]);
                }
            }
        }
        else if (agent.role === 'Criminal') {
            const moveRes = await client.query("SELECT b.cell_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id ORDER BY (b.wealth * RANDOM()) DESC LIMIT 1");
            if (moveRes.rows.length > 0) {
                const targetCell = moveRes.rows[0].cell_id;
                await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [targetCell, agent.id]);
                await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 20), crime_rate = LEAST(100, crime_rate + 5) WHERE cell_id = $1 AND wealth >= 20", [targetCell]);
            }
        }
        else if (agent.role === 'Beasts') {
            const moveRes = await client.query("SELECT id FROM sim_cells WHERE ABS(center_x - (SELECT center_x FROM sim_cells WHERE id = $1)) < 50 ORDER BY RANDOM() LIMIT 1", [agent.location_cell_id]);
            if (moveRes.rows.length > 0) {
                await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [moveRes.rows[0].id, agent.id]);
                await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 5), pop_null = GREATEST(0, pop_null - 10) WHERE cell_id = $1", [moveRes.rows[0].id]);
            }
            if (Math.random() < 0.1)
                await client.query("DELETE FROM sim_agents WHERE id = $1", [agent.id]);
        }
    }
}
//# sourceMappingURL=agents.js.map