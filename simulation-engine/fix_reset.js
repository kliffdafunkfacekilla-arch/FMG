const fs = require('fs');
let content = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

// Add to sim_factions
content = content.replace("wealth INT DEFAULT 1000", "wealth INT DEFAULT 1000,\n  treasury INT DEFAULT 1000");

// Add sim_faction_units
content = content.replace("CREATE TABLE sim_factions", "CREATE TABLE IF NOT EXISTS sim_faction_units (\n    id SERIAL PRIMARY KEY,\n    faction_id INT,\n    unit_type VARCHAR(50),\n    count INT DEFAULT 0,\n    status VARCHAR(20) DEFAULT 'ACTIVE',\n    location_cell_id INT,\n    experience INT DEFAULT 0\n);\n\nCREATE TABLE IF NOT EXISTS sim_faction_borders (\n    id SERIAL PRIMARY KEY,\n    faction_id INT,\n    cell_id INT,\n    is_border BOOLEAN\n);\n\nCREATE TABLE sim_factions");

// Add to sim_outlaw_factions
content = content.replace("manpower INT DEFAULT 100", "manpower INT DEFAULT 100,\n  worker_groups INT DEFAULT 2");

// Add to sim_paragons
content = content.replace("corruption_score INT DEFAULT 0", "corruption_score INT DEFAULT 0,\n  faction_id INT,\n  is_counselor BOOLEAN DEFAULT false");

fs.writeFileSync('src/engine/resetWorld.ts', content);
