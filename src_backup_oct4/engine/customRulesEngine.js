"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDerivedPools = calculateDerivedPools;
/**
 * Calculates derived stats based on the custom 12-attribute architecture.
 */
function calculateDerivedPools(attr) {
    return {
        health: attr.vitality + attr.reflex + attr.might,
        stamina: attr.fortitude + attr.finesse + attr.endurance,
        composure: attr.logic + attr.intuition + attr.charm,
        focus: attr.knowledge + attr.awareness + attr.willpower
    };
}
//# sourceMappingURL=customRulesEngine.js.map