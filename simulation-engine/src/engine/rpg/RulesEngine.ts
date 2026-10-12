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
}

export interface CombatOptions {
    attackerDisadvantaged?: boolean;
    defenderDisadvantaged?: boolean;
    attackerWeaponSpecRank?: number; // 1-4
    defenderArmorSpecRank?: number;  // 1-4
    isSecondActionInRound?: boolean;
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
    const rollD20 = () => Math.floor(Math.random() * 20) + 1;
    const rollDisadvantage = () => Math.min(rollD20(), rollD20());

    const wSpec = options?.attackerWeaponSpecRank || 0;
    const aSpec = options?.defenderArmorSpecRank || 0;

    // Disadvantage resolution:
    // Rank 1: Attacking with weapon does not disadvantage defense this round (or vice versa)
    // Rank 2: Does not take disadvantage if attacking or defending a second time in a round
    let attackerHasDisadv = !!options?.attackerDisadvantaged;
    let defenderHasDisadv = !!options?.defenderDisadvantaged;

    if (options?.isSecondActionInRound) {
        if (wSpec >= 2) attackerHasDisadv = false;
        if (aSpec >= 2) defenderHasDisadv = false;
    }

    const attackerRoll = attackerHasDisadv ? rollDisadvantage() : rollD20();
    const defenderRoll = defenderHasDisadv ? rollDisadvantage() : rollD20();
    const attackerTotal = attackerRoll + attackerStat + attackerMod;
    const defenderTotal = defenderRoll + defenderStat + defenderMod;

    const difference = attackerTotal - defenderTotal;

    let injuryPoints = 0;
    if (difference >= 10) {
        injuryPoints = 4; // Major/Critical
    } else if (difference >= 6) {
        injuryPoints = 3;
    } else if (difference >= 3) {
        injuryPoints = 2; // Minor Injury
    } else if (difference >= 1) {
        // Graze tier (diff 1-2)
        // Check Armor Spec Rank 4: Enemy Grazes count as complete Misses
        if (aSpec >= 4) {
            injuryPoints = 0;
        }
        // Check Weapon Spec Rank 4: Your Grazes count as Minor Injuries (2 pts instead of 1)
        else if (wSpec >= 4) {
            injuryPoints = 2;
        } else {
            injuryPoints = 1;
        }
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
        hit: injuryPoints > 0
    };
}

