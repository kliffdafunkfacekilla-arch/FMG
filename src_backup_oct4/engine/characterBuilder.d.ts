import { Attributes } from './customRulesEngine';
export type CreatureType = 'MAMMAL' | 'AVIAN' | 'REPTILE' | 'INSECT' | 'AQUATIC' | 'PLANT';
interface StatModifierMap {
    body: {
        might: number;
        endurance: number;
        finesse: number;
        reflex: number;
        vitality: number;
        fortitude: number;
    };
    mind: {
        knowledge: number;
        logic: number;
        awareness: number;
        intuition: number;
        charm: number;
        willpower: number;
    };
}
/**
 * Encodes the exact Body and Mind modifier matrices for the 6 creature types.
 * Modifiers follow the strict +2, +1, 0, 0, -1, -2 distribution.
 */
export declare const CREATURE_TYPE_MODIFIERS: Record<CreatureType, StatModifierMap>;
/**
 * Initializes a character with a baseline score of 2 in all 12 attributes,
 * then applies the selected creature type modifiers (clamped between 1 and 10).
 */
export declare function buildCharacterAttributes(creatureType: CreatureType): Attributes;
export {};
//# sourceMappingURL=characterBuilder.d.ts.map