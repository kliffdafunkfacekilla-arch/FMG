const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const target = `        // A. Ecological Trophic Loop (Cities drain ecology, Wilderness regenerates)
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
        \`);`;

const replacement = `        // A. Ecological Trophic Loop & Civilization Interaction
        const m = (cal.month % 8) || 8;
        let regenRate = 1.0;
        if (m <= 2) regenRate = 1.5; // Spring
        else if (m <= 4) regenRate = 1.2; // Summer
        else if (m <= 6) regenRate = 0.8; // Autumn
        else regenRate = 0.2; // Winter

        // 1. Calculate eco_max drop from Farms/Mines
        await client.query(\`
            UPDATE sim_cells c 
            SET eco_max = GREATEST(15, 100 - (
                SELECT COALESCE(SUM(level * 25), 0) 
                FROM sim_infrastructure i 
                WHERE i.cell_id = c.id AND i.project_type IN ('FARM', 'MINE', 'LUMBER_MILL')
            ))
            FROM sim_burg_economy b
            WHERE b.cell_id = c.id
        \`);

        // 2. Regen eco_health towards eco_max globally
        await client.query(\`
            UPDATE sim_cells 
            SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + $1)
        \`, [regenRate]);

        // 3. Raw Resource Gathering Damage (Blow-for-blow against regen)
        await client.query(\`
            WITH InfraCapacity AS (
                SELECT cell_id, SUM(level * 2500) as cap
                FROM sim_infrastructure 
                WHERE project_type IN ('FARM', 'MINE', 'LUMBER_MILL')
                GROUP BY cell_id
            )
            UPDATE sim_cells c
            SET eco_health = GREATEST(0, c.eco_health - (
                GREATEST(0, b.pop_null - COALESCE(i.cap, 0)) / 1000.0
            ))
            FROM sim_burg_economy b
            LEFT JOIN InfraCapacity i ON b.cell_id = i.cell_id
            WHERE b.cell_id = c.id
        \`);`;

if (orch.includes(target)) {
    orch = orch.replace(target, replacement);
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Patched User Ecology Rules");
} else {
    console.log("Target string not found!");
}
