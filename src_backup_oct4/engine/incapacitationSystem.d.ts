export interface IncapacitatedState {
    characterName: string;
    poolType: 'HEALTH' | 'COMPOSURE';
    turnsRemaining: number;
    isConscious: boolean;
    isHelpless: boolean;
    stabilized: boolean;
}
export declare function handleZeroPoolTrigger(characterName: string, poolType: 'HEALTH' | 'COMPOSURE'): IncapacitatedState;
export declare function processTurnIncapacitation(state: IncapacitatedState, allyHelpCheckSuccess: boolean, currentPool: number, maxPool: number): {
    message: string;
    updatedState: IncapacitatedState;
};
//# sourceMappingURL=incapacitationSystem.d.ts.map