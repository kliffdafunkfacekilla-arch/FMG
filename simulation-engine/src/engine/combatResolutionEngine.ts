/**
 * B.R.U.T.A.L. TTRPG Contested Attack & Clash Resolution Engine (v5.0)
 * ===================================================================
 * - Core Die: d12 (opposed rolls)
 * - Net Margin = Attacker Total - Defender Total
 *   * Margin < 0: Defender Wins
 *   * Margin = 0 (within reach): The Clash (no gear, d12 + best stat; wheel grants Advantage)
 *   * Margin = 0 (out of reach): Graze
 *   * Margin = 1: Graze (0 capacity, 1 energy owed, -2 Composure)
 *   * Margin 2-5: Minor (4 capacity, 2 energy owed, Disadvantage next roll)
 *   * Margin 6-9: Major (8 capacity, 4 energy owed, Bleed 1/turn)
 *   * Margin 10+: Critical (12 capacity, 6 energy owed, Staggered / Mutilated)
 * - Defenses: One Active Defense per round (rolled d12); other attacks hit Guard (stat + armor, no die).
 * - Stars (nat 12) only on succeeded rolls; Painful Lessons (nat 1) only on failed rolls.
 */

export type BrutalInjuryTier = 'GRAZE' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'NONE';

export type ClashStance = 'PRESS' | 'TRICK' | 'DISENGAGE' | 'HOLD' | 'FEINT' | 'MANEUVER';

/**
 * Canonical Clash Wheel (v5.0): each stance at index i beats i+1 and i+2 (mod 6).
 * Same stance or i+3 (mod 6) is even.
 */
export const CLASH_WHEEL: readonly ClashStance[] = [
  'PRESS',
  'TRICK',
  'DISENGAGE',
  'HOLD',
  'FEINT',
  'MANEUVER'
];

export function doesStanceBeat(stanceA: ClashStance, stanceB: ClashStance): boolean {
  const i = CLASH_WHEEL.indexOf(stanceA);
  const j = CLASH_WHEEL.indexOf(stanceB);
  if (i === -1 || j === -1 || i === j) return false;
  return (i + 1) % 6 === j || (i + 2) % 6 === j;
}

export function getBestStatFromMap(stats: Record<string, number>): { key: string; val: number } {
  let bestKey = 'might';
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(stats)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return { key: bestKey, val: bestVal === -Infinity ? 0 : bestVal };
}

export interface AttackRollParams {
  attackerStat: number;
  weaponValue: number;       // Light +1, Medium +2, Heavy +3
  hasAdvantage?: boolean | undefined;
  hasDisadvantage?: boolean | undefined;
  attackerSpent?: boolean | undefined; // Spent in attack pool gives Disadvantage
  withinReach?: boolean | undefined;   // Default true; if false, margin 0 becomes Graze instead of Clash
  fixedRoll?: number | undefined;        // Deterministic roll override for testing
  fixedRolls?: [number, number] | undefined;
}

export interface DefenseParams {
  defenseStat: number;
  armorValue: number;        // Light +1, Medium +2, Heavy +3
  hasAdvantage?: boolean | undefined;
  hasDisadvantage?: boolean | undefined;
  defenderSpent?: boolean | undefined; // Defenses roll normally even when Spent
  useGuard?: boolean | undefined;        // If true, hits Guard (no die roll: stat + armor)
  fixedRoll?: number | undefined;        // Deterministic roll override for testing
  fixedRolls?: [number, number] | undefined;
}

export interface RollD12Result {
  final: number;
  rolls: number[];
  type: 'STANDARD' | 'ADVANTAGE' | 'DISADVANTAGE';
  isStar: boolean;           // Natural 12
  isPainfulLesson: boolean;  // Natural 1
}

/**
 * Evaluates Star / Painful Lesson pips per Draft v5.0:
 * - Natural 12 is a Star ONLY if the roll succeeded.
 * - Natural 1 is a Painful Lesson ONLY if the roll failed.
 */
export function evaluateRollPips(
  naturalRoll: number,
  succeeded: boolean
): { isStar: boolean; isPainfulLesson: boolean } {
  return {
    isStar: naturalRoll === 12 && succeeded,
    isPainfulLesson: naturalRoll === 1 && !succeeded
  };
}

/**
 * Rolls a d12 with optional advantage/disadvantage.
 * Advantage + Disadvantage cancel out into a straight roll.
 */
