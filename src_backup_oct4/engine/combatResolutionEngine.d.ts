export type ClashTactic = 'PRESS' | 'FEINT' | 'DISENGAGE' | 'HOLD';
interface AttackRollParams {
    attackerStat: number;
    weaponOrArmorStat: number;
    weaponOrArmorMod: number;
    hasAdvantage?: boolean;
    hasDisadvantage?: boolean;
}
/**
 * Resolves a contested attack roll and determines success severity.
 */
export declare function resolveContestedAttack(attacker: AttackRollParams, defender: AttackRollParams): {
    outcome: string;
    diff: number;
    severity?: never;
} | {
    outcome: string;
    severity: string;
    diff: number;
};
/**
 * Resolves a locked-in Clash when an attack roll results in a tie.
 */
export declare function resolveClashTie(attackerTactic: ClashTactic, defenderTactic: ClashTactic): {
    result: string;
    attackerRoll: number;
    defenderRoll: number;
};
export {};
//# sourceMappingURL=combatResolutionEngine.d.ts.map