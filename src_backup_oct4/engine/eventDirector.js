"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGlobalEventDirector = runGlobalEventDirector;
const pool_1 = __importDefault(require("../db/pool"));
const SEASONS = [
    "The Thaw", "The Bloom", "The Green", "The Zenith",
    "The Fall", "The Chill", "The Rime", "Shadow Week"
];
function angularDiff(target, source) {
    return Math.atan2(Math.sin(target - source), Math.cos(target - source));
}
async function runGlobalEventDirector(month, tick) {
    const season = SEASONS[(month - 1) % 8];
    const isShadowWeek = season === "Shadow Week";
    console.log(`[Event Director] Running generation for ${season} (Tick ${tick})...`);
    // --- PHASE 1: EVENT MAINTENANCE ---
    await pool_1.default.query(`UPDATE sim_global_events SET duration = duration - 1`);
    await pool_1.default.query(`DELETE FROM sim_global_events WHERE duration <= 0`);
    await pool_1.default.query(`
        UPDATE sim_global_events 
        SET regional_x = regional_x + velocity_x, regional_y = regional_y + velocity_y
        WHERE velocity_x != 0 OR velocity_y != 0
    `);
    // --- HELPER TO GET A RANDOM CELL FOR SPAWNING ---
    const randCellRes = await pool_1.default.query(`SELECT biome, geometry FROM sim_cells ORDER BY RANDOM() LIMIT 1`);
    if (randCellRes.rows.length > 0) {
        const row = randCellRes.rows[0];
        const bId = parseInt(row.biome);
        const isOcean = bId >= 100;
        const geo = JSON.parse(row.geometry);
        let cx = 0, cy = 0;
        for (let pt of geo.coordinates[0]) {
            cx += pt[0];
            cy += pt[1];
        }
        cx /= geo.coordinates[0].length;
        cy /= geo.coordinates[0].length;
        // --- PHASE 2: GENERATION (The Cosmological Driver) ---
        // 2a. METEOROLOGICAL LAYER (Multi-Layer Generation)
        if (Math.random() < 0.3) {
            let surfaceType = isOcean ? "Typhoon" : "Rainstorm";
            let skyType = isOcean ? "Supercell Clouds" : "Thunderhead";
            let subType = isOcean ? "Deep Ocean Currents" : "Groundwater Flash Surge";
            if (season === "The Rime" || season === "The Chill") {
                surfaceType = isOcean ? "Ice Cyclone" : "Blizzard";
                skyType = "Polar Vortex Clouds";
                subType = isOcean ? "Sub-Zero Downwelling" : "Permafrost Freeze";
            }
            else if (season === "The Zenith") {
                surfaceType = isOcean ? "Marine Heatwave" : "Drought";
                skyType = "Stagnant High Pressure";
                subType = isOcean ? "Coral Bleaching Current" : "Aquifer Depletion";
            }
            const vx = (Math.random() - 0.5) * 2;
            const vy = (Math.random() - 0.5) * 2;
            // Sky Layer (Z=1)
            await pool_1.default.query(`
                INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration, z_layer)
                VALUES ('METEOROLOGICAL', $1, 'Atmospheric storm fronts gathering high above.', $2, $3, 15, 1.0, $4, $5, 5, 1)
            `, [skyType, cx, cy, vx, vy]);
            // Surface Layer (Z=0)
            const msg = isOcean ? `A massive ${surfaceType} is churning the seas.` : `A massive ${surfaceType} is sweeping the land.`;
            await pool_1.default.query(`
                INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration, z_layer)
                VALUES ('METEOROLOGICAL', $1, $2, $3, $4, 15, 1.0, $5, $6, 5, 0)
            `, [surfaceType, msg, cx, cy, vx, vy]);
            // Sub Layer (Z=-1)
            await pool_1.default.query(`
                INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration, z_layer)
                VALUES ('METEOROLOGICAL', $1, 'Deep sub-surface effects rippling below.', $2, $3, 15, 1.0, $4, $5, 5, -1)
            `, [subType, cx, cy, vx, vy]);
        }
        // 2b. GEOLOGICAL LAYER
        if (Math.random() < 0.05) {
            let type = isOcean ? "Tsunami" : "Earthquake";
            let msg = isOcean ? "A submarine tectonic shift triggers a massive Tsunami." : "A violent tectonic shift shatters the area.";
            await pool_1.default.query(`
                INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
                VALUES ('GEOLOGICAL', $1, $2, $3, $4, 12, 1.0, 0, 0, 2)
            `, [type, msg, cx, cy]);
        }
        // 2c. ECOLOGICAL LAYER
        if (Math.random() < 0.15) {
            // Good event vs Bad event
            if (Math.random() < 0.5) {
                let type = isOcean ? "Whale Migration" : "Great Herd Migration";
                await pool_1.default.query(`
                    INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
                    VALUES ('ECOLOGICAL', $1, 'A massive boom of wildlife moves through the area.', $2, $3, 8, 1.0, ${(Math.random() - 0.5) * 4}, ${(Math.random() - 0.5) * 4}, 8)
                `, [type, cx, cy]);
            }
            else {
                let type = isOcean ? "Toxic Algal Bloom" : "Locust Swarm";
                await pool_1.default.query(`
                    INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
                    VALUES ('ECOLOGICAL', $1, 'A devastating biological swarm consumes the region.', $2, $3, 10, 1.0, ${(Math.random() - 0.5) * 2}, ${(Math.random() - 0.5) * 2}, 6)
                `, [type, cx, cy]);
            }
        }
    }
    // --- PHASE 3: THE DOMINO EFFECT (Socio-Political) ---
    const burgsRes = await pool_1.default.query(`
        SELECT b.burg_id, b.unrest, b.health, b.crime_rate, c.geometry 
        FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id
    `);
    let dominoCount = 0;
    for (let b of burgsRes.rows) {
        if (dominoCount > 2)
            break; // Throttle to prevent DB flooding
        const geo = JSON.parse(b.geometry);
        let bx = 0, by = 0;
        for (let pt of geo.coordinates[0]) {
            bx += pt[0];
            by += pt[1];
        }
        bx /= geo.coordinates[0].length;
        by /= geo.coordinates[0].length;
        if (b.health < 20 && Math.random() < 0.1) {
            await pool_1.default.query(`
                INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
                VALUES ('SOCIAL', 'Plague Vector', 'A deadly plague is spreading.', $1, $2, 12, 1.0, ${(Math.random() - 0.5)}, ${(Math.random() - 0.5)}, 10)
            `, [bx, by]);
            dominoCount++;
        }
        if (b.crime_rate > 80 && Math.random() < 0.1) {
            // Randomly decide if it's a land horde or pirate armada based on random vector heading towards water
            let type = Math.random() < 0.3 ? "Pirate Armada" : "Bandit Horde";
            await pool_1.default.query(`
                INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
                VALUES ('POLITICAL', $1, 'A heavily armed outlaw cartel is raiding.', $2, $3, 5, 1.0, ${(Math.random() - 0.5) * 3}, ${(Math.random() - 0.5) * 3}, 6)
            `, [type, bx, by]);
            dominoCount++;
        }
    }
    // --- PHASE 4: RESOLUTION (Applying all Overlays to Burgs) ---
    const activeEvents = await pool_1.default.query(`SELECT * FROM sim_global_events`);
    // Magical Layer Pre-Calc
    const CELL_SIZE = 0.5;
    const TOTAL_TWIST_RADIANS = Math.PI / 3;
    const SPIRAL_FACTOR = TOTAL_TWIST_RADIANS / 170.0;
    const prisonsRes = await pool_1.default.query(`SELECT g.id, c.geometry FROM sim_sacred_groves g JOIN sim_cells c ON g.cell_id = c.id`);
    const prisons = prisonsRes.rows.map(p => {
        const geo = JSON.parse(p.geometry);
        let px = 0, py = 0;
        for (let pt of geo.coordinates[0]) {
            px += pt[0];
            py += pt[1];
        }
        px /= geo.coordinates[0].length;
        py /= geo.coordinates[0].length;
        px -= 2368.83;
        py -= 1196.00;
        return { r: Math.sqrt(px * px + py * py), theta: Math.atan2(py, px) };
    });
    for (let b of burgsRes.rows) {
        const geo = JSON.parse(b.geometry);
        let bx = 0, by = 0;
        for (let pt of geo.coordinates[0]) {
            bx += pt[0];
            by += pt[1];
        }
        bx /= geo.coordinates[0].length;
        by /= geo.coordinates[0].length;
        let deltaUnrest = 0, deltaHealth = 0;
        for (let ev of activeEvents.rows) {
            const dist = Math.sqrt((bx - ev.regional_x) ** 2 + (by - ev.regional_y) ** 2);
            if (dist <= ev.radius) {
                // Modifiers based on event type
                if (['Blizzard', 'Ice Cyclone'].includes(ev.type)) {
                    deltaUnrest += 5;
                    deltaHealth -= 2;
                }
                if (['Drought', 'Marine Heatwave'].includes(ev.type)) {
                    deltaUnrest += 10;
                    deltaHealth -= 5;
                }
                if (['Earthquake', 'Tsunami'].includes(ev.type)) {
                    deltaUnrest += 20;
                    deltaHealth -= 20;
                }
                if (['Plague Vector', 'Toxic Algal Bloom'].includes(ev.type)) {
                    deltaHealth -= 15;
                }
                if (['Great Herd Migration', 'Whale Migration'].includes(ev.type)) {
                    deltaUnrest -= 10;
                    deltaHealth += 5;
                }
                if (['Bandit Horde', 'Pirate Armada'].includes(ev.type)) {
                    deltaUnrest += 15;
                }
            }
        }
        // Relative to Convergence
        const rel_x = bx - 2368.83;
        const rel_y = by - 1196.00;
        const b_r = Math.sqrt(rel_x * rel_x + rel_y * rel_y);
        const b_theta = Math.atan2(rel_y, rel_x);
        let inChaosFlow = false;
        for (let p of prisons) {
            if (b_r > p.r + 5.0)
                continue;
            let target_theta = p.theta - (SPIRAL_FACTOR * (p.r - b_r));
            target_theta += Math.sin(b_r * 0.3 + tick * 0.2) * (1.5 * CELL_SIZE) / Math.max(1.0, b_r);
            const thickness = (2.0 + Math.sin(b_r * 0.15 - tick * 0.1)) * CELL_SIZE;
            if ((Math.abs(angularDiff(b_theta, target_theta)) * b_r) <= (thickness / 2)) {
                inChaosFlow = true;
                break;
            }
        }
        if (inChaosFlow) {
            deltaUnrest += isShadowWeek ? 20 : 5;
            deltaHealth -= isShadowWeek ? 10 : 2;
        }
        if (deltaUnrest !== 0 || deltaHealth !== 0) {
            await pool_1.default.query(`
                UPDATE sim_burg_economy 
                SET unrest = GREATEST(0, LEAST(100, unrest + $1)),
                    health = GREATEST(0, LEAST(100, health + $2))
                WHERE burg_id = $3
            `, [deltaUnrest, deltaHealth, b.burg_id]);
        }
    }
}
//# sourceMappingURL=eventDirector.js.map