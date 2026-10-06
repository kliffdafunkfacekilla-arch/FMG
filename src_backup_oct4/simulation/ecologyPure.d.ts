export interface CellEcologyState {
    eco_plants: number;
    eco_prey: number;
    eco_predators: number;
    eco_apex?: number;
    eco_blight?: number;
    eco_disease?: number;
    eco_resources: number;
}
export declare function simulateCellEcology(state: CellEcologyState, drain?: number, month?: number): CellEcologyState;
export declare function detectEcologyAnomaly(state: CellEcologyState): string;
export declare function calculateGlobalEcologyRegen(plants: number, prey: number): {
    plants: number;
    prey: number;
};
//# sourceMappingURL=ecologyPure.d.ts.map