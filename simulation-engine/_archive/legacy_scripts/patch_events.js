const fs = require('fs');
let ai = fs.readFileSync('src/engine/ai/factionAI.ts', 'utf8');
// Lower war declaration chance from 0.005 to 0.0005 (10x rarer)
ai = ai.replace('stanceData.aggression * 0.005', 'stanceData.aggression * 0.0005');
fs.writeFileSync('src/engine/ai/factionAI.ts', ai);

let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');
// Lower major battle chance from 0.2 to 0.02
orch = orch.replace('if (Math.random() > 0.2) continue; // 20% chance', 'if (Math.random() > 0.02) continue; // 2% chance');
orch = orch.replace('if (Math.random() > 0.2) continue;', 'if (Math.random() > 0.02) continue;');

// Add some random background events at the end of the tick
const eventLogic = `        // 8. RANDOM BACKGROUND EVENTS
        if (Math.random() < 0.05) {
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'SEVERE_WEATHER', 'A massive arcane storm is sweeping across the northern hemisphere, disrupting airship travel.', 'MINOR', $2)", [tick, loreDate]);
        }
        if (Math.random() < 0.03) {
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'ECOLOGICAL_BLOOM', 'A rare migration of mana-weavers has caused a sudden ecological bloom in the deep forests.', 'MINOR', $2)", [tick, loreDate]);
        }
        if (Math.random() < 0.04) {
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'MARKET_CRASH', 'A sudden panic in the spice trade has caused local markets to fluctuate wildly.', 'MINOR', $2)", [tick, loreDate]);
        }
        if (Math.random() < 0.05) {
            await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_WHISPERS', 'Strange sightings of chaos anomalies have been reported near the southern ruins.', 'MINOR', $2)", [tick, loreDate]);
        }
    
        await client.query('COMMIT');`;

if (orch.includes("await client.query('COMMIT');")) {
    orch = orch.replace("await client.query('COMMIT');", eventLogic);
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
}

console.log("Patched AI and Events");
