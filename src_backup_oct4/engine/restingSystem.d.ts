export interface RestResult {
    restType: 'SHORT_REST' | 'LONG_REST' | 'AETHER_SANCTUM';
    healthRecovered: number;
    staminaRecovered: number;
    composureRecovered: number;
    focusRecovered: number;
    traumaCleared: boolean;
}
export declare function executeRest(restType: 'SHORT_REST' | 'LONG_REST' | 'AETHER_SANCTUM', currentStats: {
    health: number;
    maxHealth: number;
    composure: number;
    maxComposure: number;
}): RestResult;
//# sourceMappingURL=restingSystem.d.ts.map