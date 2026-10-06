"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateFringeInterventions = simulateFringeInterventions;
function simulateFringeInterventions(burgs, fringeFactions) {
    // We need to return an array of DB queries to execute, or modify the objects in place and return them
    const queries = [];
    // The Bank (The Gilded Compass): If a burg's wealth < 10, they inject 500 wealth but steal ALL gold/crystals.
    // Smugglers (Free Sky-Barons): If a burg has Vice Dens but < 5 narcotics, they inject 10 narcotics and steal 100 wealth.
    // Pirates (Goat & Rhino Corsairs): 10% chance per coastal/market burg to steal 50 wealth and 10 spice.
    // Raiders (Ghostwind): 5% chance per tick per burg to steal all blackstone and dragon_stone_shard.
    burgs.forEach(b => {
        let inv = b.inv;
        let w = b.wealth;
        let changed = false;
        // 1. The Bank
        if (w < 10 && inv["gold"] >= 5) {
            b.wealth += 500;
            inv["gold"] = 0;
            inv["crystals"] = 0;
            changed = true;
            // Could log a world event here
        }
        // 2. Smugglers
        if (b.viceDenCount > 0 && (inv["narcotic"] || 0) < 5 && w >= 100) {
            inv["narcotic"] = (inv["narcotic"] || 0) + 10;
            b.wealth -= 100;
            changed = true;
        }
        // 3. Pirates (assuming if they have high wealth/trade)
        if (w > 500 && Math.random() < 0.10) {
            b.wealth = Math.max(0, b.wealth - 50);
            if (inv["spice"] >= 10)
                inv["spice"] -= 10;
            if (inv["exotic"] >= 10)
                inv["exotic"] -= 10;
            changed = true;
        }
        // 4. Ghostwind Raiders
        if (((inv["blackstone"] || 0) > 0 || (inv["dragon_stone_shard"] || 0) > 0) && Math.random() < 0.05) {
            inv["blackstone"] = 0;
            inv["dragon_stone_shard"] = 0;
            changed = true;
        }
        if (changed) {
            queries.push({
                sql: "UPDATE sim_burg_economy SET wealth = $1 WHERE burg_id = $2",
                params: [b.wealth, b.burg_id]
            });
            queries.push({
                sql: "UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2",
                params: [JSON.stringify(inv), b.burg_id]
            });
        }
    });
    return queries;
}
//# sourceMappingURL=fringeLogic.js.map