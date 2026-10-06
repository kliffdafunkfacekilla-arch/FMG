"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBurgOperationsAgent = runBurgOperationsAgent;
async function runBurgOperationsAgent(client, tick) {
    const burgRes = await client.query(`
        SELECT b.*, s.complex_inventory as current_inventory 
        FROM sim_burg_economy b
        LEFT JOIN sim_industrial_stockpiles s ON b.burg_id = s.burg_id
    `);
    const burgUpdates = [];
    const stockpileUpdates = [];
    const RESOURCE_TYPES = {
        "veg": "food", "meat": "food", "fruit": "food", "root_veg": "food", "grain": "food", "lard": "food",
        "stone": "mats", "clay": "mats", "fibre": "mats", "wood": "mats", "leather": "mats", "adhesive": "mats",
        "reagents": "lux", "poison": "lux", "mounts": "lux", "ivory": "lux", "gems": "lux", "fur": "lux",
        "draftbeasts": "lux", "wool": "lux", "pets": "lux", "errand_beasts": "lux", "companion_beasts": "lux",
        "herbs": "lux", "medicine": "lux", "codependent_beasts": "lux"
    };
    const CRAFTING_TREE = {
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
    for (const burg of burgRes.rows) {
        const pop = burg.pop_null || 0;
        let urbanTier = burg.urban_tier || 1;
        const gatherRate = 1 + urbanTier;
        const totalWorkers = Math.floor(pop / 10);
        let wFood = 0, wMats = 0, wLux = 0, wCivil = 0, wSec = 0, wSoc = 0;
        const fullBlocks = Math.floor(totalWorkers / 12);
        wFood += fullBlocks * 6;
        wMats += fullBlocks * 2;
        wLux += fullBlocks * 1;
        wCivil += fullBlocks * 1;
        wSec += fullBlocks * 1;
        wSoc += fullBlocks * 1;
        const remainder = totalWorkers % 12;
        let r = remainder;
        const rFood = Math.min(r, 6);
        wFood += rFood;
        r -= rFood;
        const rMats = Math.min(r, 2);
        wMats += rMats;
        r -= rMats;
        const rLux = Math.min(r, 1);
        wLux += rLux;
        r -= rLux;
        const rCivil = Math.min(r, 1);
        wCivil += rCivil;
        r -= rCivil;
        const rSec = Math.min(r, 1);
        wSec += rSec;
        r -= rSec;
        const rSoc = Math.min(r, 1);
        wSoc += rSoc;
        r -= rSoc;
        // Generic Simulation Math
        let foodProduced = wFood * gatherRate;
        let luxProduced = wLux * gatherRate;
        let foodDelta = foodProduced - pop;
        // MILITARY POPULATION & CONSUMPTION
        let military = {};
        try {
            if (burg.military_forces) {
                const parsed = JSON.parse(burg.military_forces);
                for (const k in parsed)
                    military[k.toLowerCase()] = parsed[k];
            }
        }
        catch (e) { }
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
            // Then civilians die
            if (shortfall > 0) {
                starvationDeaths = Math.min(burg.pop_null || 0, shortfall);
            }
        }
        // --- SPECIFIC RESOURCE GATHERING ---
        let profile = { slots: [] };
        try {
            if (burg.resource_profile)
                profile = JSON.parse(burg.resource_profile);
        }
        catch (e) { }
        const slots = profile.slots || [];
        const weights = { food: 0, mats: 0, lux: 0 };
        const categorizedSlots = { food: [], mats: [], lux: [] };
        for (const slot of slots) {
            const type = RESOURCE_TYPES[slot.res] || "mats";
            weights[type] += slot.workers;
            categorizedSlots[type].push(slot);
        }
        let inventory = {};
        try {
            if (burg.current_inventory)
                inventory = JSON.parse(burg.current_inventory);
        }
        catch (e) { }
        const distribute = (availableWorkers, typeStr) => {
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
                let availableRefined = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.refined === k)).sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));
                for (const refKey of availableRefined) {
                    if (maxCrafts <= 0)
                        break;
                    let possible = Math.floor((inventory[refKey] || 0) / 2);
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
                let availableRaw = Object.keys(inventory).filter(k => CRAFTING_TREE[k] !== undefined).sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));
                for (const rawKey of availableRaw) {
                    if (maxRefines <= 0)
                        break;
                    let possible = Math.floor((inventory[rawKey] || 0) / 2);
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
        const consumeSpecific = (poolType, amount) => {
            let remaining = amount;
            let keys = [];
            if (poolType === "raw")
                keys = Object.keys(inventory).filter(k => CRAFTING_TREE[k]);
            else if (poolType === "refined")
                keys = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.refined === k));
            else if (poolType === "crafted")
                keys = Object.keys(inventory).filter(k => Object.values(CRAFTING_TREE).some(t => t.crafted === k));
            keys.sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));
            for (const k of keys) {
                if (remaining <= 0)
                    break;
                let take = Math.min((inventory[k] || 0), remaining);
                inventory[k] -= take;
                remaining -= take;
            }
            return remaining; // returns deficit
        };
        const tryConsume = (acceptableKeys, amount) => {
            let remaining = amount;
            for (const key of acceptableKeys) {
                if (remaining <= 0)
                    break;
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
        if (urbanTier === 2)
            failedMaint = consumeSpecific("raw", fullBlocks);
        else if (urbanTier === 3)
            failedMaint = consumeSpecific("refined", fullBlocks);
        else if (urbanTier >= 4)
            failedMaint = consumeSpecific("crafted", fullBlocks);
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
        }
        else if (urbanTier === 2 && pop >= targetPop && totalRefined >= 1000) {
            consumeSpecific("refined", 1000);
            urbanTier = 3; // Upgrades to Town
        }
        else if (urbanTier >= 3 && pop >= targetPop && totalCrafted >= 1000 * Math.pow(2, urbanTier - 3)) {
            consumeSpecific("crafted", 1000 * Math.pow(2, urbanTier - 3));
            urbanTier += 1; // Upgrades to City / Metropolis
        }
        // Apply Final Life/Death Diffs
        const newFood = Math.max(0, (burg.food || 0) + foodDelta);
        const newWealth = Math.max(0, (burg.wealth || 0) + luxProduced);
        const newHealth = Math.min(100, Math.max(0, (burg.health || 100) + healthDelta));
        const newUnrest = Math.min(100, Math.max(0, (burg.unrest || 0) + unrestDelta));
        const newCrime = Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta));
        const newPopNull = Math.max(0, (burg.pop_null || 0) - (starvationDeaths || 0));
        for (const key in inventory) {
            if (inventory[key] > 100000)
                inventory[key] = 100000;
        }
        burgUpdates.push({
            id: burg.burg_id,
            food: newFood,
            wealth: newWealth,
            health: newHealth,
            unrest: newUnrest,
            crime: newCrime,
            urbanTier: urbanTier
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
              urban_tier = v.urban_tier, pop_null = v.pop_null, military_forces = v.military_forces::jsonb
            FROM (
              SELECT unnest($1::int[]) as id,
                     unnest($2::int[]) as food,
                     unnest($3::int[]) as wealth,
                     unnest($4::int[]) as health,
                     unnest($5::int[]) as unrest,
                     unnest($6::int[]) as crime,
                     unnest($7::int[]) as urban_tier
            ) AS v
            WHERE b.burg_id = v.id
        `, [
            burgUpdates.map(u => u.id), burgUpdates.map(u => u.food), burgUpdates.map(u => u.wealth),
            burgUpdates.map(u => u.health), burgUpdates.map(u => u.unrest), burgUpdates.map(u => u.crime),
            burgUpdates.map(u => u.urbanTier)
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
}
//# sourceMappingURL=burgOperationsAgent.js.map