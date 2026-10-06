const fs = require('fs');
let code = fs.readFileSync('src/observer/Dashboard.tsx', 'utf8');

// 1. Map Render cell colors
code = code.replace(
    'const f = cell.faction_id ? factions[cell.faction_id] : null;',
    'const actualFactionId = economy[cell.id]?.faction_id || cell.faction_id;\n        const f = actualFactionId ? factions[actualFactionId] : null;'
);

// 2. RightPanel faction info
code = code.replace(
    'faction = cell && cell.faction_id ? factionMap[cell.faction_id] : null;',
    'faction = cell ? factionMap[economyMap[selectedCell]?.faction_id || cell.faction_id] : null;'
);

// 3. FactionPanel burg counting
code = code.replace(
    'const myBurgs = economy.filter(b => cells.find(c => c.id === b.cell_id)?.faction_id === f.id);',
    'const myBurgs = economy.filter(b => b.faction_id === f.id);'
);

// 4. Hide Chaos flavor text in Event Log
code = code.replace(
    '(state.events || []).map((e) => {',
    '(state.events || []).filter(e => !["CHAOS_STORM", "MERCY_ALIGNMENT", "LUNAR_HEMORRHAGE", "NIGHTMARE_ASCENDANT"].includes(e.type)).map((e) => {'
);

fs.writeFileSync('src/observer/Dashboard.tsx', code);
