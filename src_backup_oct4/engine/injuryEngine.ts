interface EntityPools {
  health: number;
  composure: number;
}

/**
 * Maps severity to injury points and subtracts from Health or Composure.
 */
export function applyPunishment(pools: EntityPools, severity: 'GRAZE' | 'MINOR' | 'MAJOR' | 'CRIT', targetPool: 'HEALTH' | 'COMPOSURE'): EntityPools {
  let injuryCost = 1; // Graze = 1
  switch (severity) {
    case 'MINOR': injuryCost = 2; break;
    case 'MAJOR': injuryCost = 3; break;
    case 'CRIT': injuryCost = 4; break;
  }

  if (targetPool === 'HEALTH') {
    return { ...pools, health: Math.max(0, pools.health - injuryCost) };
  } else {
    return { ...pools, composure: Math.max(0, pools.composure - injuryCost) };
  }
}

