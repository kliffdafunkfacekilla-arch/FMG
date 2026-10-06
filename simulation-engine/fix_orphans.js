const fs = require('fs');
let content = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

const oldStr = 'await client.query("DELETE FROM sim_burg_economy WHERE pop_null = 0 AND pop_attuned = 0");';
const newStr = `await client.query("DELETE FROM sim_burg_economy WHERE pop_null = 0 AND pop_attuned = 0");
    await client.query("DELETE FROM sim_paragons WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_infrastructure WHERE burg_id IS NOT NULL AND burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_fringe_lairs WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/engine/resetWorld.ts', content);
