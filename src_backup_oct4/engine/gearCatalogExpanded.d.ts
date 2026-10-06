export interface DetailedGearDefinition {
    gearId: string;
    name: string;
    category: 'MELEE_WEAPON' | 'RANGED_WEAPON' | 'SOCIAL_WEAPON' | 'BODY_ARMOR' | 'MIND_ARMOR';
    primaryStat: string;
    secondaryStat: string;
    baseModifier: number;
    loadoutCost: number;
    resourcePool: 'STAMINA' | 'FOCUS';
}
export declare const EXPANDED_GEAR_CATALOG: DetailedGearDefinition[];
//# sourceMappingURL=gearCatalogExpanded.d.ts.map