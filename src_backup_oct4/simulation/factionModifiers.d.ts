import { BurgEconomyState, CellEcologyState, EconomyInputs } from "./economyPure";
export interface FactionModifier {
    applyPreHarvest?: (burg: BurgEconomyState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs, deltas: {
        unrestDelta: number;
        healthDelta: number;
        wealthInc: number;
    }) => void;
    applyPostHarvest?: (burg: BurgEconomyState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs, harvestCap: number) => void;
    applyAwakening?: (burg: BurgEconomyState, inv: Record<string, number>, inputs: EconomyInputs, warden_awakenings: number) => void;
    applyMilitaryUpkeep?: (burg: BurgEconomyState, inv: Record<string, number>, inputs: EconomyInputs, metrics: {
        baseInfantry: number;
        totalFoodUpkeep: number;
    }) => void;
    applyConstruction?: (burg: BurgEconomyState, inv: Record<string, number>, inputs: EconomyInputs, w: number, newInfra: string[]) => void;
    applyPostConsumption?: (burg: BurgEconomyState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs, deltas: {
        unrestDelta: number;
        healthDelta: number;
    }, captainDefenders: {
        value: number;
    }) => void;
}
export declare const factionModifiers: Record<number, FactionModifier>;
//# sourceMappingURL=factionModifiers.d.ts.map