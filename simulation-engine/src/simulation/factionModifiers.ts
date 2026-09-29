import { BurgEconomyState, StockpileState, CellEcologyState, EconomyInputs, addRes, subRes, getRes } from "./economyPure";
import { FACTIONS } from "../engine/constants";

export interface FactionModifier {
    applyPreHarvest?: (burg: BurgEconomyState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs, deltas: { unrestDelta: number, healthDelta: number, wealthInc: number }) => void;
    applyPostHarvest?: (burg: BurgEconomyState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs, harvestCap: number) => void;
    applyAwakening?: (burg: BurgEconomyState, inv: Record<string, number>, inputs: EconomyInputs, warden_awakenings: number) => void;
    applyMilitaryUpkeep?: (burg: BurgEconomyState, inv: Record<string, number>, inputs: EconomyInputs, metrics: { baseInfantry: number, totalFoodUpkeep: number }) => void;
    applyConstruction?: (burg: BurgEconomyState, inv: Record<string, number>, inputs: EconomyInputs, w: number, newInfra: string[]) => void;
    applyPostConsumption?: (burg: BurgEconomyState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs, deltas: { unrestDelta: number, healthDelta: number }, captainDefenders: { value: number }) => void;
}

export const factionModifiers: Record<number, FactionModifier> = {
    [FACTIONS.HIVE_COMMONWEALTH]: {
        applyPreHarvest: (burg, inv, eco, inputs, deltas) => {
            if (inputs.hasSecond) {
                // The Stationary Queen's cognitive tether creates absolute stability
                deltas.unrestDelta -= 50; 
                deltas.healthDelta += 10;
            }
        }
    },
    [FACTIONS.HEARTLAND_ALLIANCE]: {
        applyPreHarvest: (burg, inv, eco, inputs, deltas) => {
            // The Golden Warrens (Rat Director Debt Grip)
            if (inputs.hasProxy) {
                deltas.wealthInc = Math.floor(deltas.wealthInc * 1.3); // Yakuza-style debt extraction
            }
        }
    },

    [FACTIONS.MERIDIAN_CHAIN]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            // Aquatic supremacy: Deep sea resources even if surface
            if (inputs.infraTypes.has("PORT")) {
                addRes(inv, "deep_sea_kelp", 25 * harvestCap);
                addRes(inv, "crystals", 2 * harvestCap); // They harvest deep-sea arcane crystals
            }
        }
    },
    [FACTIONS.THEOCRACY]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            // Aquatic religious order: Harvests bioluminescence and kelp
            if (inputs.infraTypes.has("PORT")) {
                addRes(inv, "deep_sea_kelp", 20 * harvestCap);
                addRes(inv, "bioluminescent_gland", 5 * harvestCap); // For religious rituals
            }
        }
    },
    [FACTIONS.RIVER_FOLK]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            if (inputs.infraTypes.has("PORT")) {
                // Sail-Cipher (Red & White Strobe): Ranidae Apothecary on site
                addRes(inv, "medicine", 15 * harvestCap);
                // Aquatic dominance
                addRes(inv, "deep_sea_kelp", 20 * harvestCap);
                addRes(inv, "bioluminescent_gland", 2 * harvestCap);
            }
        }
    },

    [FACTIONS.SUMP_KIN]: {
        applyPostHarvest: (burg, inv, eco, inputs, harvestCap) => {
            addRes(inv, "bog_mud", 10 * harvestCap);
            addRes(inv, "swamp_herbs", 5 * harvestCap);
            if (inputs.hasLeader) {
                addRes(inv, "toxic_points", 5);
            }
        },
        applyConstruction: (burg, inv, inputs, w, newInfra) => {
            if (!inputs.infraTypes.has("SWAMP_FACTORY") && w >= 120 && getRes(inv, "bog_mud") >= 50 && getRes(inv, "swamp_herbs") >= 30) {
                burg.wealth -= 120;
                subRes(inv, "bog_mud", 50);
                subRes(inv, "swamp_herbs", 30);
                newInfra.push("SWAMP_FACTORY");
            }
        }
    },
    [FACTIONS.AVIAN_EMPIRE]: {
        applyAwakening: (burg, inv, inputs, warden_awakenings) => {
            if (inputs.zLayer === 1) {
                // Avians generate Coin Wardens (Financial warfare vs Cults)
                addRes(inv, "pop_coin_warden", warden_awakenings);
                if (getRes(inv, "pop_coin_warden") >= 1000) {
                    addRes(inv, "unit_coin_warden", 1);
                    subRes(inv, "pop_coin_warden", 1000);
                }
            } else {
                addRes(inv, "pop_warden", warden_awakenings);
            }
        }
    },
    [FACTIONS.URSINE_HEGEMONY]: {
        applyAwakening: (burg, inv, inputs, warden_awakenings) => {
            // Ursine Sparkborn are drafted into the Ember Keepers
            addRes(inv, "pop_ember_keeper", warden_awakenings);
            if (getRes(inv, "pop_ember_keeper") >= 1000) {
                addRes(inv, "unit_ember_keeper", 1);
                subRes(inv, "pop_ember_keeper", 1000);
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
                
                if (getRes(inv, "copper") >= 5) {
                    subRes(inv, "copper", 5);
                    deltas.unrestDelta -= 30; // Natively crushes all outlaw infiltration attempts
                    captainDefenders.value += 2; // Guard efficiency skyrockets
                }
            }
            if (inputs.biome === "MOUNTAIN") {
                // The Hegemony is biologically engineered for the freezing, high-altitude peaks
                if (getRes(inv, "raw_ore") > 0) inv["raw_ore"] = Math.floor(getRes(inv, "raw_ore") * 1.5);
                if (getRes(inv, "stone") > 0) inv["stone"] = Math.floor(getRes(inv, "stone") * 1.5);
            }
        }
    },
    [FACTIONS.GUERRILLA_CLANS]: {},
    [FACTIONS.SYLVANIA]: {},
    [FACTIONS.RELIENCE]: {},
    [FACTIONS.EASTERN_HOUNDS]: {},
    [FACTIONS.IRON_CALADRA]: {},
    [FACTIONS.CANOPY_CLANS]: {},
    [FACTIONS.SCUTE]: {},
    [FACTIONS.DUSK_HUSK_RIDERS]: {},
    [FACTIONS.PRISM_COLLECTIVE]: {},
    [FACTIONS.VANEER]: {},
    [FACTIONS.FLOWER_VALLEY]: {},
};
