/**
 * B.R.U.T.A.L. TTRPG Contested Attack & Clash Resolution Engine (v4.9)
 * ===================================================================
 * - Core Die: d12 (opposed rolls)
 * - Net Margin = Attacker Total - Defender Total
 *   * Margin < 0: Defender Wins
 *   * Margin = 0: The Clash (no gear, d12 + stance stat)
 *   * Margin = 1: Graze (0 capacity, 1 energy shredded, -2 Composure)
 *   * Margin 2-5: Minor (4 capacity, 2 energy shredded, Disadvantage next roll)
 *   * Margin 6-9: Major (8 capacity, 4 energy shredded, Bleed 1/turn)
 *   * Margin 10+: Critical (12 capacity, 6 energy shredded, Staggered / Mutilated)
 * - Defenses: One Active Defense per round (rolled d12); other attacks hit Guard (stat + armor, no die).
 */

export type BrutalInjuryTier = 'GRAZE' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'NONE';

export type ClashStance = 'PRESS' | 'HOLD' | 'MANEUVER' | 'TRICK' | 'FEINT' | 'DISENGAGE';

export const CLASH_STANCE_STATS: Record<ClashStance, [string, string]> = {
  PRESS: ['might', 'knowledge'],
  HOLD: ['endurance', 'logic'],
  MANEUVER: ['reflex', 'intuition'],
  TRICK: ['finesse', 'awareness'],
  FEINT: ['fortitude', 'willpower'],
  DISENGAGE: ['vitality', 'charm']
};

export interface AttackRollParams {
  attackerStat: number;
  weaponValue: number;       // Light +1, Medium +2, Heavy +3
  hasAdvantage?: boolean;
  hasDisadvantage?: boolean;
}

export interface DefenseParams {
  defenseStat: number;
  armorValue: number;        // Light +1, Medium +2, Heavy +3
  hasAdvantage?: boolean;
  hasDisadvantage?: boolean;
  useGuard?: boolean;        // If true, hits Guard (no die roll: stat + armor)
}

export interface RollD12Result {
  final: number;
  rolls: number[];
  type: 'STANDARD' | 'ADVANTAGE' | 'DISADVANTAGE';
  isStar: boolean;           // Natural 12
  isScar: boolean;           // Natural 1
}

/**
 * Rolls a d12 with optional advantage/disadvantage.
 */
export function rollD12(hasAdvantage: boolean = false, hasDisadvantage: boolean = false): RollD12Result {
  const r1 = Math.floor(Math.random() * 12) + 1;
  const r2 = Math.floor(Math.random() * 12) + 1;

  if (hasAdvantage && !hasDisadvantage) {
    const final = Math.max(r1, r2);
    return { final, rolls: [r1, r2], type: 'ADVANTAGE', isStar: final === 12, isScar: final === 1 };
  }
  if (hasDisadvantage && !hasAdvantage) {
    const final = Math.min(r1, r2);
    return { final, rolls: [r1, r2], type: 'DISADVANTAGE', isStar: final === 12, isScar: final === 1 };
  }
  return { final: r1, rolls: [r1], type: 'STANDARD', isStar: r1 === 12, isScar: r1 === 1 };
}

export interface ContestedCombatResult {
  outcome: 'ATTACKER_SUCCESS' | 'DEFENDER_SUCCESS' | 'CLASH_TIED';
  tier: BrutalInjuryTier;
  margin: number;
  capacityLost: number;
  energyShredded: number;
  effect: string;
  attackerRoll: RollD12Result;
  attackerTotal: number;
  defenderRoll: RollD12Result | null;
  defenderTotal: number;
  isGuardDefense: boolean;
  starGained: boolean;
  scarIncurred: boolean;
  log: string;
}

/**
 * Resolves an opposed attack roll under B.R.U.T.A.L. v4.9.
 */
