export interface MasterAbilityEntry {
    attribute: string;
    archetypeFlavor: string;
    magicPower: {
        name: string;
        description: string;
        resourceCost: number;
    };
    nullAlternative: {
        name: string;
        description: string;
        resourceCost: number;
    };
    offensiveSkill: {
        name: string;
        basicAbilityName: string;
        mechanic: string;
    };
    defensiveSkill: {
        name: string;
        basicAbilityName: string;
        mechanic: string;
    };
}
export declare const MASTER_ABILITY_REGISTRY: Record<string, MasterAbilityEntry>;
//# sourceMappingURL=masterAbilityRegistry.d.ts.map