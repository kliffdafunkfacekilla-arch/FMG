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

export const DRAGON_MONTHS: DragonMonthDef[] = [
    { id: 1,  name: "Tiraton",  domain: "Mass",   dragon: "Tiraton",  description: "Gravitic weight, tectonic basalt, crushing titan density", omen: "Tremors and heavy gravity weigh upon the land" },
    { id: 2,  name: "Carulkem", domain: "Nexus",  dragon: "Carulkem", description: "Spatial fold mirages, dimensional fissures, teleporting anomalies", omen: "Distorted horizons and shifting spatial tears shimmer in the air" },
    { id: 3,  name: "Stagus",   domain: "Ordo",   dragon: "Stagus",   description: "Temporal stasis frost, crystalline wards, unyielding containment", omen: "Unearthly stillness and creeping stasis frost crystallize on stone" },
    { id: 4,  name: "Tyrustis", domain: "Lex",    dragon: "Tyrustis", description: "Blood oaths, runic bindings, sovereign compulsion, iron decrees", omen: "Runic iron decrees echo in blood and binding compacts" },
    { id: 5,  name: "Vecelo",   domain: "Motus",  dragon: "Vecelo",   description: "Howling gales, kinetic squalls, atmospheric tremors", omen: "Fierce gale squalls and howling kinetic currents rake the earth" },
    { id: 6,  name: "Aurgenas", domain: "Flux",   dragon: "Aurgenas", description: "Biomantic mutations, chimeric flora, volatile alchemy", omen: "Unstable alchemical mists mutate strange flora overnight" },
    { id: 7,  name: "Gavusrix", domain: "Vita",   dragon: "Gavusrix", description: "Feral blood surge, primeval hyper-growth, carnivorous botany", omen: "A feral blood surge awakens predatory instincts and wild growth" },
    { id: 8,  name: "Metrion",  domain: "Ratio",  dragon: "Metrion",  description: "Geometric resonance, clockwork synchronicity, arcane ciphers", omen: "Clockwork humming resonates from deep underground fault lines" },
    { id: 9,  name: "Opecten",  domain: "Lux",    dragon: "Opecten",  description: "Blinding phosphor, scorching solar embers, radiant luminescence", omen: "Blinding celestial phosphor flares beneath the blood moon" },
    { id: 10, name: "Termhill", domain: "Omen",   dragon: "Termhill", description: "Astral eclipses, portents of doom, creeping shadow auguries", omen: "Black augury shadows stretch unnaturally across the twilight" },
    { id: 11, name: "Virantor", domain: "Aura",   dragon: "Virantor", description: "Phantasmagoric mists, psychic echoes, waking hallucinations", omen: "Phantasmagoric violet mists whisper forgotten pasts to travelers" },
    { id: 12, name: "Lophex",   domain: "Anumis", dragon: "Lophex",   description: "Soul ash, necrotic chill, void whispers, restless shades", omen: "Chilling necrotic frost and ash-whispers rise from ancient tombs" }
];

export const CHAOS_FLOWS: ChaosFlowInfo[] = DRAGON_MONTHS;

export const DAYS_PER_YEAR = 541;
export const DAYS_PER_DRAGON_MONTH = 44;
export const SHADOW_WEEK_DAYS = 13;
export const SEASONS = [
    "The Bloom",
    "The High Sun",
    "The Harvest",
    "The Withering",
    "The Deep Cold",
    "The Thaw",
    "The Awakening",
    "The Roaring"
];

export async function runCalendarAgent(client: any, tick: number) {
    const zeroDay = Math.max(0, tick - 1);
    const year = Math.floor(zeroDay / DAYS_PER_YEAR) + 1;
    const dayOfYear = (zeroDay % DAYS_PER_YEAR) + 1; // 1 to 541

    let month: number;
    let monthName: string;
    let dayOfMonth: number;
    let season: string;
    let cruorbusPhase: string;
    let activeFlow: ChaosFlowInfo;
    let isShadowWeek = false;

    if (dayOfYear <= 528) {
        // Standard 12 Dragon Months (Days 1 - 528)
        month = Math.floor((dayOfYear - 1) / DAYS_PER_DRAGON_MONTH) + 1; // 1 to 12
        dayOfMonth = ((dayOfYear - 1) % DAYS_PER_DRAGON_MONTH) + 1; // 1 to 44
        const dMonth = DRAGON_MONTHS[month - 1]!;
        monthName = dMonth.name;
        activeFlow = {
            domain: dMonth.domain,
            dragon: dMonth.dragon,
            description: dMonth.description,
            omen: dMonth.omen
        };

        // 5 Cruorbus Lunar Phases (across 44-day month cycle)
        if (dayOfMonth <= 9) cruorbusPhase = "The Empty Eye";
        else if (dayOfMonth <= 18) cruorbusPhase = "The Waxing Blood";
        else if (dayOfMonth <= 27) cruorbusPhase = "The Full Blood";
        else if (dayOfMonth <= 36) cruorbusPhase = "The Mercy Alignment";
        else cruorbusPhase = "The Nightmare Alignment";

        // 8 Seasons mapped across 528 days (66 days per season = 1.5 months each)
        const seasonIndex = Math.min(7, Math.floor((dayOfYear - 1) / 66));
        season = SEASONS[seasonIndex] || "The Bloom";
    } else {
        // Intercalary Shadow Week (Days 529 - 541, 13 days of total solar eclipse)
        isShadowWeek = true;
        month = 13;
        monthName = "Shadow Week";
        dayOfMonth = dayOfYear - 528; // 1 to 13
        season = "The Shadow Eclipse";
        cruorbusPhase = "The Black Sun Alignment";
        activeFlow = {
            domain: "Chaos",
            dragon: "The Void",
            description: "Cruorbus passes into perfect alignment with the sun, causing a total solar eclipse for thirteen days.",
            omen: "Total darkness covers the sky. The twelve Dragon Seals shudder as cosmic flows calm."
        };
    }

    const loreDate = isShadowWeek
        ? `Year ${year}, Shadow Week, Day ${dayOfMonth} (${cruorbusPhase})`
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
