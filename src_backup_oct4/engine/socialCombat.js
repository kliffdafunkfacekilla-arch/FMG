"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSocialAttack = resolveSocialAttack;
function resolveSocialAttack(attacker, defender, primaryStat, // e.g., 'charm' or 'logic'
useBodyStatBonus = false) {
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
//# sourceMappingURL=socialCombat.js.map