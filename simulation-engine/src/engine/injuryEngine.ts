/**
 * B.R.U.T.A.L. TTRPG Injury, Capacity, Come-Down, Spent & Dying Engine (v5.0)
 * =============================================================================
 * - Capacity comes off Health (or Composure) maximum immediately until treated.
 * - A hit no longer removes energy tokens during the fight; energy is tracked in
 *   `owed: { stamina, focus }` (Graze 1, Minor 2, Major 4, Critical 6) and paid
 *   at the Come-Down via `payAtComeDown(entity)` (excess beyond current pool is lost
 *   at 0 and sets Spent).
 * - Reductions (§5.4 v5.0): max 1 tier from target's own abilities + 1 tier from
 *   an ally's ability (e.g., Mend the Blow, Ward). A Mend costs patient 0 Stamina.
 * - Spent (§5.9 v5.0): pool at 0 sets `spent`, blocking Stamina/Focus Techniques,
 *   Effort, Reactions and putting matching attacks/checks at Disadvantage; Defenses roll normally.
 * - Down & Dying (§5.9): 0 Health -> 6-round dying countdown (no Adrenaline check to get up);
 *   0 Composure -> 6-round Psychic Break countdown.
 * - Locked tags (§5.6 v5.0): Disadvantage on rolls needing the tag; locked [BIPED] halves Move.
 * - Heroes' Shocks (§5.10 v5.0): 1/round max, d12 + better pair stat + Anchor vs 10.
 */

import { BrutalInjuryTier, rollD12, RollD12Result } from './combatResolutionEngine.js';
import type { Attributes } from './customRulesEngine.js';

export type { BrutalInjuryTier };

export type ComposureInjuryType = 'Fear' | 'Doubt' | 'Anxiety' | 'Rage' | 'Grief' | 'Madness';

export const COMPOSURE_TYPE_PAIRS: Record<ComposureInjuryType, [keyof Attributes, keyof Attributes]> = {
  Fear: ['fortitude', 'willpower'],
  Doubt: ['endurance', 'logic'],
  Anxiety: ['reflex', 'intuition'],
  Rage: ['might', 'knowledge'],
  Grief: ['vitality', 'charm'],
  Madness: ['finesse', 'awareness']
};

export type ShockTrigger =
  | 'ALLY_DROPS'
  | 'ALLY_TAKES_CRITICAL'
  | 'ALLY_DIES'
  | 'MONSTER_BLOWOUT_ANOMALY'
  | 'AMBUSHED_OR_SURPRISED'
  | 'LEADER_BREAKS_OR_FALLS';

export const SHOCK_TRIGGER_RULES: Record<
  ShockTrigger,
  { composureType: ComposureInjuryType; advantage: boolean; disadvantage: boolean }
> = {
  ALLY_DROPS: { composureType: 'Grief', advantage: false, disadvantage: false },
  ALLY_TAKES_CRITICAL: { composureType: 'Fear', advantage: true, disadvantage: false },
  ALLY_DIES: { composureType: 'Grief', advantage: false, disadvantage: true },
  MONSTER_BLOWOUT_ANOMALY: { composureType: 'Madness', advantage: false, disadvantage: true },
  AMBUSHED_OR_SURPRISED: { composureType: 'Anxiety', advantage: false, disadvantage: false },
  LEADER_BREAKS_OR_FALLS: { composureType: 'Fear', advantage: false, disadvantage: false }
};

export const BODY_DECK_LOCKED_TAGS: Record<string, string> = {
  Head: 'NEURAL',
  Eyes: 'VISUAL',
  Throat: 'VOCAL',
  'Left Arm': '1-ARM',
  'Right Arm': '1-ARM',
  'Left Leg': 'BIPED',
  'Right Leg': 'BIPED'
};

export interface WoundCard {
  id: string;
  tier: BrutalInjuryTier;
  targetPool: 'HEALTH' | 'COMPOSURE';
  capacityLost: number;
  isKnitted: boolean;
  description: string;
  faceUp?: boolean | undefined;
  location?: string | undefined;
  lockedTag?: string | undefined;
  composureType?: ComposureInjuryType | undefined;
}

