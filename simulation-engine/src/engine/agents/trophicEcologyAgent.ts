import { PoolClient } from "pg";
import { tagBurgCitizens, tagSectorEnvironment } from "./citizenPersonaHelper";

export interface TrophicCalendarContext {
    month?: number;
    monthName?: string;
    activeDragon?: string;
    activeDomain?: string;
    cruorbusPhase?: string;
    isShadowWeek?: boolean;
}

/**
 * Trophic Ecology Agent:
 * Drives continental carrying capacity, seasonal botanical growth,
 * dragon-domain flora mutagenesis, herbivore crop raids,
 * starving predator migrations, and chaos beast warping.
 */
export async function runTrophicEcologyAgent(
    client: PoolClient,
    tick: number,
    season: string,
    loreDate: string,
    calCtx?: TrophicCalendarContext
) {
    const dragonDomain = calCtx?.activeDomain || "Flux";
    const dragonName = calCtx?.activeDragon || "Aurgenas";
    const moonPhase = calCtx?.cruorbusPhase || "The Waxing Blood";
    const isPeakChaos = moonPhase.includes("Full Blood") || moonPhase.includes("Nightmare");

    // Continental macro-flora dynamics evaluate on weekly intervals (every 7 in-game days)
    // Multiplies daily botanical delta by 7 to achieve identical ecological equilibrium with 7x speedup
    if (tick % 7 !== 0 && !isPeakChaos) {
        return;
    }

    const intervalDays = 7;

    // ── 1. SEASONAL FLORA DYNAMICS (0-100/200 Scale) ──────────────────────────
    let plantGrowthDelta = 1.0;
    switch (season) {
        case "The Bloom":
        case "The Awakening":
            plantGrowthDelta = 2.5; // Spring rapid botanical explosion
            break;
        case "The High Sun":
        case "The Harvest":
            plantGrowthDelta = 1.2; // Sustained summer/autumn yields
            break;
        case "The Withering":
            plantGrowthDelta = -0.6; // Autumn leaf-fall and decay
            break;
        case "The Deep Cold":
            plantGrowthDelta = -1.8; // Frost kill and winter dormancy
            break;
        case "The Thaw":
            plantGrowthDelta = 1.6; // Snowmelt ground replenishment
            break;
        case "The Roaring":
            plantGrowthDelta = 0.6; // Storm-swept rain growth
            break;
        default:
            plantGrowthDelta = 1.0;
    }

    const scaledGrowth = plantGrowthDelta * intervalDays;

    // Unified Single-Pass Continental Trophic Carrying Capacity Update (Flora, Prey, Predators)
    await client.query(`
        UPDATE sim_cells
        SET eco_plants = CASE
                WHEN COALESCE(eco_blight, 0.0) < 40.0 THEN LEAST(COALESCE(eco_max, 100.0), GREATEST(2.0, COALESCE(eco_plants, 50.0) + $1))
                ELSE GREATEST(1.0, COALESCE(eco_plants, 50.0) - $2)
            END,
            eco_prey = CASE
                WHEN eco_plants >= 40.0 THEN LEAST(100.0, COALESCE(eco_prey, 50.0) + 0.8)
                WHEN eco_plants < 25.0 THEN GREATEST(2.0, COALESCE(eco_prey, 50.0) - 0.9)
                ELSE eco_prey
            END,
            eco_predators = CASE
                WHEN eco_prey >= 35.0 THEN LEAST(60.0, COALESCE(eco_predators, 10.0) + 0.5)
                ELSE eco_predators
            END
    `, [scaledGrowth, 1.2 * intervalDays]);

    // ── 2. FLORA MUTAGENESIS UNDER SURGING CHAOS LEYS ────────────────────────
    // When the broken moon Cruorbus enters Full Blood or Nightmare Alignment,
    // or near surging chaos flow banks, wild flora mutates according to the dragon domain!
    const DOMAIN_FLORA_TAGS: Record<string, { tags: string[]; name: string; desc: string }> = {
        Flux: {
            tags: ["#ChimericFlora", "#VolatileAetherRoot", "#BioluminescentSpore"],
            name: "Luminescent Chimera-Moss",
            desc: "strange iridescent spores and shifting biomantic roots glowing under the crimson sky"
        },
        Vita: {
            tags: ["#BloodThornOvergrowth", "#CarnivorousBriar", "#PrimevalHyperbloom"],
            name: "Feral Blood-Briars",
            desc: "carnivorous thorny vines that bleed sap and choke ancient timberlines"
        },
        Ordo: {
            tags: ["#StasisFrostFern", "#CrystallineLichen", "#ChronoPetals"],
            name: "Stasis-Lattice Ferns",
            desc: "geometric crystal foliage humming in perpetual frozen stasis"
        },
        Mass: {
            tags: ["#IronBarkTimber", "#BasaltCapMushroom", "#HeavyRootFungus"],
            name: "Basalt-Cap Fungi",
            desc: "dense, heavy timber and petrified fungal caps weighing down the undergrowth"
        },
        Motus: {
            tags: ["#GaleWarpedWillow", "#KineticReeds", "#WhistlingThicket"],
            name: "Kinetic Gale-Reeds",
            desc: "wind-warped bamboo and reeds whipping frantically even in still air"
        },
        Anumis: {
            tags: ["#SoulAshMycelium", "#GraveMistWeed", "#NecroticLichen"],
            name: "Soul-Ash Mycelium",
            desc: "pale ghost-lichen feeding on ancestral soil, exhaling chill mist"
        },
        Lux: {
            tags: ["#PhosphorSunLotus", "#RadiantFireLily", "#BlindingSpores"],
            name: "Phosphor Sun-Lotus",
            desc: "dazzling radiant blooms that combust with blinding solar sparks"
        },
        Nexus: {
            tags: ["#PhaseShiftingBramble", "#MiragePetals", "#FoldedLeaflet"],
            name: "Phase-Shifting Brambles",
            desc: "spectral blossoms flickering between spatial folds and optical mirages"
        },
        Lex: {
            tags: ["#IronrootMandragora", "#RunicBramble", "#DecreeThorn"],
            name: "Runic Iron-Mandragora",
            desc: "rigid runic root-plants with metallic leaves binding the topsoil"
        },
        Ratio: {
            tags: ["#ClockworkFern", "#HarmonicFungus", "#GeometricShrub"],
            name: "Clockwork Geometric Ferns",
            desc: "mathematically precise fractal leaves ticking softly with harmonic pulses"
        },
        Omen: {
            tags: ["#EclipseBlackthorn", "#ShadowOmenIvy", "#VoidPetals"],
            name: "Eclipse Blackthorn",
            desc: "inky black thorns absorbing surrounding light and whispering dire auguries"
        },
        Aura: {
            tags: ["#PhantasmVioletOrchid", "#MindEchoSpore", "#DreamMistWeed"],
            name: "Phantasmagoric Orchids",
            desc: "violet dream-spores releasing waking visions and psychic echoes"
        }
    };

    if ((isPeakChaos || tick % 6 === 0)) {
        const floraDef = DOMAIN_FLORA_TAGS[dragonDomain] || DOMAIN_FLORA_TAGS["Flux"]!;
        // Pick cells adjacent to chaos zones or groves
        const mutatedCells = await client.query(`
            SELECT c.id, c.center_x, c.center_y
            FROM sim_cells c
            JOIN sim_chaos_zones z ON c.id = z.cell_id
            WHERE z.intensity >= 30
            ORDER BY RANDOM()
            LIMIT 3
        `);

        for (const cell of mutatedCells.rows) {
            await tagSectorEnvironment(client, cell.id, floraDef.tags, 0);

            // Check if there is an adjacent burg to receive botanical herbalism effects
            const adjBurg = await client.query(`
                SELECT burg_id, name FROM sim_burg_economy
                WHERE cell_id = $1 OR ABS(cell_id - $1) <= 8
                LIMIT 1
            `, [cell.id]);

            if (adjBurg.rows.length > 0 && Math.random() < 0.35) {
                const b = adjBurg.rows[0];
                await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
                    VALUES ($1, 'FLORA_MUTAGENESIS', $2, 'MINOR', $3, $4)
                `, [
                    tick,
                    `🌿 BOTANICAL MUTAGENESIS: Surging ${dragonDomain} leys of ${dragonName} under ${moonPhase} caused ${floraDef.name} to bloom across the wilderness near ${b.name}! Foragers report ${floraDef.desc}.`,
                    b.burg_id,
                    loreDate
                ]);

                await tagBurgCitizens(
                    client,
                    b.burg_id,
                    ['#AetherHerbHarvester', '#DragonstoneGatherer'],
                    'CURIOUS',
                    `Harvesting rare ${floraDef.name} blooming along the chaos leyline perimeter.`,
                    '%herbalist%',
                    2
                );
            }
        }
    }

    // ── 3. PREY POPULATION DYNAMICS & CROP RAIDS ─────────────────────────────
    // (Carrying capacity calculated in unified single-pass pass above)
    // When prey overpopulates (prey > 80, predators < 20), wild herds swarm into cultivated farms
    if (tick % 7 === 0) {
        const overgrazed = await client.query(`
            SELECT c.id, c.eco_prey, b.burg_id, b.name, b.pop_null
            FROM sim_cells c
            JOIN sim_burg_economy b ON c.id = b.cell_id
            WHERE c.eco_prey >= 75.0 AND COALESCE(c.eco_predators, 10.0) < 20.0
            ORDER BY RANDOM()
            LIMIT 2
        `);

        for (const row of overgrazed.rows) {
            const foodLost = Math.max(15, Math.floor((row.pop_null || 100) * 0.2));
            await client.query(`
                UPDATE sim_burg_economy
                SET food = GREATEST(0, food - $1),
                    unrest = LEAST(100, unrest + 1)
                WHERE burg_id = $2
            `, [foodLost, row.burg_id]);

            await tagSectorEnvironment(client, row.id, ["#CropRaidedByBeasts", "#OvergrazedBrush"], 0);

            await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
                VALUES ($1, 'HERBIVORE_CROP_RAID', $2, 'MINOR', $3, $4)
            `, [
                tick,
                `🐗 CROP RAID: Massive herds of wild grazers and crop-raiding beasts emerged from the brush, devouring ${foodLost} units of grain around ${row.name}!`,
                row.burg_id,
                loreDate
            ]);

            await tagBurgCitizens(
                client,
                row.burg_id,
                ['#CropDefender', '#BitterHarvester'],
                'BITTER',
                `Guarding the grain fields of ${row.name} from marauding wild animal herds.`,
                '%farmer%',
                2
            );
        }
    }

    // ── 4. PREDATOR-PREY BALANCE & STARVING PREDATOR MIGRATION ────────────────
    // When predators exceed prey or prey collapses, predators starve and migrate toward settlements
    const starvingPredatorCells = await client.query(`
        SELECT id, eco_predators, eco_prey
        FROM sim_cells
        WHERE (eco_predators > (eco_prey * 1.25) OR eco_prey < 18.0)
          AND eco_predators >= 15.0
        ORDER BY RANDOM()
        LIMIT 4
    `);

    for (const cell of starvingPredatorCells.rows) {
        // Predator population declines from starvation/dispersion
        await client.query(`
            UPDATE sim_cells
            SET eco_predators = GREATEST(2.0, eco_predators - 1.5)
            WHERE id = $1
        `, [cell.id]);

        await tagSectorEnvironment(client, cell.id, ["#PredatorProwlZone", "#DireBeastAmbush"], 0);

        // Check if an adjacent burg's livestock is raided
        const nearbyBurg = await client.query(`
            SELECT burg_id, name, unrest, food FROM sim_burg_economy
            WHERE cell_id = $1 OR ABS(cell_id - $1) <= 8
            LIMIT 1
        `, [cell.id]);

        if (nearbyBurg.rows.length > 0) {
            const b = nearbyBurg.rows[0];
            await client.query(`
                UPDATE sim_burg_economy
                SET unrest = LEAST(100, unrest + 2),
                    food = GREATEST(0, food - 30)
                WHERE burg_id = $1
            `, [b.burg_id]);

            if (Math.random() < 0.40) {
                await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
                    VALUES ($1, 'STARVING_PREDATOR_MIGRATION', $2, 'MINOR', $3, $4)
                `, [
                    tick,
                    `🐺 STARVING PREDATORS: Depleted prey forced desperate dire packs and wild beasts out of the hills to prowl the caravan roads and livestock pens around ${b.name}!`,
                    b.burg_id,
                    loreDate
                ]);

                await tagBurgCitizens(
                    client,
                    b.burg_id,
                    ['#BeastHunter', '#TraumatizedSurvivor'],
                    'WARY',
                    `Patrolling the fences of ${b.name} after livestock were mauled by starving predator packs.`,
                    '%watch%',
                    2
                );
            }
        }
    }

    // ── 6. CHAOS BEAST MUTAGENESIS (APEX PREDATORS WARPED BY PRIMORDIAL LEYS) ─
    if (isPeakChaos || (tick % 5 === 0)) {
        const warpedZones = await client.query(`
            SELECT c.id, c.eco_apex, z.intensity, z.type
            FROM sim_cells c
            JOIN sim_chaos_zones z ON c.id = z.cell_id
            WHERE z.intensity >= 45
            ORDER BY RANDOM()
            LIMIT 2
        `);

        for (const zone of warpedZones.rows) {
            await client.query(`
                UPDATE sim_cells
                SET eco_apex = LEAST(100.0, COALESCE(eco_apex, 5.0) + 2.0)
                WHERE id = $1
            `, [zone.id]);

            await tagSectorEnvironment(client, zone.id, ["#ChimericMonsters", "#ChaosTouchedWildlife", `#Warped_${dragonDomain}`], 0);

            // Find nearby settlement to log event
            const nearbyBurg = await client.query(`
                SELECT burg_id, name FROM sim_burg_economy
                WHERE cell_id = $1 OR ABS(cell_id - $1) <= 10
                LIMIT 1
            `, [zone.id]);

            if (nearbyBurg.rows.length > 0 && Math.random() < 0.35) {
                const b = nearbyBurg.rows[0];
                await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
                    VALUES ($1, 'CHAOS_BEAST_MUTATION', $2, 'MAJOR', $3, $4)
                `, [
                    tick,
                    `🐉 PRIMORDIAL CHIMERA: Aetheric ley-floods of ${dragonDomain} in Sector ${zone.id} have mutated apex predators into grotesque ${dragonDomain} chimeras! Hunting parties from ${b.name} report beasts with iridescent scales and volatile breath.`,
                    b.burg_id,
                    loreDate
                ]);

                await tagBurgCitizens(
                    client,
                    b.burg_id,
                    ['#MonsterSlayer', '#BlightedBeastSurvivor'],
                    'AGGRESSIVE',
                    `Tracking horrific ${dragonDomain} chimeric predators prowling outside ${b.name}.`,
                    '%soldier%',
                    2
                );
            }
        }
    }

    // ── 7. BLIGHT & SACRED DRAGON GROVE STABILIZATION ─────────────────────────
    // Weak dragon seals radiate eco-blight to surrounding cells
    await client.query(`
        UPDATE sim_cells c
        SET eco_blight = LEAST(100.0, COALESCE(c.eco_blight, 0.0) + 0.8)
        FROM sim_sacred_groves g
        WHERE g.cell_id = c.id AND g.seal_strength < 30
    `);

    // Strong seals actively cleanse ambient blight
    await client.query(`
        UPDATE sim_cells c
        SET eco_blight = GREATEST(0.0, COALESCE(c.eco_blight, 0.0) - 1.2)
        FROM sim_sacred_groves g
        WHERE g.cell_id = c.id AND g.seal_strength >= 75
    `);

    // ── 8. AGRICULTURAL & FORAGING FEEDBACK TO BURGS ──────────────────────────
    // Burgs surrounded by lush flora gain economic food & herbal stockpiles
    if (tick % 4 === 0) {
        await client.query(`
            UPDATE sim_burg_economy b
            SET food = food + 25,
                wealth = wealth + 10
            FROM sim_cells c
            WHERE b.cell_id = c.id AND c.eco_plants >= 75.0 AND COALESCE(c.eco_blight, 0.0) < 15.0
        `);

        // Burgs surrounded by ruined / blighted flora suffer gathering famine
        await client.query(`
            UPDATE sim_burg_economy b
            SET food = GREATEST(0, food - 20)
            FROM sim_cells c
            WHERE b.cell_id = c.id AND (c.eco_plants < 20.0 OR COALESCE(c.eco_blight, 0.0) >= 50.0)
        `);
    }
}
