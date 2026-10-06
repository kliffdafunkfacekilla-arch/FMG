const fs = require('fs');

// 1. FIX ZOMBIE ARMIES
let burgOps = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

// Replace the foodDelta < 0 block with population/military decay
const oldStarvation = `
        if (foodDelta < 0) {
            healthDelta -= 10;
            unrestDelta += 10;
            crimeDelta += 5;
        }
`;

const newStarvation = `
        // Death and Desertion from Starvation
        let starvationDeaths = 0;
        let militaryDesertions = 0;
        if ((burg.food || 0) + foodDelta < 0) {
            healthDelta -= 10;
            unrestDelta += 10;
            crimeDelta += 5;
            
            // Actually kill off pop/military
            let shortfall = Math.abs((burg.food || 0) + foodDelta);
            
            // First armies desert
            for (const type of Object.keys(military)) {
                if (military[type] > 0 && shortfall > 0) {
                    let desertion = Math.min(military[type], Math.ceil(shortfall / 100)); // Arbitrary equivalent
                    military[type] -= desertion;
                    shortfall -= desertion * 100;
                    militaryDesertions += desertion;
                }
            }
            
            // Then civilians die
            if (shortfall > 0) {
                starvationDeaths = Math.min(burg.pop_null || 0, shortfall);
            }
        }
`;

burgOps = burgOps.replace(oldStarvation, newStarvation);

// Inject starvationDeaths subtraction in the newFood math
const oldPopNullMath = `const newCrime = Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta));`;
const newPopNullMath = `const newCrime = Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta));\n        const newPopNull = Math.max(0, (burg.pop_null || 0) - (starvationDeaths || 0));`;

burgOps = burgOps.replace(oldPopNullMath, newPopNullMath);

// Replace the array push to include newPopNull and military
const oldBurgUpdatesPush = `urban_tier: urbanTier`;
const newBurgUpdatesPush = `urban_tier: urbanTier, pop_null: newPopNull, military_forces: JSON.stringify(military)`;
burgOps = burgOps.replace(oldBurgUpdatesPush, newBurgUpdatesPush);

const oldQueryUpdate = `urban_tier = v.urban_tier`;
const newQueryUpdate = `urban_tier = v.urban_tier, pop_null = v.pop_null, military_forces = v.military_forces::jsonb`;
burgOps = burgOps.replace(oldQueryUpdate, newQueryUpdate);

const oldSelectUpdate = `unnest($6::int[]) as urban_tier`;
const newSelectUpdate = `unnest($6::int[]) as urban_tier, unnest($7::int[]) as pop_null, unnest($8::text[]) as military_forces`;
burgOps = burgOps.replace(oldSelectUpdate, newSelectUpdate);

const oldMapUpdate = `burgUpdates.map(u => u.urban_tier)`;
const newMapUpdate = `burgUpdates.map(u => u.urban_tier),\n                burgUpdates.map(u => u.pop_null),\n                burgUpdates.map(u => u.military_forces)`;
burgOps = burgOps.replace(oldMapUpdate, newMapUpdate);


fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', burgOps);

// 2. FIX CARTEL DEADLOCK
let cartelAgent = fs.readFileSync('src/engine/agents/cartelAgent.ts', 'utf8');

// When they leech manpower, they should also leech wealth!
const oldCartelLeech = `await client.query(\`UPDATE sim_burg_economy SET unrest = CASE WHEN unrest - 5 < 0 THEN 0 ELSE unrest - 5 END, pop_null = CASE WHEN COALESCE(pop_null, 0) - $1 < 0 THEN 0 ELSE COALESCE(pop_null, 0) - $1 END WHERE burg_id = $2\`, [bleed, burg.burg_id]);
            await client.query(\`UPDATE sim_fringe_factions SET manpower = manpower + $1 WHERE id = $2\`, [outlawGain, fringe.id]);
            fringe.manpower += outlawGain;`;

const newCartelLeech = `
            const wealthBleed = Math.floor(Math.random() * 20);
            await client.query(\`UPDATE sim_burg_economy SET unrest = CASE WHEN unrest - 5 < 0 THEN 0 ELSE unrest - 5 END, pop_null = CASE WHEN COALESCE(pop_null, 0) - $1 < 0 THEN 0 ELSE COALESCE(pop_null, 0) - $1 END, wealth = CASE WHEN COALESCE(wealth, 0) - $3 < 0 THEN 0 ELSE COALESCE(wealth, 0) - $3 END WHERE burg_id = $2\`, [bleed, burg.burg_id, wealthBleed]);
            await client.query(\`UPDATE sim_fringe_factions SET manpower = manpower + $1, wealth = wealth + $3 WHERE id = $2\`, [outlawGain, fringe.id, wealthBleed]);
            fringe.manpower += outlawGain;
            fringe.wealth += wealthBleed;
`;

cartelAgent = cartelAgent.replace(oldCartelLeech, newCartelLeech);
fs.writeFileSync('src/engine/agents/cartelAgent.ts', cartelAgent);

console.log("Balance patches applied to JS/TS files");
