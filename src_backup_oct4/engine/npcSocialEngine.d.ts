interface NPCCreationParams {
    settlementId: number;
    localId: number;
    name: string;
    birthplace: string;
}
/**
 * Spawns an NPC with minimal backstory data, traits, and weighted social ties to nearby entities.
 */
export declare function spawnNpcWithSocialMesh(params: NPCCreationParams): Promise<any>;
export {};
//# sourceMappingURL=npcSocialEngine.d.ts.map