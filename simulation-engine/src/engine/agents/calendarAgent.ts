export interface ChaosFlowInfo {
    domain: string;
    dragon: string;
    description: string;
    omen: string;
}

export interface DragonMonthDef {
    id: number;
    name: string;
    domain: string;
    dragon: string;
    description: string;
    omen: string;
}

/**
 * CANONICAL 12 DRAGON MONTHS & 12 POWERS (Canon/04 & Canon/06)
 */
export const DRAGON_MONTHS: DragonMonthDef[] = [
    { id: 1,  name: "Nexar",   domain: "Nexus",  dragon: "Carulkem", description: "Spatial fold mirages, forge-bonds, and furnace heat", omen: "Spatial tears and forge-heat shimmer in the air" },
    { id: 2,  name: "Massis",  domain: "Mass",   dragon: "Tiraton",  description: "Gravitic weight, crushing density, and unyielding bedrock", omen: "Tremors and heavy gravity weigh upon the land" },
    { id: 3,  name: "Motom",   domain: "Motus",  dragon: "Vecelo",   description: "Kinetic scream, storm squalls, and relentless acceleration", omen: "Fierce gale squalls and howling kinetic currents rake the earth" },
    { id: 4,  name: "Fluxen",  domain: "Flux",   dragon: "Ulex",     description: "Shifting melt, metamorphic change, and volatile alchemy", omen: "Unstable alchemical mists mutate strange flora overnight" },
    { id: 5,  name: "Vitan",   domain: "Vita",   dragon: "Gavusrix", description: "Fecund spark, primeval hyper-growth, and carnivorous botany", omen: "A feral blood surge awakens predatory instincts and wild growth" },
    { id: 6,  name: "Lexis",   domain: "Lex",    dragon: "Vahn",     description: "Divine mandate, runic iron compacts, and sovereign decrees", omen: "Runic iron decrees echo in blood and binding compacts" },
    { id: 7,  name: "Ration",  domain: "Ratio",  dragon: "Eldra",    description: "Galvanic lattice, crystalline mind, and cold lightning", omen: "Clockwork humming resonates from deep underground fault lines" },
    { id: 8,  name: "Ordis",   domain: "Ordo",   dragon: "Stagus",   description: "Unyielding glazier, stasis frost, and absolute containment", omen: "Unearthly stillness and creeping stasis frost crystallize on stone" },
    { id: 9,  name: "Luxen",   domain: "Lux",    dragon: "Lophex",   description: "Revealing glare, blinding phosphor, and piercing truth", omen: "Blinding celestial phosphor flares beneath the blood moon" },
    { id: 10, name: "Omin",    domain: "Omen",   dragon: "Sevrath",  description: "Inevitable rot, shadow auguries, and creeping decay", omen: "Black augury shadows stretch unnaturally across the twilight" },
    { id: 11, name: "Aurum",   domain: "Aura",   dragon: "Virantor", description: "Siren deep, phantasmagoric mists, and resonant echoes", omen: "Phantasmagoric violet mists whisper forgotten pasts to travelers" },
    { id: 12, name: "Anum",    domain: "Anumis", dragon: "Grolak",   description: "The Unmaking, soul ash, and void whispers", omen: "Chilling necrotic frost and ash-whispers rise from ancient tombs" }
];

export const CHAOS_FLOWS: ChaosFlowInfo[] = DRAGON_MONTHS;

// Canonical Calendar Constants (Canon/04 §5)
export const DAYS_PER_YEAR = 589;
export const DAYS_PER_DRAGON_MONTH = 48; // 12 x 48 = 576 days
export const SHADOWFALL_DAYS = 13;      // 576 + 13 = 589 days

/**
 * The Eight Canonical Seasons (Canon/04 §5)
 * Follow Cruorbus's wobble across 576 month-days:
 * Four quarters of 144 days (each 1 Long 96-day season + 1 Short 48-day season)
 */
export const SEASONS = [
    "Shadowburn",    // Summer, Long 96 days (Nexar, Massis)
    "Rimefall",      // Autumn, Short 48 days (Motom)
    "Deep Chill",    // Winter, Long 96 days (Fluxen, Vitan)
    "The Green",     // Spring, Short 48 days (Lexis)
    "High Bloom",    // Summer, Long 96 days (Ration, Ordis)
    "Rust Harvest",  // Autumn, Short 48 days (Luxen)
    "The Bitter Void", // Winter, Long 96 days (Omin, Aurum)
    "The Thaw"       // Spring, Short 48 days (Anum)
];

