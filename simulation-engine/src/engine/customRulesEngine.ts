/**
 * B.R.U.T.A.L. TTRPG Core Rules & Derived Systems (v5.0)
 * =====================================================
 * Canonical Derived Stats Architecture (Playtest Sim 22+ Rebuild):
 * 1. Every stat feeds exactly two derived stats.
 * 2. No pair of stats shares a derived stat twice.
 * 3. Every stat feeds one Pool (Health, Composure, Stamina, Focus)
 *    and one Sense (Perception, Speed, Stealth, Balance).
 * 4. Character building (v5.0):
 *    - The Doubling Fee: count each stat's jobs (weapon, armor, Path, Prop, Anchor).
 *      Extra jobs cost +1, +1, +2, +2 (totals 1/2/4/6) from Stamina (Body) or Focus (Mind).
 *    - Techniques are paid by what they do: strikes/shots/physical defenses/moves cost Stamina;
 *      social attacks and Mind defenses cost Focus.
 */

export interface Attributes {
  might: number;
  endurance: number;
  finesse: number;
  reflex: number;
  vitality: number;
  fortitude: number;
  knowledge: number;
  logic: number;
  awareness: number;
  intuition: number;
  charm: number;
  willpower: number;
}

export const BODY_ATTRIBUTE_KEYS: readonly (keyof Attributes)[] = [
  'might',
  'endurance',
  'finesse',
  'reflex',
  'vitality',
  'fortitude'
];

export const MIND_ATTRIBUTE_KEYS: readonly (keyof Attributes)[] = [
  'knowledge',
  'logic',
  'awareness',
  'intuition',
  'charm',
  'willpower'
];

export interface StatJobsInput {
  weapons?: (keyof Attributes)[] | undefined;
  armor?: (keyof Attributes) | null | undefined;
  paths?: (keyof Attributes)[] | undefined;
  props?: (keyof Attributes)[] | undefined;
  anchors?: (keyof Attributes)[] | undefined;
  jobCountsByStat?: Partial<Record<keyof Attributes, number>> | undefined;
}

export interface DoublingFeeResult {
  jobCounts: Record<keyof Attributes, number>;
  feeByStat: Record<keyof Attributes, number>;
  staminaFee: number;
  focusFee: number;
  totalFee: number;
}

export function feeForJobCount(jobCount: number): number {
  if (jobCount <= 1) return 0;
  if (jobCount === 2) return 1;
  if (jobCount === 3) return 2;
  if (jobCount === 4) return 4;
  return 6;
}

/**
 * Calculates the Doubling Fee per v5.0 Part Three:
 * Counts each stat's jobs (weapon, armor, Path, Prop, Anchor). Each job past the
 * first costs +1, +1, +2, +2 (totals 1/2/4/6), taken from Stamina for Body stats
 * or Focus for Mind stats.
 */
export function calculateDoublingFee(input: StatJobsInput = {}): DoublingFeeResult {
  const jobCounts: Record<keyof Attributes, number> = {
    might: 0,
    endurance: 0,
    finesse: 0,
    reflex: 0,
    vitality: 0,
    fortitude: 0,
    knowledge: 0,
    logic: 0,
    awareness: 0,
    intuition: 0,
    charm: 0,
    willpower: 0
  };

  if (input.jobCountsByStat) {
    for (const key of [...BODY_ATTRIBUTE_KEYS, ...MIND_ATTRIBUTE_KEYS]) {
      const explicit = input.jobCountsByStat[key];
      if (typeof explicit === 'number') {
        jobCounts[key] = Math.max(0, explicit);
      }
    }
  } else {
    // Two weapons on the same stat fill one weapon job (Rulebook Part 3)
    for (const stat of new Set(input.weapons || [])) {
      jobCounts[stat] = (jobCounts[stat] ?? 0) + 1;
    }
    if (input.armor) {
      jobCounts[input.armor] = (jobCounts[input.armor] ?? 0) + 1;
    }
    for (const stat of input.paths || []) {
      jobCounts[stat] = (jobCounts[stat] ?? 0) + 1;
    }
    for (const stat of new Set(input.props || [])) {
      jobCounts[stat] = (jobCounts[stat] ?? 0) + 1;
    }
    for (const stat of new Set(input.anchors || [])) {
      jobCounts[stat] = (jobCounts[stat] ?? 0) + 1;
    }
  }

  const feeByStat: Record<keyof Attributes, number> = {
    might: 0,
    endurance: 0,
    finesse: 0,
    reflex: 0,
    vitality: 0,
    fortitude: 0,
    knowledge: 0,
    logic: 0,
    awareness: 0,
    intuition: 0,
    charm: 0,
    willpower: 0
  };

  let staminaFee = 0;
  let focusFee = 0;

  for (const stat of BODY_ATTRIBUTE_KEYS) {
    const fee = feeForJobCount(jobCounts[stat] ?? 0);
    feeByStat[stat] = fee;
    staminaFee += fee;
  }

  for (const stat of MIND_ATTRIBUTE_KEYS) {
    const fee = feeForJobCount(jobCounts[stat] ?? 0);
    feeByStat[stat] = fee;
    focusFee += fee;
  }

  return {
    jobCounts,
    feeByStat,
    staminaFee,
    focusFee,
    totalFee: staminaFee + focusFee
  };
}

