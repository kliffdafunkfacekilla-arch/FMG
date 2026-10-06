export interface SocialCombatant {
    name: string;
    mentalStats: Record<string, number>;
    physicalStats: Record<string, number>;
    socialWeapon?: {
        name: string;
        baseBonus: number;
        compatibleBodyStat?: string;
    };
    socialArmor?: {
        name: string;
        defenseValue: number;
    };
    composurePool: number;
    maxComposure: number;
}
export declare function resolveSocialAttack(attacker: SocialCombatant, defender: SocialCombatant, primaryStat: string, // e.g., 'charm' or 'logic'
useBodyStatBonus?: boolean): {
    damageDealt: number;
    description: string;
};
//# sourceMappingURL=socialCombat.d.ts.map