export interface EntityInjuryState {
  name?: string | undefined;
  health: number;
  maxHealth: number;
  composure: number;
  maxComposure: number;
  stamina: number;
  focus: number;
  owed?: { stamina: number; focus: number } | undefined;
  spent?: { stamina: boolean; focus: boolean } | undefined;
  bleed?: number | undefined;
  disadvantageNextRoll?: boolean | undefined;
  tookComposureInjury?: boolean | undefined;
  tookNearMiss?: boolean | undefined;
  tookMinorOrWorse?: boolean | undefined;
  isDown?: boolean | undefined;
  isDead?: boolean | undefined;
  dyingRounds?: number | null | undefined;
  isStabilized?: boolean | undefined;
  isPsychicBreak?: boolean | undefined;
  psychicBreakRounds?: number | null | undefined;
  isGrounded?: boolean | undefined;
  isLastingBreak?: boolean | undefined;
  lockedTags?: string[] | undefined;
  baseMoveSpaces?: number | undefined;
  shockRolledThisRound?: boolean | undefined;
  activeWounds: WoundCard[];
}

export interface InjuryReductionInput {
  ownReductions?: number | string[] | undefined;
  allyReductions?: number | string[] | undefined;
  isMendFromAlly?: boolean | undefined;
}

export interface InjuryReductionResult {
  originalTier: BrutalInjuryTier;
  finalTier: BrutalInjuryTier;
  ownApplied: number;
  allyApplied: number;
  tiersDropped: number;
  patientStaminaCost: number;
}

const TIER_ORDER: readonly BrutalInjuryTier[] = ['NONE', 'GRAZE', 'MINOR', 'MAJOR', 'CRITICAL'];

/**
 * Applies injury tier reductions (v5.0 §5.4):
 * At most 1 tier from the target's own abilities + at most 1 tier from another
 * creature's ability (e.g., Mend the Blow, a Ward). A Mend costs patient 0 Stamina.
 */
export function reduceInjuryTier(
  tier: BrutalInjuryTier,
  reductions: InjuryReductionInput = {}
): InjuryReductionResult {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx <= 0) {
    return {
      originalTier: tier,
      finalTier: tier,
      ownApplied: 0,
      allyApplied: 0,
      tiersDropped: 0,
      patientStaminaCost: 0
    };
  }

  const rawOwn = Array.isArray(reductions.ownReductions)
    ? reductions.ownReductions.length
    : (reductions.ownReductions ?? 0);
  const rawAlly = Array.isArray(reductions.allyReductions)
    ? reductions.allyReductions.length
    : (reductions.allyReductions ?? 0);

  const ownApplied = Math.min(1, Math.max(0, rawOwn));
  const allyApplied = Math.min(1, Math.max(0, rawAlly));
  const totalDrop = ownApplied + allyApplied;
  const finalIdx = Math.max(0, idx - totalDrop);
  const finalTier = TIER_ORDER[finalIdx] ?? 'NONE';

  return {
    originalTier: tier,
    finalTier,
    ownApplied,
    allyApplied,
    tiersDropped: idx - finalIdx,
    patientStaminaCost: 0 // Mend used as a reduction costs the patient nothing
  };
}

function normalizeTag(tag: string): string {
  return tag.replace(/[\[\]]/g, '').trim().toUpperCase();
}

function resolveLockedTag(location?: string, explicitTag?: string): string | undefined {
  if (explicitTag) return normalizeTag(explicitTag);
  if (location && BODY_DECK_LOCKED_TAGS[location]) return BODY_DECK_LOCKED_TAGS[location];
  return undefined;
}

function appendUniqueTag(tags: string[] | undefined, tag: string | undefined): string[] {
  const existing = (tags || []).map(normalizeTag);
  if (!tag) return existing;
  const norm = normalizeTag(tag);
  return existing.includes(norm) ? existing : [...existing, norm];
}

