/**
 * B.R.U.T.A.L. TTRPG Core Rules & Derived Systems (v4.9)
 * =====================================================
 * Canonical Derived Stats Architecture (Playtest Sim 22+ Rebuild):
 * 1. Every stat feeds exactly two derived stats.
 * 2. No pair of stats shares a derived stat twice.
 * 3. Every stat feeds one Pool (Health, Composure, Stamina, Focus)
 *    and one Sense (Perception, Speed, Stealth, Balance).
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
