const fs = require('fs');
let content = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

const oldStr = `CREATE TABLE sim_paragons (
    id               SERIAL PRIMARY KEY,
    burg_id          INT,
    outlaw_id        INT,
    title            TEXT,
    name             TEXT,
    traits           TEXT DEFAULT '[]',
    corruption_score INT  DEFAULT 0
  );`;

const newStr = `CREATE TABLE sim_paragons (
    id               SERIAL PRIMARY KEY,
    burg_id          INT,
    outlaw_id        INT,
    title            TEXT,
    name             TEXT,
    traits           TEXT DEFAULT '[]',
    corruption_score INT  DEFAULT 0,
    faction_id INT,
    is_counselor BOOLEAN DEFAULT false
  );`;

content = content.replace(oldStr, newStr);

// Let's also check if the replace worked
if (content.indexOf("faction_id INT") === -1) {
    console.error("REPLACE FAILED");
    // Fallback: replace using substring
    const idx = content.indexOf("CREATE TABLE sim_paragons");
    if (idx !== -1) {
        const endIdx = content.indexOf(");", idx);
        content = content.slice(0, endIdx) + ",\n    faction_id INT,\n    is_counselor BOOLEAN DEFAULT false\n  " + content.slice(endIdx);
    }
}

fs.writeFileSync('src/engine/resetWorld.ts', content);
