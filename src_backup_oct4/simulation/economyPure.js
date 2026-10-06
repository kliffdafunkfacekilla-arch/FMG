"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRes = getRes;
exports.addRes = addRes;
exports.subRes = subRes;
exports.simulateBurgEconomy = simulateBurgEconomy;
const constants_1 = require("../engine/constants");
const factionModifiers_1 = require("./factionModifiers");
const ecologyPure_1 = require("./ecologyPure");
function getRes(inv, key) {
    return inv[key] || 0;
}
function addRes(inv, key, amount) {
    inv[key] = getRes(inv, key) + amount;
}
function subRes(inv, key, amount) {
    inv[key] = Math.max(0, getRes(inv, key) - amount);
}
function simulateBurgEconomy(burg, stockpile, inv, eco, inputs) {
    const { infraTypes, mayorTraitModifier, viceDenCount, month, biome, zLayer, hasPriest, hasCaptain, factionEconomyTrait, factionMagicTrait, factionId, mayorTraits, priestTraits, captainTraits, hasLeader, hasSecond, hasProxy } = inputs;
    const newBurg = { ...burg };
    const newStock = { ...stockpile };
    const newInv = { ...inv };
    let newEco = { ...eco };
    const newInfra = [];
    const isWinter = month >= 6 && month <= 8;
    const isShadowWeek = month === 8;
    const b = parseInt(biome);
    // POPULATION & LABOR POOL DYNAMICS
    let pop = newBurg.pop_null || 0;
    const WORKER_SIZE = 1000;
    let labor_pool = Math.floor(pop / WORKER_SIZE);
    if (labor_pool < 1)
        labor_pool = 1; // Minimum 1 worker to exist
    // Ring level dictates the max spatial capacity, but also the required maintenance.
    // Hamlet(0), Village(1), Town(2), City(3), Metropolis(4), Megalopolis(5)
    const ringCapacities = [2, 8, 20, 50, 100, 250];
    const max_spatial_harvest = ringCapacities[Math.min(5, newBurg.ring_level || 0)] || 2;
    const required_maintenance = (newBurg.ring_level || 0) + 1; // 1 for Hamlet, 2 for Village...
    let required_crafters = 0;
    if (infraTypes.has("WORKSHOP"))
        required_crafters += 1;
    if (infraTypes.has("FORGE"))
        required_crafters += 1;
    if (infraTypes.has("ALCHEMIST"))
        required_crafters += 1;
    // Allocate Workers
    let maintenance_workers = Math.min(labor_pool, required_maintenance);
    let remaining_labor = labor_pool - maintenance_workers;
    let crafter_workers = Math.min(remaining_labor, required_crafters);
    remaining_labor -= crafter_workers;
    let harvester_workers = remaining_labor;
    const harvestCap = Math.min(max_spatial_harvest, Math.max(1, harvester_workers));
    let unrestDelta = 0, healthDelta = 0;
    let wealthInc = Math.floor(pop * 0.05 * (1.0 + (factionEconomyTrait || 0) * 0.01));
    let deltas = { unrestDelta, healthDelta, wealthInc };
    if (factionModifiers_1.factionModifiers[factionId]?.applyPreHarvest) {
        factionModifiers_1.factionModifiers[factionId].applyPreHarvest(newBurg, newInv, newEco, inputs, deltas);
    }
    unrestDelta = deltas.unrestDelta;
    healthDelta = deltas.healthDelta;
    wealthInc = deltas.wealthInc;
    // PARAGON TRAIT EVALUATION (Cruel, Corrupt, Inspiring, etc.)
    const allTraits = [...mayorTraits, ...priestTraits, ...captainTraits];
    if (allTraits.includes("Cruel")) {
        unrestDelta -= 15; // Ruling by fear
        healthDelta -= 10;
    }
    if (allTraits.includes("Corrupt") || allTraits.includes("Greedy")) {
        wealthInc = Math.floor(wealthInc * 0.7); // Siphons 30% of baseline wealth!
        unrestDelta += 5;
    }
    if (allTraits.includes("Inspiring")) {
        healthDelta += 5;
        unrestDelta -= 5;
    }
    // SANITATION & DECAY
    // Only an issue if the burg lacks the workers to maintain its ring size!
    if (maintenance_workers < required_maintenance) {
        healthDelta -= 5 * (required_maintenance - maintenance_workers);
        unrestDelta += 10;
    }
    // 2. FOOD & ECOLOGY
    // First, advance the natural ecology cycle before human intervention
    newEco = (0, ecologyPure_1.simulateCellEcology)(newEco, 0, month);
    let foodGenerated = 0;
    if (infraTypes.has("FARM")) {
        let farmRate = isWinter ? 0.06 : 0.12;
        // Nulls are excellent at physical harvesting
        const nullHarvestBonus = 1.10;
        foodGenerated = Math.floor(pop * farmRate * (1.0 + mayorTraitModifier) * nullHarvestBonus);
    }
    else {
        const huntAmount = Math.min(newEco.eco_prey, 10 * harvestCap);
        newEco.eco_prey -= huntAmount;
        foodGenerated += Math.floor((huntAmount * WORKER_SIZE * 0.05));
    }
    // --- ADVANCED ECOLOGY: Overgrowth & Predator Attacks ---
    if (newEco.eco_predators > (newEco.eco_prey + 10)) {
        const starving_beasts = newEco.eco_predators - newEco.eco_prey;
        healthDelta -= Math.floor(starving_beasts * 0.1);
        foodGenerated = Math.max(0, foodGenerated - (starving_beasts * 2));
        newEco.eco_predators -= Math.floor(starving_beasts * 0.2); // Die off while attacking
    }
    // --- DOMESTICATION & TAMING (Phase 3) ---
    if (infraTypes.has("BEAST_TAMER")) {
        if (newEco.eco_prey >= 10) {
            newEco.eco_prey -= 10;
            addRes(newInv, "work_beasts", 2 * harvestCap);
            addRes(newInv, "pets", 2 * harvestCap);
        }
        if (newEco.eco_predators >= 5) {
            newEco.eco_predators -= 5;
            addRes(newInv, "war_mounts", 1 * harvestCap);
        }
        if ((newEco.eco_apex || 0) >= 1) {
            newEco.eco_apex = (newEco.eco_apex || 0) - 1;
            addRes(newInv, "war_mounts", 5 * harvestCap);
        }
    }
    if (getRes(newInv, "work_beasts") > 0) {
        foodGenerated += Math.floor(getRes(newInv, "work_beasts") * 5);
    }
    if (getRes(newInv, "pets") > 0) {
        unrestDelta -= Math.min(5, Math.floor(getRes(newInv, "pets") * 0.1));
    }
    // --- PLANT MUTATIONS (Phase 3) ---
    if (newEco.eco_plants > 150 && Math.random() < 0.05) {
        addRes(newInv, "exotic_flora", 1);
    }
    if (getRes(newInv, "exotic_flora") > 0) {
        healthDelta += 2; // Passive healing spores
    }
    if (newEco.eco_plants > 200 * harvestCap && month >= 5 && month <= 7) { // Summer Wildfire risk
        if (Math.random() < 0.1) {
            unrestDelta += 15;
            newEco.eco_plants = Math.floor(newEco.eco_plants * 0.5); // Burns half
            newInv["wood"] = Math.max(0, getRes(newInv, "wood") - 20 * harvestCap);
        }
    }
    // Eco Damage from wild harvesting
    if (!infraTypes.has("CAMP") && !infraTypes.has("MINE")) {
        // Stripping the land without sustainable infrastructure permanently degrades the cell
        newEco.eco_resources = Math.max(0, newEco.eco_resources - (1 * harvestCap));
    }
    // 3. RESOURCE EXTRACTION (Z-Layers)
    if (zLayer === -1) {
        // THE SUB-LAYER (Benthic / Underdark / Aquatic)
        addRes(newInv, "deep_sea_kelp", 5 * harvestCap);
        addRes(newInv, "cave_fungus", 5 * harvestCap);
        addRes(newInv, "stone", 10 * harvestCap); // Plenty of stone underground
        foodGenerated += Math.floor(50 * harvestCap * (1.0 + mayorTraitModifier)); // Ambient benthic food
        if (infraTypes.has("CAMP") || infraTypes.has("AQUACULTURE")) {
            addRes(newInv, "deep_sea_kelp", 30 * harvestCap);
            addRes(newInv, "cave_fungus", 30 * harvestCap);
            addRes(newInv, "bioluminescent_gland", 5 * harvestCap); // Rare aquatic asset
            foodGenerated += Math.floor(300 * harvestCap * (1.0 + mayorTraitModifier));
        }
        if (infraTypes.has("FARM")) {
            // Surface farms fail entirely in the sunless sub-layer
            foodGenerated = Math.floor(foodGenerated * 0.1);
            unrestDelta += 10;
        }
    }
    else {
        // THE SURFACE (Z = 0)
        addRes(newInv, "stone", (5 * harvestCap));
        addRes(newInv, "clay", (5 * harvestCap));
        addRes(newInv, "wood", (5 * harvestCap));
        if (infraTypes.has("CAMP")) {
            if ([6, 7, 8, 9].includes(b))
                addRes(newInv, "wood", 50 * harvestCap);
            else if ([1, 2, 3].includes(b))
                addRes(newInv, "fibre", (50 * harvestCap));
            else
                addRes(newInv, "herbs", (50 * harvestCap));
        }
    }
    if (infraTypes.has("MINE")) {
        addRes(newInv, "iron", (20 * harvestCap));
        addRes(newInv, "copper", (10 * harvestCap));
        addRes(newInv, "stone", (30 * harvestCap));
    }
    if (infraTypes.has("DEEP_MINE")) {
        addRes(newInv, "cleared_sub_space", (10 * harvestCap));
        if (getRes(newInv, "cleared_sub_space") > 500) {
            addRes(newInv, "gold", (5 * harvestCap));
            addRes(newInv, "silver", (10 * harvestCap));
            addRes(newInv, "crystals", (2 * harvestCap));
            addRes(newInv, "blackstone", (1 * harvestCap));
            wealthInc += 20 * harvestCap;
        }
    }
    if (infraTypes.has("SKY_PORT")) {
        addRes(newInv, "exotic", (5 * harvestCap));
        addRes(newInv, "aromatics", (10 * harvestCap));
        wealthInc += 15 * harvestCap;
    }
    if (factionModifiers_1.factionModifiers[factionId]?.applyPostHarvest) {
        factionModifiers_1.factionModifiers[factionId].applyPostHarvest(newBurg, newInv, newEco, inputs, harvestCap);
    }
    // 4. CRAFTING & REFINING (Requires Crafter Workers!)
    const craftingEfficiency = crafter_workers / Math.max(1, required_crafters);
    // Sparkborn bonus to magical/chemical refinement
    const sparkbornRefineBonus = 1.15;
    if (infraTypes.has("WORKSHOP") && crafter_workers > 0) {
        if (getRes(newInv, "wood") >= 20) {
            addRes(newInv, "refined_lumber", Math.floor(10 * craftingEfficiency));
            subRes(newInv, "wood", 20);
        }
        if (getRes(newInv, "fibre") >= 20) {
            addRes(newInv, "textile", Math.floor(10 * craftingEfficiency));
            subRes(newInv, "fibre", 20);
        }
    }
    if (infraTypes.has("FORGE") && crafter_workers > 0) {
        if (getRes(newInv, "iron") >= 20 && getRes(newInv, "wood") >= 10 && getRes(newInv, "stone") >= 10) {
            addRes(newInv, "forged_steel", Math.floor(10 * craftingEfficiency));
            subRes(newInv, "iron", 20);
            subRes(newInv, "wood", 10);
            subRes(newInv, "stone", 10);
        }
    }
    if (infraTypes.has("ALCHEMIST") && crafter_workers > 0) {
        if (getRes(newInv, "herbs") >= 20 && getRes(newInv, "crystals") >= 2) {
            addRes(newInv, "medicine", Math.floor(10 * craftingEfficiency * sparkbornRefineBonus));
            addRes(newInv, "alchemical_potions", Math.floor(5 * craftingEfficiency * sparkbornRefineBonus));
            subRes(newInv, "herbs", 20);
            subRes(newInv, "crystals", 2);
        }
    }
    // 5. VEHICLES & MILITARY UNITS (Drains Population!)
    if (infraTypes.has("WORKSHOP") && getRes(newInv, "refined_lumber") >= 50 && getRes(newInv, "textile") >= 20) {
        addRes(newInv, "wagon", 1);
        subRes(newInv, "refined_lumber", 50);
        subRes(newInv, "textile", 20);
    }
    if (infraTypes.has("SKY_PORT") && infraTypes.has("FORGE") && getRes(newInv, "forged_steel") >= 200 &&
        getRes(newInv, "textile") >= 150 && getRes(newInv, "dragon_stone_shard") >= 1) {
        addRes(newInv, "airship", 1);
        subRes(newInv, "forged_steel", 200);
        subRes(newInv, "textile", 150);
        subRes(newInv, "dragon_stone_shard", 1);
    }
    // MILITARY INFRASTRUCTURE & UNIT RECRUITMENT (Costs Worker Units!)
    if (infraTypes.has("FORT") && infraTypes.has("BARRACKS") && (newBurg.wealth + wealthInc) >= 200 && getRes(newInv, "forged_steel") >= 100 && pop >= 2000) {
        addRes(newInv, "infantry_battalion", 1);
        newBurg.wealth -= 200;
        subRes(newInv, "forged_steel", 100);
        pop -= WORKER_SIZE;
    }
    if (infraTypes.has("FORT") && infraTypes.has("STABLES") && (newBurg.wealth + wealthInc) >= 300 && getRes(newInv, "forged_steel") >= 100 && (newBurg.food + foodGenerated) >= 500 && pop >= 2000) {
        addRes(newInv, "cavalry_squadron", 1);
        newBurg.wealth -= 300;
        subRes(newInv, "forged_steel", 100);
        foodGenerated -= 500;
        pop -= WORKER_SIZE;
    }
    if (infraTypes.has("SIEGE_WORKSHOP") && getRes(newInv, "forged_steel") >= 200 && getRes(newInv, "refined_lumber") >= 200) {
        addRes(newInv, "siege_engine", 1);
        subRes(newInv, "forged_steel", 200);
        subRes(newInv, "refined_lumber", 200);
    }
    // 6. POPULATION PIPELINE // (Awakenings & Siphoning)
    let births = 0;
    let net_null_births = 0;
    const consumed = pop * 0.1;
    if (newBurg.food > consumed * 1.5 && newBurg.health > 50 && !isShadowWeek) {
        births = Math.floor(pop * 0.005);
        // The Awakening Check (One-Time at birth)
        let sparkRate = 0.05 + ((factionMagicTrait || 0) * 0.001); // High magic factions generate more Sparkborn
        let sparkborn_births = Math.floor(births * sparkRate);
        // 5% born with the Spark
        net_null_births = births - sparkborn_births;
        let awakened = Math.floor(sparkborn_births * 0.20); // 20% actually awaken
        let unawakened_spark = sparkborn_births - awakened;
        let mad_awakenings = Math.floor(awakened * 0.10);
        let cult_awakenings = Math.floor(awakened * 0.10);
        let warden_awakenings = awakened - mad_awakenings - cult_awakenings;
        addRes(newInv, "pop_mad", mad_awakenings);
        addRes(newInv, "pop_cult", cult_awakenings);
        if (factionModifiers_1.factionModifiers[factionId]?.applyAwakening) {
            factionModifiers_1.factionModifiers[factionId].applyAwakening(newBurg, newInv, inputs, warden_awakenings);
        }
        else {
            addRes(newInv, "pop_warden", warden_awakenings);
        }
        addRes(newInv, "pop_spark", unawakened_spark);
    }
    // Cultists & Outlaws Siphoning (Recruitment)
    // Increases growth rate in bad conditions!
    if ((newBurg.unrest ?? 0) > 60) {
        let recruits = Math.floor(pop * 0.01);
        addRes(newInv, "pop_outlaw", recruits);
        pop -= recruits;
    }
    if (((newBurg.health ?? 100) < 40 || viceDenCount > 0) && !priestTraits.includes("Zealous")) {
        let recruits = Math.floor(pop * 0.01);
        addRes(newInv, "pop_cult", recruits);
        pop -= recruits;
    }
    // Unit Generation Thresholds (1000 pop = 1 Unit)
    if (getRes(newInv, "pop_warden") >= 1000) {
        subRes(newInv, "pop_warden", 1000);
        addRes(newInv, "unit_warden", 1);
    }
    if (getRes(newInv, "pop_cult") >= 1000) {
        subRes(newInv, "pop_cult", 1000);
        addRes(newInv, "unit_cult", 1);
    }
    if (getRes(newInv, "pop_mad") >= 1000) {
        subRes(newInv, "pop_mad", 1000);
        addRes(newInv, "unit_mad_rogue", 1);
    }
    if (getRes(newInv, "pop_outlaw") >= 1000) {
        subRes(newInv, "pop_outlaw", 1000);
        addRes(newInv, "unit_outlaw", 1);
    }
    // Fringe Unit Behaviors & Clashes
    if (getRes(newInv, "unit_mad_rogue") > 0) {
        unrestDelta += 15; // Rogue mad power user wandering around causing trouble
        healthDelta -= 5;
    }
    if (getRes(newInv, "unit_cult") > 0) {
        healthDelta -= 10;
    }
    if (getRes(newInv, "unit_outlaw") > 0) {
        unrestDelta += 10;
        wealthInc = Math.floor(wealthInc * 0.5); // They steal half the income
    }
    // Wardens and Infantry actively hunt Outlaws/Cults/Madmen
    let captainDefenders = hasCaptain ? 1 : 0;
    if (hasCaptain && captainTraits.includes("Aggressive"))
        captainDefenders = 2;
    if (hasCaptain && captainTraits.includes("Passive"))
        captainDefenders = 0;
    let baseInfantry = getRes(newInv, "infantry_battalion");
    let metrics = { baseInfantry, totalFoodUpkeep: 0 };
    if (factionModifiers_1.factionModifiers[factionId]?.applyMilitaryUpkeep) {
        factionModifiers_1.factionModifiers[factionId].applyMilitaryUpkeep(newBurg, newInv, inputs, metrics);
    }
    baseInfantry = metrics.baseInfantry;
    // War Mounts are a massive force multiplier (count as 3 infantry units)
    const mountBonus = getRes(newInv, "war_mounts") * 3;
    let security_forces = baseInfantry + getRes(newInv, "unit_warden") + captainDefenders + mountBonus;
    // Sump-Kin Combat Scaling (0.5 per toxic point)
    if (factionId === constants_1.FACTIONS.SUMP_KIN) { // SUMP_KIN
        security_forces += Math.floor(getRes(newInv, "toxic_points") * 0.5);
    }
    let hostile_forces = getRes(newInv, "unit_outlaw") + getRes(newInv, "unit_cult") + getRes(newInv, "unit_mad_rogue");
    if (security_forces > 0 && hostile_forces > 0) {
        // Clashes kill 1 from each side
        if (getRes(newInv, "unit_warden") > 0 && getRes(newInv, "unit_mad_rogue") > 0) {
            subRes(newInv, "unit_warden", 1);
            subRes(newInv, "unit_mad_rogue", 1);
        }
        else if (getRes(newInv, "infantry_battalion") > 0 && getRes(newInv, "unit_outlaw") > 0) {
            subRes(newInv, "infantry_battalion", 1);
            subRes(newInv, "unit_outlaw", 1);
        }
        else if (getRes(newInv, "unit_warden") > 0 && getRes(newInv, "unit_cult") > 0) {
            subRes(newInv, "unit_warden", 1);
            subRes(newInv, "unit_cult", 1);
        }
    }
    // 7. UPKEEP & DECAY
    let totalWealthUpkeep = 0;
    let totalFoodUpkeep = 0;
    if (infraTypes.has("FORT"))
        totalWealthUpkeep += 50;
    if (infraTypes.has("HOSPITAL"))
        totalWealthUpkeep += 30;
    if (infraTypes.has("TEMPLE"))
        totalWealthUpkeep += 40;
    if (infraTypes.has("THEATER"))
        totalWealthUpkeep += 30;
    if (infraTypes.has("SKY_PORT"))
        totalWealthUpkeep += 100;
    if (infraTypes.has("DEEP_MINE"))
        totalWealthUpkeep += 80;
    if (infraTypes.has("BARRACKS"))
        totalWealthUpkeep += 20;
    if (infraTypes.has("STABLES"))
        totalWealthUpkeep += 40;
    if (infraTypes.has("SIEGE_WORKSHOP"))
        totalWealthUpkeep += 30;
    const infantries = newInv["infantry_battalion"] || 0;
    const cavalry = newInv["cavalry_squadron"] || 0;
    const siege = newInv["siege_engine"] || 0;
    totalWealthUpkeep += (cavalry * 20) + (siege * 30);
    totalFoodUpkeep += (cavalry * 100); // Horses eat a lot
    let upkeepCost = 10;
    if (hasCaptain) {
        upkeepCost = 5;
        if (captainTraits.includes("Aggressive"))
            upkeepCost = 10; // Aggressive captains drill hard, no discounts
        if (captainTraits.includes("Passive"))
            upkeepCost = 3; // Passive captains ignore maintenance
    }
    totalWealthUpkeep += (infantries * upkeepCost);
    let baseInfantryFood = 50;
    if (factionId === constants_1.FACTIONS.URSINE_HEGEMONY)
        baseInfantryFood = 100;
    totalFoodUpkeep += (infantries * baseInfantryFood); // Ursine Bears eat double
    // Ember Keepers offset thermal caloric drain
    const emberKeepers = newInv["unit_ember_keeper"] || 0;
    if (emberKeepers > 0) {
        totalFoodUpkeep = Math.max(0, totalFoodUpkeep - (emberKeepers * 100));
        totalWealthUpkeep = Math.max(0, totalWealthUpkeep - (emberKeepers * 50));
    }
    const airships = newInv["airship"] || 0;
    const hiveAirships = newInv["hive_airship"] || 0;
    totalWealthUpkeep += (airships * 50); // Standard airships cost wealth
    // Hive Airships cost 0 wealth upkeep (Bio-composite organic fleets)
    if (airships > 0) {
        if (getRes(newInv, "crystals") >= airships) {
            subRes(newInv, "crystals", airships);
        }
        else {
            newInv["airship"] = Math.max(0, airships - 1); // Crashed
        }
    }
    // Hive Airships do not require crystals. They have an organic Static Shield.
    if (wealthInc >= totalWealthUpkeep) {
        wealthInc -= totalWealthUpkeep;
    }
    else if (newBurg.wealth + wealthInc >= totalWealthUpkeep) {
        newBurg.wealth -= (totalWealthUpkeep - wealthInc);
        wealthInc = 0;
    }
    else {
        unrestDelta += 20;
        healthDelta -= 10;
        wealthInc = 0;
        newBurg.wealth = 0;
        if (infantries > 0) {
            newInv["infantry_battalion"] = infantries - 1; // Desertion
            // Deserters return to the civilian pool as angry Nulls
            pop += WORKER_SIZE;
            unrestDelta += 10;
        }
    }
    // 8. CONSTRUCTION AI
    const w = newBurg.wealth + wealthInc;
    if (zLayer === -1 && !infraTypes.has("AQUACULTURE") && w >= 100 && getRes(newInv, "stone") >= 50 && getRes(newInv, "refined_lumber") >= 20) {
        newBurg.wealth -= 100;
        subRes(newInv, "stone", 50);
        subRes(newInv, "refined_lumber", 20);
        newInfra.push("AQUACULTURE");
    }
    else if (!infraTypes.has("WORKSHOP") && w >= 50 && getRes(newInv, "wood") >= 100 && getRes(newInv, "stone") >= 50) {
        newBurg.wealth -= 50;
        subRes(newInv, "wood", 100);
        subRes(newInv, "stone", 50);
        newInfra.push("WORKSHOP");
    }
    else if (!infraTypes.has("FORGE") && w >= 80 && getRes(newInv, "stone") >= 150 && getRes(newInv, "clay") >= 50) {
        newBurg.wealth -= 80;
        subRes(newInv, "stone", 150);
        subRes(newInv, "clay", 50);
        newInfra.push("FORGE");
    }
    else if (!infraTypes.has("ALCHEMIST") && w >= 100 && getRes(newInv, "stone") >= 50 && getRes(newInv, "refined_lumber") >= 20) {
        newBurg.wealth -= 100;
        subRes(newInv, "stone", 50);
        subRes(newInv, "refined_lumber", 20);
        newInfra.push("ALCHEMIST");
    }
    else if (!infraTypes.has("THEATER") && w >= 150 && getRes(newInv, "refined_lumber") >= 100 && getRes(newInv, "textile") >= 50) {
        newBurg.wealth -= 150;
        subRes(newInv, "refined_lumber", 100);
        subRes(newInv, "textile", 50);
        newInfra.push("THEATER");
    }
    else if (!infraTypes.has("BEAST_TAMER") && w >= 120 && getRes(newInv, "refined_lumber") >= 50 && getRes(newInv, "fibre") >= 50) {
        newBurg.wealth -= 120;
        subRes(newInv, "refined_lumber", 50);
        subRes(newInv, "fibre", 50);
        newInfra.push("BEAST_TAMER");
    }
    else if (!infraTypes.has("BARRACKS") && infraTypes.has("FORT") && w >= 100 && getRes(newInv, "stone") >= 50) {
        newBurg.wealth -= 100;
        subRes(newInv, "stone", 50);
        newInfra.push("BARRACKS");
    }
    else if (!infraTypes.has("STABLES") && infraTypes.has("FORT") && w >= 150 && getRes(newInv, "refined_lumber") >= 100) {
        newBurg.wealth -= 150;
        subRes(newInv, "refined_lumber", 100);
        newInfra.push("STABLES");
    }
    else if (!infraTypes.has("SIEGE_WORKSHOP") && infraTypes.has("WORKSHOP") && w >= 200 && getRes(newInv, "forged_steel") >= 100) {
        newBurg.wealth -= 200;
        subRes(newInv, "forged_steel", 100);
        newInfra.push("SIEGE_WORKSHOP");
    }
    else if (!infraTypes.has("FORT") && w >= 100
        && getRes(newInv, "stone") >= 100 && getRes(newInv, "forged_steel") >= 50 && getRes(newInv, "refined_lumber") >= 20) {
        newBurg.wealth -= 100;
        subRes(newInv, "stone", 100);
        subRes(newInv, "forged_steel", 50);
        subRes(newInv, "refined_lumber", 20);
        newInfra.push("FORT");
    }
    else if (!infraTypes.has("DEEP_MINE") && w >= 200 && getRes(newInv, "forged_steel") >= 100 && getRes(newInv, "refined_lumber") >= 100) {
        newBurg.wealth -= 200;
        subRes(newInv, "forged_steel", 100);
        subRes(newInv, "refined_lumber", 100);
        newInfra.push("DEEP_MINE");
    }
    if (factionModifiers_1.factionModifiers[factionId]?.applyConstruction) {
        factionModifiers_1.factionModifiers[factionId].applyConstruction(newBurg, newInv, inputs, w, newInfra);
    }
    // 9. HEATING & CONSUMPTION
    if (isWinter || isShadowWeek) {
        if (getRes(newInv, "wood") >= 10 * harvestCap) {
            subRes(newInv, "wood", 10 * harvestCap);
        }
        else {
            healthDelta -= 10;
            unrestDelta += 20;
        }
    }
    if (viceDenCount > 0) {
        unrestDelta -= (15 * viceDenCount);
        healthDelta -= (5 * viceDenCount);
        addRes(newInv, "narcotic", (5 * viceDenCount));
    }
    if (getRes(newInv, "spice") > 5) {
        subRes(newInv, "spice", 5);
        unrestDelta -= 5;
        healthDelta += 2;
    }
    if (infraTypes.has("THEATER"))
        unrestDelta -= 15;
    if (infraTypes.has("TEMPLE"))
        unrestDelta -= 10;
    let postConsDeltas = { unrestDelta, healthDelta };
    let capDefRef = { value: captainDefenders };
    if (factionModifiers_1.factionModifiers[factionId]?.applyPostConsumption) {
        factionModifiers_1.factionModifiers[factionId].applyPostConsumption(newBurg, newInv, newEco, inputs, postConsDeltas, capDefRef);
    }
    unrestDelta = postConsDeltas.unrestDelta;
    healthDelta = postConsDeltas.healthDelta;
    captainDefenders = capDefRef.value;
    if (hasPriest) {
        unrestDelta -= 10;
        healthDelta += 5;
        if (priestTraits.includes("Zealous"))
            unrestDelta += 5; // Strict religious laws cause some unrest...
    }
    if (infraTypes.has("HOSPITAL"))
        healthDelta += 10;
    newBurg.health = Math.max(0, Math.min(100, (newBurg.health ?? 100) + healthDelta));
    let deaths = 0;
    if (newBurg.health < 100) {
        const mortalityRate = ((100 - newBurg.health) / 100) * 0.02;
        deaths = Math.floor(pop * mortalityRate);
    }
    // Births are now handled in the Population Pipeline (Phase 6)
    newBurg.food = Math.floor(Math.max(0, (newBurg.food || 0) + foodGenerated - consumed - totalFoodUpkeep));
    newBurg.wealth = Math.floor(Math.max(0, (newBurg.wealth || 0) + wealthInc));
    newBurg.unrest = Math.floor(Math.max(0, (newBurg.unrest || 0) + unrestDelta));
    newBurg.pop_null = Math.floor(Math.max(0, pop - deaths + net_null_births));
    return { burg: newBurg, stockpile: newStock, inv: newInv, eco: newEco, newInfra };
}
//# sourceMappingURL=economyPure.js.map