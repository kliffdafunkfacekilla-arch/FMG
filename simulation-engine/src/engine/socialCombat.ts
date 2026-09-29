export interface SocialCombatant {
  name: string;
  mentalStats: Record<string, number>; // Logic, Charm, Willpower, Knowledge, etc.
  physicalStats: Record<string, number>; // Might, Vitality, etc.
  socialWeapon?: {
    name: string;
    baseBonus: number;
    compatibleBodyStat?: string; // e.g., 'might' for intimidation
  };
  socialArmor?: {
    name: string;
    defenseValue: number;
  };
  composurePool: number;
  maxComposure: number;
}

export function resolveSocialAttack(
  attacker: SocialCombatant,
  defender: SocialCombatant,
  primaryStat: string, // e.g., 'charm' or 'logic'
  useBodyStatBonus: boolean = false
): { damageDealt: number; description: string } {
  // 1. Calculate attacker pool contribution
  let attackPower = attacker.mentalStats[primaryStat] || 2;

  // 2. Add social weapon base and optional body stat bonus (e.g., Might for intimidation)
  if (attacker.socialWeapon) {
    attackPower += attacker.socialWeapon.baseBonus;
    if (useBodyStatBonus && attacker.socialWeapon.compatibleBodyStat) {
      const bodyStatVal = attacker.physicalStats[attacker.socialWeapon.compatibleBodyStat] || 0;
      attackPower += Math.floor(bodyStatVal / 2); // Half body stat adds physical presence to social weight
    }
  }

  // 3. Calculate defender defense
  const defenseValue = (defender.socialArmor?.defenseValue || 0) + (defender.mentalStats['willpower'] || 2);

  // 4. Contested Check Differential
  const damageDealt = Math.max(1, attackPower - defenseValue);
  defender.composurePool = Math.max(0, defender.composurePool - damageDealt);

  return {
    damageDealt,
    description: `${attacker.name} presses the attack using ${primaryStat}, dealing ${damageDealt} Composure damage to ${defender.name}!`
  };
}

