export interface BurgEconomyState {
    burg_id: number;
    food: number;
    wealth: number;
    unrest: number;
    health: number;
    pop_null: number;
    ring_level: number;
    tier: string;
    demographics?: string;
}
export interface StockpileState {
    raw_wood: number;
    raw_ore: number;
    raw_herbs: number;
    raw_fiber: number;
    refined_lumber: number;
    forged_steel: number;
    alchemical_potions: number;
    textiles: number;
}
import { CellEcologyState } from "./ecologyPure";
export type { CellEcologyState };
export interface EconomyInputs {
    infraTypes: Set<string>;
    mayorTraitModifier: number;
    viceDenCount: number;
    month: number;
    biome: string;
    zLayer: number;
    hasPriest: boolean;
    hasCaptain: boolean;
    factionEconomyTrait: number;
    factionMagicTrait: number;
    factionId: number;
    mayorTraits: string[];
    priestTraits: string[];
    captainTraits: string[];
    hasLeader: boolean;
    hasSecond: boolean;
    hasProxy: boolean;
}
export declare function getRes(inv: Record<string, number>, key: string): number;
export declare function addRes(inv: Record<string, number>, key: string, amount: number): void;
export declare function subRes(inv: Record<string, number>, key: string, amount: number): void;
export declare function simulateBurgEconomy(burg: BurgEconomyState, stockpile: StockpileState, inv: Record<string, number>, eco: CellEcologyState, inputs: EconomyInputs): {
    burg: BurgEconomyState;
    stockpile: StockpileState;
    inv: Record<string, number>;
    eco: CellEcologyState;
    newInfra: string[];
};
//# sourceMappingURL=economyPure.d.ts.map