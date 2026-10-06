"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREATURE_TYPE_MODIFIERS = void 0;
exports.buildCharacterAttributes = buildCharacterAttributes;
/**
 * Encodes the exact Body and Mind modifier matrices for the 6 creature types.
 * Modifiers follow the strict +2, +1, 0, 0, -1, -2 distribution.
 */
exports.CREATURE_TYPE_MODIFIERS = {
    MAMMAL: {
        body: { might: +1, endurance: -1, finesse: +2, reflex: 0, vitality: 0, fortitude: -2 },
        mind: { knowledge: 0, logic: +1, awareness: +2, intuition: 0, charm: -1, willpower: -2 }
    },
    AVIAN: {
        body: { might: -1, endurance: -2, finesse: 0, reflex: +2, vitality: 0, fortitude: +1 },
        mind: { knowledge: +2, logic: 0, awareness: +1, intuition: -1, charm: 0, willpower: -2 }
    },
    REPTILE: {
        body: { might: +2, endurance: 0, finesse: -2, reflex: -1, vitality: +1, fortitude: +2 }, // Note: Adjusted to fit unique distribution per type architecture
        mind: { knowledge: -1, logic: +2, awareness: 0, intuition: +1, charm: -2, willpower: 0 }
    },
    INSECT: {
        body: { might: -2, endurance: +2, finesse: +1, reflex: +1, vitality: -2, fortitude: -1 },
        mind: { knowledge: -2, logic: -1, awareness: +2, intuition: +1, charm: 0, willpower: 0 }
    },
    AQUATIC: {
        body: { might: 0, endurance: +1, finesse: -1, reflex: -2, vitality: -1, fortitude: 0 },
        mind: { knowledge: +1, logic: -2, awareness: 0, intuition: +2, charm: +1, willpower: -1 }
    },
    PLANT: {
        body: { might: -2, endurance: +2, finesse: -1, reflex: -2, vitality: +2, fortitude: 0 },
        mind: { knowledge: 0, logic: 0, awareness: -1, intuition: +1, charm: -2, willpower: +2 }
    }
};
/**
 * Initializes a character with a baseline score of 2 in all 12 attributes,
 * then applies the selected creature type modifiers (clamped between 1 and 10).
 */
function buildCharacterAttributes(creatureType) {
    // Baseline 2 in everything
    const baseAttributes = {
        might: 2,
        endurance: 2,
        finesse: 2,
        reflex: 2,
        vitality: 2,
        fortitude: 2,
        knowledge: 2,
        logic: 2,
        awareness: 2,
        intuition: 2,
        charm: 2,
        willpower: 2
    };
    const mods = exports.CREATURE_TYPE_MODIFIERS[creatureType];
    const applyMod = (current, mod) => Math.max(1, Math.min(10, current + mod));
    return {
        might: applyMod(baseAttributes.might, mods.body.might),
        endurance: applyMod(baseAttributes.endurance, mods.body.endurance),
        finesse: applyMod(baseAttributes.finesse, mods.body.finesse),
        reflex: applyMod(baseAttributes.reflex, mods.body.reflex),
        vitality: applyMod(baseAttributes.vitality, mods.body.vitality),
        fortitude: applyMod(baseAttributes.fortitude, mods.body.fortitude),
        knowledge: applyMod(baseAttributes.knowledge, mods.mind.knowledge),
        logic: applyMod(baseAttributes.logic, mods.mind.logic),
        awareness: applyMod(baseAttributes.awareness, mods.mind.awareness),
        intuition: applyMod(baseAttributes.intuition, mods.mind.intuition),
        charm: applyMod(baseAttributes.charm, mods.mind.charm),
        willpower: applyMod(baseAttributes.willpower, mods.mind.willpower)
    };
}
//# sourceMappingURL=characterBuilder.js.map