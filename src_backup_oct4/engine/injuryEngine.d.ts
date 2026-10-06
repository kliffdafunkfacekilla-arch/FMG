interface EntityPools {
    health: number;
    composure: number;
}
/**
 * Maps severity to injury points and subtracts from Health or Composure.
 */
export declare function applyPunishment(pools: EntityPools, severity: 'GRAZE' | 'MINOR' | 'MAJOR' | 'CRIT', targetPool: 'HEALTH' | 'COMPOSURE'): EntityPools;
export {};
//# sourceMappingURL=injuryEngine.d.ts.map