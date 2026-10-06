const fs = require('fs');
let text = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// 1. Declare arrays before Faction loop
text = text.replace(/for \(const faction of factions\) \{/, 'const burgUpdates: any[] = [];\n    const stockpileUpdates: any[] = [];\n\n    for (const faction of factions) {');

// 2. Replace the save state queries with array pushes
const saveBlockRegex = /\/\/ Save burg state - single write per burg, no double-write\s+await client\.query\([\s\S]+?\]\);\s+await client\.query\([\s\S]+?JSON\.stringify\(inv\)\]\);/m;

const replacement = `// Accumulate burg updates
            burgUpdates.push({
                burg_id: bId,
                food: Math.floor(burg.food),
                wealth: Math.floor(burg.wealth),
                unrest: Math.floor(burg.unrest),
                health: Math.floor(burg.health),
                pop_null: Math.floor(burg.pop_null),
                military_forces: burg.military_forces || '{}'
            });

            stockpileUpdates.push({
                burg_id: bId,
                raw_wood: stockpile.raw_wood || 0,
                raw_ore: stockpile.raw_ore || 0,
                raw_herbs: stockpile.raw_herbs || 0,
                raw_fiber: stockpile.raw_fiber || 0,
                refined_lumber: stockpile.refined_lumber || 0,
                forged_steel: stockpile.forged_steel || 0,
                alchemical_potions: stockpile.alchemical_potions || 0,
                textiles: stockpile.textiles || 0,
                complex_inventory: JSON.stringify(inv)
            });`;

text = text.replace(saveBlockRegex, replacement);

// 3. Add the bulk queries after the Faction loop
const bulkExecution = `
    // BULK UPDATE ECONOMY & STOCKPILES
    if (burgUpdates.length > 0) {
        await client.query(\`
            UPDATE sim_burg_economy AS b SET
              food = v.food,
              wealth = v.wealth,
              unrest = v.unrest,
              health = v.health,
              pop_null = v.pop_null,
              military_forces = v.military_forces::text
            FROM (SELECT unnest($1::int[]) as burg_id, unnest($2::int[]) as food, unnest($3::int[]) as wealth, unnest($4::int[]) as unrest, unnest($5::int[]) as health, unnest($6::int[]) as pop_null, unnest($7::text[]) as military_forces) AS v
            WHERE b.burg_id = v.burg_id
        \`, [
            burgUpdates.map(u => u.burg_id),
            burgUpdates.map(u => u.food),
            burgUpdates.map(u => u.wealth),
            burgUpdates.map(u => u.unrest),
            burgUpdates.map(u => u.health),
            burgUpdates.map(u => u.pop_null),
            burgUpdates.map(u => u.military_forces)
        ]);
    }

    if (stockpileUpdates.length > 0) {
        await client.query(\`
            INSERT INTO sim_industrial_stockpiles (burg_id, raw_wood, raw_ore, raw_herbs, raw_fiber, refined_lumber, forged_steel, alchemical_potions, textiles, complex_inventory)
            SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::int[]), unnest($4::int[]), unnest($5::int[]), unnest($6::int[]), unnest($7::int[]), unnest($8::int[]), unnest($9::int[]), unnest($10::text[])
            ON CONFLICT (burg_id) DO UPDATE SET
              raw_wood = EXCLUDED.raw_wood, raw_ore = EXCLUDED.raw_ore, raw_herbs = EXCLUDED.raw_herbs, raw_fiber = EXCLUDED.raw_fiber,
              refined_lumber = EXCLUDED.refined_lumber, forged_steel = EXCLUDED.forged_steel, alchemical_potions = EXCLUDED.alchemical_potions,
              textiles = EXCLUDED.textiles, complex_inventory = EXCLUDED.complex_inventory
        \`, [
            stockpileUpdates.map(u => u.burg_id),
            stockpileUpdates.map(u => u.raw_wood),
            stockpileUpdates.map(u => u.raw_ore),
            stockpileUpdates.map(u => u.raw_herbs),
            stockpileUpdates.map(u => u.raw_fiber),
            stockpileUpdates.map(u => u.refined_lumber),
            stockpileUpdates.map(u => u.forged_steel),
            stockpileUpdates.map(u => u.alchemical_potions),
            stockpileUpdates.map(u => u.textiles),
            stockpileUpdates.map(u => u.complex_inventory)
        ]);
    }

    await processFactionGeopolitics(`;

text = text.replace(/await processFactionGeopolitics\(/, bulkExecution);

// 4. Fix N+1 in Vice & Militia
const viceMilitiaRegex = /const targetEntRes = await client\.query\(\`[\s\S]+?LIMIT 1\s*\`,\s*\[burg\.cell_id\]\);\s*if \(targetEntRes\.rows\.length > 0\) \{\s*const lair = targetEntRes\.rows\[0\];/m;
const viceMilitiaReplacement = "const lair = lairsRes.rows.find((l: any) => l.cell_id === burg.cell_id);\n                if (lair) {";
text = text.replace(viceMilitiaRegex, viceMilitiaReplacement);

fs.writeFileSync('src/engine/masterOrchestrator.ts', text);
