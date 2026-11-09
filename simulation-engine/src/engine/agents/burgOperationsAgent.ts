import { tagBurgCitizens } from "./citizenPersonaHelper";
import { 
    getFactionSpecialty, 
    getGoodsByCategory, 
    CommodityCategory 
} from "../economy/factionSpecialties.js";
import { evaluateBurgInventoryEffects } from "../economy/itemSystemicMatrix.js";

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

function getWorkplaceForProfession(profession: string, burgName: string): { type: string; name: string } {
    if (profession === "Baker") return { type: "BAKERY", name: `${burgName} Communal Hearth Bakery` };
    if (["Blacksmith", "Armorer", "Foundry Worker"].includes(profession)) return { type: "FORGE", name: `${burgName} Armory & Smithy` };
    if (["Brewmaster", "Brewer"].includes(profession)) return { type: "BREWERY", name: `${burgName} Brewhouse & Tavern` };
    if (profession === "Carpenter") return { type: "CARPENTRY", name: `${burgName} Woodcraft Atelier` };
    if (profession === "Tanner") return { type: "TANNERY", name: `${burgName} Currier Tannery` };
    if (profession === "Weaver") return { type: "WEAVERY", name: `${burgName} Draper Loom Guild` };
    if (profession === "Potter") return { type: "POTTERY", name: `${burgName} Pottery Kiln Shed` };
    if (["City Watchman", "Guard"].includes(profession)) return { type: "BARRACKS", name: `${burgName} City Watch Barracks` };
    if (["Farmer", "Laborer", "Disenfranchised Laborer"].includes(profession)) return { type: "FARMSTEAD", name: `${burgName} Outlying Granary & Fields` };
    if (profession === "Fisherman") return { type: "FISHERY", name: `${burgName} Basin Fishery Quay` };
    if (["Hedge Herbalist", "Apothecary"].includes(profession)) return { type: "APOTHECARY", name: `${burgName} Herbal Dispensary` };
    if (["Temple Acolyte", "Priest"].includes(profession)) return { type: "TEMPLE", name: `${burgName} Sanctuary of the Seals` };
    if (["Merchant Trader", "Caravan Drover"].includes(profession)) return { type: "MARKET_STALL", name: `${burgName} Central Market Stalls` };
    if (["Town Scribe", "Magistrate"].includes(profession)) return { type: "REGISTRY", name: `${burgName} Chancellery & Registry` };
    if (profession === "Clockmaker") return { type: "PRECISION_ATELIER", name: `${burgName} Horologist Atelier` };
    if (profession === "Stonemason") return { type: "MASONRY", name: `${burgName} Stonecutting Yard` };
    return { type: "CIVIC_GUILD", name: `${burgName} Provincial Guild` };
}

