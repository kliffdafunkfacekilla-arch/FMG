import { DAYS_PER_WEEK, DAYS_PER_YEAR, SHADOWFALL, isYearEnd, seasonKind } from "../canon/calendar.js";
import { tagBurgCitizens } from "./citizenPersonaHelper";
import { loadCellTagMap } from "../cellTags.js";
import { deriveCitizenMotives } from "../rpg/paragonMotives.js";
import { 
    getFactionSpecialty, 
    getGoodsByCategory, 
    CommodityCategory 
} from "../economy/factionSpecialties.js";
import {
    GOOD_ROLE_BY_ID,
    CIVIC_PROFESSIONS,
    SECURITY_PROFESSIONS,
    SOCIAL_SPIRITUAL_PROFESSIONS,
    getProfessionForGood,
    getWorkplaceForProfession,
    goodKeyFromName
} from "../economy/goodCatalog.js";
import { evaluateBurgInventoryEffects } from "../economy/itemSystemicMatrix.js";
import { sqlShuffle } from "../rng.js";

export { getWorkplaceForProfession };


const ADULT_TRADE_MAP: Record<string, string> = {
    "Forge Apprentice": "Blacksmith",
    "Weaver Youth": "Weaver",
    "Temple Ward": "Temple Acolyte",
    "Farm Hand": "Farmer",
    "Herbalist Gatherer": "Hedge Herbalist",
    "Scribe Runner": "Town Scribe",
    "Potter Apprentice": "Potter",
    "Dock Urchin": "Fisherman",
    "Stable Hand": "Caravan Drover",
    "Tinker Apprentice": "Clockmaker",
    "Kitchen Scullion": "Baker",
    "Fisher Boy": "Fisherman"
};

const CHILDHOOD_BACKGROUNDS = [
    "Apprenticed early at the forge; blistered palms taught them the stubborn value of endurance.",
    "Survived a bitter winter famine by foraging frozen marsh-moss with their elder siblings.",
    "Discovered strange arcane sparks dancing along their fingertips while resting beside an ancient stone megalith.",
    "Grew up listening to temple priests chant solemn hymns about the 12 Chaos Dragons and the weakening seals.",
    "Witnessed a city watch raid on their parents' workshop over unpaid grain taxes.",
    "Raised on a frontier farm constantly defending sheep herds from wandering shadow-wolves.",
    "Spent quiet candlelit hours in a scribe's dusty scriptorium copying forbidden dragon geometry.",
    "Lost a childhood companion to a river flood; swore never to abandon their fellow cohort.",
    "Learned to sprint across rooftops and alleys carrying sensitive missives for the merchant guild.",
    "Fascinated by clockwork mechanisms and copper gears salvaged from behind the master tinker's bench.",
    "Sheltered in an underground stone cellar while a chaotic purple thunderstorm warped the harvest fields.",
    "Labored in municipal clay pits from sunrise to twilight, dreaming of buying their family's independence."
];

const FIRST_NAMES: Record<string, string[]> = {
    "Human": ["Elian", "Vaelen", "Mara", "Lucian", "Kenneth", "Cassian", "Theron", "Orla", "Danica", "Gareth", "Fiona", "Tobias", "Morwen", "Darek", "Brina", "Jarek", "Sylvia"],
    "Avian": ["Corvus", "Aeron", "Peregrine", "Skye", "Talon", "Cirrus", "Zephyr", "Kestrel", "Osprey", "Altair", "Sora", "Gale"],
    "Bear-Folk": ["Bjorn", "Kaelis", "Ursan", "Torben", "Grizel", "Brant", "Hulda", "Bram", "Orson", "Valko", "Thora"],
    "Wolf-Kin": ["Fenrir", "Lupen", "Varik", "Kira", "Ragnar", "Skoll", "Volf", "Freki", "Torva", "Astrid"],
    "Felid": ["Leona", "Raza", "Sabre", "Tigran", "Panthera", "Vesper", "Lynx", "Cleo", "Shadow", "Zara"],
    "Saurian": ["Krag", "Ssys", "Xerxes", "Scales", "Gorgon", "Viper", "Drakon", "Slither", "Caiman", "Basil"],
    "Plant-Folk": ["Rowan", "Bramble", "Thorn", "Moss", "Willow", "Oakley", "Sylvan", "Fern", "Petal", "Barkley"]
};

const LAST_NAMES: Record<string, string[]> = {
    "Human": ["Thorne", "Vance", "Ironwood", "Miller", "Blackwood", "Fletcher", "Cooper", "Ashfall", "Clearwater", "Vane", "Frost", "Stone", "Cross", "Sterling", "Oakhaven", "Pike", "Weaver"],
    "Avian": ["Wind-Rider", "Cloud-Crest", "Sky-Watcher", "Feather-Bound", "Gale-Walker", "Storm-Beak", "High-Roost"],
    "Bear-Folk": ["Iron-Paw", "Rock-Cleaver", "Honey-Crag", "Heavy-Stride", "Frost-Fur", "Brawn-Hammer", "Stone-Back"],
    "Wolf-Kin": ["Blood-Howl", "Moon-Stalker", "Grey-Pelt", "Swift-Fang", "Night-Tracker", "Pine-Runner", "Frost-Howl"],
    "Felid": ["Silent-Paws", "Shadow-Pounce", "Sun-Basker", "Razor-Claw", "Night-Stalker", "Dune-Leaper"],
    "Saurian": ["Iron-Scale", "Deep-Basker", "Mud-Crag", "Venom-Spit", "Swamp-Stalker", "Spire-Tail"],
    "Plant-Folk": ["Deep-Root", "Green-Bough", "Sap-Flow", "Briar-Twist", "Autumn-Leaf", "Iron-Bark"]
};

const ADULT_PROFESSIONS = [
    "Blacksmith", "Weaver", "Miller", "Baker", "Carpenter", "Cobbler", "Stonemason",
    "Tanner", "Fisherman", "Farmer", "City Watchman", "Gate Sentry", "Town Scribe",
    "Hedge Herbalist", "Apothecary Apprentice", "Temple Acolyte", "Clockmaker",
    "Disenfranchised Laborer", "Merchant Trader", "Caravan Drover", "Potter",
    "Cooper", "Brewmaster", "Foundry Worker", "Armorer", "Bowyer"
];

function pickRandom<T>(arr: T[], fallback: T): T {
    if (!arr || arr.length === 0) return fallback;
    return arr[Math.floor(Math.random() * arr.length)] ?? fallback;
}

function resolveSpecies(demographicsStr: string): string {
    try {
        const demo = JSON.parse(demographicsStr || "{}");
        const entries = Object.entries(demo);
        if (entries.length === 0) return "Human";
        const roll = Math.random();
        let cumulative = 0;
        for (const [sp, weight] of entries) {
            cumulative += Number(weight);
            if (roll <= cumulative) {
                if (sp.includes("Avian") || sp.includes("Eagle") || sp.includes("Hawk")) return "Avian";
                if (sp.includes("Bear") || sp.includes("Ursine")) return "Bear-Folk";
                if (sp.includes("Wolf") || sp.includes("Hound")) return "Wolf-Kin";
                if (sp.includes("Felid") || sp.includes("Cat") || sp.includes("Red Panda")) return "Felid";
                if (sp.includes("Lizard") || sp.includes("Reptile") || sp.includes("Saurian")) return "Saurian";
                if (sp.includes("Plant") || sp.includes("Mushroom") || sp.includes("Fae")) return "Plant-Folk";
                return sp;
            }
        }
    } catch (e) { }
    return "Human";
}


/**
 * How a burg's population counters map onto its citizen records. Each record stands for `unit` people:
 * the burg's own density (people per living record), not a fixed 12. Records used to claim unit_size 12
 * while holding ~8.5 people each, growth added 6 null + 6 attuned per unit whatever the burg's real mix,
 * and executions, riots, bandits and refugees lowered the counters without ever retiring a record.
 */
export interface RecordLedger { unit: number; attunedShare: number }

export function recordLedger(popNull: number, popAttuned: number, livingRecords: number): RecordLedger {
    const total = Math.max(0, popNull) + Math.max(0, popAttuned);
    const unit = livingRecords > 0 ? Math.min(40, Math.max(3, Math.round(total / livingRecords))) : 12;
    const attunedShare = total > 0 ? Math.max(0, popAttuned) / total : 0.5;
    return { unit, attunedShare };
}

/** A burg's ledger from its stored record_unit and its current null/attuned mix. */
function ledgerFor(burg: any): RecordLedger {
    const popNull = Math.max(0, Number(burg.pop_null) || 0), popAttuned = Math.max(0, Number(burg.pop_attuned) || 0);
    const total = popNull + popAttuned;
    return { unit: Math.min(40, Math.max(3, Number(burg.record_unit) || 12)), attunedShare: total > 0 ? popAttuned / total : 0.5 };
}

/** Splits `people` into null and attuned by the burg's mix. */
export function splitByShare(people: number, attunedShare: number): { nulls: number; attuned: number } {
    const attuned = Math.round(people * attunedShare);
    return { nulls: people - attuned, attuned };
}

/** Takes n living civilians out of a burg's records: dead (with a cause) or gone (DEPARTED). */
async function retireRecords(client: any, burgId: number, n: number, status: "DECEASED" | "DEPARTED", cause: string | null, motivation: string) {
    if (n <= 0) return;
    await client.query(`
        UPDATE population_demographics
        SET allegiance_status = $2, cause_of_death = $3, motivation = $4
        WHERE citizen_id IN (
            SELECT citizen_id FROM population_demographics
            WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
            ORDER BY ${sqlShuffle("citizen_id")}
            LIMIT $5
        )`, [burgId, status, cause, motivation, n]);
}

