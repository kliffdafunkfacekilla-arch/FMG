const fs = require('fs');
let c = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

c = c.replace('SELECT b.burg_id, c.faction_id FROM sim_burg_economy b', 
              'SELECT b.burg_id, c.faction_id, b.pop_null, b.wealth, b.food, b.crime_rate FROM sim_burg_economy b');

fs.writeFileSync('src/engine/resetWorld.ts', c);