export async function runCalendarAgent(client: any, tick: number) {
    const zeroDay = Math.max(0, tick - 1);
    const year = Math.floor(zeroDay / DAYS_PER_YEAR) + 1;
    const dayOfYear = (zeroDay % DAYS_PER_YEAR) + 1; // 1 to 589

    let month: number;
    let monthName: string;
    let dayOfMonth: number;
    let season: string;
    let cruorbusPhase: string;
    let activeFlow: ChaosFlowInfo;
    let isShadowWeek = false;

    if (dayOfYear <= 576) {
        // Standard 12 Dragon Months (Days 1 - 576)
        month = Math.floor((dayOfYear - 1) / DAYS_PER_DRAGON_MONTH) + 1; // 1 to 12
        dayOfMonth = ((dayOfYear - 1) % DAYS_PER_DRAGON_MONTH) + 1; // 1 to 48
        const dMonth = DRAGON_MONTHS[month - 1]!;
        monthName = dMonth.name;
        activeFlow = {
            domain: dMonth.domain,
            dragon: dMonth.dragon,
            description: dMonth.description,
            omen: dMonth.omen
        };

        // Cruorbus Lunar Phases (Canon/04 §2 across 48-day month cycle)
        if (dayOfMonth <= 10) cruorbusPhase = "The Leering";
        else if (dayOfMonth <= 20) cruorbusPhase = "The Open Eye";
        else if (dayOfMonth <= 30) cruorbusPhase = "The Receding";
        else if (dayOfMonth <= 40) cruorbusPhase = "The Halo";
        else cruorbusPhase = "The Nightmare Alignment";

        // Map dayOfYear to the 8 Canonical Seasons (96 / 48 alternating quarters)
        if (dayOfYear <= 96) season = "Shadowburn";
        else if (dayOfYear <= 144) season = "Rimefall";
        else if (dayOfYear <= 240) season = "Deep Chill";
        else if (dayOfYear <= 288) season = "The Green";
        else if (dayOfYear <= 384) season = "High Bloom";
        else if (dayOfYear <= 432) season = "Rust Harvest";
        else if (dayOfYear <= 528) season = "The Bitter Void";
        else season = "The Thaw";
    } else {
        // Intercalary Shadowfall (Days 577 - 589, 13 days of total eclipse outside the months)
        isShadowWeek = true;
        month = 13;
        monthName = "Shadowfall";
        dayOfMonth = dayOfYear - 576; // 1 to 13
        season = "The Shadow Eclipse";
        cruorbusPhase = "The Black Sun Alignment";
        activeFlow = {
            domain: "Chaos",
            dragon: "The Void",
            description: "Cruorbus passes into perfect alignment with the sun, causing a total solar eclipse for thirteen days (Shadowfall).",
            omen: "Total darkness covers the sky. The thirteen signs appear in the Shatter as cosmic flows calm."
        };
    }

    const loreDate = isShadowWeek
        ? `Year ${year}, Shadowfall, Day ${dayOfMonth} (${cruorbusPhase})`
        : `Year ${year}, Month ${month} (${monthName}), Day ${dayOfMonth} (${season}, ${cruorbusPhase})`;

    const calRes = await client.query("SELECT id FROM sim_calendar LIMIT 1");
    if (calRes.rows.length > 0) {
        await client.query(
            `UPDATE sim_calendar SET 
                tick = $1, 
                year = $2, 
                month = $3, 
                month_name = $4,
                day_of_month = $5,
                day_of_year = $6,
                season = $7, 
                moon_phase = $8, 
                active_flow = $9, 
                dragon_domain = $10,
                is_shadow_week = $11
             WHERE id = $12`,
            [
                tick, year, month, monthName, dayOfMonth, dayOfYear, season, 
                cruorbusPhase, activeFlow.domain, activeFlow.dragon, isShadowWeek, calRes.rows[0].id
            ]
        );
    } else {
        await client.query(
            `INSERT INTO sim_calendar (
                tick, year, month, month_name, day_of_month, day_of_year, 
                season, moon_phase, active_flow, dragon_domain, is_shadow_week
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                tick, year, month, monthName, dayOfMonth, dayOfYear, 
                season, cruorbusPhase, activeFlow.domain, activeFlow.dragon, isShadowWeek
            ]
        );
    }

    // --- COSMIC ANOMALIES & CYCLES ---
    // 1. Cruorbus Hemorrhage (Chaos Surge) - Day 48 of every Dragon Month
    if (dayOfMonth === 48 && !isShadowWeek) {
        await client.query(`
            UPDATE sim_burg_economy b
            SET unrest = LEAST(100, COALESCE(b.unrest, 0) + 4), 
                health = GREATEST(0, COALESCE(b.health, 100) - 2)
            FROM sim_chaos_zones z
            WHERE b.cell_id = z.cell_id AND z.intensity > 40
        `);
        await client.query(`
            UPDATE sim_burg_economy
            SET unrest = LEAST(100, COALESCE(unrest, 0) + 2)
            WHERE unrest < 90
        `);
    }

    return {
        tick,
        year,
        month,
        monthName,
        dayOfMonth,
        dayOfYear,
        season,
        cruorbusPhase,
        activeFlow,
        isShadowWeek,
        loreDate
    };
}
