const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const oldEvents = `          // 8. RANDOM BACKGROUND EVENTS
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
        }`;

const emergentEvents = `        // 8. EMERGENT SYSTEM EVENTS (Weather, Eco, Economy connected to Simulation State)
        
        // A. Ecological Trophic Loop (Cities drain ecology, Wilderness regenerates)
        // Cities with high population and low infrastructure drain the land.
        await client.query(\`
            UPDATE sim_cells c 
            SET eco_health = GREATEST(0, COALESCE(c.eco_health, c.eco_max, 100) - (b.pop_null / 3000.0)) 
            FROM sim_burg_economy b 
            WHERE b.cell_id = c.id
        \`);
        // Wilderness regenerates
        await client.query(\`
            UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 1.0) 
            WHERE id NOT IN (SELECT cell_id FROM sim_burg_economy)
        \`);

        // B. Global Chaos (Weather / Cosmic)
        // If the world is highly unstable, it literally destabilizes the magical atmosphere!
        const globalUnrestRes = await client.query("SELECT SUM(unrest) as total_unrest FROM sim_burg_economy");
        const totalUnrest = parseInt(globalUnrestRes.rows[0].total_unrest) || 0;
        if (totalUnrest > 2000 && Math.random() < 0.1) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_SURGE', 'The sheer volume of global suffering and war has destabilized the Aether! A Chaos Surge is wracking the world!', 'MAJOR', $2)", [tick, loreDate]);
             await client.query("UPDATE sim_cells SET eco_health = GREATEST(0, COALESCE(eco_health, 100) - 5)");
        } else if (totalUnrest < 200 && Math.random() < 0.05) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'GOLDEN_AGE', 'A period of global peace and low unrest has stabilized the Aether. The skies are clear and crops are thriving.', 'MAJOR', $2)", [tick, loreDate]);
             await client.query("UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 10)");
        }

        // C. Ecological Tipping Points
        const deadEco = await client.query("SELECT b.burg_id, b.pop_null FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE c.eco_health <= 10 LIMIT 1");
        if (deadEco.rows.length > 0 && Math.random() < 0.3) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'ECOLOGICAL_COLLAPSE', 'Over-industrialization and massive population drain has collapsed the local ecology. The land is barren, reducing food output.', 'MINOR', $2, $3)", [tick, deadEco.rows[0].burg_id, loreDate]);
             await client.query("UPDATE sim_burg_economy SET food = GREATEST(0, COALESCE(food, 0) - 500) WHERE burg_id = $1", [deadEco.rows[0].burg_id]);
        }
        
        const bloomingEco = await client.query("SELECT b.burg_id, b.pop_null FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE c.eco_health >= 95 AND b.pop_null < 2000 LIMIT 1");
        if (bloomingEco.rows.length > 0 && Math.random() < 0.2) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'ECOLOGICAL_BLOOM', 'The untouched wilderness around the city has bloomed, spawning rare flora and fauna.', 'MINOR', $2, $3)", [tick, bloomingEco.rows[0].burg_id, loreDate]);
             const targetInvRes = await client.query("SELECT complex_inventory FROM sim_industrial_stockpiles WHERE burg_id = $1", [bloomingEco.rows[0].burg_id]);
             if (targetInvRes.rows.length > 0) {
                 let inv = JSON.parse(targetInvRes.rows[0].complex_inventory || '{}');
                 inv['exotic'] = (inv['exotic'] || 0) + 100;
                 inv['medicine'] = (inv['medicine'] || 0) + 100;
                 await client.query("UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2", [JSON.stringify(inv), bloomingEco.rows[0].burg_id]);
             }
        }
        
        // D. Economic Fluctuations
        const richBurgs = await client.query("SELECT burg_id FROM sim_burg_economy WHERE wealth > 8000 ORDER BY RANDOM() LIMIT 1");
        if (richBurgs.rows.length > 0 && Math.random() < 0.1) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'ECONOMIC_BOOM', 'Massive wealth accumulation has triggered a local economic boom. Trade routes are flourishing.', 'MINOR', $2, $3)", [tick, richBurgs.rows[0].burg_id, loreDate]);
        }`;

orch = orch.replace(oldEvents, emergentEvents);
fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched Emergence!");
