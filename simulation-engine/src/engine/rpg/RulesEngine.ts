/**
 * B.R.U.T.A.L. TTRPG Core Rules Engine (v4.9)
 * ============================================
 * Canonical Opposed Combat Resolution Bridge.
 * Core Die: 1d12 (Net Margin = Attacker Total - Defender Total).
 * Defenses: Active (1d12 + stat + armor) vs Guard (static stat + armor, no die).
 */

import { rollD12, BrutalInjuryTier } from "../combatResolutionEngine.js";

export interface CombatRollDetails {
    attackerRoll: number;
    attackerStatVal: number;
    attackerMod: number;
    attackerTotal: number;
    defenderRoll: number;
    defenderStatVal: number;
    defenderMod: number;
    defenderTotal: number;
    difference: number;
    injuryPoints: number;
    hit: boolean;
    tier?: BrutalInjuryTier;
    starGained?: boolean;
    scarIncurred?: boolean;
}

export interface CombatOptions {
    attackerDisadvantaged?: boolean;
    attackerAdvantaged?: boolean;
    defenderDisadvantaged?: boolean;
    defenderAdvantaged?: boolean;
    attackerWeaponSpecRank?: number; // 1-4
    defenderArmorSpecRank?: number;  // 1-4
    isSecondActionInRound?: boolean;
    useGuard?: boolean;              // Hits Guard (passive static score, no die)
}

export function resolveMeleeAttack(
    attackerStat: number,
    attackerMod: number,
    defenderStat: number,
    defenderMod: number,
    options?: CombatOptions
): number {
    const res = resolveOpposedCombat(attackerStat, attackerMod, defenderStat, defenderMod, options);
    return res.injuryPoints;
}

export function resolveOpposedCombat(
    attackerStat: number,
    attackerMod: number,
    defenderStat: number,
    defenderMod: number,
    options?: CombatOptions
): CombatRollDetails {
    const wSpec = options?.attackerWeaponSpecRank || 0;
    const aSpec = options?.defenderArmorSpecRank || 0;

    let attackerHasDisadv = !!options?.attackerDisadvantaged;
    let defenderHasDisadv = !!options?.defenderDisadvantaged;
    let attackerHasAdv = !!options?.attackerAdvantaged;
    let defenderHasAdv = !!options?.defenderAdvantaged;

    if (options?.isSecondActionInRound) {
        if (wSpec >= 2) attackerHasDisadv = false;
        if (aSpec >= 2) defenderHasDisadv = false;
    }

    // Roll canonical 1d12 with Star (12) and Scar (1)
    const atkRollRes = rollD12(attackerHasAdv, attackerHasDisadv);
    const defRollRes = options?.useGuard ? null : rollD12(defenderHasAdv, defenderHasDisadv);

    const attackerRoll = atkRollRes.final;
    const defenderRoll = defRollRes ? defRollRes.final : 0;

    const attackerTotal = attackerRoll + attackerStat + attackerMod;
    // Guard: static score (stat + mod) without die
    const defenderTotal = defRollRes ? (defenderRoll + defenderStat + defenderMod) : (defenderStat + defenderMod);

    const difference = attackerTotal - defenderTotal;

    let injuryPoints = 0;
    let tier: BrutalInjuryTier = 'NONE';

    if (difference >= 10) {
        injuryPoints = 4; // Critical
        tier = 'CRITICAL';
    } else if (difference >= 6) {
        injuryPoints = 3; // Major
        tier = 'MAJOR';
    } else if (difference >= 2) {
        injuryPoints = 2; // Minor Injury
        tier = 'MINOR';
    } else if (difference === 1) {
        // Graze tier
        if (aSpec >= 4) {
            injuryPoints = 0;
            tier = 'NONE';
        } else if (wSpec >= 4) {
            injuryPoints = 2;
            tier = 'MINOR';
        } else {
            injuryPoints = 1;
            tier = 'GRAZE';
        }
    } else {
        injuryPoints = 0;
        tier = 'NONE';
    }

    return {
        attackerRoll,
        attackerStatVal: attackerStat,
        attackerMod,
        attackerTotal,
        defenderRoll,
        defenderStatVal: defenderStat,
        defenderMod,
        defenderTotal,
        difference,
        injuryPoints,
        hit: injuryPoints > 0,
        tier,
        starGained: atkRollRes.isStar,
        scarIncurred: atkRollRes.isScar
    };
}
