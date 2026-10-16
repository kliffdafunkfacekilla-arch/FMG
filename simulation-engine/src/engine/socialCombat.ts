/**
 * SOCIAL & SANITY COMBAT RESOLUTION ENGINE
 * ========================================
 * Parallels physical combat by resolving opposed 1d20 checks targeting Composure pools.
 * - Social Attacks: 1d20 + Stat + Social Weapon Mod vs 1d20 + Defender Stat + Social Armor Mod
 * - Cosmic Dread: 1d20 + Willpower/Fortitude + Social Armor Mod vs Environmental Horror DC
 * - Morale Breakdown: When Composure reaches 0, target surrenders, flees, or enters Panic.
 */

import { getSocialWeapon, getSocialArmor, SocialWeaponDef, SocialArmorDef } from './rpg/SocialEquipmentRegistry.js';
import { StatKey } from './rpg/EquipmentRegistry.js';

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
  } = {}
): SocialContestResult {
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

  const atkRoll = Math.floor(Math.random() * 20) + 1;
  const defRoll = Math.floor(Math.random() * 20) + 1;

  const advantage = options.advantageMod || 0;
  const attackerTotal = atkRoll + atkStatVal + socialWeapon.mod + advantage;
  const defenderTotal = defRoll + defStatVal + socialArmor.mod;

  const difference = attackerTotal - defenderTotal;
  const hit = difference >= 0;

  let composureDamage = 0;
  if (hit) {
    const rawInjury = difference >= 10 ? 4 : (difference >= 6 ? 3 : (difference >= 3 ? 2 : 1));
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

  const roll = Math.floor(Math.random() * 20) + 1;
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
