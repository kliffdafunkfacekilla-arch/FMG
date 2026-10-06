const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');
const target = '// B. Global Chaos (Weather / Cosmic) - DETERMINISTIC';
const blockEnd = '// C. Ecological Tipping Points';
const idx1 = orch.indexOf(target);
const idx2 = orch.indexOf(blockEnd);
if (idx1 > -1 && idx2 > -1) {
    const replacement = `// B. Global Chaos (Lunar Cycle -> Seals -> Center -> Void)
        // Chaos comes from the Broken Moon, flows to the 12 Seals, and drains into the center void.
        if (dayOfMonth === 47) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'LUNAR_HEMORRHAGE', 'The Broken Moon reaches peak saturation, vomiting pure chaos. The 12 Seals catch the brunt of the storm.', 'MAJOR', $2)", [tick, loreDate]);
             await client.query("UPDATE sim_cells SET eco_health = GREATEST(0, COALESCE(eco_health, 100) - 5)");
        } else if (dayOfMonth === 24) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_FLOW', 'Chaos rivers flow steadily from the 12 scattered Seals, drawn inexorably toward the central Void.', 'MINOR', $2)", [tick, loreDate]);
        } else if (dayOfMonth === 5) {
             await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'VOID_DRAIN', 'The central Void drinks the surface chaos, leaking it back upward into the Broken Moon. The cycle begins anew.', 'MINOR', $2)", [tick, loreDate]);
             await client.query("UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 2)");
        }
        
        `;
    orch = orch.substring(0, idx1) + replacement + orch.substring(idx2);
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Replaced chaos logic successfully");
} else {
    console.log("Could not find the target blocks");
}
