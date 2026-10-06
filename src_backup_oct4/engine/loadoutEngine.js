"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.equipGear = equipGear;
exports.calculateTurnRegeneration = calculateTurnRegeneration;
/**
 * Evaluates gear equip cost and deduction from stamina or focus pools.
 */
function equipGear(poolState, gear) {
    const newReserved = poolState.currentReserved + gear.loadoutCost;
    return {
        ...poolState,
        currentReserved: newReserved,
        currentAvailable: Math.max(0, poolState.maxPool - newReserved)
    };
}
/**
 * Computes turn-based resource regeneration based on current pool usage thresholds.
 * - Below 50% usage: Regens every turn.
 * - Between 50% and 100% usage: Regens every other turn.
 * - At 100% (maxed/exceeded): Regens nothing.
 */
function calculateTurnRegeneration(baseRegenRate, maxPool, currentUsed) {
    const usageRatio = currentUsed / maxPool;
    if (usageRatio >= 1.0) {
        return 0; // Maxed out, zero regeneration
    }
    else if (usageRatio >= 0.5) {
        return baseRegenRate / 2; // Exceeds half, drops to every other turn equivalent
    }
    return baseRegenRate; // Normal regeneration
}
//# sourceMappingURL=loadoutEngine.js.map