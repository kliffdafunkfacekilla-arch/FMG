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
export function resolveTagInteraction(sourceAction: UniversalTag, targetEntity: TaggedEntity): InteractionResult {
  const targetTags = targetEntity.tags;

  // 1. Flammable + Fire/Aether
  if (sourceAction === 'FLAMMABLE' || sourceAction === 'AETHER_CHARGED') {
    if (targetTags.has('FLAMMABLE') && targetTags.has('LIQUID')) {
      return { triggered: true, effectDescription: 'The liquid ignites into a raging fire zone!', spawnTerrain: 'FIRE_HAZARD' };
    }
    if (targetTags.has('FLAMMABLE') && targetTags.has('WOOD')) {
      return { triggered: true, effectDescription: 'The wooden structure catches fire, creating smoke cover.', statusEffect: 'BURNING' };
    }
  }

  // 2. Null Field Interaction against Aether-Charged objects
  if (sourceAction === 'NULL_FIELD' && targetTags.has('AETHER_CHARGED')) {
    return { triggered: true, effectDescription: 'The Null field short-circuits the aetheric charge, neutralizing the object.', statusEffect: 'DISRUPTED' };
  }

  // 3. Heavy impact against Fragile objects
  if (sourceAction === 'HEAVY' && targetTags.has('FRAGILE')) {
    return { triggered: true, effectDescription: 'The target shatters completely under heavy force.', statusEffect: 'DESTROYED' };
  }

  return { triggered: false, effectDescription: 'Standard physical resistance applies.' };
}

