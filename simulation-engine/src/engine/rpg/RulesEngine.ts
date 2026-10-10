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

export function resolveMeleeAttack(
    attackerStat: number,
    attackerMod: number,
    defenderStat: number,
    defenderMod: number
): number {
    const res = resolveOpposedCombat(attackerStat, attackerMod, defenderStat, defenderMod);
    return res.injuryPoints;
}

export function resolveOpposedCombat(
    attackerStat: number,
    attackerMod: number,
    defenderStat: number,
    defenderMod: number
): CombatRollDetails {
    const rollD20 = () => Math.floor(Math.random() * 20) + 1;
    
    const attackerRoll = rollD20();
    const defenderRoll = rollD20();
    const attackerTotal = attackerRoll + attackerStat + attackerMod;
    const defenderTotal = defenderRoll + defenderStat + defenderMod;
    
    const difference = attackerTotal - defenderTotal;
    
    let injuryPoints = 0;
    if (difference >= 10) injuryPoints = 4;
    else if (difference >= 6) injuryPoints = 3;
    else if (difference >= 3) injuryPoints = 2;
    else if (difference >= 1) injuryPoints = 1;
    
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
