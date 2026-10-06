const fs = require('fs');
let ai = fs.readFileSync('src/engine/ai/factionAI.ts', 'utf8');

// Replace the FOOD_SUBSIDY check
const foodCheckTarget = `        // 1. Food Subsidy
        if (avgFood < 500 && totalWealth > 100) {
            options.push({ action: 'FOOD_SUBSIDY', score: 10 + (500 - avgFood) / 10 });
        }`;
const foodCheckReplace = `        // 1. Emergency Relief (Health/Unrest)
        if (avgHealth < 50 && totalWealth > 100) {
            options.push({ action: 'EMERGENCY_RELIEF', score: 15 + (50 - avgHealth) });
        }
        
        // Security Deployment (Crime/Beasts)
        let avgCrime = myBurgs.reduce((sum: number, b: any) => sum + (b.crime_rate || 0), 0) / (myBurgs.length || 1);
        if (avgCrime > 30 && totalWealth > 100) {
            options.push({ action: 'DEPLOY_SECURITY', score: stanceData.aggression * 3 });
        }`;
ai = ai.replace(foodCheckTarget, foodCheckReplace);

// Replace the FOOD_SUBSIDY execution
const foodExecTarget = `        if (choice.action === 'FOOD_SUBSIDY') {
            await client.query("UPDATE sim_burg_economy SET food = COALESCE(food, 0) + 100, wealth = GREATEST(0, COALESCE(wealth, 0) - 50) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'FOOD_SUBSIDY', $2, 'MINOR', $3, $4)", [tick, \`\${leaderName} opened the faction's emergency coffers to subsidize food for starving citizens.\`, loreDate, faction.id]);
        }`;
const foodExecReplace = `        if (choice.action === 'EMERGENCY_RELIEF') {
            await client.query("UPDATE sim_burg_economy SET health = LEAST(100, COALESCE(health, 0) + 20), unrest = GREATEST(0, COALESCE(unrest, 0) - 10) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("UPDATE sim_factions SET wealth = GREATEST(0, COALESCE(wealth, 0) - 100) WHERE id = $1", [faction.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'EMERGENCY_RELIEF', $2, 'MINOR', $3, $4)", [tick, \`\${faction.name} deployed emergency medical and food relief to counter the devastating toll of labor.\`, loreDate, faction.id]);
        }
        else if (choice.action === 'DEPLOY_SECURITY') {
            await client.query("UPDATE sim_burg_economy SET crime_rate = GREATEST(0, COALESCE(crime_rate, 0) - 20) WHERE cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            // Security forces hunt down beasts in their territory
            await client.query("DELETE FROM sim_agents WHERE role = 'Beasts' AND location_cell_id IN (SELECT id FROM sim_cells WHERE faction_id = $1)", [faction.id]);
            await client.query("UPDATE sim_factions SET wealth = GREATEST(0, COALESCE(wealth, 0) - 50) WHERE id = $1", [faction.id]);
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'SECURITY_CRACKDOWN', $2, 'MINOR', $3, $4)", [tick, \`\${faction.name} deployed armed security to crack down on crime and hunt dangerous beasts.\`, loreDate, faction.id]);
        }`;
ai = ai.replace(foodExecTarget, foodExecReplace);

fs.writeFileSync('src/engine/ai/factionAI.ts', ai);
console.log("Patched Faction AI reactions");