function tierSpecs(tier: BrutalInjuryTier): {
  capacityLost: number;
  energyOwed: number;
  downedRoundCost: number;
  effect: string;
} {
  switch (tier) {
    case 'GRAZE':
      return {
        capacityLost: 0,
        energyOwed: 1,
        downedRoundCost: 1,
        effect: 'A near miss: -2 Composure (Anxiety).'
      };
    case 'MINOR':
      return {
        capacityLost: 4,
        energyOwed: 2,
        downedRoundCost: 1,
        effect: 'Adrenaline Shock: Disadvantage on next roll. Hidden wound card.'
      };
    case 'MAJOR':
      return {
        capacityLost: 8,
        energyOwed: 4,
        downedRoundCost: 2,
        effect: 'Bleed: lose 1 token at start of each turn. Wound card revealed.'
      };
    case 'CRITICAL':
      return {
        capacityLost: 12,
        energyOwed: 6,
        downedRoundCost: 6,
        effect: 'Staggered! Body part destroyed until proper treatment; needs stabilizing.'
      };
    default:
      return { capacityLost: 0, energyOwed: 0, downedRoundCost: 0, effect: 'No damage taken.' };
  }
}

export interface ApplyInjuryOptions {
  location?: string | undefined;
  lockedTag?: string | undefined;
  composureType?: ComposureInjuryType | undefined;
  reductions?: InjuryReductionInput | undefined;
}

/**
 * Applies a B.R.U.T.A.L. v5.0 injury to an entity's state.
 * - Energy cost goes into `owed: { stamina, focus }` instead of removing tokens mid-fight.
 * - Capacity drops maxHealth / maxComposure immediately.
 * - Minor: Disadvantage on next roll + face-down card.
 * - Major: Bleed (+1/turn) + face-up card + locks location tag immediately.
 * - Critical: face-up card + locks tag immediately.
 * - Hitting 0 Health starts the 6-round dying countdown; hits on downed accelerate it or kill on Critical.
 * - Hitting 0 Composure starts the 6-round Psychic Break countdown.
 */
