export interface Attributes {
    might: number;
    endurance: number;
    finesse: number;
    reflex: number;
    vitality: number;
    fortitude: number;
    knowledge: number;
    logic: number;
    awareness: number;
    intuition: number;
    charm: number;
    willpower: number;
}
export interface DerivedPools {
    health: number;
    stamina: number;
    composure: number;
    focus: number;
}
/**
 * Calculates derived stats based on the custom 12-attribute architecture.
 */
export declare function calculateDerivedPools(attr: Attributes): DerivedPools;
//# sourceMappingURL=customRulesEngine.d.ts.map