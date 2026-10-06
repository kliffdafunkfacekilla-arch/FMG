"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWeatherAgent = runWeatherAgent;
async function runWeatherAgent(client, tick, season, dayOfMonth, loreDate) {
    // 1. Move existing weather fronts
    await client.query("UPDATE sim_weather_fronts SET x = x + dx, y = y + dy, lifetime = lifetime - 1");
    await client.query("DELETE FROM sim_weather_fronts WHERE lifetime <= 0");
    // 2. Spawn new weather fronts based on season
    if (season === 'The Deep Cold' && Math.random() < 0.04) {
        await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('BLIZZARD', $1, $2, $3, $4, 25, 20)`, [Math.random() * 100 - 50, (Math.random() > 0.5 ? 80 : -80), (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2]);
    }
    else if (season === 'The Bloom' && Math.random() < 0.02) {
        await client.query(`INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('DROUGHT', $1, $2, $3, $4, 30, 15)`, [Math.random() * 100 - 50, Math.random() * 100 - 50, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1]);
    }
    // 3. Lunar Chaos Loop
    if (dayOfMonth === 47) {
        await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'LUNAR_HEMORRHAGE', 'The Broken Moon reaches peak saturation, vomiting pure chaos. The 12 Seals catch the brunt of the storm.', 'MAJOR', $2)", [tick, loreDate]);
        await client.query("UPDATE sim_cells SET eco_health = GREATEST(0, COALESCE(eco_health, 100) - 5)");
    }
    else if (dayOfMonth === 24) {
        await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_FLOW', 'Chaos rivers flow steadily from the 12 scattered Seals, drawn inexorably toward the central Void.', 'MINOR', $2)", [tick, loreDate]);
    }
    else if (dayOfMonth === 5) {
        await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'VOID_DRAIN', 'The central Void drinks the surface chaos, leaking it back upward into the Broken Moon. The cycle begins anew.', 'MINOR', $2)", [tick, loreDate]);
        await client.query("UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 2)");
    }
}
//# sourceMappingURL=weatherAgent.js.map