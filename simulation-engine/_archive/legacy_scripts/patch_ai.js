const fs = require('fs');

let c = fs.readFileSync('src/engine/ai/factionAI.ts', 'utf8');

const targetStr = `const enemies = factions.filter((f: any) => f.id !== faction.id);`;
const replaceStr = `const borderRes = await client.query("SELECT faction_b FROM sim_faction_borders WHERE faction_a = $1", [faction.id]);
                const validEnemyIds = borderRes.rows.map((r: any) => r.faction_b);
                const enemies = factions.filter((f: any) => validEnemyIds.includes(f.id));`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replaceStr);
    fs.writeFileSync('src/engine/ai/factionAI.ts', c);
    console.log("Patched factionAI.ts");
} else {
    console.log("target string not found in factionAI.ts");
}
