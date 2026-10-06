"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContestedAttack = resolveContestedAttack;
exports.resolveClashTie = resolveClashTie;
/**
 * Rolls a d20 with optional advantage/disadvantage.
 */
function rollD20(hasAdvantage = false, hasDisadvantage = false) {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    if (hasAdvantage && !hasDisadvantage)
        return Math.max(r1, r2);
    if (hasDisadvantage && !hasAdvantage)
        return Math.min(r1, r2);
    return r1;
}
/**
 * Resolves a contested attack roll and determines success severity.
 */
function resolveContestedAttack(attacker, defender) {
    const attackerTotal = rollD20(attacker.hasAdvantage, attacker.hasDisadvantage) + attacker.attackerStat + attacker.weaponOrArmorStat + attacker.weaponOrArmorMod;
    const defenderTotal = rollD20(defender.hasAdvantage, defender.hasDisadvantage) + defender.attackerStat + defender.weaponOrArmorStat + defender.weaponOrArmorMod;
    const diff = attackerTotal - defenderTotal;
    if (diff === 0) {
        return { outcome: 'CLASH_TIED', diff: 0 };
    }
    else if (diff > 0) {
        // Determine severity from difference
        let severity = 'GRAZE';
        if (diff >= 10)
            severity = 'CRIT';
        else if (diff >= 6)
            severity = 'MAJOR';
        else if (diff >= 3)
            severity = 'MINOR';
        return { outcome: 'ATTACKER_SUCCESS', severity, diff };
    }
    else {
        return { outcome: 'DEFENDER_SUCCESS', diff: Math.abs(diff) };
    }
}
/**
 * Resolves a locked-in Clash when an attack roll results in a tie.
 */
function resolveClashTie(attackerTactic, defenderTactic) {
    const attackerRoll = Math.floor(Math.random() * 6) + 1;
    const defenderRoll = Math.floor(Math.random() * 6) + 1;
    // Clash matrix logic determined by chosen tactics
    if (attackerTactic === defenderTactic) {
        return { result: 'MUTUAL_STALEMATE', attackerRoll, defenderRoll };
    }
    if ((attackerTactic === 'PRESS' && defenderTactic === 'DISENGAGE') ||
        (attackerTactic === 'FEINT' && defenderTactic === 'PRESS') ||
        (attackerTactic === 'DISENGAGE' && defenderTactic === 'HOLD') ||
        (attackerTactic === 'HOLD' && defenderTactic === 'FEINT')) {
        return { result: 'ATTACKER_WINS_CLASH', attackerRoll, defenderRoll };
    }
    return { result: 'DEFENDER_WINS_CLASH', attackerRoll, defenderRoll };
}
//# sourceMappingURL=combatResolutionEngine.js.map