import { tagBurgCitizens, tagSectorEnvironment } from "./citizenPersonaHelper";
import { MERCY_ALIGNMENT, NIGHTMARE_ALIGNMENT, SHADOWFALL, moonPhaseFor, seasonByName } from "../canon/calendar.js";import { sqlShuffle } from "../rng.js";


// ─────────────────────────────────────────────────────────────────────────────
//  Weather & Chaos Agent
//  One tick = one day. Fronts travel, apply real effects, and chaos syncs to
//  the lunar cycle of Cruorbus (48-day month).
// ─────────────────────────────────────────────────────────────────────────────

// Weather effect for Cruorbus's face (Canon/04 §2), from the canon calendar.
function getCruorbusPhase(season: string, dayOfMonth: number, isShadowWeek?: boolean): string {
    if (isShadowWeek) return "SHADOW_WEEK";
    const s = seasonByName(season);
    if (!s) return "HALO";
    const phase = moonPhaseFor(s, dayOfMonth);
    if (phase === NIGHTMARE_ALIGNMENT) return "NIGHTMARE";  // Open Eye at full moon: peak dread
    if (phase === MERCY_ALIGNMENT) return "MERCY";          // Open Eye at new moon: chaos damped
    if (phase === "The Open Eye") return "BLEED";      // the Bleed: storms, raids, madness
    if (phase === "The Leering") return "CHAOS_FLOW";       // pressure rising: chaos rivers pulse
    if (phase === "The Receding") return "VOID_DRAIN";      // pressure easing
    return "HALO";                                          // the mild seasons: the world can breathe
}

