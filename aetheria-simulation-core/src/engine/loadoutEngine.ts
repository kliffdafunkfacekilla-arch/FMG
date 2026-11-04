interface GearItem {
  name: string;
  loadoutCost: number;
  associatedStatType: 'STAMINA' | 'FOCUS'; // depends on stat used to equip
}

interface PlayerResourceState {
  maxPool: number;
  currentReserved: number;
  currentAvailable: number;
}

/**
 * Evaluates gear equip cost and deduction from stamina or focus pools.
 */
export function equipGear(poolState: PlayerResourceState, gear: GearItem): PlayerResourceState {
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
export function calculateTurnRegeneration(baseRegenRate: number, maxPool: number, currentUsed: number): number {
  const usageRatio = currentUsed / maxPool;

  if (usageRatio >= 1.0) {
    return 0; // Maxed out, zero regeneration
  } else if (usageRatio >= 0.5) {
    return baseRegenRate / 2; // Exceeds half, drops to every other turn equivalent
  }
  return baseRegenRate; // Normal regeneration
}

