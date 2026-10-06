const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

code = code.replace(
    'const newPopNull = Math.max(0, (burg.pop_null || 0) - (starvationDeaths || 0));',
    'const newPopNull = Math.floor(Math.max(0, (burg.pop_null || 0) - (starvationDeaths || 0)));'
);
code = code.replace(
    'const newFood = Math.max(0, (burg.food || 0) + foodDelta);',
    'const newFood = Math.floor(Math.max(0, (burg.food || 0) + foodDelta));'
);
code = code.replace(
    'const newWealth = Math.max(0, (burg.wealth || 0) + luxProduced);',
    'const newWealth = Math.floor(Math.max(0, (burg.wealth || 0) + luxProduced));'
);
code = code.replace(
    'const newHealth = Math.min(100, Math.max(0, (burg.health || 100) + healthDelta));',
    'const newHealth = Math.floor(Math.min(100, Math.max(0, (burg.health || 100) + healthDelta)));'
);
code = code.replace(
    'const newUnrest = Math.min(100, Math.max(0, (burg.unrest || 0) + unrestDelta));',
    'const newUnrest = Math.floor(Math.min(100, Math.max(0, (burg.unrest || 0) + unrestDelta)));'
);
code = code.replace(
    'const newCrime = Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta));',
    'const newCrime = Math.floor(Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta)));'
);

fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', code);
console.log('Fixed floats in burgOps');