export type TechniqueActionCategory =
  | 'STRIKE'
  | 'SHOT'
  | 'PHYSICAL_DEFENSE'
  | 'MOVE'
  | 'SOCIAL_ATTACK'
  | 'MIND_DEFENSE';

/**
 * Techniques are paid by what they do (v5.0):
 * - Strikes, shots, physical defenses and moves cost Stamina.
 * - Social attacks and Mind defenses cost Focus.
 */
export function getTechniqueEnergyCost(
  category: TechniqueActionCategory,
  baseCost: number = 1
): { pool: 'STAMINA' | 'FOCUS'; cost: number } {
  const cost = Math.max(0, baseCost);
  if (category === 'SOCIAL_ATTACK' || category === 'MIND_DEFENSE') {
    return { pool: 'FOCUS', cost };
  }
  return { pool: 'STAMINA', cost };
}

export interface DerivedPools {
  health: number;     // Vitality + Fortitude + Intuition
  composure: number;  // Willpower + Awareness + Endurance
  stamina: number;    // Might + Reflex + Charm
  focus: number;      // Logic + Knowledge + Finesse
}

export interface DerivedSenses {
  perception: number; // Awareness + Intuition + Finesse
  speed: number;      // Reflex + Vitality + Logic (Move = 1 space per 5 Speed)
  stealth: number;    // Knowledge + Charm + Endurance
  balance: number;    // Might + Fortitude + Willpower
  dodge: number;      // Speed Guard = Math.floor(speed / 2) + 5
  footing: number;    // Balance Guard = Math.floor(balance / 2) + 5
}

export interface CompleteDerivedStats {
  pools: DerivedPools;
  senses: DerivedSenses;
}

/**
 * Calculates derived pools based on canonical B.R.U.T.A.L. v4.2+ architecture.
 */
export function calculateDerivedPools(attr: Attributes): DerivedPools {
  return {
    health: attr.vitality + attr.fortitude + attr.intuition,
    composure: attr.willpower + attr.awareness + attr.endurance,
    stamina: attr.might + attr.reflex + attr.charm,
    focus: attr.logic + attr.knowledge + attr.finesse
  };
}

/**
 * Calculates derived senses (Perception, Speed, Stealth, Balance, Dodge, Footing).
 */
export function calculateDerivedSenses(attr: Attributes): DerivedSenses {
  const speed = attr.reflex + attr.vitality + attr.logic;
  const balance = attr.might + attr.fortitude + attr.willpower;

  return {
    perception: attr.awareness + attr.intuition + attr.finesse,
    speed,
    stealth: attr.knowledge + attr.charm + attr.endurance,
    balance,
    dodge: Math.floor(speed / 2) + 5,
    footing: Math.floor(balance / 2) + 5
  };
}

/**
 * Calculates all derived pools and senses.
 */
export function calculateCompleteDerivedStats(attr: Attributes): CompleteDerivedStats {
  return {
    pools: calculateDerivedPools(attr),
    senses: calculateDerivedSenses(attr)
  };
}
