const fs = require('fs');
let content = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

// I will just use a very loose replace
content = content.replace(/corruption_score\s+INT\s+DEFAULT\s+0\s*\);/, "corruption_score INT DEFAULT 0,\n    faction_id INT,\n    is_counselor BOOLEAN DEFAULT false\n  );");

fs.writeFileSync('src/engine/resetWorld.ts', content);