export function applyBrutalInjury(
  state: EntityInjuryState,
  tier: BrutalInjuryTier,
  targetPool: 'HEALTH' | 'COMPOSURE',
  description: string = 'Combat wound',
  options: ApplyInjuryOptions = {}
): {
  updatedState: EntityInjuryState;
  finalTier: BrutalInjuryTier;
  capacityLost: number;
  energyOwed: number;
  energyShredded: number;
  reduction: InjuryReductionResult;
  effect: string;
} {
  const reduction = options.reductions
    ? reduceInjuryTier(tier, options.reductions)
    : {
        originalTier: tier,
        finalTier: tier,
        ownApplied: 0,
        allyApplied: 0,
        tiersDropped: 0,
        patientStaminaCost: 0
      };

  const finalTier = reduction.finalTier;
  const currentOwed = { stamina: state.owed?.stamina ?? 0, focus: state.owed?.focus ?? 0 };
  const currentSpent = {
    stamina: !!state.spent?.stamina || state.stamina <= 0,
    focus: !!state.spent?.focus || state.focus <= 0
  };

  if (finalTier === 'NONE') {
    return {
      updatedState: { ...state, owed: currentOwed, spent: currentSpent },
      finalTier: 'NONE',
      capacityLost: 0,
      energyOwed: 0,
      energyShredded: 0,
      reduction,
      effect: 'No damage taken.'
    };
  }

  const spec = tierSpecs(finalTier);
  const { capacityLost, energyOwed, downedRoundCost, effect } = spec;

  // Energy is owed and settled at the Come-Down (does NOT remove Stamina/Focus during the fight)
  const updatedOwed = {
    stamina: targetPool === 'HEALTH' ? currentOwed.stamina + energyOwed : currentOwed.stamina,
    focus: targetPool === 'COMPOSURE' ? currentOwed.focus + energyOwed : currentOwed.focus
  };

  let newHealth = state.health;
  let newMaxHealth = state.maxHealth;
  let newComposure = state.composure;
  let newMaxComposure = state.maxComposure;

  let isDown = !!state.isDown;
  let isDead = !!state.isDead;
  let dyingRounds = state.dyingRounds ?? null;
  let isStabilized = !!state.isStabilized;

  let isPsychicBreak = !!state.isPsychicBreak;
  let psychicBreakRounds = state.psychicBreakRounds ?? null;
  let isGrounded = !!state.isGrounded;
  let isLastingBreak = !!state.isLastingBreak;

  let tookNearMiss = !!state.tookNearMiss;
  let tookComposureInjury = !!state.tookComposureInjury;
  let tookMinorOrWorse = !!state.tookMinorOrWorse;

  if (finalTier === 'MINOR' || finalTier === 'MAJOR' || finalTier === 'CRITICAL') {
    tookMinorOrWorse = true;
  }

  if (targetPool === 'HEALTH') {
    if (isDown && !isDead) {
      // Hits on someone already down (§5.9)
      if (finalTier === 'CRITICAL') {
        isDead = true;
        dyingRounds = 0;
        isStabilized = false;
      } else if (isStabilized) {
        // Hit on someone already stabilized restarts the count at 6 minus hit's cost
        isStabilized = false;
        dyingRounds = Math.max(0, 6 - downedRoundCost);
        if (dyingRounds === 0) isDead = true;
      } else {
        dyingRounds = Math.max(0, (dyingRounds ?? 6) - downedRoundCost);
        if (dyingRounds === 0) isDead = true;
      }
    }

    newMaxHealth = Math.max(0, state.maxHealth - capacityLost);
    newHealth = Math.min(newHealth, newMaxHealth);

    if (finalTier === 'GRAZE') {
      newComposure = Math.max(0, newComposure - 2);
      tookNearMiss = true;
      tookComposureInjury = true;
    }

    if (!isDown && newHealth <= 0) {
      isDown = true;
      dyingRounds = 6;
      isStabilized = false;
    }
  } else {
    tookComposureInjury = true;
    if (finalTier === 'GRAZE') {
      tookNearMiss = true;
      // Composure Graze reduces Composure by 2 immediately without capacity lock
      newComposure = Math.max(0, newComposure - 2);
    } else {
      newMaxComposure = Math.max(0, state.maxComposure - capacityLost);
      newComposure = Math.min(newComposure, newMaxComposure);
    }

    if (isPsychicBreak && !isLastingBreak) {
      if (finalTier === 'CRITICAL') {
        isLastingBreak = true;
        psychicBreakRounds = 0;
        isGrounded = false;
      } else if (isGrounded) {
        isGrounded = false;
        psychicBreakRounds = Math.max(0, 6 - downedRoundCost);
        if (psychicBreakRounds === 0) isLastingBreak = true;
      } else {
        psychicBreakRounds = Math.max(0, (psychicBreakRounds ?? 6) - downedRoundCost);
        if (psychicBreakRounds === 0) isLastingBreak = true;
      }
    }

    if (!isPsychicBreak && newComposure <= 0) {
      isPsychicBreak = true;
      psychicBreakRounds = 6;
      isGrounded = false;
    }
  }

  const resolvedTag = resolveLockedTag(options.location, options.lockedTag);
  const faceUp = finalTier === 'MAJOR' || finalTier === 'CRITICAL';
  let lockedTags = (state.lockedTags || []).map(normalizeTag);
  if (faceUp && resolvedTag) {
    lockedTags = appendUniqueTag(lockedTags, resolvedTag);
  }

  const activeWounds = [...state.activeWounds];
  if (finalTier !== 'GRAZE') {
    activeWounds.push({
      id: `wound_${Math.random().toString(36).slice(2, 10)}`,
      tier: finalTier,
      targetPool,
      capacityLost,
      isKnitted: false,
      description,
      faceUp,
      location: options.location,
      lockedTag: resolvedTag,
      composureType: options.composureType
    });
  }

  const updatedState: EntityInjuryState = {
    ...state,
    health: newHealth,
    maxHealth: newMaxHealth,
    composure: newComposure,
    maxComposure: newMaxComposure,
    stamina: state.stamina, // In-fight pool untouched by hit
    focus: state.focus,     // In-fight pool untouched by hit
    owed: updatedOwed,
    spent: currentSpent,
    bleed: (state.bleed ?? 0) + (finalTier === 'MAJOR' ? 1 : 0),
    disadvantageNextRoll: !!state.disadvantageNextRoll || finalTier === 'MINOR',
    tookComposureInjury,
    tookNearMiss,
    tookMinorOrWorse,
    isDown,
    isDead,
    dyingRounds,
    isStabilized,
    isPsychicBreak,
    psychicBreakRounds,
    isGrounded,
    isLastingBreak,
    lockedTags,
    activeWounds
  };

  return {
    updatedState,
    finalTier,
    capacityLost,
    energyOwed,
    energyShredded: energyOwed,
    reduction,
    effect
  };
}