export function rollD12(
  hasAdvantage: boolean = false,
  hasDisadvantage: boolean = false,
  fixedRoll?: number | [number, number]
): RollD12Result {
  const r1 = Array.isArray(fixedRoll) ? fixedRoll[0] : (fixedRoll ?? (Math.floor(Math.random() * 12) + 1));
  const r2 = Array.isArray(fixedRoll) ? fixedRoll[1] : (fixedRoll ?? (Math.floor(Math.random() * 12) + 1));

  if (hasAdvantage && !hasDisadvantage) {
    const final = Math.max(r1, r2);
    return { final, rolls: [r1, r2], type: 'ADVANTAGE', isStar: final === 12, isPainfulLesson: final === 1 };
  }
  if (hasDisadvantage && !hasAdvantage) {
    const final = Math.min(r1, r2);
    return { final, rolls: [r1, r2], type: 'DISADVANTAGE', isStar: final === 12, isPainfulLesson: final === 1 };
  }
  return { final: r1, rolls: [r1], type: 'STANDARD', isStar: r1 === 12, isPainfulLesson: r1 === 1 };
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
  painfulLessonIncurred: boolean;
  attackerStar: boolean;
  attackerPainfulLesson: boolean;
  defenderStar: boolean;
  defenderPainfulLesson: boolean;
  log: string;
}

/**
 * Resolves an opposed attack roll under B.R.U.T.A.L. v5.0.
 */
export function resolveContestedAttack(attacker: AttackRollParams, defender: DefenseParams): ContestedCombatResult {
  const atkDisadv = !!attacker.hasDisadvantage || !!attacker.attackerSpent;
  const atkFixed = attacker.fixedRolls ?? attacker.fixedRoll;
  const atkRoll = rollD12(!!attacker.hasAdvantage, atkDisadv, atkFixed);
  const attackerTotal = atkRoll.final + attacker.attackerStat + attacker.weaponValue;

  let defRoll: RollD12Result | null = null;
  let defenderTotal = 0;

  if (defender.useGuard) {
    // Hits Guard: Defense Stat + Armor Value, no die
    defenderTotal = defender.defenseStat + defender.armorValue;
  } else {
    // Active Defense: d12 + Defense Stat + Armor Value (defenses roll normally even if Spent)
    const defFixed = defender.fixedRolls ?? defender.fixedRoll;
    defRoll = rollD12(!!defender.hasAdvantage, !!defender.hasDisadvantage, defFixed);
    defenderTotal = defRoll.final + defender.defenseStat + defender.armorValue;
  }

  const margin = attackerTotal - defenderTotal;
  const withinReach = attacker.withinReach !== false;

  if (margin === 0 && withinReach) {
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
      starGained: false,
      painfulLessonIncurred: false,
      attackerStar: false,
      attackerPainfulLesson: false,
      defenderStar: false,
      defenderPainfulLesson: false,
      log: `⚔️ CLASH TIED! Attacker (${attackerTotal}) tied Defender (${defenderTotal}). Choose Clash stance!`
    };
  }

  if (margin < 0) {
    const atkPips = evaluateRollPips(atkRoll.final, false);
    const defPips = defRoll ? evaluateRollPips(defRoll.final, true) : { isStar: false, isPainfulLesson: false };
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
      starGained: defPips.isStar,
      painfulLessonIncurred: atkPips.isPainfulLesson,
      attackerStar: atkPips.isStar,
      attackerPainfulLesson: atkPips.isPainfulLesson,
      defenderStar: defPips.isStar,
      defenderPainfulLesson: defPips.isPainfulLesson,
      log: `🛡️ DEFENDED! Defender (${defenderTotal}${defender.useGuard ? ' Guard' : ''}) stopped Attacker (${attackerTotal}). Margin: ${margin}.`
    };
  }

  // Attacker Wins (including margin === 0 when out of reach -> Graze): determine Injury Tier from Margin
  let tier: BrutalInjuryTier = 'GRAZE';
  let capacityLost = 0;
  let energyShredded = 1;
  let effect = margin === 0
    ? 'Tie out of reach becomes a Graze: -2 Composure (Anxiety).'
    : 'A near miss: -2 Composure (Anxiety).';

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

  const atkPips = evaluateRollPips(atkRoll.final, true);
  const defPips = defRoll ? evaluateRollPips(defRoll.final, false) : { isStar: false, isPainfulLesson: false };

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
    starGained: atkPips.isStar,
    painfulLessonIncurred: defPips.isPainfulLesson,
    attackerStar: atkPips.isStar,
    attackerPainfulLesson: atkPips.isPainfulLesson,
    defenderStar: defPips.isStar,
    defenderPainfulLesson: defPips.isPainfulLesson,
    log: `💥 ATTACK LANDED! Attacker (${attackerTotal}) vs Defender (${defenderTotal}${defender.useGuard ? ' Guard' : ''}) | Margin +${margin} -> ${tier} Injury (${capacityLost} capacity lost, ${energyShredded} energy owed). ${effect}`
  };
}

