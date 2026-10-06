import { TaggedEntity, UniversalTag } from './tagRegistry';
export interface InteractionResult {
    triggered: boolean;
    effectDescription: string;
    spawnTerrain?: string;
    statusEffect?: string;
}
/**
 * Single-line evaluation function for any creative player action against a target or tile.
 */
export declare function resolveTagInteraction(sourceAction: UniversalTag, targetEntity: TaggedEntity): InteractionResult;
//# sourceMappingURL=universalInteraction.d.ts.map