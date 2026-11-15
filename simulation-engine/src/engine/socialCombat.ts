/**
 * SOCIAL & SANITY COMBAT RESOLUTION ENGINE (B.R.U.T.A.L. v5.0)
 * ============================================================
 * - Persuasion (§6.3): unopposed skill check (d12 + stat + Prop) vs target's current Composure.
 *   Margins: 7+ yes and more, 3-6 yes, 0-2 yes for a price, <0 no.
 *   An ask against the target's orders cannot be won by Persuasion.
 *   One voice: one speaker per target per round; other speakers grant Advantage.
 * - Talk in a fight is free and wounds nobody (§5.10 / §6).
 * - Hostile social attacks out of a fight deal Composure injuries (§6.2).
 */

import { getSocialWeapon, getSocialArmor, SocialWeaponDef, SocialArmorDef } from './rpg/SocialEquipmentRegistry.js';
import { StatKey } from './rpg/EquipmentRegistry.js';
import { rollD12, RollD12Result } from './combatResolutionEngine.js';

export type PersuasionOutcome =
  | 'YES_AND_MORE'
  | 'YES'
  | 'YES_FOR_A_PRICE'
  | 'NO'
  | 'REJECTED_AGAINST_ORDERS'
  | 'REJECTED_ONE_VOICE';

export interface PersuasionParams {
  speakerStatVal: number;
  propValue?: number | undefined;
  targetComposure: number;
  againstOrders?: boolean | undefined;
  otherSpeakersCount?: number | undefined;
  alreadySpokenToTargetThisRound?: boolean | undefined;
  hasAdvantage?: boolean | undefined;
  hasDisadvantage?: boolean | undefined;
  fixedRoll?: number | undefined;
  fixedRolls?: [number, number] | undefined;
}

export interface PersuasionResult {
  outcome: PersuasionOutcome;
  succeeded: boolean;
  woundsDealt: 0;
  focusCost: 0;
  roll: RollD12Result | null;
  total: number;
  difficulty: number;
  margin: number;
  usedAdvantage: boolean;
  log: string;
}

/**
 * Resolves a non-hostile Persuasion check (v5.0 §6.3):
 * - Difficulty is the target's current Composure.
 * - Margins: 7+ YES_AND_MORE, 3-6 YES, 0-2 YES_FOR_A_PRICE, <0 NO.
 * - Asks against orders cannot be won by Persuasion.
 * - One speaker per target per round; other speakers grant Advantage.
 * - Free and deals 0 wounds.
 */
export function resolvePersuasion(params: PersuasionParams): PersuasionResult {
  if (params.againstOrders) {
    return {
      outcome: 'REJECTED_AGAINST_ORDERS',
      succeeded: false,
      woundsDealt: 0,
      focusCost: 0,
      roll: null,
      total: 0,
      difficulty: params.targetComposure,
      margin: -99,
      usedAdvantage: false,
      log: 'Persuasion rejected: an ask against the target\'s orders cannot be won by Persuasion.'
    };
  }

  if (params.alreadySpokenToTargetThisRound) {
    return {
      outcome: 'REJECTED_ONE_VOICE',
      succeeded: false,
      woundsDealt: 0,
      focusCost: 0,
      roll: null,
      total: 0,
      difficulty: params.targetComposure,
      margin: -99,
      usedAdvantage: false,
      log: 'One voice rule: only one speaker per target per round; allies can assist to grant Advantage.'
    };
  }

  const usedAdvantage = !!params.hasAdvantage || (params.otherSpeakersCount ?? 0) > 0;
  const fixed = params.fixedRolls ?? params.fixedRoll;
  const roll = rollD12(usedAdvantage, !!params.hasDisadvantage, fixed);
  const propValue = params.propValue ?? 0;
  const total = roll.final + params.speakerStatVal + propValue;
  const difficulty = params.targetComposure;
  const margin = total - difficulty;

  let outcome: PersuasionOutcome = 'NO';
  if (margin >= 7) outcome = 'YES_AND_MORE';
  else if (margin >= 3) outcome = 'YES';
  else if (margin >= 0) outcome = 'YES_FOR_A_PRICE';

  return {
    outcome,
    succeeded: margin >= 0,
    woundsDealt: 0,
    focusCost: 0,
    roll,
    total,
    difficulty,
    margin,
    usedAdvantage,
    log: `[PERSUASION]: 1d12 (${roll.rolls.join(', ')}) + ${params.speakerStatVal} + ${propValue} = ${total} vs Composure ${difficulty} (Margin ${margin >= 0 ? `+${margin}` : margin}) -> ${outcome} (0 wounds).`
  };
}

