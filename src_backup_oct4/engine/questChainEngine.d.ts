interface QuestResolutionParams {
    seed: string;
    questId: number;
    playerOutcome: 'SUCCESS' | 'FAILURE' | 'SABOTAGE';
    targetCellId: number;
}
/**
 * Evaluates quest completion, updates world state deltas, and branches the next story phase.
 */
export declare function resolveQuestAndMutateWorld(params: QuestResolutionParams): Promise<{
    status: string;
    nextQuestId: any;
    title: string;
    description: string;
    worldDeltaApplied: string;
}>;
export {};
//# sourceMappingURL=questChainEngine.d.ts.map