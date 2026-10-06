export type SizeClass = 'SMALL' | 'MEDIUM' | 'LARGE';
export type EcologicalRole = 'PREDATOR' | 'PREY';
export interface SubTypeClassification {
    subTypeName: string;
    sizeClass: SizeClass;
    ecologicalRole: EcologicalRole;
    statModifiers: {
        healthBonus: number;
        staminaMultiplier: number;
    };
}
/**
 * Registry of sub-types, size classifications, and ecological roles for each of the 6 creature types.
 */
export declare const CREATURE_SUBTYPES: Record<string, SubTypeClassification[]>;
//# sourceMappingURL=creatureTaxonomy.d.ts.map