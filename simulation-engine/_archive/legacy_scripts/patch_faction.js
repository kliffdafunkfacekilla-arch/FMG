const fs = require('fs');
let code = fs.readFileSync('src/engine/ai/factionAI.ts', 'utf8');

const targetStr = `        // UTILITY BASED ACTION SCORING
        const options: {action: string, score: number}[] = [];

        // 1. Food Subsidy
        if (totalFood < totalPop && totalWealth > 1000) {
            options.push({ action: 'FOOD_SUBSIDY', score: 10 + stanceData.economy });
        }

        // 2. Purge Dissidents
        if (avgUnrest > 40 && stanceData.aggression > 6) {
            options.push({ action: 'PURGE_DISSIDENTS', score: (avgUnrest / 5) + stanceData.aggression });
        }

        // 3. Mystic Festival
        if (stanceData.magic > 6 && totalWealth > 500) {
            options.push({ action: 'MYSTIC_FESTIVAL', score: stanceData.magic * 2 });
        }

        // 4. Declare War
        if (stanceData.stance === 'EXPANSIONIST' && neighbors.length > 0 && avgUnrest < 30) {
            options.push({ action: 'DECLARE_WAR', score: stanceData.aggression * 2 });
        }

        // 5. Form Trade Pact
        if (neighbors.length > 0 && totalWealth > 2000) {
            options.push({ action: 'TRADE_PACT', score: stanceData.economy * 1.5 });
        }

        // 6. Propaganda Campaign
        if (avgUnrest > 20) {
            options.push({ action: 'PROPAGANDA', score: 5 + (avgUnrest / 4) });
        }`;

const replacementStr = `        // UTILITY BASED ACTION SCORING
        const options: {action: string, score: number}[] = [];

        let avgHealth = totalPop > 0 ? myBurgs.reduce((sum, b) => sum + (b.health || 100), 0) / myBurgs.length : 100;
        let avgCrime = myBurgs.length > 0 ? myBurgs.reduce((sum, b) => sum + (b.crime_rate || 0), 0) / myBurgs.length : 0;

        // 1. Emergency Relief
        if (avgHealth < 50 && totalWealth > 100) {
            options.push({ action: 'EMERGENCY_RELIEF', score: 15 + (50 - avgHealth) });
        }

        // 2. Security Crackdown
        if (avgCrime > 30 && totalWealth > 100) {
            options.push({ action: 'DEPLOY_SECURITY', score: stanceData.aggression * 3 });
        }

        // 3. Purge Dissidents
        if (avgUnrest > 40 && stanceData.aggression > 6) {
            options.push({ action: 'PURGE_DISSIDENTS', score: (avgUnrest / 5) + stanceData.aggression });
        }

        // 4. Mystic Festival
        if (stanceData.magic > 6 && totalWealth > 500) {
            options.push({ action: 'MYSTIC_FESTIVAL', score: stanceData.magic * 2 });
        }

        // 5. Declare War
        if (stanceData.stance === 'EXPANSIONIST' && neighbors.length > 0 && avgUnrest < 30) {
            options.push({ action: 'DECLARE_WAR', score: stanceData.aggression * 2 });
        }

        // 6. Form Trade Pact
        if (neighbors.length > 0 && totalWealth > 2000) {
            options.push({ action: 'TRADE_PACT', score: stanceData.economy * 1.5 });
        }

        // 7. GILDED COMPASS / AVIAN BLOCKADE (Market Balancing)
        // If this faction is Avian (or controls the bank), and a neighbor is getting too wealthy (> 5000), they blockade them to prevent war!
        const isAvian = (faction.name || "").toLowerCase().includes("avian");
        if (isAvian) {
            const richNeighbors = neighbors.filter(n => (n.wealth || 0) > 5000);
            if (richNeighbors.length > 0) {
                options.push({ action: 'IMPOSE_BLOCKADE', score: 50, target: richNeighbors[0] });
            }
        }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    
    // Now replace the execution block
    const execTarget = `        if (choice.action === 'FOOD_SUBSIDY') {
            await client.query("UPDATE sim_burg_economy SET food = COALESCE(food, 0) + 100, wealth = GREATEST(0, COALESCE(wealth, 0) - 50) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'FOOD_SUBSIDY', $2, 'MINOR', $3, $4)", [tick, \`\${leaderName} opened the faction's emergency coffers to subsidize food for starving citizens.\`, loreDate, faction.id]);
        }`;
    const execReplacement = `        if (choice.action === 'EMERGENCY_RELIEF') {
            await client.query("UPDATE sim_burg_economy SET health = LEAST(100, COALESCE(health, 0) + 20), unrest = GREATEST(0, COALESCE(unrest, 0) - 10) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("UPDATE sim_factions SET wealth = GREATEST(0, COALESCE(wealth, 0) - 100) WHERE id = $1", [faction.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'EMERGENCY_RELIEF', $2, 'MINOR', $3, $4)", [tick, \`\${faction.name} deployed emergency medical and food relief to counter the devastating toll of labor.\`, loreDate, faction.id]);
        }
        else if (choice.action === 'DEPLOY_SECURITY') {
            await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, COALESCE(crime_rate, 0) - 20) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("DELETE FROM sim_agents WHERE role = 'Beasts' AND location_cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("UPDATE sim_factions SET wealth = GREATEST(0, COALESCE(wealth, 0) - 50) WHERE id = $1", [faction.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'SECURITY_CRACKDOWN', $2, 'MINOR', $3, $4)", [tick, \`\${faction.name} deployed armed security to crack down on crime and hunt dangerous beasts.\`, loreDate, faction.id]);
        }
        else if (choice.action === 'IMPOSE_BLOCKADE') {
            const target = (choice as any).target;
            await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [faction.id, target.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'FULCRUM_BLOCKADE', $2, 'MAJOR', $3, $4)", [tick, \`The Gilded Compass (Avians) imposed heavy tariffs and a physical blockade on \${target.name} to curb their rapidly growing power and balance the global market.\`, loreDate, faction.id]);
        }`;
    
    code = code.replace(execTarget, execReplacement);
    fs.writeFileSync('src/engine/ai/factionAI.ts', code);
    console.log("Patched factionAI.ts");
} else {
    console.log("Target not found");
}