async function spawnImmigrant(client: any, burg: any) {
    const isExotic = Math.random() < 0.15;
    const ALL_SPECIES = ["Human", "Avian", "Bear-Folk", "Wolf-Kin", "Felid", "Saurian", "Plant-Folk"];
    const species = isExotic ? pickRandom(ALL_SPECIES, "Human") : resolveSpecies(burg.species_demographics);
    const first = pickRandom(FIRST_NAMES[species] || FIRST_NAMES["Human"] || ["Val"], "Val");
    const last = pickRandom(LAST_NAMES[species] || LAST_NAMES["Human"] || ["Traveler"], "Traveler");
    const name = `${first} ${last}`;
    const profession = pickRandom(ADULT_PROFESSIONS, "Merchant Trader");
    const age = Math.floor(Math.random() * 25) + 20;
    const childhood = pickRandom(CHILDHOOD_BACKGROUNDS, "Traveled far across the leylines during youth.");
    const isNull = Math.random() < 0.50;
    const sparkTier = isNull ? "NULL" : (Math.random() < 0.50 ? "DORMANT_SPARK" : Math.random() < 0.70 ? "SENSITIVE" : "CHANNELER");
    const temper = pickRandom(["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "STOIC", "VENGEFUL", "COMPASSIONATE", "BITTER"], "CURIOUS");
    const instinct = pickRandom(["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL", "DEVOUT"], "WARY");
    const motiv = `Relocated to ${burg.name || 'town'} seeking new trade opportunities and stability.`;
    const wp = getWorkplaceForProfession(profession, burg.name || "Town");

    await client.query(`
        INSERT INTO population_demographics (
            settlement_id, home_cell_id, name, profession, species,
            is_null, spark_tier, attunement_level, chaos_attraction_index,
            temper, instinct, motivation, traits, social_links, allegiance_status,
            unit_size, life_stage, age, childhood_background, is_immigrant,
            workplace_type, workplace_name
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13::jsonb, '[]'::jsonb, 'CIVILIAN',
            12, 'ADULT', $14, $15, TRUE,
            $16, $17
        )
    `, [
        burg.burg_id, burg.cell_id, name, profession, species,
        isNull, sparkTier, isNull ? 0 : 0.3, isNull ? 0 : 2.0,
        temper, instinct, motiv, JSON.stringify([temper, instinct]),
        age, childhood, wp.type, wp.name
    ]);
}

export async function runBurgOperationsAgent(client: any, tick: number, loreDate: string = "") {
    if (tick % 541 === 0) {
        // Natural annual maturation: advance all living citizen ages by 1 year (1 Year = 541 Days)
        await client.query("UPDATE population_demographics SET age = age + 1 WHERE allegiance_status = 'CIVILIAN'").catch(() => { });
    }

    const burgRes = await client.query(`
        SELECT b.*, c.faction_id, s.complex_inventory as current_inventory 
        FROM sim_burg_economy b
        LEFT JOIN sim_cells c ON b.cell_id = c.id
        LEFT JOIN sim_industrial_stockpiles s ON b.burg_id = s.burg_id
    `);

    const burgUpdates: any[] = [];
    const stockpileUpdates: any[] = [];
    const burgEvents: any[] = [];

    const RESOURCE_TYPES: Record<string, string> = {
        "veg": "food", "meat": "food", "fruit": "food", "root_veg": "food", "grain": "food", "lard": "food",
        "stone": "mats", "clay": "mats", "fibre": "mats", "wood": "mats", "leather": "mats", "adhesive": "mats",
        "reagents": "lux", "poison": "lux", "mounts": "lux", "ivory": "lux", "gems": "lux", "fur": "lux",
        "draftbeasts": "lux", "wool": "lux", "pets": "lux", "errand_beasts": "lux", "companion_beasts": "lux",
        "herbs": "lux", "medicine": "lux", "codependent_beasts": "lux"
    };

    const CRAFTING_TREE: Record<string, { refined: string, crafted: string }> = {
        "veg": { refined: "pickled_veg", crafted: "preserved_rations" },
        "meat": { refined: "cured_meat", crafted: "gourmet_rations" },
        "fruit": { refined: "pressed_juice", crafted: "fine_wine" },
        "root_veg": { refined: "milled_flour", crafted: "baked_goods" },
        "grain": { refined: "malt", crafted: "ale" },
        "lard": { refined: "tallow", crafted: "fine_candles" },
        "stone": { refined: "cut_stone", crafted: "sculptures" },
        "clay": { refined: "bricks", crafted: "fine_pottery" },
        "fibre": { refined: "thread", crafted: "textiles" },
        "wood": { refined: "lumber", crafted: "furniture" },
        "leather": { refined: "tanned_hide", crafted: "leather_armor" },
        "adhesive": { refined: "resin", crafted: "sealant" },
        "reagents": { refined: "alchemical_base", crafted: "elixirs" },
        "poison": { refined: "venom_extract", crafted: "assassin_vials" },
        "mounts": { refined: "trained_mounts", crafted: "war_mounts" },
        "ivory": { refined: "polished_ivory", crafted: "ivory_carvings" },
        "gems": { refined: "cut_gems", crafted: "jewelry" },
        "fur": { refined: "treated_fur", crafted: "luxurious_coats" },
        "draftbeasts": { refined: "harnessed_beasts", crafted: "siege_beasts" },
        "wool": { refined: "yarn", crafted: "tapestries" },
        "pets": { refined: "tamed_pets", crafted: "exotic_companions" },
        "errand_beasts": { refined: "messenger_beasts", crafted: "courier_network_beasts" },
        "companion_beasts": { refined: "guard_beasts", crafted: "elite_guard_beasts" },
        "herbs": { refined: "dried_herbs", crafted: "incense" },
        "medicine": { refined: "poultices", crafted: "miracle_cures" },
        "codependent_beasts": { refined: "symbiotic_beasts", crafted: "bonded_beasts" },
        "foraged_food": { refined: "dried_forage", crafted: "survival_rations" },
        "scrap": { refined: "usable_parts", crafted: "salvaged_tools" },
        "trinkets": { refined: "polished_trinkets", crafted: "curiosities" },
        "iron": { refined: "forged_steel", crafted: "steel_weapons" },
        "copper": { refined: "bronze_ingots", crafted: "bronze_statues" },
        "gold": { refined: "gold_bars", crafted: "gold_relics" },
        "silver": { refined: "silver_ingots", crafted: "silver_artifacts" },
        "crystals": { refined: "cut_crystals", crafted: "crystal_foci" },
        "dragon_stone_shard": { refined: "dragon_core", crafted: "airship_engine" }
    };

    // Map to accumulate hierarchical shipments from downstream hamlets/villages/towns
    const incomingTributes = new Map<number, { food: number; wealth: number }>();

    // ── MACRO WEATHER & COSMIC INSTABILITY LOOKUPS ───────────────────────────
    const calRes = await client.query("SELECT season, month_name, active_flow FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const currentSeason = calRes.rows[0]?.season || "The Bloom";

    // Ambient Chaos Blight intensity per cell
    const chaosRes = await client.query("SELECT cell_id, intensity FROM sim_chaos_zones WHERE intensity >= 60");
    const chaosIntensityMap = new Map<number, number>();
    for (const r of chaosRes.rows) {
        chaosIntensityMap.set(Number(r.cell_id), Math.max(chaosIntensityMap.get(Number(r.cell_id)) || 0, Number(r.intensity) || 0));
    }

    // Trade Blockades & Mercantile Embargoes (Gilded Compass sanctions)
    const sectorTagsRes = await client.query(`
        SELECT cell_id, features->'environmental_tags' as env_tags 
        FROM sim_sector_layers 
        WHERE z_layer = 0 AND features->'environmental_tags' IS NOT NULL
    `);
    const sectorBlockadeMap = new Map<number, boolean>();
    for (const r of sectorTagsRes.rows) {
        if (Array.isArray(r.env_tags)) {
            const hasEmbargo = r.env_tags.some((t: string) => t.includes("Blockade") || t.includes("Embargo") || t.includes("CompassEmbargo"));
            if (hasEmbargo) sectorBlockadeMap.set(Number(r.cell_id), true);
        }
    }

    // ── QUANTITATIVE ECOLOGY (QE) & INFRASTRUCTURE SETUP ─────────────────────
    const INFRA_MAP: Record<string, string> = {
        "grain": "FARM", "fruit": "FARM", "root_veg": "FARM", "veg": "FARM", "fibre": "FARM", "herbs": "FARM", "medicine": "FARM",
        "wood": "CAMP", "pitch": "CAMP", "meat": "CAMP", "ivory": "CAMP", "leather": "CAMP", "wool": "CAMP", "fur": "CAMP", "lard": "CAMP", "adhesive": "CAMP", "reagents": "CAMP", "pets": "CAMP", "mounts": "CAMP", "draftbeasts": "CAMP", "poison": "CAMP",
        "stone": "QUARRY", "clay": "QUARRY",
        "ore": "MINE", "iron": "MINE", "copper": "MINE", "gold": "MINE", "silver": "MINE", "gems": "MINE", "crystals": "MINE", "dragon_stone_shard": "MINE"
    };

    const infraRes = await client.query("SELECT burg_id, type, level FROM sim_infrastructure");
    const burgInfraMap = new Map<number, Map<string, number>>();
    for (const row of infraRes.rows) {
        if (!burgInfraMap.has(row.burg_id)) burgInfraMap.set(row.burg_id, new Map());
        burgInfraMap.get(row.burg_id)!.set(row.type, Number(row.level) || 1);
    }
    const cellEcoDeltas = new Map<number, number>();

    // ── ACTIVE CONSTRUCTION PROJECTS PIPELINE (sim_active_projects) ──────────
    await client.query("UPDATE sim_active_projects SET ticks_remaining = ticks_remaining - 1").catch(() => { });
    const completedProjects = await client.query("SELECT * FROM sim_active_projects WHERE ticks_remaining <= 0").catch(() => ({ rows: [] }));
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
        let urbanTier = burg.urban_tier || 1;
        const gatherRate = 1 + urbanTier;

        const totalWorkers = Math.floor(pop / 10);
        const fullBlocks = Math.floor(totalWorkers / 12);

        // --- PURPOSE-DRIVEN WORKFORCE: DEDICATED CIVIC OVERHEAD VS PRODUCTIVE CRAFTING ---
        // Each settlement size requires dedicated civic operational population:
        // Hamlet: 5%, Village: 15%, Town: 25%, City: 35%, Capital: 45%
        const civicRatio = Number(burg.dedicated_civic_ratio) || (burg.is_capital ? 0.45 : burg.urban_tier >= 3 ? 0.35 : burg.urban_tier === 2 ? 0.25 : burg.parent_burg_id ? 0.05 : 0.15);
        const civicWorkers = Math.max(1, Math.floor(totalWorkers * civicRatio));
        const productiveWorkers = Math.max(0, totalWorkers - civicWorkers);

        let wCivil = Math.floor(civicWorkers * 0.34);
        let wSec = Math.floor(civicWorkers * 0.33);
        let wSoc = Math.max(0, civicWorkers - wCivil - wSec);

        let wFood = 0, wMats = 0, wLux = 0;
        // Group of 12 Distribution: 6 Food Creating (50%), 2-4 Resources (25-30%), rest artisanal crafts/luxuries
        if (burg.urban_tier <= 1 || burg.parent_burg_id) {
            // Hamlets & Agrarian Hinterlands focus on primary agricultural extraction
            wFood = Math.floor(productiveWorkers * 0.60);
            wMats = Math.floor(productiveWorkers * 0.25);
            wLux = Math.max(0, productiveWorkers - wFood - wMats);
        } else if (burg.urban_tier === 2) {
            // Towns: balanced regional aggregation (50% Food hinterland, 25% Mats, 25% Lux)
            wFood = Math.floor(productiveWorkers * 0.50);
            wMats = Math.floor(productiveWorkers * 0.25);
            wLux = Math.max(0, productiveWorkers - wFood - wMats);
        } else {
            // Cities & Capitals: regional farms & outposts account for 50% food, 25% resource milling, 25% fine craft
            wFood = Math.floor(productiveWorkers * 0.50);
            wMats = Math.floor(productiveWorkers * 0.25);
            wLux = Math.max(0, productiveWorkers - wFood - wMats);
        }

        let invObj: Record<string, number> = {};
        try {
            invObj = typeof burg.current_inventory === 'string'
                ? JSON.parse(burg.current_inventory)
                : (burg.current_inventory || {});
        } catch (e) {
            invObj = {};
        }
        const systemicEffects = evaluateBurgInventoryEffects(invObj);

        // --- CONTROLLED INSTABILITY 1: SEASONAL AGRICULTURAL CYCLE & CHAOS BLIGHT ---
        // Deep Cold cuts base crop yields to 35%; Coal & Stone-Root winter resilience mitigates cold!
        const isWinterFreeze = currentSeason === 'The Deep Cold' || (burg.current_temp !== undefined && Number(burg.current_temp) < 0);
        const winterFloor = Math.min(0.85, 0.35 + (systemicEffects.winterResilience * 0.05));
        const seasonMod = isWinterFreeze ? winterFloor : (currentSeason === 'The Harvest' ? 1.45 : (currentSeason === 'The Bloom' ? 1.20 : 1.0));
        let foodYieldPerWorker = Math.max(6, Math.floor((28 + (urbanTier * 3)) * seasonMod));

        const chaosIntensity = chaosIntensityMap.get(Number(burg.cell_id)) || 0;
        if (chaosIntensity >= 70) {
            foodYieldPerWorker = Math.max(4, Math.floor(foodYieldPerWorker * (1 - (chaosIntensity / 100) * 0.70)));
        }

        let foodProduced = Math.floor(wFood * foodYieldPerWorker);
        // Base subsistence floor: foraging in deep winter snow or blighted soil is severely crippled!
        const baseFloorRate = isWinterFreeze ? 0.40 : (chaosIntensity >= 70 ? 0.35 : 0.90);
        foodProduced = Math.max(foodProduced, Math.floor(pop * baseFloorRate));

        // Artisanal luxury wealth net calculation (luxury tax revenue minus civic overhead):
        const luxRevenue = Math.floor(wLux * 0.10 * (1 + urbanTier * 0.20));
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
                // Mercantile sanctions freeze commercial food imports and siphon wealth
                wealthDelta = Math.min(0, wealthDelta - 4);
            } else if ((burg.wealth || 0) > 25) {
                // Commercial Grain Purchase: Wealthy cities buy grain from trade caravans (1 Gold = 25 Food)
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
                const parsed = typeof burg.military_forces === 'string' ? JSON.parse(burg.military_forces) : burg.military_forces;
                for (const k in parsed) military[k.toLowerCase()] = parsed[k];
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

        // Organic Civil Tension:
        // Unrest naturally settles around an authentic societal equilibrium (~40-50%).
        // It drops toward 20-30% in prosperous, well-fed, peaceful burgs,
        // and spikes toward 60-80% during famine, siege, war, or chaos storms.
        let baseUnrestDelta = 0;
        const currentUnrest = Number(burg.unrest || 0);
        const currentCrime = Number(burg.crime_rate || 0);
        const currentHealth = Number(burg.health ?? 100);

        const isWellFed = (burg.food || 0) + foodDelta >= pop * 1.1;
        const isHealthy = currentHealth >= 50;
        const isLowCrime = currentCrime < 45;

        if (isWellFed && isHealthy && isLowCrime) {
            // Peace and abundance calms civil tension
            baseUnrestDelta = -Math.max(1, Math.floor(wSoc * 0.05));
            if (currentUnrest > 50) baseUnrestDelta -= 2; // Accelerated pacification at elevated unrest
            else if (currentUnrest > 35) baseUnrestDelta -= 1;
        } else if ((burg.food || 0) + foodDelta < pop * 0.5) {
            // Acute food scarcity stokes bread riots
            baseUnrestDelta = +2;
        }

        // Underworld cartel presence & severe crime stokes unrest
        if (currentCrime >= 60) {
            baseUnrestDelta += 1;
        }

        // Natural mean reversion toward societal resting band (40-50%):
        // Extended high unrest causes exhaustion, marshal curfews, and public fatigue
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

            // Actually kill off pop/military
            let shortfall = Math.abs((burg.food || 0) + foodDelta);

            // First armies desert
            for (const type of Object.keys(military)) {
                if (military[type] > 0 && shortfall > 0) {
                    let desertion = Math.min(military[type], Math.ceil(shortfall / 200));
                    military[type] -= desertion;
                    shortfall -= desertion * 200;
                    militaryDesertions += desertion;
                }
            }

            // Civilians suffer realistic daily famine attrition (~0.1% of shortfall per day)
            // Desperate survivors turn to highway banditry and swell cartel ranks!
            if (shortfall > 0) {
                starvationDeaths = Math.min(burg.pop_null || 0, Math.floor(shortfall * 0.001));
                banditDefectors = Math.min(Math.floor((burg.pop_null || 0) * 0.04), Math.max(0, Math.floor(shortfall * 0.004)));
            }
        }

        // Chaos Blight impact on health and unrest
        if (chaosIntensity >= 70) {
            healthDelta -= Math.floor((chaosIntensity - 55) * 0.12);
            unrestDelta += Math.floor((chaosIntensity - 55) * 0.15);
        }

        // --- SPECIFIC RESOURCE GATHERING ---
        let profile = { slots: [] };
        try {
            if (burg.resource_profile) profile = JSON.parse(burg.resource_profile);
        } catch (e) { }

        const slots: any[] = profile.slots || [];
        const weights = { food: 0, mats: 0, lux: 0 };
        const categorizedSlots: any = { food: [], mats: [], lux: [] };

        for (const slot of slots) {
            const type = RESOURCE_TYPES[slot.res] || "mats";
            weights[type as keyof typeof weights] += slot.workers;
            categorizedSlots[type].push(slot);
        }

        let inventory: any = {};
        try {
            if (burg.current_inventory) inventory = JSON.parse(burg.current_inventory);
        } catch (e) { }

        // --- AUTHENTIC LORE COMMODITY SYSTEMIC EFFECTS ---
        // 1. The Reliance: Chaos-Resistant Compound neutralizes Chaos Blight
        if (chaosIntensity >= 70 && ((inventory['chaos_resistant_compound'] as number) || 0) >= 1) {
            inventory['chaos_resistant_compound'] -= 1;
            healthDelta += 2; // Shields from blight rot
            unrestDelta = Math.max(-2, unrestDelta - 2);
        }

        // 2. Sump-Kin: Mire Pharmaceuticals & Narcotics treat health emergencies
        if ((burg.health || 100) < 55 && ((inventory['sumpkin_pharmaceutical_chems'] as number) || 0) >= 1) {
            inventory['sumpkin_pharmaceutical_chems'] -= 1;
            healthDelta += 3;
            unrestDelta -= 1;
        }

        // 3. Flower Valley: Intel Dossiers grant early warnings, curbing crime and unrest
        if (((inventory['coded_intel_dossiers'] as number) || 0) >= 2) {
            crimeDelta = Math.max(-3, crimeDelta - 1);
            if (currentUnrest > 45) unrestDelta -= 1;
        }

        // 4. Dust-Husk Moonflowers: Calming dream teas ease civil agitation
        if (currentUnrest > 55 && ((inventory['night_moonflowers'] as number) || 0) >= 1) {
            inventory['night_moonflowers'] -= 1;
            unrestDelta -= 2;
        }

        const requiredInfraBuilds = new Map<string, number>();

        const distribute = (availableWorkers: number, typeStr: "food" | "mats" | "lux") => {
            const totalWeight = weights[typeStr];
            let remainingWorkers = availableWorkers;

            if (totalWeight === 0 && availableWorkers > 0) {
                const fallback = typeStr === "food" ? "foraged_food" : (typeStr === "mats" ? "scrap" : "trinkets");
                inventory[fallback] = (inventory[fallback] || 0) + (availableWorkers * gatherRate);
                return;
            }

            for (let i = 0; i < categorizedSlots[typeStr].length; i++) {
                const slot = categorizedSlots[typeStr][i];
                const assigned = (i === categorizedSlots[typeStr].length - 1)
                    ? remainingWorkers
                    : Math.floor(availableWorkers * (slot.workers / totalWeight));

                remainingWorkers -= assigned;

                // Quantitative Ecology (QE): Covered vs Uncovered Workers
                const reqInfra = INFRA_MAP[slot.res] || "CAMP";
                const bInfra = burgInfraMap.get(burg.burg_id) || new Map<string, number>();
                const infraLevel = bInfra.get(reqInfra) || 0;
                const infraCap = infraLevel * 10;
                const covered = Math.min(assigned, infraCap);
                const uncovered = Math.max(0, assigned - infraCap);

                // Covered workers produce 2x yield with zero eco damage;
                // Uncovered workers produce 1x yield and inflict damage on the cell's eco_health
                const yieldAmt = (covered * 2 * gatherRate) + (uncovered * 1 * gatherRate);
                inventory[slot.res] = (inventory[slot.res] || 0) + yieldAmt;

                if (uncovered > 0 && burg.cell_id) {
                    cellEcoDeltas.set(burg.cell_id, (cellEcoDeltas.get(burg.cell_id) || 0) + uncovered);
                    requiredInfraBuilds.set(reqInfra, (requiredInfraBuilds.get(reqInfra) || 0) + uncovered);
                }
            }
        };

        distribute(wFood, "food");
        distribute(wMats, "mats");
        distribute(wLux, "lux");

        // Auto-build infrastructure to halt ecological bleeding
        for (const [infraType, deficit] of requiredInfraBuilds.entries()) {
            if (deficit >= 10 && (inventory['lumber'] || inventory['wood'] || 0) >= 20 && (burg.wealth || 0) >= 20) {
                if (inventory['lumber']) inventory['lumber'] -= 20;
                else inventory['wood'] -= 20;
                await client.query(`
                    INSERT INTO sim_infrastructure (burg_id, cell_id, type, level)
                    VALUES ($1, $2, $3, 1)
                    ON CONFLICT (burg_id, type) DO UPDATE SET level = sim_infrastructure.level + 1
                `, [burg.burg_id, burg.cell_id, infraType]).catch(() => { });
                await client.query("UPDATE sim_cells SET eco_max = GREATEST(10, eco_max - 1) WHERE id = $1", [burg.cell_id]).catch(() => { });
            }
        }

        // --- PRODUCTION & CONSTRUCTION (PROCESSING SPECIFIC TIERS) ---
        if (urbanTier >= 2) {
            let actions = fullBlocks;
            let refineRate = urbanTier - 1; // Village(2)=1, Town(3)=2, City(4)=3
            let craftRate = Math.max(0, urbanTier - 2); // Village(2)=0, Town(3)=1, City(4)=2

            let craftActions = urbanTier >= 3 ? Math.floor(actions / 3) : 0;
            let refineActions = actions - craftActions;

            // Crafting Phase (Refined -> Crafted)
            if (craftRate > 0 && craftActions > 0) {
                let maxCrafts = craftActions * craftRate;

                let availableRefined = Object.keys(inventory).filter(k =>
                    Object.values(CRAFTING_TREE).some(t => t.refined === k)
                ).sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));

                for (const refKey of availableRefined) {
                    if (maxCrafts <= 0) break;
                    let possible = Math.floor(((inventory[refKey] as number) || 0) / 2);
                    let actual = Math.min(possible, maxCrafts);

                    if (actual > 0) {
                        let craftedKey = Object.values(CRAFTING_TREE).find(t => t.refined === refKey)?.crafted || "crafted_goods";
                        inventory[refKey] -= actual * 2;
                        inventory[craftedKey] = (inventory[craftedKey] || 0) + actual;
                        maxCrafts -= actual;
                    }
                }
            }

            // Refining Phase (Raw -> Refined)
            if (refineRate > 0 && refineActions > 0) {
                let maxRefines = refineActions * refineRate;

                let availableRaw = Object.keys(inventory).filter(k =>
                    CRAFTING_TREE[k] !== undefined
                ).sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));

                for (const rawKey of availableRaw) {
                    if (maxRefines <= 0) break;
                    let possible = Math.floor(((inventory[rawKey] as number) || 0) / 2);
                    let actual = Math.min(possible, maxRefines);

                    if (actual > 0) {
                        let refinedKey = CRAFTING_TREE[rawKey]?.refined || "refined_goods";
                        inventory[rawKey] -= actual * 2;
                        inventory[refinedKey] = (inventory[refinedKey] || 0) + actual;
                        maxRefines -= actual;
                    }
                }
            }
        }

        // --- FACTION-SPECIFIC SIGNATURE COMMODITY PRODUCTION ---
        // Each sovereign faction executes unique harvest/production methods yielding signature commodities
        // that foreign settlements require to advance their urban tiers and infrastructure.
        const factionSpecialty = getFactionSpecialty(factionId);
        if (factionSpecialty && productiveWorkers >= 5) {
            // Determine maximum batches based on productive workforce
            const maxBatches = Math.max(1, Math.floor(productiveWorkers / 25));
            let possibleBatches = maxBatches;

            // Check if required raw materials are available
            for (const input of (factionSpecialty.requiredRawInputs || [])) {
                const stock = (inventory[input.resource] || 0) as number;
                const canMake = Math.floor(stock / Math.max(1, input.count));
                possibleBatches = Math.min(possibleBatches, canMake);
            }

            // If raw inputs are available, produce full yield; otherwise produce a base harvest (1 batch)
            const actualBatches = Math.max(1, Math.min(maxBatches, possibleBatches));
            for (const input of (factionSpecialty.requiredRawInputs || [])) {
                if (inventory[input.resource]) {
                    inventory[input.resource] = Math.max(0, inventory[input.resource] - (input.count * actualBatches));
                }
            }

            const producedSignatureGoods = actualBatches * factionSpecialty.outputPerBatch;
            inventory[factionSpecialty.uniqueGood] = (inventory[factionSpecialty.uniqueGood] || 0) + producedSignatureGoods;

            // Periodically tag authentic local artisan citizens
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

        // Helper for specific consumption
        const consumeSpecific = (poolType: "raw" | "refined" | "crafted", amount: number) => {
            let remaining = amount;
            let keys: string[] = [];
            if (poolType === "raw") keys = Object.keys(inventory).filter(k => CRAFTING_TREE[k]);
            else if (poolType === "refined") keys = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.refined === k));
            else if (poolType === "crafted") keys = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.crafted === k));

            keys.sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));
            for (const k of keys) {
                if (remaining <= 0) break;
                let take = Math.min((inventory[k] || 0) as number, remaining);
                inventory[k] -= take;
                remaining -= take;
            }
            return remaining; // returns deficit
        };

        const tryConsume = (acceptableKeys: string[], amount: number) => {
            let remaining = amount;
            for (const key of acceptableKeys) {
                if (remaining <= 0) break;
                if (inventory[key] && inventory[key] > 0) {
                    let take = Math.min(inventory[key], remaining);
                    inventory[key] -= take;
                    remaining -= take;
                }
            }
            return remaining; // returns deficit
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
        supplyDeficit += tryConsume(["leather_armor", "tanned_hide", "leather"], military.infantry || 0);
        supplyDeficit += tryConsume(["forged_steel", "iron", "scrap"], military.infantry || 0);

        supplyDeficit += tryConsume(["lumber", "wood", "dragon_stone_shard"], military.ranged || 0);

        supplyDeficit += tryConsume(["war_mounts", "trained_mounts", "mounts", "draftbeasts"], military.mounted || 0);

        supplyDeficit += tryConsume(["airship_engine", "dragon_core", "dragon_stone_shard", "cut_stone"], military.airship || 0);

        supplyDeficit += tryConsume(["elixirs", "alchemical_base", "reagents", "poison"], military.mage || 0);
        supplyDeficit += tryConsume(["fine_wine", "pressed_juice", "fruit"], military.mage || 0);

        if (supplyDeficit > 0) {
            // Military equipment shortage affects readiness, not massive daily civilian rioting
            if (supplyDeficit > 10) unrestDelta += 1;

            // Only severe chronic deficits occasionally cause deserters (periodic check, capped at 2,500 syndicate max)
            if (supplyDeficit >= 15 && (tick + burg.burg_id) % 15 === 0) {
                const deserters = Math.min(4, Math.floor(supplyDeficit * 0.05));
                if (deserters > 0) {
                    await client.query(`
                        UPDATE sim_outlaw_factions 
                        SET manpower = LEAST(2500, manpower + $1) 
                        WHERE id = (SELECT id FROM sim_outlaw_factions WHERE manpower < 2500 ORDER BY RANDOM() LIMIT 1)
                    `, [deserters]).catch(() => { });
                }
            }
        }

        // --- TIER 1 & TIER 2 CIVILIAN COMFORT & LUXURY NEEDS ---
        // Tier 1 Comfort Need: Population > 5,000 requires textiles / medicine
        if (pop > 5000) {
            const neededComfort = Math.ceil((pop - 5000) / 1000);
            const comfortDeficit = tryConsume(["textiles", "thread", "medicine", "poultices"], neededComfort);
            if (comfortDeficit > 5) {
                healthDelta -= 1;
                if (comfortDeficit > 15) unrestDelta += 1;
            }
        }
        // Tier 2 Luxury Need: Population > 20,000 requires fine goods / wine / ale / jewelry
        if (pop > 20000) {
            const neededLuxury = Math.ceil((pop - 20000) / 2000);
            const luxuryDeficit = tryConsume(["fine_wine", "jewelry", "fine_pottery", "ale", "sculptures", "tapestries"], neededLuxury);
            // Lack of luxury goods slightly dampens satisfaction if unrest is low, but doesn't cause armed riots
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
                    inventory['grain'] -= 40;
                    resPwr = Math.max(0, resPwr - 20);
                } else {
                    resPwr += 10;
                }
            }

            // Daily Riot Collision
            let curFootmen = military.infantry || military.footmen || 0;
            popNullDelta -= Math.floor(resPwr * 0.05);
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
                    inventory[m] -= amt;
                }
            };

            const t1 = ['wood', 'stone', 'clay'];
            const t2 = ['refined_lumber', 'cut_stone', 'bricks'];
            const t3 = ['treated_lumber', 'masonry', 'ceramics'];

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
                        inventory[presGood] -= 15;
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
                        inventory[structGood] -= 20;
                        inventory[foundGood] -= 20;
                        newWealth -= 200;
                        archType = b2 === 'refined_lumber' ? 'WOOD' : b2 === 'cut_stone' ? 'STONE' : 'CLAY';
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
                    const lux = (inventory['luxury'] || inventory['fine_goods'] || 0) as number;
                    // Tier 3 -> 4 requires ADVANCED commodity (Aether-Glass, Astrolabe Gears, Spidersilk) PLUS HEALTH or METAPHYSICAL
                    const advGood = checkCategoryCommodity("ADVANCED", 25);
                    const metaGood = checkCategoryCommodity("METAPHYSICAL", 20) || checkCategoryCommodity("HEALTH", 20) || checkCategoryCommodity("ENERGY", 20);

                    if (b3 && lux >= 100 && advGood && metaGood) {
                        deductMat(b3, 300);
                        if (inventory['luxury']) inventory['luxury'] -= 100;
                        inventory[advGood] -= 25;
                        inventory[metaGood] -= 20;
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
                // Siphon into regional outlaw syndicates up to syndicate capacity (2,500 max)
                const siphonedBandits = Math.min(10, banditDefectors);
                await client.query(`
                UPDATE sim_outlaw_factions 
                SET manpower = LEAST(2500, manpower + $1) 
                WHERE id = (SELECT id FROM sim_outlaw_factions WHERE manpower < 2500 ORDER BY RANDOM() LIMIT 1)
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
                // Realistic pre-industrial annual birth rate (~3.5% annually) divided across 541 days
                const annualBirthRate = 0.035 * (newHealth / 100) * (1 - newUnrest / 150);
                const dailyBirthRate = annualBirthRate / 541;
                births = pop * dailyBirthRate;
                if (pop < 100 && newFood > pop * 2 && Math.random() < 0.05) {
                    births = Math.max(0.1, births);
                }
            }
            // 12-to-1 Demographic Growth, Maturation & Immigration
            let growthPool = (Number(burg.pop_growth_pool) || 0) + (births - (starvationDeaths || 0));

            // When positive growth accumulates to a full unit of 12:
            while (growthPool >= 12) {
                growthPool -= 12;
                popNullDelta += 6;
                popAttunedDelta += 6;

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
                        await client.query(`
                        UPDATE population_demographics
                        SET life_stage = 'ADULT', age = 16, profession = $1, motivation = $2,
                            workplace_type = $3, workplace_name = $4
                        WHERE citizen_id = $5
                    `, [adultTrade, newAdultMotiv, wp.type, wp.name, child.citizen_id]);

                        // Spawn replacement infant/child in the cradle to replace them
                        const replacementFirst = pickRandom(FIRST_NAMES[child.species] || FIRST_NAMES["Human"] || ["Val"], "Val");
                        const replacementLast = child.name.split(" ")[1] || "Kin";
                        const replacementName = `${replacementFirst} ${replacementLast}`;
                        const replacementRole = pickRandom(["Forge Apprentice", "Weaver Youth", "Temple Ward", "Farm Hand", "Herbalist Gatherer", "Scribe Runner", "Potter Apprentice"], "Apprentice");
                        const childBg = pickRandom(CHILDHOOD_BACKGROUNDS, "Learning the traditions of their elders.");
                        const isChildNull = Math.random() < 0.5;

                        await client.query(`
                        INSERT INTO population_demographics (
                            settlement_id, home_cell_id, name, profession, species,
                            is_null, spark_tier, attunement_level, chaos_attraction_index,
                            temper, instinct, motivation, traits, social_links, allegiance_status,
                            unit_size, life_stage, age, childhood_background
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9,
                            'CURIOUS', 'WARY', $10, '["CURIOUS","WARY","YOUTH"]'::jsonb, '[]'::jsonb, 'CIVILIAN',
                            12, 'CHILD', 1, $11
                        )
                    `, [
                            burg.burg_id, burg.cell_id, replacementName, replacementRole, child.species,
                            isChildNull, isChildNull ? 'NULL' : (Math.random() < 0.5 ? 'DORMANT_SPARK' : 'SENSITIVE'),
                            isChildNull ? 0 : 0.2, isChildNull ? 0 : 1.0,
                            `Growing up in ${burg.name || 'town'} under the guidance of elder craftsmen.`,
                            childBg
                        ]);
                    } else {
                        await spawnImmigrant(client, burg);
                    }
                } else {
                    // 50% immigration: someone moving to the area
                    await spawnImmigrant(client, burg);
                }
            }

            // When negative growth reaches -12 (starvation or casualties):
            while (growthPool <= -12) {
                growthPool += 12;
                popNullDelta -= 6;
                popAttunedDelta -= 6;

                const victimRes = await client.query(`
                SELECT citizen_id, name, profession
                FROM population_demographics
                WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
                ORDER BY (CASE WHEN temper = 'DESPERATE' THEN 1 WHEN temper = 'BITTER' THEN 2 ELSE 3 END), RANDOM()
                LIMIT 1
            `, [burg.burg_id]);

                if (victimRes.rows.length > 0) {
                    await client.query(`
                    UPDATE population_demographics
                    SET allegiance_status = 'DECEASED', cause_of_death = 'FAMINE_OR_PLAGUE'
                    WHERE citizen_id = $1
                `, [victimRes.rows[0].citizen_id]);
                }
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
                if (inventory[key] > 100000) inventory[key] = 100000;
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
                     unnest($13::float[]) as pop_growth_pool
            ) AS v
            WHERE b.burg_id = v.id
        `, [
                burgUpdates.map(u => u.id), burgUpdates.map(u => u.food), burgUpdates.map(u => u.wealth),
                burgUpdates.map(u => u.health), burgUpdates.map(u => u.unrest), burgUpdates.map(u => u.crime),
                burgUpdates.map(u => u.urbanTier), burgUpdates.map(u => u.architectureType),
                burgUpdates.map(u => u.pop_null || 0), burgUpdates.map(u => u.pop_attuned || 0),
                burgUpdates.map(u => u.demographics),
                burgUpdates.map(u => typeof u.military_forces === 'string' ? u.military_forces : JSON.stringify(u.military_forces || {})),
                burgUpdates.map(u => u.pop_growth_pool || 0.0)
            ]);
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




