export interface RestResult {
  restType: 'SHORT_REST' | 'LONG_REST' | 'AETHER_SANCTUM';
  healthRecovered: number;
  staminaRecovered: number;
  composureRecovered: number;
  focusRecovered: number;
  traumaCleared: boolean;
}

export function executeRest(
  restType: 'SHORT_REST' | 'LONG_REST' | 'AETHER_SANCTUM',
  currentStats: { health: number; maxHealth: number; composure: number; maxComposure: number }
): RestResult {
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
  } else if (restType === 'LONG_REST') {
    // Full night's rest in safe zone
    return {
      restType,
      healthRecovered: currentStats.maxHealth - currentStats.health,
      staminaRecovered: 999,
      composureRecovered: currentStats.maxComposure - currentStats.composure,
      focusRecovered: 999,
      traumaCleared: true
    };
  } else {
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