/**
 * Pays the Come-Down bill at the end of a fight (v5.0 §10.1):
 * - Subtracts `owed.stamina` and `owed.focus` (a bill bigger than the pool takes it to 0, rest is lost).
 * - Sets Spent flags if any pool hits 0.
 * - Flips face-down Minor wound cards face-up (revealing locked tags).
 * - Applies the shakes: a Composure Graze (-2, never below 1) for anyone who took a
 *   Composure injury, a near miss, or a Minor or worse.
 */
export function payAtComeDown(entity: EntityInjuryState): EntityInjuryState {
  const owed = entity.owed ?? { stamina: 0, focus: 0 };
  const newStamina = Math.max(0, entity.stamina - owed.stamina);
  const newFocus = Math.max(0, entity.focus - owed.focus);

  let lockedTags = (entity.lockedTags || []).map(normalizeTag);
  const flippedWounds = entity.activeWounds.map(w => {
    if (!w.faceUp && w.tier === 'MINOR') {
      if (w.lockedTag) lockedTags = appendUniqueTag(lockedTags, w.lockedTag);
      return { ...w, faceUp: true };
    }
    return w;
  });

  const qualifiesForShakes =
    !!entity.tookComposureInjury ||
    !!entity.tookNearMiss ||
    !!entity.tookMinorOrWorse ||
    entity.activeWounds.some(w => w.tier === 'MINOR' || w.tier === 'MAJOR' || w.tier === 'CRITICAL');

  // The shakes never take Composure below 1
  let newComposure = entity.composure;
  if (qualifiesForShakes && entity.composure >= 1) {
    newComposure = Math.max(1, entity.composure - 2);
  }

  return {
    ...entity,
    stamina: newStamina,
    focus: newFocus,
    composure: newComposure,
    owed: { stamina: 0, focus: 0 },
    spent: {
      stamina: newStamina === 0 || !!entity.spent?.stamina,
      focus: newFocus === 0 || !!entity.spent?.focus
    },
    lockedTags,
    activeWounds: flippedWounds
  };
}

/**
 * Checks whether Stamina or Focus are Spent (0 tokens -> Spent until rest).
 */
export function checkSpentState(state: EntityInjuryState): { stamina: boolean; focus: boolean } {
  return {
    stamina: !!state.spent?.stamina || state.stamina <= 0,
    focus: !!state.spent?.focus || state.focus <= 0
  };
}

/**
 * Spends Stamina or Focus tokens and updates Spent flags if a pool reaches 0 (Step 5).
 * When Spent in a pool, Techniques, Effort and Reactions that cost that pool are forbidden.
 */
export function spendPoolTokens(
  state: EntityInjuryState,
  pool: 'STAMINA' | 'FOCUS',
  amount: number,
  kind: 'TECHNIQUE' | 'EFFORT' | 'REACTION' | 'BASIC' | 'BLEED' = 'TECHNIQUE'
): { allowed: boolean; reason?: string; updatedState: EntityInjuryState } {
  const spentNow = checkSpentState(state);
  const isSpent = pool === 'STAMINA' ? spentNow.stamina : spentNow.focus;

  if (amount > 0 && isSpent && (kind === 'TECHNIQUE' || kind === 'EFFORT' || kind === 'REACTION')) {
    return {
      allowed: false,
      reason: `Cannot use ${kind.toLowerCase()} costing ${pool}: character is Spent.`,
      updatedState: { ...state, spent: spentNow }
    };
  }

  const newStamina = pool === 'STAMINA' ? Math.max(0, state.stamina - amount) : state.stamina;
  const newFocus = pool === 'FOCUS' ? Math.max(0, state.focus - amount) : state.focus;

  return {
    allowed: true,
    updatedState: {
      ...state,
      stamina: newStamina,
      focus: newFocus,
      spent: {
        stamina: spentNow.stamina || newStamina === 0,
        focus: spentNow.focus || newFocus === 0
      }
    }
  };
}

