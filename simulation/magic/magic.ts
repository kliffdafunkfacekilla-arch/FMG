export type Wieldability = "innate" | "learned" | "item_bound" | "ritual" | "environmental";

export type EffectType = "creation" | "destruction" | "alteration" | "mind" | "healing" | "movement";

export interface MagicEntity {
  name: string;
  wieldability: Wieldability;
  cost: number;
  effectType: EffectType;
  [key: string]: unknown; // allow additional properties as per the schema
}
