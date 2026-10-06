interface ParagonTrait {
    name: string;
    modifier: number;
    target: string;
}
/**
 * Applies Paragon trait skews to base simulation values.
 */
export declare function applyParagonSkew(baseValue: number, traits: ParagonTrait[], targetKey: string): number;
/**
 * Executes monthly faction upkeep, diplomatic shifts, and leadership trait checks.
 */
export declare function executeFactionAndDiplomacyTick(seed: string): Promise<void>;
export {};
//# sourceMappingURL=factionEngine.d.ts.map