/**
 * Resolves ongoing Bleed ticks at the start of a turn (1 token per active Major Bleed).
 */
export function tickOngoingBleed(state: EntityInjuryState): {
  updatedState: EntityInjuryState;
  tokensLost: number;
} {
  const bleedCount = state.bleed ?? 0;
  if (bleedCount <= 0) return { updatedState: state, tokensLost: 0 };

  const bodyBleeds = state.activeWounds.filter(w => w.tier === 'MAJOR' && w.targetPool === 'HEALTH' && !w.isKnitted).length;
  const mindBleeds = state.activeWounds.filter(w => w.tier === 'MAJOR' && w.targetPool === 'COMPOSURE' && !w.isKnitted).length;
  const effectiveBody = bodyBleeds || bleedCount;

  let next = state;
  if (effectiveBody > 0) {
    next = spendPoolTokens(next, 'STAMINA', effectiveBody, 'BLEED').updatedState;
  }
  if (mindBleeds > 0) {
    next = spendPoolTokens(next, 'FOCUS', mindBleeds, 'BLEED').updatedState;
  }
  return { updatedState: next, tokensLost: effectiveBody + mindBleeds };
}

export type RollActionCategory =
  | 'BODY_ATTACK'
  | 'BODY_CHECK'
  | 'BODY_DEFENSE'
  | 'MIND_ATTACK'
  | 'MIND_CHECK'
  | 'MIND_DEFENSE';

/**
 * Evaluates Disadvantage from being Spent (Step 5):
 * - Spent in Stamina: Disadvantage on Body attacks and checks; Defenses roll normally.
 * - Spent in Focus: Disadvantage on Mind attacks and checks; Defenses roll normally.
 */
export function getSpentRollPenalty(
  state: Pick<EntityInjuryState, 'stamina' | 'focus' | 'spent'>,
  actionKind: RollActionCategory
): { hasDisadvantage: boolean } {
  const spentStamina = !!state.spent?.stamina || state.stamina <= 0;
  const spentFocus = !!state.spent?.focus || state.focus <= 0;

  if (actionKind === 'BODY_ATTACK' || actionKind === 'BODY_CHECK') {
    return { hasDisadvantage: spentStamina };
  }
  if (actionKind === 'MIND_ATTACK' || actionKind === 'MIND_CHECK') {
    return { hasDisadvantage: spentFocus };
  }
  // BODY_DEFENSE and MIND_DEFENSE roll normally even when Spent
  return { hasDisadvantage: false };
}

/**
 * Decrements dying / Psychic Break countdowns at the end of a round (Step 6).
 */
export function advanceDyingRound(state: EntityInjuryState): {
  updatedState: EntityInjuryState;
  narration: string | null;
} {
  let next: EntityInjuryState = { ...state };
  const lines: string[] = [];
  const label = state.name || 'Creature';

  if (next.isDown && !next.isDead && !next.isStabilized && typeof next.dyingRounds === 'number') {
    const remaining = Math.max(0, next.dyingRounds - 1);
    next.dyingRounds = remaining;
    if (remaining === 0) {
      next.isDead = true;
      lines.push(`${label} is down: 0 rounds (dead)`);
    } else {
      lines.push(`${label} is down: ${remaining} rounds`);
    }
  }

  if (next.isPsychicBreak && !next.isLastingBreak && !next.isGrounded && typeof next.psychicBreakRounds === 'number') {
    const remaining = Math.max(0, next.psychicBreakRounds - 1);
    next.psychicBreakRounds = remaining;
    if (remaining === 0) {
      next.isLastingBreak = true;
      lines.push(`${label} is in Psychic Break: 0 rounds (lasting break)`);
    } else {
      lines.push(`${label} is in Psychic Break: ${remaining} rounds`);
    }
  }

  return {
    updatedState: next,
    narration: lines.length > 0 ? lines.join(' | ') : null
  };
}

/**
 * Stabilizes a downed creature (Step 6):
 * Costs 1 Stamina + 1 Focus from helper, OR 1 token of either with a field kit.
 */
