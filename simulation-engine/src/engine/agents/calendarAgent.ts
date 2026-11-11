import { dateForTick } from "../canon/calendar.js";

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

// Year length, seasons and moon phases live in engine/canon/calendar.ts (Canon/04). Re-exported for older imports.
export { DAYS_PER_YEAR, SHADOWFALL_DAYS, DAYS_PER_MONTH as DAYS_PER_DRAGON_MONTH } from "../canon/calendar.js";

export async function runCalendarAgent(client: any, tick: number) {
    const date = dateForTick(tick);
    const { year, month, dayOfMonth, dayOfYear, season } = date;
    const cruorbusPhase = date.moonPhase;
    const isShadowWeek = date.isShadowfall;
    let monthName: string;
    let activeFlow: ChaosFlowInfo;

    if (!isShadowWeek) {
        const dMonth = DRAGON_MONTHS[month - 1]!;
        monthName = dMonth.name;
        activeFlow = {
            domain: dMonth.domain,
            dragon: dMonth.dragon,
            description: dMonth.description,
            omen: dMonth.omen
        };
    } else {
        // Intercalary Shadowfall (Days 577 - 589, 13 days of total eclipse outside the months)
        monthName = "Shadowfall";
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
