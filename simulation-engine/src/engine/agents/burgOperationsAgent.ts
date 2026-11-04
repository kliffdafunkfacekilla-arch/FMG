import { tagBurgCitizens } from "./citizenPersonaHelper";

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
    } catch (e) {}
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
    if (tick % 44 === 0) {
        // Natural maturation: advance child ages each month
        await client.query("UPDATE population_demographics SET age = age + 1 WHERE life_stage = 'CHILD'").catch(() => {});
    }

    const burgRes = await client.query(`
        SELECT b.*, s.complex_inventory as current_inventory 
        FROM sim_burg_economy b
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
        if (burg.urban_tier <= 1 || burg.parent_burg_id) {
            // Hamlets & Villages focus on primary extraction (grain, livestock, ore, wood)
            wFood = Math.floor(productiveWorkers * 0.65);
            wMats = Math.floor(productiveWorkers * 0.25);
            wLux = Math.max(0, productiveWorkers - wFood - wMats);
        } else if (burg.urban_tier === 2) {
            // Towns: balanced regional aggregation, trade, secondary refining
            wFood = Math.floor(productiveWorkers * 0.40);
            wMats = Math.floor(productiveWorkers * 0.30);
            wLux = Math.max(0, productiveWorkers - wFood - wMats);
        } else {
            // Cities & Capitals: advanced manufacturing, luxury goods, high craftsmanship
            wFood = Math.floor(productiveWorkers * 0.20);
            wMats = Math.floor(productiveWorkers * 0.25);
            wLux = Math.max(0, productiveWorkers - wFood - wMats);
        }

        const foodYieldPerWorker = 22 + (urbanTier * 4);
        let foodProduced = Math.floor(wFood * foodYieldPerWorker);
        let luxProduced = Math.floor(wLux * (3 + urbanTier * 2));
        
        let foodDelta = foodProduced - pop;

        // Hierarchical resource shipments to upstream hub
        if (burg.upstream_burg_id) {
            const shipRate = burg.parent_burg_id ? 0.25 : (urbanTier === 1 ? 0.20 : (urbanTier === 2 ? 0.15 : 0.10));
            const foodShipment = foodDelta > 0 ? Math.floor(foodDelta * shipRate) : 0;
            const wealthShipment = luxProduced > 0 ? Math.floor(luxProduced * shipRate) : 0;

            if (foodShipment > 0 || wealthShipment > 0) {
                foodDelta -= foodShipment;
                luxProduced -= wealthShipment;
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
            luxProduced += receivedTribute.wealth;
        } 

        // MILITARY POPULATION & CONSUMPTION
        
        let military: any = {};
        try {
            if (burg.military_forces) {
                const parsed = typeof burg.military_forces === 'string' ? JSON.parse(burg.military_forces) : burg.military_forces;
                for (const k in parsed) military[k.toLowerCase()] = parsed[k];
            }
        } catch (e) {}


        let milPopEquivalent = (military.infantry || 0) * 100 + 
                               (military.ranged || 0) * 200 + 
                               (military.mounted || 0) * 300 + 
                               (military.airship || 0) * 400 + 
                               (military.mage || 0) * 1200;
                               
        foodDelta -= milPopEquivalent;
        
        let healthDelta = wCivil * 2;
        let unrestDelta = -(wSoc * 2);
        let crimeDelta = -(wSec * 2);
        
        // Death and Desertion from Starvation
        let starvationDeaths = 0;
        let militaryDesertions = 0;
        if ((burg.food || 0) + foodDelta < 0) {
            healthDelta -= 10;
            unrestDelta += 10;
            crimeDelta += 5;
            
            // Actually kill off pop/military
            let shortfall = Math.abs((burg.food || 0) + foodDelta);
            
            // First armies desert
            for (const type of Object.keys(military)) {
                if (military[type] > 0 && shortfall > 0) {
                    let desertion = Math.min(military[type], Math.ceil(shortfall / 100)); // Arbitrary equivalent
                    military[type] -= desertion;
                    shortfall -= desertion * 100;
                    militaryDesertions += desertion;
                }
            }
            
            // Then civilians suffer realistic famine attrition (5% of shortfall per tick)
            if (shortfall > 0) {
                starvationDeaths = Math.min(burg.pop_null || 0, Math.max(1, Math.ceil(shortfall * 0.05)));
            }
        }

        // --- SPECIFIC RESOURCE GATHERING ---
        let profile = { slots: [] };
        try {
            if (burg.resource_profile) profile = JSON.parse(burg.resource_profile);
        } catch (e) {}
        
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
        } catch (e) {}
        
        const distribute = (availableWorkers: number, typeStr: "food"|"mats"|"lux") => {
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
                inventory[slot.res] = (inventory[slot.res] || 0) + (assigned * gatherRate);
            }
        };
        
        distribute(wFood, "food");
        distribute(wMats, "mats");
        distribute(wLux, "lux");

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

        // Helper for specific consumption
        const consumeSpecific = (poolType: "raw"|"refined"|"crafted", amount: number) => {
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
            healthDelta -= Math.ceil(failedMaint / 2);
            unrestDelta += Math.ceil(failedMaint / 2);
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
            unrestDelta += Math.ceil(supplyDeficit / 2); 
            healthDelta -= Math.ceil(supplyDeficit / 5);
        }

        // --- TIER UPGRADES ---
        // Pop thresholds: 1200, 12000, 120000
        let targetPop = 1200 * Math.pow(10, urbanTier - 1); 
        
        const totalRaw = Object.keys(inventory).filter(k => CRAFTING_TREE[k]).reduce((sum, k) => sum + inventory[k], 0);
        const totalRefined = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.refined === k)).reduce((sum, k) => sum + inventory[k], 0);
        const totalCrafted = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.crafted === k)).reduce((sum, k) => sum + inventory[k], 0);

        if (urbanTier === 1 && pop >= targetPop && totalRaw >= 1000) {
            consumeSpecific("raw", 1000);
            urbanTier = 2; // Upgrades to Village
        } else if (urbanTier === 2 && pop >= targetPop && totalRefined >= 1000) {
            consumeSpecific("refined", 1000);
            urbanTier = 3; // Upgrades to Town
        } else if (urbanTier >= 3 && pop >= targetPop && totalCrafted >= 1000 * Math.pow(2, urbanTier - 3)) {
            consumeSpecific("crafted", 1000 * Math.pow(2, urbanTier - 3));
            urbanTier += 1; // Upgrades to City / Metropolis
        }

        // Apply Final Life/Death Diffs
        const newFood = Math.floor(Math.max(0, (burg.food || 0) + foodDelta));
        const newWealth = Math.floor(Math.max(0, (burg.wealth || 0) + luxProduced));
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
            await tagBurgCitizens(client, burg.burg_id, ['#FamineStricken', '#DesperateRationing'], 'DESPERATE', `Desperately searching for grain in ${burg.name} after severe famine struck.`, null, 6);
        } else if (newFood === 0 && (burg.food || 0) > 0) {
            burgEvents.push({
                tick,
                type: 'BURG_FAMINE',
                message: `Granaries run completely dry in ${burg.name}! Food deficit reaches ${Math.abs(foodDelta)}. Citizens face imminent starvation.`,
                tier: 'MAJOR',
                burg_id: burg.burg_id,
                lore_date: loreDate
            });
            await tagBurgCitizens(client, burg.burg_id, ['#FamineStricken', '#BreadRioter'], 'ANGRY', `Threatening to storm the municipal granaries of ${burg.name} as bread supplies ran out.`, '%laborer%', 4);
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

        // Bandit Activity Emergence (Driven strictly by extreme famine, starvation, or anti-government unrest)
        if (starvationDeaths > 3 || (newFood === 0 && foodDelta < -150) || newUnrest >= 60) {
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

                // Displaced highwaymen ambush passing supply caravans along the outskirts
                if (Math.random() < 0.45) {
                    burgEvents.push({
                        tick,
                        type: 'CARAVAN_AMBUSH',
                        message: `CARAVAN AMBUSH: Desperate famine-refugee bandits from ${burg.name} ambushed a supply wagon along the outskirts, looting food provisions!`,
                        tier: 'MINOR',
                        burg_id: burg.burg_id,
                        lore_date: loreDate
                    });
                }
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
            const birthRate = 0.003 * (newHealth / 100) * (1 - newUnrest / 150);
            births = Math.floor(pop * birthRate);
            if (pop < 100 && newFood > pop * 2 && Math.random() < 0.6) {
                births = Math.max(1, births);
            }
        }
        // 12-to-1 Demographic Growth, Maturation & Immigration
        let growthPool = (Number(burg.pop_growth_pool) || 0) + (births - (starvationDeaths || 0));
        let popNullDelta = 0;
        let popAttunedDelta = 0;

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
                     unnest($8::int[]) as pop_null,
                     unnest($9::int[]) as pop_attuned,
                     unnest($10::text[]) as demographics,
                     unnest($11::text[]) as military_forces,
                     unnest($12::float[]) as pop_growth_pool
            ) AS v
            WHERE b.burg_id = v.id
        `, [
            burgUpdates.map(u => u.id), burgUpdates.map(u => u.food), burgUpdates.map(u => u.wealth),
            burgUpdates.map(u => u.health), burgUpdates.map(u => u.unrest), burgUpdates.map(u => u.crime),
            burgUpdates.map(u => u.urbanTier), burgUpdates.map(u => u.pop_null || 0),
            burgUpdates.map(u => u.pop_attuned || 0), burgUpdates.map(u => u.demographics),
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
        for (const ev of burgEvents) {
            await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [ev.tick, ev.type, ev.message, ev.tier, ev.burg_id, ev.lore_date]);
        }
    }
}