export function resolveContestedAttack(attacker: AttackRollParams, defender: DefenseParams): ContestedCombatResult {
  const atkRoll = rollD12(attacker.hasAdvantage, attacker.hasDisadvantage);
  const attackerTotal = atkRoll.final + attacker.attackerStat + attacker.weaponValue;

  let defRoll: RollD12Result | null = null;
  let defenderTotal = 0;

  if (defender.useGuard) {
    // Hits Guard: Defense Stat + Armor Value, no die
    defenderTotal = defender.defenseStat + defender.armorValue;
  } else {
    // Active Defense: d12 + Defense Stat + Armor Value
    defRoll = rollD12(defender.hasAdvantage, defender.hasDisadvantage);
    defenderTotal = defRoll.final + defender.defenseStat + defender.armorValue;
  }

  const margin = attackerTotal - defenderTotal;

  if (margin === 0) {
    return {
      outcome: 'CLASH_TIED',
      tier: 'NONE',
      margin: 0,
      capacityLost: 0,
      energyShredded: 0,
      effect: 'Weapons lock! Both combatants enter The Clash (margin 0).',
      attackerRoll: atkRoll,
      attackerTotal,
      defenderRoll: defRoll,
      defenderTotal,
      isGuardDefense: !!defender.useGuard,
      starGained: atkRoll.isStar,
      scarIncurred: atkRoll.isScar,
      log: `⚔️ CLASH TIED! Attacker (${attackerTotal}) tied Defender (${defenderTotal}). Choose Clash stance!`
    };
  }

  if (margin < 0) {
    return {
      outcome: 'DEFENDER_SUCCESS',
      tier: 'NONE',
      margin,
      capacityLost: 0,
      energyShredded: 0,
      effect: 'Attack parried, dodged, or turned away by armor.',
      attackerRoll: atkRoll,
      attackerTotal,
      defenderRoll: defRoll,
      defenderTotal,
      isGuardDefense: !!defender.useGuard,
      starGained: defRoll?.isStar ?? false,
      scarIncurred: atkRoll.isScar,
      log: `🛡️ DEFENDED! Defender (${defenderTotal}${defender.useGuard ? ' Guard' : ''}) stopped Attacker (${attackerTotal}). Margin: ${margin}.`
    };
  }

  // Attacker Wins: determine Injury Tier from Margin
  let tier: BrutalInjuryTier = 'GRAZE';
  let capacityLost = 0;
  let energyShredded = 1;
  let effect = 'A near miss: -2 Composure (Anxiety).';

  if (margin >= 10) {
    tier = 'CRITICAL';
    capacityLost = 12;
    energyShredded = 6;
    effect = 'Staggered! Body part destroyed until proper treatment; needs stabilizing.';
  } else if (margin >= 6) {
    tier = 'MAJOR';
    capacityLost = 8;
    energyShredded = 4;
    effect = 'Bleed: lose 1 token at the start of each of your turns. Wound card revealed.';
  } else if (margin >= 2) {
    tier = 'MINOR';
    capacityLost = 4;
    energyShredded = 2;
    effect = 'Disadvantage on your next roll. Hidden wound card.';
  }

  return {
    outcome: 'ATTACKER_SUCCESS',
    tier,
    margin,
    capacityLost,
    energyShredded,
    effect,
    attackerRoll: atkRoll,
    attackerTotal,
    defenderRoll: defRoll,
    defenderTotal,
    isGuardDefense: !!defender.useGuard,
    starGained: atkRoll.isStar,
    scarIncurred: defRoll?.isScar ?? false,
    log: `💥 ATTACK LANDED! Attacker (${attackerTotal}) vs Defender (${defenderTotal}${defender.useGuard ? ' Guard' : ''}) | Margin +${margin} -> ${tier} Injury (${capacityLost} capacity lost, ${energyShredded} energy shredded). ${effect}`
  };
}

