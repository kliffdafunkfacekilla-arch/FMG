/**
 * Thin compatibility re-export; storyline resolution logic lives in `engine/story/resolve.ts`.
 */
export {
  resolveThreadByParty,
  resolveQuestAndMutateWorld,
  type ResolveThreadByPartyInput,
  type ResolveThreadByPartyResult,
} from './story/resolve.js';