export function stabilizeDowned(
  patient: EntityInjuryState,
  helper: { stamina: number; focus: number; hasFieldKit?: boolean | undefined; kitPool?: 'STAMINA' | 'FOCUS' | undefined }
): {
  success: boolean;
  message: string;
  updatedPatient: EntityInjuryState;
  updatedHelper: { stamina: number; focus: number };
} {
  if (!patient.isDown || patient.isDead) {
    return {
      success: false,
      message: `${patient.name || 'Target'} cannot be stabilized right now.`,
      updatedPatient: patient,
      updatedHelper: { stamina: helper.stamina, focus: helper.focus }
    };
  }

  if (helper.hasFieldKit) {
    const chosenPool = helper.kitPool || (helper.stamina >= helper.focus ? 'STAMINA' : 'FOCUS');
    const canPayChosen = chosenPool === 'STAMINA' ? helper.stamina >= 1 : helper.focus >= 1;
    const actualPool = canPayChosen
      ? chosenPool
      : helper.stamina >= 1
      ? 'STAMINA'
      : helper.focus >= 1
      ? 'FOCUS'
      : null;

    if (!actualPool) {
      return {
        success: false,
        message: 'Helper needs 1 Stamina or Focus token even with a field kit.',
        updatedPatient: patient,
        updatedHelper: { stamina: helper.stamina, focus: helper.focus }
      };
    }

    return {
      success: true,
      message: `${patient.name || 'Target'} stabilized with a field kit (1 ${actualPool}).`,
      updatedPatient: { ...patient, isStabilized: true, dyingRounds: null },
      updatedHelper: {
        stamina: actualPool === 'STAMINA' ? helper.stamina - 1 : helper.stamina,
        focus: actualPool === 'FOCUS' ? helper.focus - 1 : helper.focus
      }
    };
  }

  if (helper.stamina < 1 || helper.focus < 1) {
    return {
      success: false,
      message: 'Stabilizing without a field kit requires 1 Stamina + 1 Focus.',
      updatedPatient: patient,
      updatedHelper: { stamina: helper.stamina, focus: helper.focus }
    };
  }

  return {
    success: true,
    message: `${patient.name || 'Target'} stabilized (1 S + 1 F).`,
    updatedPatient: { ...patient, isStabilized: true, dyingRounds: null },
    updatedHelper: { stamina: helper.stamina - 1, focus: helper.focus - 1 }
  };
}

/**
 * Grounds a creature in a Psychic Break (Step 6):
 * Stopped by 1 Stamina + 1 Focus or a Rally.
 */
export function groundBroken(
  patient: EntityInjuryState,
  options: { stamina?: number | undefined; focus?: number | undefined; isRally?: boolean | undefined }
): {
  success: boolean;
  message: string;
  updatedPatient: EntityInjuryState;
  remainingHelper?: { stamina: number; focus: number };
} {
  if (!patient.isPsychicBreak || patient.isLastingBreak) {
    return {
      success: false,
      message: `${patient.name || 'Target'} is not in an active Psychic Break.`,
      updatedPatient: patient
    };
  }

  if (options.isRally) {
    return {
      success: true,
      message: `${patient.name || 'Target'} grounded by a Rally.`,
      updatedPatient: { ...patient, isGrounded: true, psychicBreakRounds: null }
    };
  }

  const s = options.stamina ?? 0;
  const f = options.focus ?? 0;
  if (s < 1 || f < 1) {
    return {
      success: false,
      message: 'Grounding requires 1 Stamina + 1 Focus (or a Rally).',
      updatedPatient: patient
    };
  }

  return {
    success: true,
    message: `${patient.name || 'Target'} grounded (1 S + 1 F).`,
    updatedPatient: { ...patient, isGrounded: true, psychicBreakRounds: null },
    remainingHelper: { stamina: s - 1, focus: f - 1 }
  };
}

/**
 * Evaluates Locked Tag penalties (v5.0 §5.6 Step 7):
 * - Any locked tag required for the roll grants Disadvantage (no doubled energy cost).
 * - A locked [BIPED] halves Move.
 */