export interface ClashResult {
  result: 'ATTACKER_WINS_CLASH' | 'DEFENDER_WINS_CLASH' | 'MUTUAL_STALEMATE';
  attackerStance: ClashStance;
  attackerStatKey: string;
  attackerStatVal: number;
  attackerRoll: number;
  attackerTotal: number;
  defenderStance: ClashStance;
  defenderStatKey: string;
  defenderStatVal: number;
  defenderRoll: number;
  defenderTotal: number;
  winnerBenefit: string;
  loserPenalty: string;
  narrative: string;
}

/**
 * Resolves The Clash (B.R.U.T.A.L. v4.9 margin = 0).
 * Both roll: d12 + chosen stance stat (no gear value).
 */
export function resolveClashTie(
  attackerStance: ClashStance,
  attackerStatKey: string,
  attackerStatVal: number,
  defenderStance: ClashStance,
  defenderStatKey: string,
  defenderStatVal: number
): ClashResult {
  const atkDie = Math.floor(Math.random() * 12) + 1;
  const defDie = Math.floor(Math.random() * 12) + 1;

  const attackerTotal = atkDie + attackerStatVal;
  const defenderTotal = defDie + defenderStatVal;

  const STANCE_BENEFITS: Record<ClashStance, { win: string; lose: string }> = {
    PRESS: {
      win: 'Pushes 1 space forward, lands a Minor injury.',
      lose: 'Next hit on them is +1 tier.'
    },
    HOLD: {
      win: 'Strikes from fixed stance (Minor injury).',
      lose: 'Anything they were channeling detonates!'
    },
    MANEUVER: {
      win: 'Shifts and lands a flanking strike (Minor injury).',
      lose: 'Takes a Graze.'
    },
    TRICK: {
      win: 'Next hit ignores armor value completely.',
      lose: '[STUNNED]: loses next Body beat.'
    },
    FEINT: {
      win: 'Swaps places with the target.',
      lose: '[STAGGERED]: next strike on them is unopposed.'
    },
    DISENGAGE: {
      win: 'Parting Graze and leaps 1 space back.',
      lose: '[OFF-BALANCE]: thrown back 1 space.'
    }
  };

  if (attackerTotal === defenderTotal) {
    return {
      result: 'MUTUAL_STALEMATE',
      attackerStance,
      attackerStatKey,
      attackerStatVal,
      attackerRoll: atkDie,
      attackerTotal,
      defenderStance,
      defenderStatKey,
      defenderStatVal,
      defenderRoll: defDie,
      defenderTotal,
      winnerBenefit: 'Neither broke guard.',
      loserPenalty: 'Stalemate continues.',
      narrative: `Mutual stalemate! Both rolled total ${attackerTotal}. Weapons remain grinding in deadlock.`
    };
  }

  const attackerWon = attackerTotal > defenderTotal;
  const winnerStance = attackerWon ? attackerStance : defenderStance;
  const loserStance = attackerWon ? defenderStance : attackerStance;

  return {
    result: attackerWon ? 'ATTACKER_WINS_CLASH' : 'DEFENDER_WINS_CLASH',
    attackerStance,
    attackerStatKey,
    attackerStatVal,
    attackerRoll: atkDie,
    attackerTotal,
    defenderStance,
    defenderStatKey,
    defenderStatVal,
    defenderRoll: defDie,
    defenderTotal,
    winnerBenefit: STANCE_BENEFITS[winnerStance].win,
    loserPenalty: STANCE_BENEFITS[loserStance].lose,
    narrative: attackerWon
      ? `Attacker's ${attackerStance} (${attackerTotal}) overpowered Defender's ${defenderStance} (${defenderTotal})! ${STANCE_BENEFITS.PRESS.win}`
      : `Defender's ${defenderStance} (${defenderTotal}) turned Attacker's ${attackerStance} (${attackerTotal})! ${STANCE_BENEFITS[defenderStance].win}`
  };
}
