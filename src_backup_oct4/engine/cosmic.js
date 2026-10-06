"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCosmic = processCosmic;
async function processCosmic(client, tick) {
    const res = await client.query("SELECT burg_id, cell_id, pop_null, unrest, health FROM sim_burg_economy");
    for (const burg of res.rows) {
        let health = burg.health || 100;
        let pop = burg.pop_null || 0;
        let deaths = (health < 20) ? Math.floor(pop * ((20 - health) * 0.005)) : 0;
        let popGrowth = (health > 80) ? Math.floor(pop * 0.005) + 1 : 0;
        let awakeningBase = popGrowth + (deaths * 0.5);
        let sparkborn = Math.floor(awakeningBase * 0.5);
        let awoken = Math.floor(sparkborn * 0.15);
        let mad = Math.floor(awoken * 0.25);
        let wardenPilgrims = awoken - mad;
        if (wardenPilgrims > 0) {
            if (Math.random() < (wardenPilgrims / 50.0)) {
                await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', $1)", [burg.cell_id]);
            }
        }
        let unrest = burg.unrest || 0;
        if (unrest > 50) {
            const hiddenRecruits = pop * 0.005 * (unrest / 100.0);
            if (Math.random() < (hiddenRecruits / 50.0)) {
                await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', $1)", [burg.cell_id]);
            }
        }
    }
}
//# sourceMappingURL=cosmic.js.map