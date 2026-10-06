const fs = require('fs');
let code = fs.readFileSync('src/api/observerRouter.ts', 'utf8');

code = code.replace(
    'const economy = await pool.query("SELECT burg_id, food, wealth, unrest, health, pop_null, crime_rate, military_forces, demographics, species_demographics, cell_id FROM sim_burg_economy");',
    'const economy = await pool.query("SELECT b.burg_id, b.food, b.wealth, b.unrest, b.health, b.pop_null, b.crime_rate, b.military_forces, b.demographics, b.species_demographics, b.cell_id, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id");'
);

fs.writeFileSync('src/api/observerRouter.ts', code);
