"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRest = executeRest;
function executeRest(restType, currentStats) {
    if (restType === 'SHORT_REST') {
        // Recovers quick stamina/focus pools, minor health/composure via field items/rationing
        return {
            restType,
            healthRecovered: Math.floor(currentStats.maxHealth * 0.15),
            staminaRecovered: 10,
            composureRecovered: Math.floor(currentStats.maxComposure * 0.15),
            focusRecovered: 10,
            traumaCleared: false
        };
    }
    else if (restType === 'LONG_REST') {
        // Full night's rest in safe zone
        return {
            restType,
            healthRecovered: currentStats.maxHealth - currentStats.health,
            staminaRecovered: 999,
            composureRecovered: currentStats.maxComposure - currentStats.composure,
            focusRecovered: 999,
            traumaCleared: true
        };
    }
    else {
        // Aether Sanctum / Magical Immersion rest
        return {
            restType,
            healthRecovered: currentStats.maxHealth,
            staminaRecovered: 999,
            composureRecovered: currentStats.maxComposure,
            focusRecovered: 999,
            traumaCleared: true
        };
    }
}
//# sourceMappingURL=restingSystem.js.map