export interface ClashTieOptions {
  attackerStats?: Record<string, number> | undefined;
  defenderStats?: Record<string, number> | undefined;
  attackerFixedRoll?: number | [number, number] | undefined;
  defenderFixedRoll?: number | [number, number] | undefined;
}

export interface ClashResult {
  result: 'ATTACKER_WINS_CLASH' | 'DEFENDER_WINS_CLASH' | 'MUTUAL_STALEMATE';
  attackerStance: ClashStance;
  attackerStatKey: string;
  attackerStatVal: number;
  attackerRoll: number;
  attackerRolls: number[];
  attackerHasAdvantage: boolean;
  attackerTotal: number;
  defenderStance: ClashStance;
  defenderStatKey: string;
  defenderStatVal: number;
  defenderRoll: number;
  defenderRolls: number[];
  defenderHasAdvantage: boolean;
  defenderTotal: number;
  continuesNextRound: boolean;
  staminaCostEach: number;
  focusCostEach: number;
  winnerBenefit: string;
  loserPenalty: string;
  narrative: string;
}

/**
 * Resolves The Clash (B.R.U.T.A.L. v5.0 margin = 0 within reach).
 * Stances do NOT have stats; each side rolls d12 + its best stat (no gear).
 * The Clash wheel determines which side rolls with Advantage.
 * A tie means the Clash continues next round (both pay 1 Stamina + 1 Focus, pick again).
 */
export function resolveClashTie(
  attackerStance: ClashStance,
  attackerStatKey: string,
  attackerStatVal: number,
  defenderStance: ClashStance,
  defenderStatKey: string,
  defenderStatVal: number,
  options?: ClashTieOptions
): ClashResult {
  const atkBest = options?.attackerStats
    ? getBestStatFromMap(options.attackerStats)
    : { key: attackerStatKey, val: attackerStatVal };
  const defBest = options?.defenderStats
    ? getBestStatFromMap(options.defenderStats)
    : { key: defenderStatKey, val: defenderStatVal };

  const attackerHasAdvantage = doesStanceBeat(attackerStance, defenderStance);
  const defenderHasAdvantage = doesStanceBeat(defenderStance, attackerStance);

  const atkRollRes = rollD12(attackerHasAdvantage, false, options?.attackerFixedRoll);
  const defRollRes = rollD12(defenderHasAdvantage, false, options?.defenderFixedRoll);

  const atkDie = atkRollRes.final;
  const defDie = defRollRes.final;

  const attackerTotal = atkDie + atkBest.val;
  const defenderTotal = defDie + defBest.val;

  const STANCE_BENEFITS: Record<ClashStance, { win: string; lose: string }> = {
    PRESS: {
      win: 'Pushes 1 space forward, lands a Minor injury.',
      lose: 'Next hit on them is +1 tier.'
    },
    HOLD: {
      win: 'Strikes from fixed stance (Minor injury) and anchors.',
      lose: 'Anything they were channeling detonates!'
    },
    MANEUVER: {
      win: 'Shifts 1 space and lands a flanking strike (Minor injury).',
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
      attackerStatKey: atkBest.key,
      attackerStatVal: atkBest.val,
      attackerRoll: atkDie,
      attackerRolls: atkRollRes.rolls,
      attackerHasAdvantage,
      attackerTotal,
      defenderStance,
      defenderStatKey: defBest.key,
      defenderStatVal: defBest.val,
      defenderRoll: defDie,
      defenderRolls: defRollRes.rolls,
      defenderHasAdvantage,
      defenderTotal,
      continuesNextRound: true,
      staminaCostEach: 1,
      focusCostEach: 1,
      winnerBenefit: 'Neither broke guard.',
      loserPenalty: 'Clash continues next round: both pay 1 Stamina + 1 Focus and pick again.',
      narrative: `Mutual stalemate! Both rolled total ${attackerTotal}. Clash continues next round: both pay 1 Stamina + 1 Focus.`
    };
  }

  const attackerWon = attackerTotal > defenderTotal;
  const winnerStance = attackerWon ? attackerStance : defenderStance;
  const loserStance = attackerWon ? defenderStance : attackerStance;

  return {
    result: attackerWon ? 'ATTACKER_WINS_CLASH' : 'DEFENDER_WINS_CLASH',
    attackerStance,
    attackerStatKey: atkBest.key,
    attackerStatVal: atkBest.val,
    attackerRoll: atkDie,
    attackerRolls: atkRollRes.rolls,
    attackerHasAdvantage,
    attackerTotal,
    defenderStance,
    defenderStatKey: defBest.key,
    defenderStatVal: defBest.val,
    defenderRoll: defDie,
    defenderRolls: defRollRes.rolls,
    defenderHasAdvantage,
    defenderTotal,
    continuesNextRound: false,
    staminaCostEach: 0,
    focusCostEach: 0,
    winnerBenefit: STANCE_BENEFITS[winnerStance].win,
    loserPenalty: STANCE_BENEFITS[loserStance].lose,
    narrative: attackerWon
      ? `Attacker's ${attackerStance} (${attackerTotal}) overpowered Defender's ${defenderStance} (${defenderTotal})! ${STANCE_BENEFITS[winnerStance].win}`
      : `Defender's ${defenderStance} (${defenderTotal}) turned Attacker's ${attackerStance} (${attackerTotal})! ${STANCE_BENEFITS[winnerStance].win}`
  };
}

