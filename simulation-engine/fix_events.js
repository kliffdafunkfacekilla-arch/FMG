const fs = require('fs');
let code = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

if (!code.includes('TRUNCATE TABLE sim_events')) {
    code = code.replace(/await client\.query\(\s*\`INSERT INTO sim_events/, "await client.query('TRUNCATE TABLE sim_events RESTART IDENTITY CASCADE');\n      await client.query(\n      `INSERT INTO sim_events");
    fs.writeFileSync('src/engine/resetWorld.ts', code);
    console.log("Added TRUNCATE sim_events");
}