export function getLockedTagPenalties(
  state: Pick<EntityInjuryState, 'lockedTags' | 'baseMoveSpaces'>,
  requiredTags: string[] = []
): { hasDisadvantage: boolean; effectiveMoveSpaces: number; zoneMoveMultiplier: number } {
  const lockedSet = new Set((state.lockedTags || []).map(normalizeTag));
  const needsLockedTag = requiredTags.some(t => lockedSet.has(normalizeTag(t)));
  const bipedLocked = lockedSet.has('BIPED');
  const baseMove = state.baseMoveSpaces ?? 2;

  return {
    hasDisadvantage: needsLockedTag,
    effectiveMoveSpaces: bipedLocked ? Math.floor(baseMove / 2) : baseMove,
    zoneMoveMultiplier: bipedLocked ? 0.5 : 1
  };
}

export interface HeroShockResult {
  triggered: boolean;
  skippedDueToRoundLimit: boolean;
  composureType: ComposureInjuryType;
  roll: RollD12Result | null;
  bestPairStat: number;
  anchorValue: number;
  total: number;
  dc: number;
  passed: boolean;
  updatedState: EntityInjuryState;
}

/**
 * Resolves a Hero's Shock check (Step 9, Rulebook §5.10):
 * - Roll d12 + better stat of the Composure type's pair + Anchor against 10.
 * - On failure (< 10), apply a Composure Minor of that type.
 * - Enforces at most ONE Shock per creature per round.
 */
export function resolveHeroShock(
  state: EntityInjuryState,
  attrs: Attributes,
  trigger: ShockTrigger,
  options?: {
    anchorValue?: number | undefined;
    fixedRoll?: number | undefined;
    fixedRolls?: [number, number] | undefined;
  }
): HeroShockResult {
  const rule = SHOCK_TRIGGER_RULES[trigger];
  const pair = COMPOSURE_TYPE_PAIRS[rule.composureType];
  const bestPairStat = Math.max(attrs[pair[0]], attrs[pair[1]]);
  const anchorValue = options?.anchorValue ?? 0;

  if (state.shockRolledThisRound) {
    return {
      triggered: false,
      skippedDueToRoundLimit: true,
      composureType: rule.composureType,
      roll: null,
      bestPairStat,
      anchorValue,
      total: 0,
      dc: 10,
      passed: true,
      updatedState: state
    };
  }

  const fixed = options?.fixedRolls ?? options?.fixedRoll;
  const roll = rollD12(rule.advantage, rule.disadvantage, fixed);
  const total = roll.final + bestPairStat + anchorValue;
  const passed = total >= 10;

  let nextState: EntityInjuryState = { ...state, shockRolledThisRound: true };
  if (!passed) {
    nextState = applyBrutalInjury(
      nextState,
      'MINOR',
      'COMPOSURE',
      `Shock failed (${trigger} -> ${rule.composureType})`,
      { composureType: rule.composureType }
    ).updatedState;
  }

  return {
    triggered: true,
    skippedDueToRoundLimit: false,
    composureType: rule.composureType,
    roll,
    bestPairStat,
    anchorValue,
    total,
    dc: 10,
    passed,
    updatedState: nextState
  };
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
 * B.R.U.T.A.L. Magical Healing (§8.2):
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

  const newStamina = Math.max(0, patientState.stamina - staminaCost);
  const updatedState: EntityInjuryState = {
    ...patientState,
    maxHealth: restoredMaxHealth,
    health: wound.targetPool === 'HEALTH' ? patientState.health + wound.capacityLost : patientState.health,
    maxComposure: restoredMaxComposure,
    composure: wound.targetPool === 'COMPOSURE' ? patientState.composure + wound.capacityLost : patientState.composure,
    stamina: newStamina,
    spent: {
      stamina: !!patientState.spent?.stamina || newStamina === 0,
      focus: !!patientState.spent?.focus || patientState.focus <= 0
    },
    activeWounds: updatedWounds
  };

  return {
    success: true,
    message: `Wound knitted! Restored ${wound.capacityLost} capacity to ${wound.targetPool}. Patient paid ${staminaCost} Stamina. (Wound remains knitted and can reopen on Major+ strike).`,
    updatedState
  };
}