async function spawnImmigrant(client: any, burg: any, ledger: RecordLedger) {
    const isExotic = Math.random() < 0.15;
    const ALL_SPECIES = ["Human", "Avian", "Bear-Folk", "Wolf-Kin", "Felid", "Saurian", "Plant-Folk"];
    const species = isExotic ? pickRandom(ALL_SPECIES, "Human") : resolveSpecies(burg.species_demographics);
    const first = pickRandom(FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Val"], "Val");
    const last = pickRandom(LAST_NAMES[species] || LAST_NAMES["Human"] || ["Traveler"], "Traveler");
    const name = `${first} ${last}`;
    const profession = pickRandom(ADULT_PROFESSIONS, "Merchant Trader");
    const age = Math.floor(Math.random() * 25) + 20;
    const childhood = pickRandom(CHILDHOOD_BACKGROUNDS, "Traveled far across the leylines during youth.");
    const isNull = Math.random() >= ledger.attunedShare;
    const sparkTier = isNull ? "NULL" : (Math.random() < 0.50 ? "DORMANT_SPARK" : Math.random() < 0.70 ? "SENSITIVE" : "CHANNELER");
    const temper = pickRandom(["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "STOIC", "VENGEFUL", "COMPASSIONATE", "BITTER"], "CURIOUS");
    const instinct = pickRandom(["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL", "DEVOUT"], "WARY");
    const motiv = `Relocated to ${burg.name || 'town'} seeking new trade opportunities and stability.`;
    const wp = getWorkplaceForProfession(profession, burg.name || "Town");
    const motives = deriveCitizenMotives({ profession, temper, instinct, allegiance_status: "CIVILIAN" });

    await client.query(`
        INSERT INTO population_demographics (
            settlement_id, home_cell_id, name, profession, species,
            is_null, spark_tier, attunement_level, chaos_attraction_index,
            temper, instinct, motivation, traits, social_links, allegiance_status,
            unit_size, life_stage, age, childhood_background, is_immigrant,
            workplace_type, workplace_name, want, flaw, line_wont_cross
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13::jsonb, '[]'::jsonb, 'CIVILIAN',
            $18, 'ADULT', $14, $15, TRUE,
            $16, $17, $19, $20, $21
        )
    `, [
        burg.burg_id, burg.cell_id, name, profession, species,
        isNull, sparkTier, isNull ? 0 : 0.3, isNull ? 0 : 2.0,
        temper, instinct, motiv, JSON.stringify([temper, instinct]),
        age, childhood, wp.type, wp.name, ledger.unit,
        motives.want, motives.flaw, motives.lineWontCross
    ]);
}

export async function runBurgOperationsAgent(client: any, tick: number, loreDate: string = "") {
    if (isYearEnd(tick)) {
        // Natural annual maturation: advance all living citizen ages by 1 year (1 year = DAYS_PER_YEAR days)
        // Everyone alive ages, cultists and zealots included (it used to be civilians only)
        await client.query("UPDATE population_demographics SET age = age + 1 WHERE allegiance_status NOT IN ('DECEASED', 'DEPARTED')").catch(() => { });
    }


    const burgRes = await client.query(`
        SELECT b.*, c.faction_id, s.complex_inventory as current_inventory 
        FROM sim_burg_economy b
        LEFT JOIN sim_cells c ON b.cell_id = c.id
        LEFT JOIN sim_industrial_stockpiles s ON b.burg_id = s.burg_id ORDER BY b.burg_id
    `);

    // Each burg's people per citizen record (record_unit). Counting 600k records costs ~200 ms, and
    // density moves slowly, so it is recounted weekly (and for a burg that has none yet) and stored, which
    // also keeps a replay of the day on the same value.
    if (tick % DAYS_PER_WEEK === 0 || burgRes.rows.some((b: any) => b.record_unit == null)) {
        const countRes = await client.query(`
            SELECT settlement_id, COUNT(*)::int AS n FROM population_demographics
            WHERE allegiance_status NOT IN ('DECEASED', 'DEPARTED') GROUP BY settlement_id ORDER BY settlement_id`);
        const living = new Map<number, number>(countRes.rows.map((r: any) => [Number(r.settlement_id), Number(r.n)]));
        for (const b of burgRes.rows) {
            b.record_unit = recordLedger(Number(b.pop_null) || 0, Number(b.pop_attuned) || 0, living.get(Number(b.burg_id)) || 0).unit;
        }
        await client.query(`
            UPDATE sim_burg_economy b SET record_unit = v.unit
            FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS unit) v
            WHERE b.burg_id = v.burg_id`,
            [burgRes.rows.map((b: any) => b.burg_id), burgRes.rows.map((b: any) => b.record_unit)]);
    }

    const burgUpdates: any[] = [];
    const stockpileUpdates: any[] = [];
    const burgEvents: any[] = [];
    const workforceDirtyBurgs = new Set<number>();

    // Load canonical goods & recipes from sim_goods (Ostraka_full.map)
    const goodsRes = await client.query(`SELECT id, name, value, tags, recipes FROM sim_goods ORDER BY id`);
    const goodsById = new Map<number, { id: number; name: string; key: string; value: number; recipes: Array<Record<string, number>> }>();
    const goodKeyById = new Map<number, string>();
    const rawMaterialKeys = new Set<string>();
    const refinedGoodKeys = new Set<string>();
    const advancedGoodKeys = new Set<string>();
    for (const g of goodsRes.rows) {
        const gId = Number(g.id);
        const key = goodKeyFromName(String(g.name || "")) || GOOD_ROLE_BY_ID[gId]?.goodKey || `good_${gId}`;
        let recipes: Array<Record<string, number>> = [];
        try {
            recipes = Array.isArray(g.recipes) ? g.recipes : JSON.parse(g.recipes || "[]");
        } catch {
            recipes = [];
        }
        goodsById.set(gId, { id: gId, name: String(g.name || ""), key, value: Number(g.value) || 1, recipes });
        goodKeyById.set(gId, key);
        const role = GOOD_ROLE_BY_ID[gId];
        if (recipes.length === 0) {
            if (!role?.isFood) rawMaterialKeys.add(key);
        } else if (Number(g.value) >= 12) {
            advancedGoodKeys.add(key);
        } else {
            refinedGoodKeys.add(key);
        }
    }

    // Load real living adult civilian workers grouped by (settlement_id, profession),
    // cached on sim_burg_economy.workforce and recounted weekly (or per-burg when missing/invalidated).
    const isWeeklyWorkforce = tick % DAYS_PER_WEEK === 0;
    const missingWorkforceIds = isWeeklyWorkforce
        ? []
        : burgRes.rows.filter((b: any) => b.workforce == null).map((b: any) => Number(b.burg_id));

    if (isWeeklyWorkforce || missingWorkforceIds.length > 0) {
        const wfRes = isWeeklyWorkforce
            ? await client.query(`
                SELECT settlement_id, COALESCE(profession, '') AS profession, COUNT(*)::int AS active_records, COALESCE(SUM(unit_size), 0)::int AS active_people
                FROM population_demographics
                WHERE life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
                GROUP BY settlement_id, COALESCE(profession, '')
                ORDER BY settlement_id, profession
            `)
            : await client.query(`
                SELECT settlement_id, COALESCE(profession, '') AS profession, COUNT(*)::int AS active_records, COALESCE(SUM(unit_size), 0)::int AS active_people
                FROM population_demographics
                WHERE settlement_id = ANY($1::int[]) AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
                GROUP BY settlement_id, COALESCE(profession, '')
                ORDER BY settlement_id, profession
            `, [missingWorkforceIds]);

        const recountedMap = new Map<number, Record<string, { records: number; people: number }>>();
        const targetRows = isWeeklyWorkforce
            ? burgRes.rows
            : burgRes.rows.filter((b: any) => b.workforce == null);
        for (const b of targetRows) recountedMap.set(Number(b.burg_id), {});
        for (const row of wfRes.rows) {
            const bId = Number(row.settlement_id);
            let rec = recountedMap.get(bId);
            if (!rec) {
                rec = {};
                recountedMap.set(bId, rec);
            }
            rec[String(row.profession || "")] = {
                records: Number(row.active_records) || 0,
                people: Number(row.active_people) || 0
            };
        }
        for (const b of targetRows) {
            b.workforce = recountedMap.get(Number(b.burg_id)) || {};
        }
        if (targetRows.length > 0) {
            await client.query(`
                UPDATE sim_burg_economy b SET workforce = v.wf
                FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::jsonb[]) AS wf) v
                WHERE b.burg_id = v.burg_id`,
                [targetRows.map((b: any) => Number(b.burg_id)), targetRows.map((b: any) => JSON.stringify(b.workforce || {}))]
            );
        }
    }

    const burgWorkforce = new Map<number, Map<string, { records: number; people: number }>>();
    for (const b of burgRes.rows) {
        const bId = Number(b.burg_id);
        const pMap = new Map<string, { records: number; people: number }>();
        let raw = b.workforce;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { raw = {}; }
        }
        if (raw && typeof raw === 'object') {
            for (const [prof, counts] of Object.entries(raw as Record<string, any>)) {
                pMap.set(prof, {
                    records: Number(counts?.records) || 0,
                    people: Number(counts?.people) || 0
                });
            }
        }
        burgWorkforce.set(bId, pMap);
    }

    // Map to accumulate hierarchical shipments from downstream hamlets/villages/towns
    const incomingTributes = new Map<number, { food: number; wealth: number }>();

    // ── MACRO WEATHER & COSMIC INSTABILITY LOOKUPS ───────────────────────────
    const calRes = await client.query("SELECT season, month_name, active_flow FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const currentSeason = calRes.rows[0]?.season || "Greenspan";

    // Ambient Chaos Blight intensity per cell
    const chaosRes = await client.query("SELECT cell_id, intensity FROM sim_chaos_zones WHERE intensity >= 60");
    const chaosIntensityMap = new Map<number, number>();
    for (const r of chaosRes.rows) {
        chaosIntensityMap.set(Number(r.cell_id), Math.max(chaosIntensityMap.get(Number(r.cell_id)) || 0, Number(r.intensity) || 0));
    }

    // Trade Blockades & Mercantile Embargoes (Gilded Compass sanctions)
    const sectorBlockadeMap = new Map<number, boolean>();
    for (const [cellId, tags] of await loadCellTagMap(client)) {
        if (tags.some((t: string) => t.includes("Blockade") || t.includes("Embargo"))) sectorBlockadeMap.set(cellId, true);
    }

    const infraRes = await client.query("SELECT burg_id, type, level FROM sim_infrastructure");
    const burgInfraMap = new Map<number, Map<string, number>>();
    for (const row of infraRes.rows) {
        if (!burgInfraMap.has(row.burg_id)) burgInfraMap.set(row.burg_id, new Map());
        burgInfraMap.get(row.burg_id)!.set(row.type, Number(row.level) || 1);
    }
    const cellEcoDeltas = new Map<number, number>();

    // ── ACTIVE CONSTRUCTION PROJECTS PIPELINE (sim_active_projects) ──────────
    await client.query("UPDATE sim_active_projects SET ticks_remaining = ticks_remaining - 1").catch(() => { });
    const completedProjects = await client.query("SELECT * FROM sim_active_projects WHERE ticks_remaining <= 0 ORDER BY id").catch(() => ({ rows: [] }));
    for (const proj of completedProjects.rows) {
        if (proj.project_type === 'URBAN_TIER') {
            await client.query("UPDATE sim_burg_economy SET urban_tier = $1 WHERE burg_id = $2", [proj.target_tier, proj.burg_id]).catch(() => { });
            const tierName = proj.target_tier === 2 ? 'Village' : proj.target_tier === 3 ? 'Town' : proj.target_tier === 4 ? 'City' : 'Metropolis';
            burgEvents.push({
                tick,
                type: 'BURG_URBAN_GROWTH',
                message: `Construction completed in burg ${proj.burg_id}: officially elevated to Tier ${proj.target_tier} (${tierName})! New artisan workshops and civil infrastructure erected.`,
                tier: 'MAJOR',
                burg_id: proj.burg_id,
                lore_date: loreDate
            });
        }
    }
    await client.query("DELETE FROM sim_active_projects WHERE ticks_remaining <= 0").catch(() => { });

    const activeProjectsRes = await client.query("SELECT burg_id, project_type FROM sim_active_projects").catch(() => ({ rows: [] }));
    const activeProjectsSet = new Set(activeProjectsRes.rows.map((p: any) => `${p.burg_id}_${p.project_type}`));

    for (const burg of burgRes.rows) {
        const pop = burg.pop_null || 0;
        const ledger = ledgerFor(burg);
        let departedDead = 0, departedLeft = 0;
        let urbanTier = burg.urban_tier || 1;
        const gatherRate = 1 + urbanTier;

        // Real living adult workforce in this burg
        const profMap = burgWorkforce.get(Number(burg.burg_id)) || new Map<string, { records: number; people: number }>();
        let wCivil = 0, wSec = 0, wSoc = 0, craftedCount = 0, totalActiveRecords = 0;
        for (const [prof, counts] of profMap.entries()) {
            totalActiveRecords += counts.records;
            if (CIVIC_PROFESSIONS.has(prof)) wCivil += counts.records;
            else if (SECURITY_PROFESSIONS.has(prof)) wSec += counts.records;
            else if (SOCIAL_SPIRITUAL_PROFESSIONS.has(prof)) wSoc += counts.records;
            else if (["Armorer", "Blacksmith", "Tanner", "Weaver", "Potter", "Foundry Worker", "Alchemist", "Goldsmith", "Brewmaster", "Baker"].includes(prof)) {
                craftedCount += counts.records;
            }
        }
        const fullBlocks = Math.max(0, Math.floor(totalActiveRecords / 12));

        let inventory: Record<string, number> = {};
        try {
            inventory = typeof burg.current_inventory === 'string'
                ? JSON.parse(burg.current_inventory)
                : { ...(burg.current_inventory || {}) };
        } catch (e) {
            inventory = {};
        }
        const systemicEffects = evaluateBurgInventoryEffects(inventory);

        const currentUnrest = Number(burg.unrest || 0);
        const currentCrime = Number(burg.crime_rate || 0);
        const currentHealth = Number(burg.health ?? 100);
        const chaosIntensity = chaosIntensityMap.get(Number(burg.cell_id)) || 0;

        // Deterministic worker hindrance from occupation, riots, illness, or chaos blight
        let workEfficiency = 1.0;
        if (burg.occupier_faction_id) workEfficiency *= 0.50;
        if (currentUnrest >= 80) workEfficiency *= 0.25;
        else if (currentUnrest >= 60) workEfficiency *= 0.60;
        if (currentHealth < 40) workEfficiency *= 0.50;
        else if (currentHealth < 65) workEfficiency *= 0.80;
        if (chaosIntensity >= 70) workEfficiency *= Math.max(0.25, 1 - (chaosIntensity / 100) * 0.50);
        workEfficiency = Math.max(0.1, Math.min(1.0, workEfficiency));

        // Seasonal agricultural factor
        const isWinterFreeze = seasonKind(currentSeason) === "Winter" || currentSeason === SHADOWFALL || (burg.current_temp !== undefined && Number(burg.current_temp) < 0);
        const winterFloor = Math.min(0.85, 0.35 + (systemicEffects.winterResilience * 0.05));
        const seasonMod = isWinterFreeze ? winterFloor : (currentSeason === "Dryspell" ? 1.45 : (seasonKind(currentSeason) === "Spring" ? 1.20 : (currentSeason === "Cropfade" ? 0.8 : 1.0)));

        // Parse primary extraction & crafted workshop profile from Ostraka_full.map
        let profile: { primary?: Array<{ goodId: number; key: string; share: number }>; crafted?: Array<{ goodId: number; key: string; targetOutput: number }> } = {};
        try {
            if (burg.resource_profile) {
                profile = typeof burg.resource_profile === 'string' ? JSON.parse(burg.resource_profile) : burg.resource_profile;
            }
        } catch (e) { }

        const primarySlots = Array.isArray(profile.primary) && profile.primary.length > 0
            ? profile.primary
            : [
                { goodId: 9, key: "grain", share: 0.6 },
                { goodId: 1, key: "wood", share: 0.4 }
            ];
        const craftedSlots = Array.isArray(profile.crafted) && profile.crafted.length > 0
            ? profile.crafted
            : (Array.isArray(burg.production) ? burg.production : []).map(([gid, out]: [number, number]) => ({
                goodId: Number(gid),
                key: goodKeyById.get(Number(gid)) || goodKeyFromName(GOOD_ROLE_BY_ID[Number(gid)]?.goodKey || ""),
                targetOutput: Number(out) || 1
            })).filter((c: any) => c.goodId > 0 && c.key);

        // --- CITIZEN-BACKED PRIMARY GATHERING (NO WORKER = NO RESOURCE) ---
        let foodProduced = 0;
        const requiredInfraBuilds = new Map<string, number>();
        const primaryByProfession = new Map<string, Array<{ goodId: number; key: string; share: number }>>();
        for (const slot of primarySlots) {
            const role = getProfessionForGood(Number(slot.goodId));
            const list = primaryByProfession.get(role.profession) || [];
            list.push({ goodId: Number(slot.goodId), key: slot.key || role.goodKey, share: Math.max(0.01, Number(slot.share) || 0.1) });
            primaryByProfession.set(role.profession, list);
        }

        const bInfra = burgInfraMap.get(burg.burg_id) || new Map<string, number>();
        for (const [profName, slotsForProf] of primaryByProfession.entries()) {
            const profRecords = profMap.get(profName)?.records || 0;
            if (profRecords <= 0) continue; // No living workers -> strictly 0 output

            const sortedSlots = slotsForProf.slice().sort((a, b2) => a.goodId - b2.goodId);
            const totalShare = sortedSlots.reduce((s, x) => s + x.share, 0) || 1;
            const allocs = sortedSlots.map((s) => {
                const exact = profRecords * (s.share / totalShare);
                const base = Math.floor(exact);
                return { slot: s, count: base, frac: exact - base };
            });
            let rem = profRecords - allocs.reduce((s, a) => s + a.count, 0);
            const byFrac = allocs.slice().sort((a, b2) => (b2.frac - a.frac) || (a.slot.goodId - b2.slot.goodId));
            for (let k = 0; k < rem && byFrac.length > 0; k++) {
                byFrac[k % byFrac.length]!.count++;
            }

            for (const { slot, count } of allocs) {
                if (count <= 0) continue;
                const role = getProfessionForGood(slot.goodId);
                const reqInfra = role.infraType === "WORKSHOP" ? "CAMP" : role.infraType;
                const infraLevel = bInfra.get(reqInfra) || 0;
                const infraCap = infraLevel * 10;
                const covered = Math.min(count, infraCap);
                const uncovered = Math.max(0, count - infraCap);

                const seasonFactor = (role.infraType === "FARM" || role.isFood) ? seasonMod : 1.0;
                const basePerRecord = 1.0 + urbanTier * 0.5;
                const yieldAmt = Math.floor((covered * 2 + uncovered) * workEfficiency * seasonFactor * basePerRecord);
                if (yieldAmt > 0) {
                    inventory[slot.key] = (inventory[slot.key] || 0) + yieldAmt;
                    if (role.isFood) {
                        foodProduced += Math.round(yieldAmt * Math.max(8, role.foodNutrition) * 1.6);
                    }
                }
                if (uncovered > 0 && burg.cell_id) {
                    cellEcoDeltas.set(burg.cell_id, (cellEcoDeltas.get(burg.cell_id) || 0) + uncovered);
                    requiredInfraBuilds.set(reqInfra, (requiredInfraBuilds.get(reqInfra) || 0) + uncovered);
                }
            }
        }

        // Millers & Bakers add provisioning efficiency only when living food gatherers produced food
        if (foodProduced > 0) {
            const foodProcessors = (profMap.get("Baker")?.records || 0) + (profMap.get("Grain Miller")?.records || 0);
            foodProduced += Math.floor(foodProcessors * 12 * workEfficiency * seasonMod);
        }

        // Artisanal wealth calculation backed by living crafters & civic workers:
        const luxRevenue = Math.floor(craftedCount * workEfficiency * 0.12 * (1 + urbanTier * 0.20));
        const municipalCosts = Math.floor(wCivil * 0.04 + wSec * 0.04 + urbanTier * 2);
        let wealthDelta = Math.max(-8, Math.min(25, luxRevenue - municipalCosts));

        let foodDelta = foodProduced - pop;

        // --- CONTROLLED INSTABILITY 2: TRADE EMBARGO VS COMMERCIAL GRAIN RELIEF ---
        const isTradeBlockaded = sectorBlockadeMap.get(Number(burg.cell_id)) || false;
        const factionId = burg.occupier_faction_id || burg.faction_id;

        if ((burg.food || 0) + foodDelta < pop * 2) {
            const deficit = Math.round(pop * 2 - ((burg.food || 0) + foodDelta));
            const breadbasket = burgRes.rows.find((b: any) =>
                b.burg_id !== burg.burg_id &&
                (factionId ? (b.occupier_faction_id || b.faction_id) === factionId : true) &&
                (b.food || 0) > (b.pop_null || 100) * 8
            );
            if (breadbasket && !isTradeBlockaded) {
                const grainRelief = Math.min(deficit, Math.floor(((breadbasket.food || 0) - (breadbasket.pop_null || 100) * 4) * 0.15));
                if (grainRelief > 0) {
                    foodDelta += grainRelief;
                    breadbasket.food = Math.max(0, (breadbasket.food || 0) - grainRelief);
                }
            } else if (isTradeBlockaded) {
                wealthDelta = Math.min(0, wealthDelta - 4);
            } else if ((burg.wealth || 0) > 25) {
                const affordableGrain = Math.min(deficit, ((burg.wealth || 0) - 25) * 25);
                if (affordableGrain > 0) {
                    foodDelta += affordableGrain;
                    wealthDelta -= Math.ceil(affordableGrain / 25);
                }
            }
        }

        // Hierarchical resource shipments to upstream hub
        if (burg.upstream_burg_id) {
            const shipRate = burg.parent_burg_id ? 0.25 : (urbanTier === 1 ? 0.20 : (urbanTier === 2 ? 0.15 : 0.10));
            const foodShipment = foodDelta > 0 ? Math.floor(foodDelta * shipRate) : 0;
            const wealthShipment = wealthDelta > 0 ? Math.floor(wealthDelta * shipRate) : 0;

            if (foodShipment > 0 || wealthShipment > 0) {
                foodDelta -= foodShipment;
                wealthDelta -= wealthShipment;
                const existing = incomingTributes.get(burg.upstream_burg_id) || { food: 0, wealth: 0 };
                existing.food += foodShipment;
                existing.wealth += wealthShipment;
                incomingTributes.set(burg.upstream_burg_id, existing);
            }
        }

        // Incorporate incoming shipments from downstream tributaries
        const receivedTribute = incomingTributes.get(burg.burg_id);
        if (receivedTribute) {
            foodDelta += receivedTribute.food;
            wealthDelta += receivedTribute.wealth;
        }

        // MILITARY POPULATION & CONSUMPTION
        let military: any = {};
        try {
            if (burg.military_forces) {
                const parsedMil = typeof burg.military_forces === 'string' ? JSON.parse(burg.military_forces) : burg.military_forces;
                for (const k in parsedMil) military[k.toLowerCase()] = parsedMil[k];
            }
        } catch (e) { }

        const milInfantry = (military.infantry || military.footmen || military.militia || 0);
        const milRanged = (military.ranged || military.archers || 0);
        const milMounted = (military.mounted || military.cavalry || 0);
        const milAirship = (military.airship || 0);
        const milMage = (military.mage || 0);

        let milRationUpkeep = Math.round(
            milInfantry * 1.2 +
            milRanged * 1.2 +
            milMounted * 2.0 +
            milAirship * 2.5 +
            milMage * 2.0
        );

        foodDelta -= milRationUpkeep;

        let popNullDelta = 0;
        let popAttunedDelta = 0;

        // Authentic civil equilibrium:
        let healthDelta = Math.min(4, Math.max(-4, Math.floor(wCivil * 0.08) - ((burg.health || 100) > 80 ? 0 : 1) + systemicEffects.healthDelta));

        let baseUnrestDelta = 0;
        const isWellFed = (burg.food || 0) + foodDelta >= pop * 1.1;
        const isHealthy = currentHealth >= 50;
        const isLowCrime = currentCrime < 45;

        if (isWellFed && isHealthy && isLowCrime) {
            baseUnrestDelta = -Math.max(1, Math.floor(wSoc * 0.05));
            if (currentUnrest > 50) baseUnrestDelta -= 2;
            else if (currentUnrest > 35) baseUnrestDelta -= 1;
        } else if ((burg.food || 0) + foodDelta < pop * 0.5) {
            baseUnrestDelta = +2;
        }

        if (currentCrime >= 60) {
            baseUnrestDelta += 1;
        }

        if (currentUnrest > 60) {
            baseUnrestDelta -= 2;
        } else if (currentUnrest > 50) {
            baseUnrestDelta -= 1;
        }

        let unrestDelta = Math.min(6, Math.max(-6, baseUnrestDelta + systemicEffects.unrestDelta));
        let crimeDelta = Math.min(4, Math.max(-4, -Math.floor(wSec * 0.08) + (currentUnrest > 70 ? 1 : 0) + systemicEffects.crimeDelta));

        // Death and Desertion from Starvation
        let starvationDeaths = 0;
        let militaryDesertions = 0;
        let banditDefectors = 0;
        if ((burg.food || 0) + foodDelta < 0) {
            healthDelta -= 3;
            unrestDelta += 4;
            crimeDelta += 3;

            let shortfall = Math.abs((burg.food || 0) + foodDelta);
            for (const type of Object.keys(military)) {
                if (military[type] > 0 && shortfall > 0) {
                    let desertion = Math.min(military[type], Math.ceil(shortfall / 200));
                    military[type] -= desertion;
                    shortfall -= desertion * 200;
                    militaryDesertions += desertion;
                }
            }

            if (shortfall > 0) {
                starvationDeaths = Math.min(burg.pop_null || 0, Math.floor(shortfall * 0.001));
                banditDefectors = Math.min(Math.floor((burg.pop_null || 0) * 0.04), Math.max(0, Math.floor(shortfall * 0.004)));
            }
        }

        if (chaosIntensity >= 70) {
            healthDelta -= Math.floor((chaosIntensity - 55) * 0.12);
            unrestDelta += Math.floor((chaosIntensity - 55) * 0.15);
        }

        // --- AUTHENTIC LORE COMMODITY SYSTEMIC EFFECTS ---
        if (chaosIntensity >= 70 && ((inventory['aether_clear'] as number) || (inventory['chaos_resistant_compound'] as number) || 0) >= 1) {
            if (inventory['aether_clear']) inventory['aether_clear'] -= 1;
            else inventory['chaos_resistant_compound'] = Math.max(0, (inventory['chaos_resistant_compound'] || 0) - 1);
            healthDelta += 2;
            unrestDelta = Math.max(-2, unrestDelta - 2);
        }

        if ((burg.health || 100) < 55 && ((inventory['grave_berries'] as number) || (inventory['sumpkin_pharmaceutical_chems'] as number) || 0) >= 1) {
            if (inventory['grave_berries']) inventory['grave_berries'] -= 1;
            else inventory['sumpkin_pharmaceutical_chems'] = Math.max(0, (inventory['sumpkin_pharmaceutical_chems'] || 0) - 1);
            healthDelta += 3;
            unrestDelta -= 1;
        }

        if (((inventory['perfume'] as number) || 0) >= 2) {
            crimeDelta = Math.max(-3, crimeDelta - 1);
            if (currentUnrest > 45) unrestDelta -= 1;
        }

        // Auto-build infrastructure to halt ecological bleeding
        for (const [infraType, deficit] of requiredInfraBuilds.entries()) {
            if (deficit >= 10 && (inventory['wood'] || 0) >= 20 && (burg.wealth || 0) >= 20) {
                inventory['wood'] = Math.max(0, (inventory['wood'] || 0) - 20);
                await client.query(`
                    INSERT INTO sim_infrastructure (burg_id, cell_id, type, level)
                    VALUES ($1, $2, $3, 1)
                    ON CONFLICT (burg_id, type) DO UPDATE SET level = sim_infrastructure.level + 1
                `, [burg.burg_id, burg.cell_id, infraType]).catch(() => { });
                await client.query("UPDATE sim_cells SET eco_max = GREATEST(10, eco_max - 1) WHERE id = $1", [burg.cell_id]).catch(() => { });
            }
        }

        // --- CITIZEN-BACKED RECIPE CRAFTING (INPUTS + CRAFTERS REQUIRED) ---
        let workshopShortageLogged = false;
        for (const cSlot of craftedSlots) {
            const g = goodsById.get(Number(cSlot.goodId));
            const role = getProfessionForGood(Number(cSlot.goodId));
            const crafterRecords = profMap.get(role.profession)?.records || 0;
            if (crafterRecords <= 0 || !g || !Array.isArray(g.recipes) || g.recipes.length === 0) continue;

            const maxBatches = Math.max(1, Math.floor(crafterRecords * workEfficiency * (0.25 + urbanTier * 0.15)));
            let remainingBatches = Math.min(maxBatches, Math.max(2, Math.ceil((Number(cSlot.targetOutput) || 2) * 3)));
            let craftedTotal = 0;

            for (const recipeObj of g.recipes) {
                if (remainingBatches <= 0 || !recipeObj || typeof recipeObj !== 'object') break;
                const inputs = Object.entries(recipeObj)
                    .map(([idStr, req]) => {
                        const iId = Number(idStr);
                        const iKey = goodKeyById.get(iId) || goodKeyFromName(GOOD_ROLE_BY_ID[iId]?.goodKey || "");
                        return { id: iId, key: iKey, req: Number(req) || 0 };
                    })
                    .filter((x) => x.id > 0 && x.key && x.req > 0)
                    .sort((a, b2) => a.id - b2.id);

                if (inputs.length === 0) continue;
                let canMake = remainingBatches;
                for (const inp of inputs) {
                    canMake = Math.min(canMake, Math.floor((inventory[inp.key] || 0) / inp.req));
                }
                if (canMake > 0) {
                    for (const inp of inputs) {
                        const spent = Math.max(1, Math.round(canMake * inp.req));
                        inventory[inp.key] = Math.max(0, (inventory[inp.key] || 0) - spent);
                    }
                    inventory[g.key] = (inventory[g.key] || 0) + canMake;
                    craftedTotal += canMake;
                    remainingBatches -= canMake;
                }
            }

            if (craftedTotal > 0 && role.isFood) {
                foodProduced += craftedTotal * Math.max(8, role.foodNutrition);
            } else if (craftedTotal === 0 && !workshopShortageLogged && (tick + burg.burg_id) % 30 === 0) {
                workshopShortageLogged = true;
                const neededNames = Object.keys(g.recipes[0] || {})
                    .map((idStr) => goodsById.get(Number(idStr))?.name || idStr)
                    .join(", ");
                burgEvents.push({
                    tick,
                    type: 'WORKSHOP_INPUT_SHORTAGE',
                    message: `${role.profession} workshops in ${burg.name} stalled on ${g.name}: awaiting inputs (${neededNames}).`,
                    tier: 'MINOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
            }
        }

        // --- FACTION-SPECIFIC SIGNATURE COMMODITY PRODUCTION (STRICT INPUT GATE) ---
        const factionSpecialty = getFactionSpecialty(factionId);
        if (factionSpecialty && totalActiveRecords >= 5) {
            const inputs = factionSpecialty.requiredRawInputs || [];
            const maxBatches = Math.max(1, Math.floor(totalActiveRecords * workEfficiency / 20));
            let possibleBatches = maxBatches;

            for (const input of inputs) {
                const stock = (inventory[input.resource] || 0) as number;
                const canMake = Math.floor(stock / Math.max(0.25, input.count));
                possibleBatches = Math.min(possibleBatches, canMake);
            }

            if (possibleBatches > 0) {
                const actualBatches = Math.min(maxBatches, possibleBatches);
                for (const input of inputs) {
                    const spent = Math.max(1, Math.round(input.count * actualBatches));
                    inventory[input.resource] = Math.max(0, (inventory[input.resource] || 0) - spent);
                }
                const producedSignatureGoods = actualBatches * factionSpecialty.outputPerBatch;
                inventory[factionSpecialty.uniqueGood] = (inventory[factionSpecialty.uniqueGood] || 0) + producedSignatureGoods;

                if ((tick + burg.burg_id) % 30 === 0) {
                    await tagBurgCitizens(
                        client,
                        burg.burg_id,
                        [factionSpecialty.artisanPersonaTag],
                        'FOCUSED',
                        `Practicing ${factionSpecialty.specialtyName} using traditional ${factionSpecialty.harvestMethod.toLowerCase()}.`,
                        null,
                        2
                    ).catch(() => { });
                }
            }
        }

        const consumeSpecific = (poolType: "raw" | "refined" | "crafted", amount: number) => {
            let remaining = amount;
            const targetSet = poolType === "raw" ? rawMaterialKeys : (poolType === "refined" ? refinedGoodKeys : advancedGoodKeys);
            const keys = Object.keys(inventory)
                .filter((k) => targetSet.has(k) && (inventory[k] || 0) > 0)
                .sort((a, b) => ((inventory[b] || 0) - (inventory[a] || 0)) || a.localeCompare(b));
            for (const k of keys) {
                if (remaining <= 0) break;
                const take = Math.min(inventory[k] || 0, remaining);
                inventory[k] = (inventory[k] || 0) - take;
                remaining -= take;
            }
            return remaining;
        };

        const tryConsume = (acceptableKeys: string[], amount: number) => {
            let remaining = amount;
            for (const key of acceptableKeys) {
                if (remaining <= 0) break;
                if (inventory[key] && inventory[key] > 0) {
                    const take = Math.min(inventory[key], remaining);
                    inventory[key] -= take;
                    remaining -= take;
                }
            }
            return remaining;
        };

        // --- INFRASTRUCTURE MAINTENANCE ---
        let failedMaint = 0;
        if (urbanTier === 2) failedMaint = consumeSpecific("raw", fullBlocks);
        else if (urbanTier === 3) failedMaint = consumeSpecific("refined", fullBlocks);
        else if (urbanTier >= 4) failedMaint = consumeSpecific("crafted", fullBlocks);

        if (failedMaint > 0) {
            healthDelta -= 1;
            if (failedMaint > 5) unrestDelta += 1;
        }

        // --- MILITARY MAINTENANCE ---
        let supplyDeficit = 0;
        supplyDeficit += tryConsume(["arms", "leather", "tools", "iron"], military.infantry || 0);
        supplyDeficit += tryConsume(["arms", "wood", "leather", "ropes"], military.ranged || 0);
        supplyDeficit += tryConsume(["horses", "camels", "tack", "leather"], military.mounted || 0);
        supplyDeficit += tryConsume(["aether_skiffs", "sails", "ropes", "tar", "dragonstone"], military.airship || 0);
        supplyDeficit += tryConsume(["aether_clear", "incense", "wine", "candles"], military.mage || 0);

        if (supplyDeficit > 0) {
            if (supplyDeficit > 10) unrestDelta += 1;
            if (supplyDeficit >= 15 && (tick + burg.burg_id) % 15 === 0) {
                const deserters = Math.min(4, Math.floor(supplyDeficit * 0.05));
                if (deserters > 0) {
                    await client.query(`
                        UPDATE sim_outlaw_factions 
                        SET manpower = LEAST(2500, manpower + $1) 
                        WHERE id = (SELECT id FROM sim_outlaw_factions WHERE manpower < 2500 ORDER BY ${sqlShuffle("id")} LIMIT 1)
                    `, [deserters]).catch(() => { });
                }
            }
        }

        // --- TIER 1 & TIER 2 CIVILIAN COMFORT & LUXURY NEEDS ---
        if (pop > 5000) {
            const neededComfort = Math.ceil((pop - 5000) / 1000);
            const comfortDeficit = tryConsume(["garments", "cloth", "boots", "soap", "aether_clear", "grave_berries"], neededComfort);
            if (comfortDeficit > 5) {
                healthDelta -= 1;
                if (comfortDeficit > 15) unrestDelta += 1;
            }
        }
        if (pop > 20000) {
            const neededLuxury = Math.ceil((pop - 20000) / 2000);
            const luxuryDeficit = tryConsume(["wine", "beer", "liquor", "jewelry", "ceramics", "perfume", "candles", "tea"], neededLuxury);
            if (luxuryDeficit > 10 && currentUnrest < 35) {
                unrestDelta += 1;
            }
        }

        // --- THE OCCUPATION & RESISTANCE LOOP ---
        if (burg.occupier_faction_id) {
            let occTicks = (burg.occupation_ticks || 0) + 1;
            let resPwr = burg.resistance_strength || 50;

            // Narcotic / munitions contraband fuels resistance
            if ((burg.crime_rate || 0) > 20 && ((inventory['narcotic'] || 0) >= 5 || (inventory['poison'] || 0) >= 5)) {
                if (inventory['narcotic']) inventory['narcotic'] = Math.max(0, inventory['narcotic'] - 5);
                resPwr += 15;
            }

            // Occupier suppression tactic (Brutal crackdown vs Hearts and Minds)
            const occLeaderRes = await client.query(`
                SELECT traits FROM sim_paragons 
                WHERE faction_id = $1 AND title IN ('Mayor', 'Marshal', 'Commander', 'Baron')
                LIMIT 1
            `, [burg.occupier_faction_id]).catch(() => ({ rows: [] }));
            const occTraits = occLeaderRes.rows[0]?.traits || [];
            const isBrutal = Array.isArray(occTraits) && (occTraits.includes('Bloodthirsty') || occTraits.includes('Paranoid') || occTraits.includes('Ruthless'));

            if (isBrutal) {
                // Mass Executions
                popNullDelta -= 25;
                departedDead += 25;
                resPwr = Math.max(0, resPwr - 15);
                if (Math.random() < 0.15) {
                    burgEvents.push({
                        tick,
                        type: 'MASS_EXECUTION',
                        message: `Occupying garrison executed suspected resistance sympathizers in ${burg.name} in a brutal curfew raid.`,
                        tier: 'MINOR',
                        burg_id: burg.burg_id,
                        lore_date: loreDate
                    });
                }
            } else {
                // Hearts and minds grain relief
                if ((inventory['grain'] || 0) >= 40) {
                    inventory['grain'] = Math.max(0, (inventory['grain'] || 0) - 40);
                    resPwr = Math.max(0, resPwr - 20);
                } else {
                    resPwr += 10;
                }
            }

            // Daily Riot Collision
            let curFootmen = military.infantry || military.footmen || 0;
            const riotDeaths = Math.floor(resPwr * 0.05);
            popNullDelta -= riotDeaths;
            departedDead += riotDeaths;
            curFootmen = Math.max(0, curFootmen - Math.floor(resPwr * 0.15));
            if (military.infantry !== undefined) military.infantry = curFootmen;
            else military.footmen = curFootmen;

            // Liberation vs Annexation
            if (curFootmen <= 0) {
                await client.query("UPDATE sim_cells SET faction_id = NULL WHERE id = $1", [burg.cell_id]).catch(() => { });
                await client.query("UPDATE sim_burg_economy SET occupier_faction_id = NULL, occupation_ticks = 0, resistance_strength = 0 WHERE burg_id = $1", [burg.burg_id]).catch(() => { });
                burg.occupier_faction_id = null;
                burg.occupation_ticks = 0;
                burg.resistance_strength = 0;
                if (military.infantry !== undefined) military.infantry = 100;
                else military.footmen = 100;
                burgEvents.push({
                    tick,
                    type: 'LIBERATION',
                    message: `Citizens of ${burg.name} successfully overwhelmed the occupying garrison and proclaimed self-liberation!`,
                    tier: 'MAJOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
            } else if (occTicks >= 28) {
                await client.query("UPDATE sim_cells SET faction_id = $1 WHERE id = $2", [burg.occupier_faction_id, burg.cell_id]);
                await client.query("UPDATE sim_burg_economy SET occupier_faction_id = NULL, occupation_ticks = 0, resistance_strength = 0 WHERE burg_id = $1", [burg.burg_id]);
                burgEvents.push({
                    tick,
                    type: 'CONQUEST',
                    message: `Occupying forces pacified all resistance in ${burg.name}. The settlement was officially annexed into Faction ${burg.occupier_faction_id}.`,
                    tier: 'MAJOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                burg.occupier_faction_id = null;
                burg.occupation_ticks = 0;
                burg.resistance_strength = 0;
            } else {
                burg.occupation_ticks = occTicks;
                burg.resistance_strength = resPwr;
                await client.query("UPDATE sim_burg_economy SET occupation_ticks = $1, resistance_strength = $2 WHERE burg_id = $3", [occTicks, resPwr, burg.burg_id]).catch(() => { });
            }
        }

        let newWealth = Math.floor(Math.max(0, (burg.wealth || 0) + wealthDelta));

        // --- 2-RESOURCE REQUIREMENT & URBAN UPGRADES ---
        // Pop thresholds: T1->T2 (1,200 pop), T2->T3 (4,500 pop), T3->T4 (12,000 pop)
        const popThreshold = urbanTier === 1 ? 1200 : urbanTier === 2 ? 4500 : urbanTier === 3 ? 12000 : 999999;

        // Initial fallback from biome if architecture_type is unset or generic
        let archType = burg.architecture_type;
        if (!archType || archType === 'MIXED') {
            const bId = Number(burg.biome ?? 4);
            if ([1, 2, 12].includes(bId)) archType = 'CLAY';
            else if ([0, 10, 11].includes(bId)) archType = 'STONE';
            else archType = 'WOOD';
        }

        if (pop >= popThreshold) {
            const getBest = (mats: string[], req: number) => {
                let best: string | null = null;
                let max = -1;
                for (const m of mats) {
                    const amt = (inventory[m] || 0) as number;
                    if (amt >= req && amt > max) { best = m; max = amt; }
                }
                return best;
            };

            const deductMat = (m: string, amt: number) => {
                if ((inventory[m] || 0) >= amt) {
                    inventory[m] = Math.max(0, (inventory[m] || 0) - amt);
                }
            };

            const t1 = ['wood', 'stone', 'clay'];
            const t2 = ['coal', 'leather', 'cloth', 'bronze', 'tools', 'ceramics', 'glass', 'tar'];
            const t3 = ['mahogany', 'marble', 'garments', 'jewelry', 'artillery', 'sheet_metal', 'stone_root_timber', 'books'];

                // Helper to check for signature commodities by category
                const checkCategoryCommodity = (cat: CommodityCategory, minRequired: number): string | null => {
                    const candidates = getGoodsByCategory(cat);
                    for (const goodKey of candidates) {
                        if (((inventory[goodKey] as number) || 0) >= minRequired) {
                            return goodKey;
                        }
                    }
                    return null;
                };

                if (urbanTier === 1 && newWealth >= 100 && !activeProjectsSet.has(`${burg.burg_id}_URBAN_TIER`)) {
                    const b1 = getBest(t1, 100);
                    const b2 = getBest(t2, 50);
                    // Tier 1 -> 2 requires basic materials PLUS at least 15 units of a PRESERVATION or LOGISTICS commodity
                    const presGood = checkCategoryCommodity("PRESERVATION", 15) || checkCategoryCommodity("LOGISTICS", 15);

                    if (b1 && b2 && presGood) {
                        deductMat(b1, 100);
                        deductMat(b2, 50);
                        deductMat(presGood, 15);
                        newWealth -= 100;
                        archType = b1.toUpperCase(); // 'WOOD', 'STONE', or 'CLAY'
                        await client.query(`
                        INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining)
                        VALUES ($1, 'URBAN_TIER', 2, 20)
                    `, [burg.burg_id]).catch(() => { });
                        activeProjectsSet.add(`${burg.burg_id}_URBAN_TIER`);
                        burgEvents.push({
                            tick,
                            type: 'PROJECT_COMMENCED',
                            message: `Municipal expansion begun in ${burg.name}: construction crews commenced Village fortification and masonry works utilizing ${presGood.replace(/_/g, " ")} (20 days).`,
                            tier: 'MINOR',
                            burg_id: burg.burg_id,
                            lore_date: loreDate
                        });
                    } else if (b1 && b2 && !presGood && (tick + burg.burg_id) % 25 === 0) {
                        burgEvents.push({
                            tick,
                            type: 'COMMODITY_SHORTAGE_STALL',
                            message: `📦 TRADE REQUISITION: Town charter in ${burg.name} stalled! Builders require preservation/logistics imports (Salt, Pitch, or Amber-Grain) from regional trading partners.`,
                            tier: 'MINOR',
                            burg_id: burg.burg_id,
                            lore_date: loreDate
                        });
                    }
                } else if (urbanTier === 2 && newWealth >= 200 && !activeProjectsSet.has(`${burg.burg_id}_URBAN_TIER`)) {
                    const b2 = getBest(t2, 200);
                    const b3 = getBest(t3, 50);
                    // Tier 2 -> 3 requires refined materials PLUS 20 units of STRUCTURAL and 20 units of FOUNDATION
                    const structGood = checkCategoryCommodity("STRUCTURAL", 20);
                    const foundGood = checkCategoryCommodity("FOUNDATION", 20);

                    if (b2 && b3 && structGood && foundGood) {
                        deductMat(b2, 200);
                        deductMat(b3, 50);
                        deductMat(structGood, 20);
                        deductMat(foundGood, 20);
                        newWealth -= 200;
                        archType = ['tar', 'leather', 'cloth'].includes(b2) ? 'WOOD' : ['glass', 'tools', 'bronze'].includes(b2) ? 'STONE' : 'CLAY';
                        await client.query(`
                        INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining)
                        VALUES ($1, 'URBAN_TIER', 3, 20)
                    `, [burg.burg_id]).catch(() => { });
                        activeProjectsSet.add(`${burg.burg_id}_URBAN_TIER`);
                        burgEvents.push({
                            tick,
                            type: 'PROJECT_COMMENCED',
                            message: `Urban charter expansion begun in ${burg.name}: master builders commenced Town guildhalls and stone ramparts utilizing ${structGood.replace(/_/g, " ")} and ${foundGood.replace(/_/g, " ")} (20 days).`,
                            tier: 'MINOR',
                            burg_id: burg.burg_id,
                            lore_date: loreDate
                        });
                    } else if (b2 && b3 && (!structGood || !foundGood) && (tick + burg.burg_id) % 25 === 0) {
                        const missing = !structGood && !foundGood ? "structural alloy and foundation mortar" : !structGood ? "structural alloy/ironwood" : "hydraulic foundation mortar";
                        burgEvents.push({
                            tick,
                            type: 'COMMODITY_SHORTAGE_STALL',
                            message: `🏛️ ARCHITECTURAL IMPASSE: City wall construction in ${burg.name} halted! Master masons lack required ${missing} from foreign trade partners.`,
                            tier: 'MINOR',
                            burg_id: burg.burg_id,
                            lore_date: loreDate
                        });
                    }
                } else if (urbanTier === 3 && newWealth >= 500 && !activeProjectsSet.has(`${burg.burg_id}_URBAN_TIER`)) {
                    const b3 = getBest(t3, 300);
                    const lux = (inventory['jewelry'] || 0) + (inventory['perfume'] || 0) + (inventory['wine'] || 0) + (inventory['candles'] || 0) + (inventory['tea'] || 0);
                    const advGood = checkCategoryCommodity("ADVANCED", 25);
                    const metaGood = checkCategoryCommodity("METAPHYSICAL", 20) || checkCategoryCommodity("HEALTH", 20) || checkCategoryCommodity("ENERGY", 20);

                    if (b3 && lux >= 100 && advGood && metaGood) {
                        deductMat(b3, 300);
                        tryConsume(['jewelry', 'perfume', 'wine', 'candles', 'tea'], 100);
                        deductMat(advGood, 25);
                        deductMat(metaGood, 20);
                        newWealth -= 500;
                        await client.query(`
                        INSERT INTO sim_active_projects (burg_id, project_type, target_tier, ticks_remaining)
                        VALUES ($1, 'URBAN_TIER', 4, 20)
                    `, [burg.burg_id]).catch(() => { });
                        activeProjectsSet.add(`${burg.burg_id}_URBAN_TIER`);
                        burgEvents.push({
                            tick,
                            type: 'PROJECT_COMMENCED',
                            message: `Metropolitan charter expansion begun in ${burg.name}: grand architects commenced City high ramparts, cathedral spires, and grand avenues reinforced with ${advGood.replace(/_/g, " ")} and ${metaGood.replace(/_/g, " ")} (20 days).`,
                            tier: 'MAJOR',
                            burg_id: burg.burg_id,
                            lore_date: loreDate
                        });
                    } else if (b3 && lux >= 100 && (!advGood || !metaGood) && (tick + burg.burg_id) % 25 === 0) {
                        burgEvents.push({
                            tick,
                            type: 'COMMODITY_SHORTAGE_STALL',
                            message: `👑 METROPOLITAN IMPASSE: High cathedral and observatory spire construction in ${burg.name} stalled awaiting advanced optical glass or celestial ward crystals!`,
                            tier: 'MINOR',
                            burg_id: burg.burg_id,
                            lore_date: loreDate
                        });
                    }
                }
            }

            // Apply Final Life/Death Diffs with Granary Spoilage & Wealth Circulation
            let newFood = Math.floor(Math.max(0, (burg.food || 0) + foodDelta));
            newWealth = Math.floor(Math.max(0, newWealth));

            // Granary Spoilage: Excess grain past 25 days reserves naturally rots
            const maxGranary = Math.max(1200, pop * 25);
            if (newFood > maxGranary) {
                newFood -= Math.floor((newFood - maxGranary) * 0.10);
            }

            // Wealth Circulation: Currency circulates into imports, commerce maintenance, and wear
            const maxCommercialReserves = Math.max(800, pop * 5);
            if (newWealth > maxCommercialReserves) {
                newWealth -= Math.floor((newWealth - maxCommercialReserves) * 0.04);
            }

            const newHealth = Math.floor(Math.min(100, Math.max(0, (burg.health || 100) + healthDelta)));
            const newUnrest = Math.floor(Math.min(100, Math.max(0, (burg.unrest || 0) + unrestDelta)));
            const newCrime = Math.floor(Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta)));

            // Log Notable Economic & Civil Events
            if (starvationDeaths > 0) {
                burgEvents.push({
                    tick,
                    type: 'BURG_FAMINE',
                    message: `Severe famine strikes ${burg.name}: food supplies collapsed with a ${Math.abs(foodDelta)} bushel deficit. ${starvationDeaths} citizens died of starvation!`,
                    tier: 'MAJOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                if (tick % 5 === 0) {
                    await tagBurgCitizens(client, burg.burg_id, ['#FamineStricken', '#DesperateRationing'], 'DESPERATE', `Desperately searching for grain in ${burg.name} after severe famine struck.`, null, 6);
                }
            } else if (newFood === 0 && (burg.food || 0) > 0) {
                burgEvents.push({
                    tick,
                    type: 'BURG_FAMINE',
                    message: `Granaries run completely dry in ${burg.name}! Food deficit reaches ${Math.abs(foodDelta)}. Citizens face imminent starvation.`,
                    tier: 'MAJOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                if (tick % 5 === 0) {
                    await tagBurgCitizens(client, burg.burg_id, ['#FamineStricken', '#BreadRioter'], 'ANGRY', `Threatening to storm the municipal granaries of ${burg.name} as bread supplies ran out.`, '%laborer%', 4);
                }
            }

            if (urbanTier > (burg.urban_tier || 1)) {
                const tierName = urbanTier === 2 ? 'Village' : urbanTier === 3 ? 'Town' : urbanTier === 4 ? 'City' : 'Metropolis';
                burgEvents.push({
                    tick,
                    type: 'BURG_URBAN_GROWTH',
                    message: `Settlement boom in ${burg.name}: population and trade advanced the settlement to Tier ${urbanTier} (${tierName})! New artisan workshops and civil infrastructure erected.`,
                    tier: 'MAJOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                await tagBurgCitizens(client, burg.burg_id, ['#BoomtownCitizen', '#MasterArtisan'], 'INSPIRED', `Expanding craft workshops to meet the boom of ${burg.name}'s new urban charter.`, null, 4);
            }

            if (newUnrest >= 45 && (burg.unrest || 0) < 45) {
                burgEvents.push({
                    tick,
                    type: 'MARTIAL_LAW_DECLARED',
                    message: `Martial law declared in ${burg.name}: civil unrest spiked to ${newUnrest}%. City Watch patrols double to suppress insurrection.`,
                    tier: 'MAJOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                await tagBurgCitizens(client, burg.burg_id, ['#CurfewDefier', '#AgitatedCitizen'], 'REBELLIOUS', `Joining secret assemblies in ${burg.name} to resist marshal patrols.`, '%laborer%', 4);
                await tagBurgCitizens(client, burg.burg_id, ['#CurfewEnforcer', '#VigilantGuard'], 'WARY', `Patrolling the avenues of ${burg.name} under martial law curfews.`, '%watch%', 4);
            }

            // Bandit Activity Emergence (Driven strictly by extreme famine, starvation)
            if (banditDefectors > 0) {
                popNullDelta -= banditDefectors;
                departedLeft += banditDefectors;
                // Siphon into regional outlaw syndicates up to syndicate capacity (2,500 max)
                const siphonedBandits = Math.min(10, banditDefectors);
                await client.query(`
                UPDATE sim_outlaw_factions 
                SET manpower = LEAST(2500, manpower + $1) 
                WHERE id = (SELECT id FROM sim_outlaw_factions WHERE manpower < 2500 ORDER BY ${sqlShuffle("id")} LIMIT 1)
            `, [siphonedBandits]).catch(() => { });

                const supplyLooted = Math.min(newFood, Math.floor(banditDefectors * 8));
                newFood = Math.max(0, newFood - supplyLooted);

                if ((tick + burg.burg_id) % 3 === 0) {
                    burgEvents.push({
                        tick,
                        burg_id: burg.burg_id,
                        type: 'BANDIT_RAIDERS_EMERGE',
                        tier: 'MAJOR',
                        message: `⚔️ HIGHWAY ROBBERY: ${banditDefectors} starving laborers and military deserters from ${burg.name} formed an outlaw raiding party, siphoning ${supplyLooted} food from regional supply lines!`,
                        lore_date: loreDate
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#WildernessBandit', '#DeserterOutlaw'], 'DESPERATE', `Fled the famine and watch oppression in ${burg.name} to survive as a highwayman in the hills.`, '%laborer%', 3);
                }
            } else if (starvationDeaths > 3 || (newFood === 0 && foodDelta < -150) || newUnrest >= 60) {
                if ((tick + burg.burg_id) % 5 === 0) {
                    burgEvents.push({
                        tick,
                        type: 'BANDIT_RAIDERS_EMERGE',
                        message: `Exiled outlaws and starving refugees driven out of ${burg.name} have formed a desperate highwayman band in the surrounding wilderness!`,
                        tier: 'MINOR',
                        burg_id: burg.burg_id,
                        lore_date: loreDate
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#WildernessBandit', '#DeserterOutlaw'], 'DESPERATE', `Fled the famine and watch oppression in ${burg.name} to survive as a highwayman in the hills.`, '%laborer%', 3);
                }
            } else if (newFood > 15000 && newUnrest < 25 && (burg.unrest || 0) >= 35 && (tick + burg.burg_id) % 8 === 0) {
                burgEvents.push({
                    tick,
                    type: 'BANDIT_AMNESTY',
                    message: `Order restored in ${burg.name}: abundant granary reserves persuaded starving wilderness outlaws to surrender their arms in exchange for food rations.`,
                    tier: 'MINOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
            }

            // Catastrophic Chaos Rupture & Burg Abandonment
            if (chaosIntensity >= 80 && newUnrest >= 85 && newHealth <= 25 && newFood === 0 && !burg.name.startsWith("[Ruin]")) {
                const refugees = Math.floor((burg.pop_null || 100) * 0.85);
                popNullDelta -= refugees;
                departedLeft += refugees;
                await client.query(`UPDATE sim_burg_economy SET name = '[Ruin] ' || name, urban_tier = 0 WHERE burg_id = $1`, [burg.burg_id]).catch(() => { });
                burgEvents.push({
                    tick,
                    burg_id: burg.burg_id,
                    type: 'BURG_ABANDONED_TO_CHAOS',
                    tier: 'CRITICAL',
                    message: `⚡ ABANDONED RUIN: The screaming primordial chaos flood (intensity ${chaosIntensity}%) has overwhelmed the municipal wards of ${burg.name}! ${refugees.toLocaleString()} citizens fled into the wilderness as refugees, leaving behind an abandoned eldritch ruin overrun by void abominations.`,
                    lore_date: loreDate
                });
                await tagBurgCitizens(client, burg.burg_id, ['#VoidRefugee', '#FleeingChaos'], 'TERRIFIED', `Fleeing the collapsing chaos-ruin of ${burg.name}.`, null, 5);
            }

            if (receivedTribute && (receivedTribute.food > 50 || receivedTribute.wealth > 20) && (tick + burg.burg_id) % 7 === 0) {
                burgEvents.push({
                    tick,
                    type: 'TRADE_CARAVAN_DELIVERY',
                    message: `Trade caravan arrived in ${burg.name}: received tribute of ${receivedTribute.food} food and ${receivedTribute.wealth} trade goods from regional vassals.`,
                    tier: 'MINOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                await tagBurgCitizens(client, burg.burg_id, ['#ProsperousMerchant', '#CaravanPartner'], 'CONTENT', `Brokering lucrative distribution agreements as tributary trade arrived in ${burg.name}.`, '%trader%', 3);
            }

            if (foodDelta >= 800 && newFood > 15000 && (tick + burg.burg_id) % 17 === 0) {
                burgEvents.push({
                    tick,
                    type: 'HARVEST_SURPLUS',
                    message: `Bountiful harvest recorded in ${burg.name}: agricultural yield produced +${foodDelta} surplus provisions.`,
                    tier: 'MINOR',
                    burg_id: burg.burg_id,
                    lore_date: loreDate
                });
                await tagBurgCitizens(client, burg.burg_id, ['#BountifulHarvest', '#GrainSurplusProducer'], 'CONTENT', `Rejoicing as agricultural harvests filled the granary towers of ${burg.name}.`, '%farmer%', 3);
            }

            let births = 0;
            if (newFood > 0 && newHealth >= 40 && newUnrest < 70) {
                // Realistic pre-industrial annual birth rate (~3.5% annually) divided across the year
                const annualBirthRate = 0.035 * (newHealth / 100) * (1 - newUnrest / 150);
                const dailyBirthRate = annualBirthRate / DAYS_PER_YEAR;
                births = pop * dailyBirthRate;
                if (pop < 100 && newFood > pop * 2 && Math.random() < 0.05) {
                    births = Math.max(0.1, births);
                }
            }
            // Demographic growth, maturation and immigration: one citizen record per ledger.unit people
            let growthPool = (Number(burg.pop_growth_pool) || 0) + (births - (starvationDeaths || 0));

            // Each full unit of growth adds one record and that many people, split by the burg's real mix
            const grown = splitByShare(ledger.unit, ledger.attunedShare);
            while (growthPool >= ledger.unit) {
                growthPool -= ledger.unit;
                popNullDelta += grown.nulls;
                popAttunedDelta += grown.attuned;

                // 50% from children coming of age, 50% from immigration
                const isMaturation = Math.random() < 0.50;
                if (isMaturation) {
                    // Find oldest living child in this burg
                    const childRes = await client.query(`
                    SELECT citizen_id, name, profession, species, spark_tier, childhood_background
                    FROM population_demographics
                    WHERE settlement_id = $1 AND life_stage = 'CHILD' AND allegiance_status = 'CIVILIAN'
                    ORDER BY age DESC, citizen_id ASC
                    LIMIT 1
                `, [burg.burg_id]);

                    if (childRes.rows.length > 0) {
                        const child = childRes.rows[0];
                        const adultTrade = ADULT_TRADE_MAP[child.profession] || "Laborer";
                        const newAdultMotiv = `Having come of age in ${burg.name || 'their hometown'}, they carry forward the lessons of their childhood: ${child.childhood_background || 'faithful labor'}`;

                        // Promote child to adult with assigned workplace
                        const wp = getWorkplaceForProfession(adultTrade, burg.name || "Town");
                        const adultMotives = deriveCitizenMotives({ profession: adultTrade, temper: "CURIOUS", instinct: "WARY", allegiance_status: "CIVILIAN" });
                        await client.query(`
                        UPDATE population_demographics
                        SET life_stage = 'ADULT', age = 16, profession = $1, motivation = $2,
                            workplace_type = $3, workplace_name = $4,
                            want = COALESCE(want, $6), flaw = COALESCE(flaw, $7), line_wont_cross = COALESCE(line_wont_cross, $8)
                        WHERE citizen_id = $5
                    `, [adultTrade, newAdultMotiv, wp.type, wp.name, child.citizen_id, adultMotives.want, adultMotives.flaw, adultMotives.lineWontCross]);
                        workforceDirtyBurgs.add(Number(burg.burg_id));

                        // Spawn replacement infant/child in the cradle to replace them
                        const replacementFirst = pickRandom(FIRST_NAMES[child.species] || FIRST_NAMES["Human"] || ["Val"], "Val");
                        const replacementLast = child.name.split(" ")[1] || "Kin";
                        const replacementName = `${replacementFirst} ${replacementLast}`;
                        const replacementRole = pickRandom(["Forge Apprentice", "Weaver Youth", "Temple Ward", "Farm Hand", "Herbalist Gatherer", "Scribe Runner", "Potter Apprentice"], "Apprentice");
                        const childBg = pickRandom(CHILDHOOD_BACKGROUNDS, "Learning the traditions of their elders.");
                        const isChildNull = Math.random() >= ledger.attunedShare;
                        const childMotives = deriveCitizenMotives({ profession: replacementRole, temper: "CURIOUS", instinct: "WARY", allegiance_status: "CIVILIAN" });

                        await client.query(`
                        INSERT INTO population_demographics (
                            settlement_id, home_cell_id, name, profession, species,
                            is_null, spark_tier, attunement_level, chaos_attraction_index,
                            temper, instinct, motivation, traits, social_links, allegiance_status,
                            unit_size, life_stage, age, childhood_background, want, flaw, line_wont_cross
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9,
                            'CURIOUS', 'WARY', $10, '["CURIOUS","WARY","YOUTH"]'::jsonb, '[]'::jsonb, 'CIVILIAN',
                            $12, 'CHILD', 1, $11, $13, $14, $15
                        )
                    `, [
                            burg.burg_id, burg.cell_id, replacementName, replacementRole, child.species,
                            isChildNull, isChildNull ? 'NULL' : (Math.random() < 0.5 ? 'DORMANT_SPARK' : 'SENSITIVE'),
                            isChildNull ? 0 : 0.2, isChildNull ? 0 : 1.0,
                            `Growing up in ${burg.name || 'town'} under the guidance of elder craftsmen.`,
                            childBg, ledger.unit, childMotives.want, childMotives.flaw, childMotives.lineWontCross
                        ]);
                    } else {
                        await spawnImmigrant(client, burg, ledger);
                        workforceDirtyBurgs.add(Number(burg.burg_id));
                    }
                } else {
                    // 50% immigration: someone moving to the area
                    await spawnImmigrant(client, burg, ledger);
                    workforceDirtyBurgs.add(Number(burg.burg_id));
                }
            }

            // Each full unit of starvation deaths takes one record and that many people
            while (growthPool <= -ledger.unit) {
                growthPool += ledger.unit;
                popNullDelta -= grown.nulls;
                popAttunedDelta -= grown.attuned;

                const victimRes = await client.query(`
                SELECT citizen_id, name, profession
                FROM population_demographics
                WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
                ORDER BY (CASE WHEN temper = 'DESPERATE' THEN 1 WHEN temper = 'BITTER' THEN 2 ELSE 3 END), ${sqlShuffle('citizen_id')}
                LIMIT 1
            `, [burg.burg_id]);

                if (victimRes.rows.length > 0) {
                    await client.query(`
                    UPDATE population_demographics
                    SET allegiance_status = 'DECEASED', cause_of_death = 'FAMINE_OR_PLAGUE'
                    WHERE citizen_id = $1
                `, [victimRes.rows[0].citizen_id]);
                    workforceDirtyBurgs.add(Number(burg.burg_id));
                }
            }

            // Executions, riots, bandits and refugees already left the counters above. Their records follow
            // one per full unit: the dead are marked DECEASED, the rest DEPARTED (kept as history).
            let departurePool = (Number(burg.pop_departure_pool) || 0) + departedDead + departedLeft;
            const retiring = Math.floor(departurePool / ledger.unit);
            if (retiring > 0) {
                departurePool -= retiring * ledger.unit;
                const leftTotal = departedDead + departedLeft;
                const dead = leftTotal > 0 ? Math.round(retiring * (departedDead / leftTotal)) : 0;
                await retireRecords(client, burg.burg_id, dead, "DECEASED", "CIVIL_VIOLENCE", `Killed in the violence in ${burg.name}.`);
                await retireRecords(client, burg.burg_id, retiring - dead, "DEPARTED", null, `Left ${burg.name} as a refugee or outlaw.`);
                workforceDirtyBurgs.add(Number(burg.burg_id));
            }

            const newPopNull = Math.floor(Math.max(12, (burg.pop_null || 0) + popNullDelta));
            const newPopAttuned = Math.floor(Math.max(12, (burg.pop_attuned || 0) + popAttunedDelta));
            const sparkbornTotal = newPopAttuned;
            const dormantSparks = Math.round(sparkbornTotal * 0.50);
            const adepts = Math.max(1, Math.round(sparkbornTotal * 0.01));
            const sensitives = Math.max(0, sparkbornTotal - dormantSparks - adepts);
            const demoJson = JSON.stringify({
                nulls: newPopNull,
                sparkborn_total: sparkbornTotal,
                dormant_sparks: dormantSparks,
                sensitives: sensitives,
                adepts: adepts
            });

            for (const key in inventory) {
                if ((inventory[key] || 0) > 100000) inventory[key] = 100000;
            }

            burgUpdates.push({
                id: burg.burg_id,
                food: newFood,
                wealth: newWealth,
                health: newHealth,
                unrest: newUnrest,
                crime: newCrime,
                urbanTier: urbanTier,
                architectureType: archType,
                pop_null: newPopNull,
                pop_attuned: newPopAttuned,
                pop_growth_pool: growthPool,
                pop_departure_pool: departurePool,
                demographics: demoJson,
                military_forces: burg.military_forces
            });

            stockpileUpdates.push({
                id: burg.burg_id,
                invObj: JSON.stringify(inventory)
            });
        }

        if (burgUpdates.length > 0) {
            await client.query(`
            UPDATE sim_burg_economy AS b SET
              food = v.food,
              wealth = v.wealth,
              health = v.health,
              unrest = v.unrest,
              crime_rate = v.crime,
              urban_tier = v.urban_tier,
              architecture_type = v.architecture_type,
              pop_null = v.pop_null,
              pop_attuned = v.pop_attuned,
              pop_growth_pool = v.pop_growth_pool,
              pop_departure_pool = v.pop_departure_pool,
              demographics = v.demographics,
              military_forces = v.military_forces::jsonb
            FROM (
              SELECT unnest($1::int[]) as id,
                     unnest($2::int[]) as food,
                     unnest($3::int[]) as wealth,
                     unnest($4::int[]) as health,
                     unnest($5::int[]) as unrest,
                     unnest($6::int[]) as crime,
                     unnest($7::int[]) as urban_tier,
                     unnest($8::text[]) as architecture_type,
                     unnest($9::int[]) as pop_null,
                     unnest($10::int[]) as pop_attuned,
                     unnest($11::text[]) as demographics,
                     unnest($12::text[]) as military_forces,
                     unnest($13::float[]) as pop_growth_pool,
                     unnest($14::float[]) as pop_departure_pool
            ) AS v
            WHERE b.burg_id = v.id
        `, [
                burgUpdates.map(u => u.id), burgUpdates.map(u => u.food), burgUpdates.map(u => u.wealth),
                burgUpdates.map(u => u.health), burgUpdates.map(u => u.unrest), burgUpdates.map(u => u.crime),
                burgUpdates.map(u => u.urbanTier), burgUpdates.map(u => u.architectureType),
                burgUpdates.map(u => u.pop_null || 0), burgUpdates.map(u => u.pop_attuned || 0),
                burgUpdates.map(u => u.demographics),
                burgUpdates.map(u => typeof u.military_forces === 'string' ? u.military_forces : JSON.stringify(u.military_forces || {})),
                burgUpdates.map(u => u.pop_growth_pool || 0.0),
                burgUpdates.map(u => u.pop_departure_pool || 0.0)
            ]);
        }

        if (workforceDirtyBurgs.size > 0) {
            await client.query(
                `UPDATE sim_burg_economy SET workforce = NULL WHERE burg_id = ANY($1::int[])`,
                [Array.from(workforceDirtyBurgs).sort((a, b) => a - b)]
            );
        }

        if (stockpileUpdates.length > 0) {
            await client.query(`
            INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory)
            SELECT unnest($1::int[]), unnest($2::jsonb[])
            ON CONFLICT (burg_id) DO UPDATE SET
              complex_inventory = EXCLUDED.complex_inventory
        `, [
                stockpileUpdates.map(u => u.id),
                stockpileUpdates.map(u => u.invObj)
            ]);
        }

        if (burgEvents.length > 0) {
            await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
                SELECT unnest($1::int[]), unnest($2::text[]), unnest($3::text[]), unnest($4::text[]), unnest($5::int[]), unnest($6::text[])
            `, [
                burgEvents.map(e => e.tick),
                burgEvents.map(e => e.type),
                burgEvents.map(e => e.message),
                burgEvents.map(e => e.tier),
                burgEvents.map(e => e.burg_id),
                burgEvents.map(e => e.lore_date)
            ]);
        }

        // ── QUANTITATIVE ECOLOGY FLUSH & ECOLOGICAL COLLAPSE AUDIT ────────────────
        if (cellEcoDeltas.size > 0) {
            for (const [cellId, damage] of cellEcoDeltas.entries()) {
                await client.query(`
                UPDATE sim_cells 
                SET eco_health = GREATEST(0, eco_health - $1)
                WHERE id = $2
            `, [damage, cellId]).catch(() => { });

                const ecoCheck = await client.query("SELECT eco_health FROM sim_cells WHERE id = $1", [cellId]).catch(() => ({ rows: [] }));
                if (ecoCheck.rows[0] && Number(ecoCheck.rows[0].eco_health) < 30) {
                    await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, cell_id, lore_date)
                    VALUES ($1, 'ECOLOGICAL_COLLAPSE', $2, 'MAJOR', $3, $4)
                `, [
                        tick,
                        `⚠️ ECOLOGICAL COLLAPSE: Cell ${cellId} suffering from severe deforestation and resource depletion (Eco-Health ${ecoCheck.rows[0].eco_health})! Flora and wildlife populations decimated.`,
                        cellId, loreDate
                    ]).catch(() => { });
                }
            }
        }
    }




