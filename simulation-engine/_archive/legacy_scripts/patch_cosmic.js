const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// The original logic:
const cosmicTarget = `            let sparkborn = Math.floor(popGrowth * 0.5);
            let awoken = Math.floor(sparkborn * 0.15);
            let mad = Math.floor(awoken * 0.25);
            let wardenPilgrims = awoken - mad;

            if (mad > 0) unrestChange += Math.min(5, mad);
            if (wardenPilgrims > 0) {
                if (Math.random() < (wardenPilgrims / 50.0)) { // 1 agent represents ~50 lore pilgrims
                    await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', $1)", [burg.cell_id]);
                }
            }

            // COSMIC PIPELINE: Unhappy citizens -> Cultists
            if (burg.unrest > 50) {
                const hiddenRecruits = (burg.pop_null || 0) * 0.001 * (burg.unrest / 100.0);
                if (Math.random() < (hiddenRecruits / 50.0)) {
                    await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', $1)", [burg.cell_id]);
                }
            }`;

const cosmicReplace = `            // COSMIC PIPELINE: Sparkborn -> Pilgrims -> Wardens
            // Citizens awaken dynamically, not just from birth! Despair/death triggers awakening too.
            let awakeningBase = popGrowth + (deaths * 0.5); 
            let sparkborn = Math.floor(awakeningBase * 0.5);
            let awoken = Math.floor(sparkborn * 0.15);
            let mad = Math.floor(awoken * 0.25);
            let wardenPilgrims = awoken - mad;

            if (mad > 0) unrestChange += Math.min(5, mad);
            if (wardenPilgrims > 0) {
                if (Math.random() < (wardenPilgrims / 50.0)) { // 1 agent represents ~50 lore pilgrims
                    await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', $1)", [burg.cell_id]);
                }
            }

            // COSMIC PIPELINE: Unhappy citizens -> Cultists
            if (burg.unrest > 50) {
                const hiddenRecruits = (burg.pop_null || 0) * 0.005 * (burg.unrest / 100.0);
                if (Math.random() < (hiddenRecruits / 50.0)) {
                    await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', $1)", [burg.cell_id]);
                }
            }`;

if (orch.includes(cosmicTarget)) {
    orch = orch.replace(cosmicTarget, cosmicReplace);
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Patched cosmic decoupled from popGrowth");
} else {
    console.log("Could not find cosmicTarget");
}
