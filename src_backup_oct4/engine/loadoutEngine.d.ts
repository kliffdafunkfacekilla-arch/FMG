interface GearItem {
    name: string;
    loadoutCost: number;
    associatedStatType: 'STAMINA' | 'FOCUS';
}
interface PlayerResourceState {
    maxPool: number;
    currentReserved: number;
    currentAvailable: number;
}
/**
 * Evaluates gear equip cost and deduction from stamina or focus pools.
 */
export declare function equipGear(poolState: PlayerResourceState, gear: GearItem): PlayerResourceState;
/**
 * Computes turn-based resource regeneration based on current pool usage thresholds.
 * - Below 50% usage: Regens every turn.
 * - Between 50% and 100% usage: Regens every other turn.
 * - At 100% (maxed/exceeded): Regens nothing.
 */
export declare function calculateTurnRegeneration(baseRegenRate: number, maxPool: number, currentUsed: number): number;
export {};
//# sourceMappingURL=loadoutEngine.d.ts.map