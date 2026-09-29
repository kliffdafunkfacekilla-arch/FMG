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

// Predefined tag profiles for quick instantiation
export const DEFAULT_TAG_PROFILES: Record<string, UniversalTag[]> = {
  // Weapons
  'Executioner Greatsword': ['HEAVY', 'METAL', 'SOLID'],
  'Duelling Rapier': ['LIGHT', 'METAL', 'SOLID'],
  'Composite Warbow': ['WOOD', 'LIGHT', 'FRAGILE'],
  
  // Armors
  'Gothic Full Plate': ['HEAVY', 'METAL', 'SOLID', 'COVER'],
  'Riveted Chainmail': ['HEAVY', 'METAL', 'SOLID'],
  
  // Environment Tiles
  'Stone Floor': ['SOLID', 'STONE', 'STABLE_MATTER'],
  'Wooden Barricade': ['WOOD', 'SOLID', 'COVER', 'FLAMMABLE'],
  'Oil Puddle': ['LIQUID', 'FLAMMABLE'],
  'Aether Crystal': ['FRAGILE', 'AETHER_CHARGED', 'SHOCK']
};

