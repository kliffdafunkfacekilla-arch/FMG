const fs = require('fs');
let content = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

const targetStr = `    const stats = {`;
const insertStr = `
    // 4. Purge Ghost Burgs (Delete all burgs with 0 population to prevent bloat and UI bugs)
    await client.query("DELETE FROM sim_burg_economy WHERE pop_null = 0 AND pop_attuned = 0");
    const remainingBurgs = (await client.query("SELECT COUNT(*) as c FROM sim_burg_economy")).rows[0].c;

    const stats = {`;

content = content.replace(targetStr, insertStr);
content = content.replace('burgs: burgs.length,', 'burgs: parseInt(remainingBurgs, 10),');

fs.writeFileSync('src/engine/resetWorld.ts', content);
