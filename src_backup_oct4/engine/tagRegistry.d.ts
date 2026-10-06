export type ElementalTag = 'FLAMMABLE' | 'FREEZING' | 'SHOCK' | 'CORROSIVE' | 'RADIANT';
export type PhysicalTag = 'HEAVY' | 'LIGHT' | 'FRAGILE' | 'SOLID' | 'LIQUID' | 'GAS' | 'METAL' | 'WOOD' | 'STONE' | 'ORGANIC';
export type AethericTag = 'ATTUNED' | 'NULL_FIELD' | 'AETHER_CHARGED' | 'STABLE_MATTER';
export type TacticalTag = 'COVER' | 'OBSTACLE' | 'ELEVATED' | 'HAZARD' | 'PORTAL';
export type UniversalTag = ElementalTag | PhysicalTag | AethericTag | TacticalTag;
export interface TaggedEntity {
    id: string;
    name: string;
    category: 'CHARACTER' | 'WEAPON' | 'ARMOR' | 'GEAR' | 'ENVIRONMENT';
    tags: Set<UniversalTag>;
}
export declare const DEFAULT_TAG_PROFILES: Record<string, UniversalTag[]>;
//# sourceMappingURL=tagRegistry.d.ts.map