export interface SocialCombatant {
  id?: string | number;
  name: string;
  stats: Record<string, number>;
  equippedSocialWeapon?: string;
  equippedSocialArmor?: string;
  composure: number;
  maxComposure: number;
  skillRanks?: Record<string, number>;
  difficulty?: string;
}

export interface SocialContestResult {
  hit: boolean;
  attackerRoll: number;
  attackerStatVal: number;
  attackerMod: number;
  attackerTotal: number;
  defenderRoll: number;
  defenderStatVal: number;
  defenderMod: number;
  defenderTotal: number;
  difference: number;
  composureDamage: number;
  defenderComposureRemaining: number;
  isBroken: boolean; // True if defender composure reaches 0 (Morale Collapse / Surrender)
  log: string;
}

export function resolveOpposedSocialContest(
  attacker: SocialCombatant,
  defender: SocialCombatant,
  attackStat: StatKey,
  options: {
    advantageMod?: number;
    useWeaponSpec?: boolean;
    useArmorSpec?: boolean;
    inFight?: boolean;
  } = {}
): SocialContestResult {
  if (options.inFight) {
    return {
      hit: false,
      attackerRoll: 0,
      attackerStatVal: Number(attacker.stats[attackStat]) || 5,
      attackerMod: 0,
      attackerTotal: 0,
      defenderRoll: 0,
      defenderStatVal: Number(defender.stats['willpower']) || 5,
      defenderMod: 0,
      defenderTotal: 0,
      difference: 0,
      composureDamage: 0,
      defenderComposureRemaining: defender.composure,
      isBroken: false,
      log: '[IN-FIGHT TALK]: Talk during a fight is free and wounds nobody (0 Composure trauma dealt).'
    };
  }
  const socialWeapon: SocialWeaponDef = getSocialWeapon(attacker.equippedSocialWeapon || '');
  const socialArmor: SocialArmorDef = getSocialArmor(defender.equippedSocialArmor || '');

  const effectiveAtkStat: StatKey = socialWeapon.stat || attackStat;
  const defStat: StatKey = socialArmor.stat || 'willpower';

  const atkStatVal = Number(attacker.stats[effectiveAtkStat]) || 5;
  const defStatVal = Number(defender.stats[defStat]) || 5;

  const atkSkillRanks = attacker.skillRanks || {};
  const defSkillRanks = defender.skillRanks || {};

  const weaponSpecRank = atkSkillRanks[`spec_soc_weapon_${effectiveAtkStat}`] || 0;
  const armorSpecRank = defSkillRanks[`spec_san_armor_${defStat}`] || 0;

  // Passive skill bonuses
  const atkPassiveBonus = (atkSkillRanks[`pass_soc_${effectiveAtkStat}`] || 0) >= 2 ? 1 : 0;
  const defPassiveCDR = (defSkillRanks[`pass_san_${defStat}`] || 0) >= 2 ? 1 : 0;

  const atkRoll = rollD12().final;
  const defRoll = rollD12().final;

  const advantage = options.advantageMod || 0;
  const attackerTotal = atkRoll + atkStatVal + socialWeapon.mod + advantage;
  const defenderTotal = defRoll + defStatVal + socialArmor.mod;

  const difference = attackerTotal - defenderTotal;
  const hit = difference >= 1;

  let composureDamage = 0;
  if (hit) {
    const rawInjury = difference >= 10 ? 4 : (difference >= 6 ? 3 : (difference >= 2 ? 2 : 1));
    const effectiveCDR = Math.max(0, socialArmor.composureReduction + defPassiveCDR);
    composureDamage = Math.max(1, rawInjury + socialWeapon.composureDamageBonus + atkPassiveBonus - effectiveCDR);
  }

  const defenderComposureRemaining = Math.max(0, defender.composure - composureDamage);
  const isBroken = defenderComposureRemaining === 0;

  const log = `[SOCIAL CONTEST (${effectiveAtkStat.toUpperCase()} - ${socialWeapon.name}): ${attackerTotal} vs (${defStat.toUpperCase()} - ${socialArmor.name}): ${defenderTotal} | ${hit ? "COMPOSURE HIT" : "DEFLECTED"} | ${composureDamage} Composure Trauma dealt (${defenderComposureRemaining}/${defender.maxComposure})]${isBroken ? ' 🚨 [MORALE COLLAPSE: Target Composure Broken! Surrenders / Panics]' : ''}`;

  return {
    hit,
    attackerRoll: atkRoll,
    attackerStatVal: atkStatVal,
    attackerMod: socialWeapon.mod,
    attackerTotal,
    defenderRoll: defRoll,
    defenderStatVal: defStatVal,
    defenderMod: socialArmor.mod,
    defenderTotal,
    difference,
    composureDamage,
    defenderComposureRemaining,
    isBroken,
    log
  };
}