export interface ReadyDeclaration {
  actorId: string;
  trigger: 'CHARGER' | 'INTERCEPT_ALLY' | 'ENTER_REACH';
  stepIntoReach?: boolean | undefined;
  hasMoveRemaining?: boolean | undefined;
  hasReactionRemaining?: boolean | undefined;
  isShooter?: boolean | undefined;
}

export interface ReadyReactionResult {
  fired: boolean;
  bodyBeatSpent: true;
  reactionSpent: boolean;
  moveSpent: boolean;
  intercepted: boolean;
  chargerMoveStopped: boolean;
  readyAttackResult: ContestedCombatResult | null;
  interceptedAttackResult: ContestedCombatResult | null;
}

/**
 * Resolves a Readied Body beat trigger (Step 10, Rulebook §5.7):
 * - Gives up Body beat to name a trigger; fires at once BEFORE the triggering attack roll.
 * - Uses the round's one Reaction; may include a 1-space step into reach spending Move.
 * - Intercept: attack targeting an adjacent ally is redirected onto the interceptor instead.
 * - Shooter vs Charger: on Minor or worse, the charger's Move stops where it is.
 */
export function resolveReadyReaction(
  ready: ReadyDeclaration,
  readiedAttack: AttackRollParams,
  triggerTargetDefense: DefenseParams,
  triggeringAttack?: {
    attackerParams: AttackRollParams;
    interceptorDefense: DefenseParams;
  }
): ReadyReactionResult {
  if (ready.hasReactionRemaining === false) {
    return {
      fired: false,
      bodyBeatSpent: true,
      reactionSpent: false,
      moveSpent: false,
      intercepted: false,
      chargerMoveStopped: false,
      readyAttackResult: null,
      interceptedAttackResult: null
    };
  }

  if (ready.stepIntoReach && ready.hasMoveRemaining === false) {
    return {
      fired: false,
      bodyBeatSpent: true,
      reactionSpent: false,
      moveSpent: false,
      intercepted: false,
      chargerMoveStopped: false,
      readyAttackResult: null,
      interceptedAttackResult: null
    };
  }

  const moveSpent = !!ready.stepIntoReach && ready.hasMoveRemaining !== false;

  if (ready.trigger === 'INTERCEPT_ALLY') {
    const interceptedAttackResult = triggeringAttack
      ? resolveContestedAttack(triggeringAttack.attackerParams, triggeringAttack.interceptorDefense)
      : null;

    return {
      fired: true,
      bodyBeatSpent: true,
      reactionSpent: true,
      moveSpent,
      intercepted: true,
      chargerMoveStopped: false,
      readyAttackResult: null,
      interceptedAttackResult
    };
  }

  // Trigger fires before the triggering attack roll
  const readyAttackResult = resolveContestedAttack(readiedAttack, triggerTargetDefense);
  const chargerMoveStopped =
    ready.trigger === 'CHARGER' &&
    !!ready.isShooter &&
    readyAttackResult.outcome === 'ATTACKER_SUCCESS' &&
    (readyAttackResult.tier === 'MINOR' ||
      readyAttackResult.tier === 'MAJOR' ||
      readyAttackResult.tier === 'CRITICAL');

  return {
    fired: true,
    bodyBeatSpent: true,
    reactionSpent: true,
    moveSpent,
    intercepted: false,
    chargerMoveStopped,
    readyAttackResult,
    interceptedAttackResult: null
  };
}
