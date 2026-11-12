/**
 * B.R.U.T.A.L. TTRPG Injury, Capacity & Energy Shredding Engine (v4.9)
 * ===================================================================
 * - Capacity comes off Health (or Composure) maximum until properly treated.
 * - Energy shredded comes off Stamina (Body injuries) or Focus (Composure injuries).
 * - Magical healing tradeoff (§8.2, v4.6):
 *   Healing costs healer Focus AND patient Stamina:
 *   * Minor: costs patient 2 Stamina
 *   * Major: costs patient 4 Stamina
 *   Leaves a "Knitted" wound (capacity restored, but Major+ to same spot tears it open).
 */

export type BrutalInjuryTier = 'GRAZE' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'NONE';

export interface EntityInjuryState {
  health: number;
  maxHealth: number;
  composure: number;
  maxComposure: number;
  stamina: number;
  focus: number;
  activeWounds: {
    id: string;
    tier: BrutalInjuryTier;
    targetPool: 'HEALTH' | 'COMPOSURE';
    capacityLost: number;
    isKnitted: boolean;
    description: string;
  }[];
}

/**
 * Applies a B.R.U.T.A.L. injury to an entity's pools and energy.
 */
export function applyBrutalInjury(
  state: EntityInjuryState,
  tier: BrutalInjuryTier,
  targetPool: 'HEALTH' | 'COMPOSURE',
  description: string = 'Combat wound'
): {
  updatedState: EntityInjuryState;
  capacityLost: number;
  energyShredded: number;
  effect: string;
} {
  if (tier === 'NONE') {
    return { updatedState: state, capacityLost: 0, energyShredded: 0, effect: 'No damage taken.' };
  }

  let capacityLost = 0;
  let energyShredded = 0;
  let effect = '';

  switch (tier) {
    case 'GRAZE':
      capacityLost = 0;
      energyShredded = 1;
      effect = 'A near miss: -2 Composure (Anxiety).';
      break;
    case 'MINOR':
      capacityLost = 4;
      energyShredded = 2;
      effect = 'Disadvantage on next roll. Hidden wound card.';
      break;
    case 'MAJOR':
      capacityLost = 8;
      energyShredded = 4;
      effect = 'Bleed: lose 1 token at start of each turn. Wound card revealed.';
      break;
    case 'CRITICAL':
      capacityLost = 12;
      energyShredded = 6;
      effect = 'Staggered! Body part destroyed until proper treatment; needs stabilizing.';
      break;
  }

  // Energy is shredded from Stamina (body) or Focus (mind)
  const newStamina = targetPool === 'HEALTH'
    ? Math.max(0, state.stamina - energyShredded)
    : state.stamina;

  const newFocus = targetPool === 'COMPOSURE'
    ? Math.max(0, state.focus - energyShredded)
    : state.focus;

  // Capacity comes off maximums
  let newHealth = state.health;
  let newMaxHealth = state.maxHealth;
  let newComposure = state.composure;
  let newMaxComposure = state.maxComposure;

  if (targetPool === 'HEALTH') {
    newMaxHealth = Math.max(1, state.maxHealth - capacityLost);
    newHealth = Math.min(newHealth, newMaxHealth);
    if (tier === 'GRAZE') {
      // Graze delivers -2 Composure Anxiety
      newComposure = Math.max(0, newComposure - 2);
    }
  } else {
    newMaxComposure = Math.max(1, state.maxComposure - capacityLost);
    newComposure = Math.min(newComposure, newMaxComposure);
  }

  const wound = {
    id: `wound_${Math.random().toString(36).slice(2, 10)}`,
    tier,
    targetPool,
    capacityLost,
    isKnitted: false,
    description
  };

  const updatedState: EntityInjuryState = {
    health: newHealth,
    maxHealth: newMaxHealth,
    composure: newComposure,
    maxComposure: newMaxComposure,
    stamina: newStamina,
    focus: newFocus,
    activeWounds: [...state.activeWounds, wound]
  };

  return { updatedState, capacityLost, energyShredded, effect };
}

/**
 * Backward compatibility helper for legacy call sites.
 */
export function applyPunishment(
  pools: { health: number; composure: number },
  severity: 'GRAZE' | 'MINOR' | 'MAJOR' | 'CRIT' | 'CRITICAL',
  targetPool: 'HEALTH' | 'COMPOSURE'
): { health: number; composure: number } {
  let capacity = 0;
  if (severity === 'MINOR') capacity = 4;
  else if (severity === 'MAJOR') capacity = 8;
  else if (severity === 'CRIT' || severity === 'CRITICAL') capacity = 12;

  if (targetPool === 'HEALTH') {
    return {
      health: Math.max(0, pools.health - capacity),
      composure: severity === 'GRAZE' ? Math.max(0, pools.composure - 2) : pools.composure
    };
  } else {
    return {
      health: pools.health,
      composure: Math.max(0, pools.composure - (capacity || 2))
    };
  }
}

/**
 * B.R.U.T.A.L. Magical Healing (§8.2, v4.6):
 * Patient must pay stamina for the body to knit wounds:
 * - Minor: 2 Stamina
 * - Major: 4 Stamina
 */
export function applyMagicalHealing(
  patientState: EntityInjuryState,
  woundId: string
): { success: boolean; message: string; updatedState: EntityInjuryState } {
  const woundIndex = patientState.activeWounds.findIndex(w => w.id === woundId && !w.isKnitted);
  if (woundIndex === -1) {
    return { success: false, message: 'No unknitted wound found with that ID.', updatedState: patientState };
  }

  const wound = patientState.activeWounds[woundIndex];
  if (!wound) {
    return { success: false, message: 'No unknitted wound found with that ID.', updatedState: patientState };
  }
  const staminaCost = wound.tier === 'MINOR' ? 2 : wound.tier === 'MAJOR' ? 4 : 0;

  if (staminaCost > 0 && patientState.stamina < staminaCost) {
    return {
      success: false,
      message: `The body cannot knit the wound! Patient has only ${patientState.stamina} Stamina, but ${wound.tier} requires ${staminaCost} Stamina.`,
      updatedState: patientState
    };
  }

  // Restore capacity and mark as knitted
  const updatedWounds = [...patientState.activeWounds];
  updatedWounds[woundIndex] = { ...wound, isKnitted: true };

  const restoredMaxHealth = wound.targetPool === 'HEALTH'
    ? patientState.maxHealth + wound.capacityLost
    : patientState.maxHealth;

  const restoredMaxComposure = wound.targetPool === 'COMPOSURE'
    ? patientState.maxComposure + wound.capacityLost
    : patientState.maxComposure;

  const updatedState: EntityInjuryState = {
    ...patientState,
    maxHealth: restoredMaxHealth,
    health: wound.targetPool === 'HEALTH' ? patientState.health + wound.capacityLost : patientState.health,
    maxComposure: restoredMaxComposure,
    composure: wound.targetPool === 'COMPOSURE' ? patientState.composure + wound.capacityLost : patientState.composure,
    stamina: Math.max(0, patientState.stamina - staminaCost),
    activeWounds: updatedWounds
  };

  return {
    success: true,
    message: `Wound knitted! Restored ${wound.capacityLost} capacity to ${wound.targetPool}. Patient paid ${staminaCost} Stamina. (Wound remains knitted and can reopen on Major+ strike).`,
    updatedState
  };
}
