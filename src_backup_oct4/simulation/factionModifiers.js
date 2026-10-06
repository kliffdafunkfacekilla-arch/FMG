"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factionModifiers = void 0;
const economyPure_1 = require("./economyPure");
const constants_1 = require("../engine/constants");
exports.factionModifiers = {
    [constants_1.FACTIONS.HIVE_COMMONWEALTH]: {
        applyPreHarvest: (burg, inv, eco, inputs, deltas) => {
            if (inputs.hasSecond) {
                // The Stationary Queen's cognitive tether creates absolute stability
                deltas.unrestDelta -= 50;
                deltas.healthDelta += 10;
            }
        }
    },
    [constants_1.FACTIONS.HEARTLAND_ALLIANCE]: {
        applyPreHarvest: (burg, inv, eco, inputs, deltas) => {
            // The Golden Warrens (Rat Director Debt Grip)
            if (inputs.hasProxy) {
                deltas.wealthInc = Math.floor(deltas.wealthInc * 1.3); // Yakuza-style debt extraction
            }
        }
    },
    [constants_1.FACTIONS.MERIDIAN_CHAIN]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            // Aquatic supremacy: Deep sea resources even if surface
            if (inputs.infraTypes.has("PORT")) {
                (0, economyPure_1.addRes)(inv, "deep_sea_kelp", 25 * harvestCap);
                (0, economyPure_1.addRes)(inv, "crystals", 2 * harvestCap); // They harvest deep-sea arcane crystals
            }
        }
    },
    [constants_1.FACTIONS.THEOCRACY]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            // Aquatic religious order: Harvests bioluminescence and kelp
            if (inputs.infraTypes.has("PORT")) {
                (0, economyPure_1.addRes)(inv, "deep_sea_kelp", 20 * harvestCap);
                (0, economyPure_1.addRes)(inv, "bioluminescent_gland", 5 * harvestCap); // For religious rituals
            }
        }
    },
    [constants_1.FACTIONS.RIVER_FOLK]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            if (inputs.infraTypes.has("PORT")) {
                // Sail-Cipher (Red & White Strobe): Ranidae Apothecary on site
                (0, economyPure_1.addRes)(inv, "medicine", 15 * harvestCap);
                // Aquatic dominance
                (0, economyPure_1.addRes)(inv, "deep_sea_kelp", 20 * harvestCap);
                (0, economyPure_1.addRes)(inv, "bioluminescent_gland", 2 * harvestCap);
            }
        }
    },
    [constants_1.FACTIONS.SUMP_KIN]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            (0, economyPure_1.addRes)(inv, "bog_mud", 10 * harvestCap);
            (0, economyPure_1.addRes)(inv, "swamp_herbs", 5 * harvestCap);
            if (inputs.hasLeader) {
                (0, economyPure_1.addRes)(inv, "toxic_points", 5);
            }
        },
        applyConstruction: (burg, inv, inputs, w, newInfra) => {
            if (!inputs.infraTypes.has("SWAMP_FACTORY") && w >= 120 && (0, economyPure_1.getRes)(inv, "bog_mud") >= 50 && (0, economyPure_1.getRes)(inv, "swamp_herbs") >= 30) {
                burg.wealth -= 120;
                (0, economyPure_1.subRes)(inv, "bog_mud", 50);
                (0, economyPure_1.subRes)(inv, "swamp_herbs", 30);
                newInfra.push("SWAMP_FACTORY");
            }
        }
    },
    [constants_1.FACTIONS.AVIAN_EMPIRE]: {
        applyAwakening: (burg, inv, inputs, warden_awakenings) => {
            if (inputs.zLayer === 1) {
                // Avians generate Coin Wardens (Financial warfare vs Cults)
                (0, economyPure_1.addRes)(inv, "pop_coin_warden", warden_awakenings);
                if ((0, economyPure_1.getRes)(inv, "pop_coin_warden") >= 1000) {
                    (0, economyPure_1.addRes)(inv, "unit_coin_warden", 1);
                    (0, economyPure_1.subRes)(inv, "pop_coin_warden", 1000);
                }
            }
            else {
                (0, economyPure_1.addRes)(inv, "pop_warden", warden_awakenings);
            }
        }
    },
    [constants_1.FACTIONS.URSINE_HEGEMONY]: {
        applyAwakening: (burg, inv, inputs, warden_awakenings) => {
            // Ursine Sparkborn are drafted into the Ember Keepers
            (0, economyPure_1.addRes)(inv, "pop_ember_keeper", warden_awakenings);
            if ((0, economyPure_1.getRes)(inv, "pop_ember_keeper") >= 1000) {
                (0, economyPure_1.addRes)(inv, "unit_ember_keeper", 1);
                (0, economyPure_1.subRes)(inv, "pop_ember_keeper", 1000);
            }
        },
        applyMilitaryUpkeep: (burg, inv, inputs, metrics) => {
            metrics.baseInfantry *= 2; // Ursine Infantry count as 2 Defenders due to massive size
            // We can't directly multiply totalFoodUpkeep here easily without recalculating it, but we can return it or use an object ref.
            // But let's handle the specific calculation below.
        },
        applyPostConsumption: (burg, inv, eco, inputs, deltas, captainDefenders) => {
            if (inputs.infraTypes.has("FORGE")) {
                // The 360-Hearth: Communal fire is the foundation of trust.
                deltas.unrestDelta -= 20;
                deltas.healthDelta += 10;
                if ((0, economyPure_1.getRes)(inv, "copper") >= 5) {
                    (0, economyPure_1.subRes)(inv, "copper", 5);
                    deltas.unrestDelta -= 30; // Natively crushes all outlaw infiltration attempts
                    captainDefenders.value += 2; // Guard efficiency skyrockets
                }
            }
            if (inputs.biome === "MOUNTAIN") {
                // The Hegemony is biologically engineered for the freezing, high-altitude peaks
                if ((0, economyPure_1.getRes)(inv, "raw_ore") > 0)
                    inv["raw_ore"] = Math.floor((0, economyPure_1.getRes)(inv, "raw_ore") * 1.5);
                if ((0, economyPure_1.getRes)(inv, "stone") > 0)
                    inv["stone"] = Math.floor((0, economyPure_1.getRes)(inv, "stone") * 1.5);
            }
        }
    },
    [constants_1.FACTIONS.GUERRILLA_CLANS]: {},
    [constants_1.FACTIONS.SYLVANIA]: {},
    [constants_1.FACTIONS.RELIENCE]: {},
    [constants_1.FACTIONS.EASTERN_HOUNDS]: {},
    [constants_1.FACTIONS.IRON_CALADRA]: {},
    [constants_1.FACTIONS.CANOPY_CLANS]: {},
    [constants_1.FACTIONS.SCUTE]: {},
    [constants_1.FACTIONS.DUSK_HUSK_RIDERS]: {},
    [constants_1.FACTIONS.PRISM_COLLECTIVE]: {},
    [constants_1.FACTIONS.VANEER]: {},
    [constants_1.FACTIONS.FLOWER_VALLEY]: {},
};
//# sourceMappingURL=factionModifiers.js.map