export interface NPCState {
    npcId: string;
    name: string;
    role: string;
    settlementId: number;
    attunementLevel: number;
    currentMood: 'FRIENDLY' | 'SUSPICIOUS' | 'HOSTILE' | 'PANICKED';
    memoryBuffer: string[];
}
/**
 * Generates dynamic dialogue responses based on NPC state and active simulation conditions.
 */
export declare function generateNpcDialogue(npc: NPCState, playerQuery: string, isFamineActive: boolean): string;
//# sourceMappingURL=npcConversationEngine.d.ts.map