export interface DreadCheckResult {
  passed: boolean;
  playerRoll: number;
  statVal: number;
  armorMod: number;
  totalRoll: number;
  horrorDC: number;
  composureTrauma: number;
  remainingComposure: number;
  isPanicked: boolean;
  log: string;
}

export function resolveCosmicDreadCheck(
  player: SocialCombatant,
  horrorDC: number,
  defenseStat: StatKey = 'willpower'
): DreadCheckResult {
  const socialArmor: SocialArmorDef = getSocialArmor(player.equippedSocialArmor || '');
  const statVal = Number(player.stats[defenseStat]) || Number(player.stats['willpower']) || 5;

  const armorSpecRank = (player.skillRanks || {})[`spec_san_armor_${defenseStat}`] || 0;
  const passiveCDR = ((player.skillRanks || {})[`pass_san_${defenseStat}`] || 0) >= 2 ? 1 : 0;

  const roll = rollD12().final;
  const totalRoll = roll + statVal + socialArmor.mod;
  const passed = totalRoll >= horrorDC;

  let composureTrauma = 0;
  if (!passed) {
    const diff = horrorDC - totalRoll;
    const baseTrauma = Math.max(2, Math.min(6, Math.floor(diff / 2)));
    const effectiveCDR = Math.max(0, socialArmor.composureReduction + passiveCDR);
    composureTrauma = Math.max(1, baseTrauma - effectiveCDR);
  }

  const remainingComposure = Math.max(0, player.composure - composureTrauma);
  const isPanicked = remainingComposure === 0;

  const log = `[SANITY DREAD CHECK (${defenseStat.toUpperCase()} - ${socialArmor.name}): ${totalRoll} vs Horror DC ${horrorDC} | ${passed ? "RESOLVED" : "SHAKEN"} | -${composureTrauma} Composure (${remainingComposure}/${player.maxComposure})]${isPanicked ? ' 👁️ [PSYCHOLOGICAL BREAKDOWN: Composure 0! Panicked & Disoriented]' : ''}`;

  return {
    passed,
    playerRoll: roll,
    statVal,
    armorMod: socialArmor.mod,
    totalRoll,
    horrorDC,
    composureTrauma,
    remainingComposure,
    isPanicked,
    log
  };
}
