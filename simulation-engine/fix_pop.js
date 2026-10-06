const fs = require('fs');
let c = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

c = c.replace(/let pop = 0;/g, 'let pop = b.pop_null || 0;');
c = c.replace(/\[pop, wealth, food, crime, JSON.stringify\({ footmen: mil }\), b.burg_id\]/g, 
              '[pop, Math.max(wealth, b.wealth||0), Math.max(food, b.food||0), Math.max(crime, b.crime_rate||0), JSON.stringify({ footmen: mil }), b.burg_id]');

fs.writeFileSync('src/engine/resetWorld.ts', c);
