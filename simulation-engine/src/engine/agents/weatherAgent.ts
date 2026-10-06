// ─────────────────────────────────────────────────────────────────────────────
//  Weather & Chaos Agent
//  One tick = one day. Fronts travel, apply real effects, and chaos syncs to
//  the lunar cycle of Cruorbus (48-day month).
// ─────────────────────────────────────────────────────────────────────────────

// Cruorbus lunar phase from dayOfMonth (1–48)
function getCruorbusPhase(dayOfMonth: number): string {
    if (dayOfMonth <= 8)  return "WAXING";         // chaos building
    if (dayOfMonth <= 16) return "FULL_BLOOD";      // peak chaos – storms, raids, madness
    if (dayOfMonth <= 24) return "CHAOS_FLOW";      // chaos rivers drain toward the Void
    if (dayOfMonth <= 32) return "MERCY";           // calm eye, healing
    if (dayOfMonth <= 40) return "WANING";          // slow dread
    return "NIGHTMARE";                             // day 41-48: the Nightmare Alignment
}

export async function runWeatherAgent(client: any, tick: number, season: string, dayOfMonth: number, loreDate: string) {

    // ── 1. MOVE & AGE existing weather fronts ────────────────────────────────
    await client.query("UPDATE sim_weather_fronts SET x = x + dx, y = y + dy, lifetime = lifetime - 1");
    await client.query("DELETE FROM sim_weather_fronts WHERE lifetime <= 0");

    // ── 2. SPAWN new weather fronts based on season + lunar phase ─────────────
    const phase = getCruorbusPhase(dayOfMonth);
    const SPAWN_CHANCE: Record<string, number> = {
        "The Deep Cold": 0.12,
        "The Withering": 0.08,
        "The Roaring":   0.10,
        "The Bloom":     0.05,
        "The High Sun":  0.04,
        "The Harvest":   0.04,
        "The Thaw":      0.06,
        "The Awakening": 0.05,
    };

    // Lunar amplification — Cruorbus Full Blood and Nightmare dramatically spike storm spawning
    let lunarMult = 1.0;
    if (phase === "FULL_BLOOD")  lunarMult = 2.5;
    if (phase === "NIGHTMARE")   lunarMult = 3.0;
    if (phase === "MERCY")       lunarMult = 0.3;

    const spawnChance = (SPAWN_CHANCE[season] || 0.05) * lunarMult;

    if (Math.random() < spawnChance) {
        // Pick storm type based on season + phase
        let stormType = "STORM";
        if (season === "The Deep Cold" || season === "The Withering") stormType = "BLIZZARD";
        else if (season === "The High Sun" || season === "The Bloom")  stormType = "DROUGHT";
        else if (phase === "FULL_BLOOD" || phase === "NIGHTMARE")      stormType = "CHAOS_STORM";
        else if (season === "The Roaring")                             stormType = "HURRICANE";

        // Spawn at a random map edge and move inward
        const fromEdge = Math.random() < 0.5;
        const sx = fromEdge ? (Math.random() < 0.5 ? -60 : 160) : Math.random() * 100;
        const sy = fromEdge ? Math.random() * 100 : (Math.random() < 0.5 ? -60 : 160);
        const dx = (50 - sx) / (25 + Math.random() * 20);
        const dy = (50 - sy) / (25 + Math.random() * 20);
        const radius = 15 + Math.random() * 20;
        const lifetime = 8 + Math.floor(Math.random() * 16);

        await client.query(
            `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [stormType, sx, sy, dx, dy, radius, lifetime]
        );
    }

    // ── 3. APPLY active fronts to cells & burgs they are over ─────────────────
    const fronts = await client.query("SELECT * FROM sim_weather_fronts");
    for (const front of fronts.rows) {
        // Find burgs inside this front's radius using cell geometry approximation
        // We stored burg cell_id; we need the cell x/y. Use a simple bounding check on geometry centroid.
        // For now: apply to a random sample of burgs weighted by probability — real geo join is Phase 2.
        const affectedBurgs = await client.query(
            `SELECT burg_id, food, unrest, health, pop_null FROM sim_burg_economy ORDER BY RANDOM() LIMIT $1`,
            [Math.max(1, Math.floor(front.radius / 20))] // more burgs hit by bigger fronts
        );

        for (const burg of affectedBurgs.rows) {
            let foodDelta = 0, unrestDelta = 0, healthDelta = 0, popDelta = 0;
            let eventMsg: string | null = null;

            if (front.type === "BLIZZARD") {
                foodDelta  = -Math.floor(burg.pop_null * 0.8);  // heavy food loss
                healthDelta = -5;
                unrestDelta = +8;
                if (Math.random() < 0.15) eventMsg = `A brutal blizzard has buried the roads around Burg ${burg.burg_id}, cutting off supply lines and starving the populace.`;
            } else if (front.type === "DROUGHT") {
                foodDelta  = -Math.floor(burg.pop_null * 0.5);
                healthDelta = -3;
                unrestDelta = +5;
                if (Math.random() < 0.12) eventMsg = `Drought has cracked the earth around Burg ${burg.burg_id}. The harvest is dust.`;
            } else if (front.type === "HURRICANE") {
                foodDelta   = -Math.floor(burg.pop_null * 0.4);
                healthDelta = -4;
                unrestDelta = +6;
                popDelta    = -Math.floor(burg.pop_null * 0.01); // small direct deaths
                if (Math.random() < 0.2) eventMsg = `A massive hurricane tore through Burg ${burg.burg_id}, destroying homes and killing ${-popDelta} souls.`;
            } else if (front.type === "CHAOS_STORM") {
                // Chaos storms: random, wild, terrifying
                foodDelta   = -Math.floor(burg.pop_null * (0.3 + Math.random() * 0.7));
                healthDelta = -Math.floor(5 + Math.random() * 10);
                unrestDelta = +Math.floor(10 + Math.random() * 20);
                popDelta    = -Math.floor(burg.pop_null * 0.02 * Math.random());
                if (Math.random() < 0.3) eventMsg = `A Chaos Storm — born from the Broken Moon Cruorbus — has erupted over Burg ${burg.burg_id}. Reality itself warps. The sky bleeds crimson.`;
            } else { // generic STORM
                foodDelta  = -Math.floor(burg.pop_null * 0.2);
                unrestDelta = +3;
                if (Math.random() < 0.08) eventMsg = `Violent storms battered Burg ${burg.burg_id} for days, damaging crops and morale.`;
            }

            await client.query(
                `UPDATE sim_burg_economy SET
                    food   = GREATEST(0, food + $1),
                    unrest = LEAST(100, GREATEST(0, unrest + $2)),
                    health = LEAST(100, GREATEST(0, health + $3)),
                    pop_null = GREATEST(0, pop_null + $4)
                 WHERE burg_id = $5`,
                [foodDelta, unrestDelta, healthDelta, popDelta, burg.burg_id]
            );

            if (eventMsg) {
                await client.query(
                    `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, $2, $3, 'MAJOR', $4)`,
                    [tick, front.type, eventMsg, loreDate]
                );
            }
        }
    }

    // ── 4. CHAOS FLOW — Lunar cycle of Cruorbus ───────────────────────────────
    if (phase === "FULL_BLOOD") {
        // Peak chaos: spawn chaos zones, damage seals, trigger chaos storms
        const groveRes = await client.query("SELECT id, cell_id, seal_strength FROM sim_sacred_groves LIMIT 12");
        for (const grove of groveRes.rows) {
            const damage = Math.floor(5 + Math.random() * 15);
            const newStr = Math.max(0, (grove.seal_strength || 100) - damage);
            await client.query("UPDATE sim_sacred_groves SET seal_strength = $1 WHERE id = $2", [newStr, grove.id]);

            // Broken seals spawn chaos zones
            if (newStr < 30 && Math.random() < 0.4) {
                await client.query(
                    `INSERT INTO sim_chaos_zones (cell_id, intensity, type) VALUES ($1, $2, 'VOID_RIFT') ON CONFLICT DO NOTHING`,
                    [grove.cell_id, 20 + Math.random() * 40]
                );
            }
        }

        // Chaos storm guaranteed during Full Blood
        if (Math.random() < 0.5) {
            const sx = Math.random() * 100;
            const sy = Math.random() * 100;
            await client.query(
                `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('CHAOS_STORM', $1, $2, $3, $4, 30, 12)`,
                [sx, sy, (Math.random()-0.5)*3, (Math.random()-0.5)*3]
            );
        }

        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'LUNAR_HEMORRHAGE', $2, 'MAJOR', $3)`,
            [tick, `Cruorbus reaches FULL BLOOD — the broken moon vomits raw chaos onto the land. The 12 Seals strain against the tide. Chaos storms birth across the continent.`, loreDate]
        );

    } else if (phase === "CHAOS_FLOW") {
        // Chaos rivers pulse — intensify existing chaos zones, move them slightly
        await client.query("UPDATE sim_chaos_zones SET intensity = LEAST(100, intensity + 5)");
        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_FLOW', $2, 'MINOR', $3)`,
            [tick, `Chaos rivers flow from the Seals toward the central Void. The land hums with wrongness.`, loreDate]
        );

    } else if (phase === "NIGHTMARE") {
        // The Nightmare Alignment — peak dread, high chaos storm chance, cultists empowered
        await client.query("UPDATE sim_chaos_zones SET intensity = LEAST(100, intensity + 10)");
        await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 3)"); // global dread
        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'NIGHTMARE_ALIGNMENT', $2, 'MAJOR', $3)`,
            [tick, `The Nightmare Alignment grips the land. Cruorbus glows black-red. Citizens wake screaming. Shadows move wrong. Cultists grow bold.`, loreDate]
        );

    } else if (phase === "MERCY") {
        // The Mercy Alignment — brief calm, eco healing
        await client.query("UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 3)");
        await client.query("UPDATE sim_chaos_zones SET intensity = GREATEST(0, intensity - 8)");
        await client.query("DELETE FROM sim_chaos_zones WHERE intensity <= 0");
        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'MERCY_ALIGNMENT', $2, 'MINOR', $3)`,
            [tick, `The Mercy Alignment of Cruorbus brings an eerie stillness. The chaos recedes. Forests breathe. Wounds close a little faster.`, loreDate]
        );

    } else if (phase === "VOID_DRAIN" || dayOfMonth === 5) {
        await client.query("UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 2)");
        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'VOID_DRAIN', $2, 'MINOR', $3)`,
            [tick, `The central Void drinks the last of the surface chaos, leaking it upward into the Broken Moon. The cycle of Cruorbus begins anew.`, loreDate]
        );
    }
}