export async function runWeatherAgent(client: any, tick: number, season: string, dayOfMonth: number, loreDate: string, isShadowWeek?: boolean) {

    // ── 1. MOVE & AGE existing weather fronts ────────────────────────────────
    await client.query("UPDATE sim_weather_fronts SET x = x + dx, y = y + dy, lifetime = lifetime - 1");
    await client.query("DELETE FROM sim_weather_fronts WHERE lifetime <= 0");

    // ── 2. SPAWN new weather fronts based on season + lunar phase ─────────────
    const phase = getCruorbusPhase(season, dayOfMonth, isShadowWeek);
    const SPAWN_CHANCE: Record<string, number> = {
        Shadowburn: 0.04,
        Dryspell:   0.04,
        Frostin:    0.08,
        Greenspan:  0.05,
        Dimburn:    0.10, // canon: high tides, high storms
        Cropfade:   0.08,
        Dimfreeze:  0.12, // canon: deep cold
        Thawrise:   0.06,
    };

    // Lunar amplification — the Bleed (Open Eye) and the Nightmare Alignment dramatically spike storm spawning
    let lunarMult = 1.0;
    if (phase === "BLEED")  lunarMult = 2.5;
    if (phase === "NIGHTMARE")   lunarMult = 3.0;
    if (phase === "MERCY")       lunarMult = 0.3;

    const spawnChance = (SPAWN_CHANCE[season] || 0.05) * lunarMult;

    if (Math.random() < spawnChance) {
        // Pick storm type based on season + phase
        let stormType = "STORM";
        const kind = seasonByName(season)?.kind;
        if (kind === "Winter") stormType = "BLIZZARD";
        else if (season === "Shadowburn") stormType = Math.random() < 0.45 ? "WILDFIRE" : "DROUGHT";
        else if (season === "Dryspell") stormType = "DROUGHT";
        else if (season === "Greenspan") stormType = Math.random() < 0.25 ? "EARTHQUAKE" : "DROUGHT";
        else if (phase === "BLEED" || phase === "NIGHTMARE") stormType = "CHAOS_STORM";
        else if (season === "Dimburn") stormType = "HURRICANE";

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
    const fronts = await client.query("SELECT * FROM sim_weather_fronts ORDER BY id");
    for (const front of fronts.rows) {
        // Find burgs inside this front's radius using cell geometry approximation
        // We stored burg cell_id; we need the cell x/y. Use a simple bounding check on geometry centroid.
        // For now: apply to a random sample of burgs weighted by probability — real geo join is Phase 2.
        const affectedBurgs = await client.query(
            `SELECT burg_id, name, cell_id, food, unrest, health, pop_null, architecture_type FROM sim_burg_economy ORDER BY ${sqlShuffle("burg_id")} LIMIT $1`,
            [Math.max(1, Math.floor(front.radius / 20))] // more burgs hit by bigger fronts
        );

        for (const burg of affectedBurgs.rows) {
            let foodDelta = 0, unrestDelta = 0, healthDelta = 0, popDelta = 0;
            let eventMsg: string | null = null;
            let weatherTags: string[] = [];
            const arch = (burg.architecture_type || "WOOD").toUpperCase();
            const isWood = arch === "WOOD" || arch.includes("TIMBER") || arch === "HALF_TIMBERED" || arch === "REED_STILT";
            const isStone = arch === "STONE" || arch.includes("ASHLAR") || arch.includes("DRYSTONE");
            const isClay = arch === "CLAY" || arch.includes("ADOBE");

            if (front.type === "WILDFIRE") {
                if (isWood) {
                    // Wood towns ignite and burn to nothing!
                    foodDelta   = -Math.floor(burg.pop_null * 0.9);
                    healthDelta = -18;
                    unrestDelta = +28;
                    popDelta    = -Math.floor(burg.pop_null * 0.03);
                    weatherTags = ["#WildfireInferno", "#TimberQuarterAshes", "#BurnedHomes"];
                    eventMsg = `🔥 CATASTROPHIC WILDFIRE: Raging wildfires swept into ${burg.name}! Because the town is built primarily of wood, the timber framing and thatched roofs ignited instantly. Entire residential quarters burned to nothing, leaving hundreds homeless amidst smoking ash!`;
                    await tagBurgCitizens(client, burg.burg_id, ['#BurnedOutRefugee', '#AshRuinsSurvivor'], 'TERRIFIED', `Lost their home to the wildfire inferno that consumed the wooden districts of ${burg.name}.`, null, 4);
                } else {
                    // Stone and Clay towns resist fire!
                    foodDelta   = -Math.floor(burg.pop_null * 0.2);
                    healthDelta = -2;
                    unrestDelta = +5;
                    weatherTags = ["#FireResisted", "#ScorchedWalls"];
                    eventMsg = `Wildfires roared against the fortified masonry perimeter of ${burg.name}. The town's heavy ${arch.toLowerCase()} construction resisted the flames, sparing the structures while surrounding scrubland scorched.`;
                }
            } else if (front.type === "EARTHQUAKE") {
                if (isStone) {
                    // Stone towns suffer masonry collapse and fractures
                    foodDelta   = -Math.floor(burg.pop_null * 0.4);
                    healthDelta = -12;
                    unrestDelta = +22;
                    popDelta    = -Math.floor(burg.pop_null * 0.02);
                    weatherTags = ["#EarthquakeRubble", "#CollapsedMasonry"];
                    eventMsg = `A violent earthquake shook ${burg.name}! Brittle ashlar stone arches and heavy masonry towers cracked and collapsed into street rubble.`;
                    await tagBurgCitizens(client, burg.burg_id, ['#QuakeSurvivor', '#RubbleClearingWorker'], 'WARY', `Shoveling fallen masonry after an earthquake damaged ${burg.name}.`, null, 3);
                } else {
                    // Wood towns flex and absorb ground tremors
                    foodDelta   = -Math.floor(burg.pop_null * 0.2);
                    healthDelta = -4;
                    unrestDelta = +8;
                    weatherTags = ["#TremorsFelt"];
                    eventMsg = `Ground tremors shook ${burg.name}. The settlement's flexible timber framing swayed and absorbed the shock with minimal structural damage.`;
                }
            } else if (front.type === "BLIZZARD") {
                foodDelta  = -Math.floor(burg.pop_null * 0.8);  // heavy food loss
                healthDelta = -5;
                unrestDelta = +8;
                weatherTags = ["#BlizzardGrounded", "#FrozenSupplyLine"];
                if (Math.random() < 0.25) {
                    eventMsg = `A brutal blizzard has buried the roads around ${burg.name}, cutting off supply lines and freezing the populace.`;
                    await tagBurgCitizens(client, burg.burg_id, ['#FrostbittenPeasant', '#SnowboundForager'], 'DESPERATE', `Trapped inside ${burg.name} by howling snowdrifts and sub-zero blizzard gales.`, null, 3);
                }
            } else if (front.type === "DROUGHT") {
                foodDelta  = -Math.floor(burg.pop_null * 0.5);
                healthDelta = -3;
                unrestDelta = +5;
                weatherTags = ["#DroughtStricken", "#BarrenHarvest"];
                if (Math.random() < 0.22) {
                    eventMsg = `Parched drought has cracked the earth around ${burg.name}. Wellsprings ran dry and crops withered to ash.`;
                    await tagBurgCitizens(client, burg.burg_id, ['#ThirstyLaborer', '#DustBowlRefugee'], 'BITTER', `Enduring scorching heat and water rations in drought-stricken ${burg.name}.`, null, 3);
                }
            } else if (front.type === "HURRICANE") {
                if (isClay) {
                    foodDelta   = -Math.floor(burg.pop_null * 0.7);
                    healthDelta = -10;
                    unrestDelta = +16;
                    popDelta    = -Math.floor(burg.pop_null * 0.02);
                    weatherTags = ["#HurricaneGales", "#FloodedTerrain", "#AdobeErosion"];
                    if (Math.random() < 0.35) {
                        eventMsg = `Torrential hurricane floods inundated ${burg.name}! Earthen adobe brickwork softened and eroded under relentless gale floods.`;
                        await tagBurgCitizens(client, burg.burg_id, ['#StormDisplaced', '#FloodedSurvivor'], 'DESPERATE', `Rebuilding washed-out adobe homes after a hurricane struck ${burg.name}.`, null, 3);
                    }
                } else {
                    foodDelta   = -Math.floor(burg.pop_null * 0.4);
                    healthDelta = -4;
                    unrestDelta = +6;
                    popDelta    = -Math.floor(burg.pop_null * 0.01); // small direct deaths
                    weatherTags = ["#HurricaneGales", "#FloodedTerrain"];
                    if (Math.random() < 0.25) {
                        eventMsg = `A massive hurricane tore through ${burg.name}, damaging roofs and drowning surrounding lowlands.`;
                        await tagBurgCitizens(client, burg.burg_id, ['#StormDisplaced', '#FloodedSurvivor'], 'DESPERATE', `Rebuilding flooded homes and salvaging ruined timber after a hurricane struck ${burg.name}.`, null, 3);
                    }
                }
            } else if (front.type === "CHAOS_STORM") {
                // Chaos storms: random, wild, terrifying
                foodDelta   = -Math.floor(burg.pop_null * (0.3 + Math.random() * 0.7));
                healthDelta = -Math.floor(5 + Math.random() * 10);
                unrestDelta = +Math.floor(10 + Math.random() * 20);
                popDelta    = -Math.floor(burg.pop_null * 0.02 * Math.random());
                weatherTags = ["#ChaosStormRift", "#RealityWarped", "#CrimsonAtmosphere"];
                if (Math.random() < 0.35) {
                    eventMsg = `A Chaos Storm — vomited from the Broken Moon Cruorbus — erupted over ${burg.name}. Gravity stutters, shadows detach, and crimson rain falls upwards.`;
                    await tagBurgCitizens(client, burg.burg_id, ['#AetherStormSurvivor', '#VoidTouchedMind'], 'FANATICAL', `Witnessed reality warp during a Cruorbus chaos storm over ${burg.name}.`, null, 3);
                }
            } else { // generic STORM
                foodDelta  = -Math.floor(burg.pop_null * 0.2);
                unrestDelta = +3;
                weatherTags = ["#HeavyRainfall", "#MuddyHighways"];
                if (Math.random() < 0.12) eventMsg = `Violent rainstorms battered ${burg.name} for days, washing out roads and flooding cellars.`;
            }

            if (burg.cell_id && weatherTags.length > 0) {
                await tagSectorEnvironment(client, burg.cell_id, weatherTags, 0);
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
                    `INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, $2, $3, 'MAJOR', $4, $5)`,
                    [tick, front.type, eventMsg, burg.burg_id, loreDate]
                );
            }
        }
    }

    // ── 4. CHAOS FLOW — Cruorbus's faces & Shadowfall ─────────────────
    if (phase === "SHADOW_WEEK") {
        // Shadowfall: 13-day solar eclipse by Cruorbus.
        // Ambient chaos flow calms. The Dragon Prisons (which feed on flowing chaos)
        // do not naturally self-regenerate during these 13 days, giving cultists a window of vulnerability.
        if (tick % 3 === 0) {
            await client.query(
                `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'SHADOW_WEEK_ECLIPSE', $2, 'MAJOR', $3)`,
                [tick, `Shadowfall Day ${dayOfMonth}: Total darkness blankets Ostraka as Cruorbus blots out the sun. Ambient chaos flows still, depriving the ancient seals of ley energy as Shlaar's whispers intensify in the void.`, loreDate]
            );
        }
    } else if (phase === "BLEED") {
        // Peak chaos: spawn chaos zones, trigger chaos storms across Ostraka
        // Weakened seals may radiate void rifts
        const groveRes = await client.query("SELECT id, cell_id, seal_strength FROM sim_sacred_groves WHERE seal_strength < 40 ORDER BY id");
        for (const grove of groveRes.rows) {
            if (Math.random() < 0.3) {
                await client.query(
                    `INSERT INTO sim_chaos_zones (cell_id, intensity, type) VALUES ($1, $2, 'VOID_RIFT') ON CONFLICT DO NOTHING`,
                    [grove.cell_id, 20 + Math.random() * 40]
                );
            }
        }

        // Chaos storm likely during the Bleed
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
            [tick, `Cruorbus bleeds crimson as the Open Eye faces the world — the broken moon vomits raw chaos onto the land. The 12 Seals strain against the tide. Chaos storms birth across the continent.`, loreDate]
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

    } else if (phase === "VOID_DRAIN" && dayOfMonth % 12 === 5) {
        await client.query("UPDATE sim_cells SET eco_health = LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 100) + 2)");
        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'VOID_DRAIN', $2, 'MINOR', $3)`,
            [tick, `The central Void drinks the last of the surface chaos, leaking it upward into the Broken Moon. The cycle of Cruorbus begins anew.`, loreDate]
        );
    }

    // ── 5. NATURAL CONTINENTAL TEMPERATURE & CLIMATE CYCLE ───────────────────
    // Dynamically updates cell temperatures across Ostraka based on season, latitude, elevation, and active fronts
    if (tick % 5 === 0) {
        const SEASON_BASE_TEMPS: Record<string, number> = {
            Shadowburn: 28,
            Dimburn: 24,
            Greenspan: 18,
            Dryspell: 14,
            Cropfade: 10,
            Thawrise: 8,
            Frostin: -2,
            Dimfreeze: -12,
            [SHADOWFALL]: -15
        };
        const baseTemp = SEASON_BASE_TEMPS[season] ?? 14;

        // Apply temperature shift across cells
        await client.query(`
            UPDATE sim_cells
            SET current_temp = ROUND(
                ($1::numeric) - (COALESCE(elevation, 50) * 0.22) - (CASE WHEN center_y < 500 THEN (500 - center_y) * 0.015 ELSE 0 END)
            )
        `, [baseTemp]);

        // Blizzards plunge local temperatures sub-zero
        const blizzards = fronts.rows.filter((f: any) => f.type === 'BLIZZARD');
        for (const b of blizzards) {
            await client.query(`
                UPDATE sim_cells
                SET current_temp = current_temp - 14
                WHERE power(center_x - $1::numeric, 2) + power(center_y - $2::numeric, 2) <= power($3::numeric * 8, 2)
            `, [Number(b.x), Number(b.y), Number(b.radius)]);
        }

        // Droughts spike heatwaves
        const droughts = fronts.rows.filter((f: any) => f.type === 'DROUGHT');
        for (const d of droughts) {
            await client.query(`
                UPDATE sim_cells
                SET current_temp = current_temp + 14
                WHERE power(center_x - $1::numeric, 2) + power(center_y - $2::numeric, 2) <= power($3::numeric * 8, 2)
            `, [Number(d.x), Number(d.y), Number(d.radius)]);
        }
    }
}
