import { Pool, PoolClient } from 'pg';
import pool from '../db/pool.js';
import {
  SimThread,
  ThreadWorldDelta,
  applyThreadWorldDelta,
  evaluateThreadState,
  resolveThreadNaturally,
  ThreadStateEvaluation
} from './threads/threadEngine.js';

export interface ResolveThreadByPartyInput {
  threadId: number;
  playerOutcome?: 'SUCCESS' | 'FAILURE' | 'SABOTAGE';
  resolutionNarrative?: string;
  currentTick?: number;
  loreDate?: string;
}

export interface ResolveThreadByPartyResult {
  threadId: number;
  state: 'resolved';
  resolvedTick: number;
  outcomeType: string;
  burgId?: number | undefined;
  unrestDelta: number;
  wealthDelta: number;
  resolution: string;
  deltaApplied: ThreadWorldDelta;
}

/**
 * Systemically resolves an active narrative thread via player action.
 * Evaluates the real physical state of sector entities (dead, free, fugitive, working)
 * and naturally ripples consequences into:
 * - sim_sector_layers (consequence & ripple tags like #BrokenTools, #SmithyOperational, #MartialTerror)
 * - sim_burg_economy (unrest, wealth, food, raw_materials)
 * - sim_events (historical chronicle log)
 * and marks the thread as 'resolved' in sim_threads.
 */
export async function resolveThreadByParty(
  client: Pool | PoolClient,
  input: ResolveThreadByPartyInput
): Promise<ResolveThreadByPartyResult> {
  const currentTick = input.currentTick ?? 1;

  // 1. Fetch active thread
  const threadRes = await client.query(
    `SELECT * FROM sim_threads WHERE id = $1 LIMIT 1`,
    [input.threadId]
  );
  if (threadRes.rows.length === 0) {
    throw new Error(`[QuestChainEngine] Thread #${input.threadId} not found in sim_threads.`);
  }

  const thread: SimThread = threadRes.rows[0];
  if (thread.state === 'resolved') {
    throw new Error(`[QuestChainEngine] Thread #${input.threadId} is already resolved at tick ${thread.resolved_tick}.`);
  }

  // 2. Fetch current physical sector layer state
  const layerRes = await client.query(
    `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 LIMIT 1`,
    [thread.cell_id, thread.rx, thread.ry]
  );
  const npcs = Array.isArray(layerRes.rows[0]?.npcs) ? layerRes.rows[0].npcs : [];
  const props = Array.isArray(layerRes.rows[0]?.props) ? layerRes.rows[0].props : [];

  // 3. Systemically evaluate real entity states
  let evaluation = evaluateThreadState(thread, npcs, props);

  // If entities haven't been mutated yet but a clear outcome was declared, synthesize the physical state change
  if (!evaluation.isResolved && input.playerOutcome) {
    if (input.playerOutcome === 'SUCCESS') {
      // Free the captive
      const targetId = thread.actor_ids[0];
      const targetNpc = npcs.find((n: any) => String(n.id) === String(targetId));
      if (targetNpc) {
        targetNpc.tags = (targetNpc.tags || []).filter((t: string) => !['#InCustody', '#Imprisoned'].includes(t));
        targetNpc.tags.push('#RebelAlly', '#VindicatedArtisan');
        targetNpc.disposition = (targetNpc.disposition || 0) + 3;
      }
      evaluation = evaluateThreadState(thread, npcs, props);
    } else if (input.playerOutcome === 'FAILURE' || input.playerOutcome === 'SABOTAGE') {
      // Target remains in custody or executed
      evaluation = {
        isResolved: true,
        outcomeType: 'EXPIRED',
        resolutionNarrative: input.resolutionNarrative || `Intervention failed: ${thread.stakes}`,
        sectorTagsToAdd: ['#BrokenTools', '#SupplyDrought', '#MartialTerror'],
        actorTagsToAdd: ['#Executed', '#MartyrOfRebellion'],
        actorTagsToRemove: ['#InCustody', '#Imprisoned'],
        unrestDelta: 25,
        wealthDelta: -250,
        foodDelta: -100,
        rawMaterialsDelta: -150,
        crimeRateDelta: 10
      };
    }
  }

  if (input.resolutionNarrative) {
    evaluation.resolutionNarrative = input.resolutionNarrative;
  }

  // 4. Resolve naturally with true physical ripple effects
  const deltaResult = await resolveThreadNaturally(
    client,
    thread,
    evaluation,
    currentTick,
    input.loreDate
  );

  const appliedDelta: ThreadWorldDelta = {
    unrestDelta: evaluation.unrestDelta,
    wealthDelta: evaluation.wealthDelta,
    foodDelta: evaluation.foodDelta,
    rawMaterialsDelta: evaluation.rawMaterialsDelta,
    crimeRateDelta: evaluation.crimeRateDelta,
    actorTagsAdd: evaluation.actorTagsToAdd,
    actorTagsRemove: evaluation.actorTagsToRemove,
    propTagsAdd: evaluation.propTagsToAdd,
    propTagsRemove: evaluation.propTagsToRemove,
    sectorTagsAdd: evaluation.sectorTagsToAdd,
    sectorTagsRemove: evaluation.sectorTagsToRemove,
    narrativeSummary: evaluation.resolutionNarrative
  };

  return {
    threadId: thread.id,
    state: 'resolved',
    resolvedTick: currentTick,
    outcomeType: evaluation.outcomeType,
    burgId: deltaResult.burgId,
    unrestDelta: deltaResult.unrestDelta,
    wealthDelta: deltaResult.wealthDelta,
    resolution: deltaResult.resolution,
    deltaApplied: appliedDelta
  };
}

interface LegacyQuestResolutionParams {
  seed: string;
  questId: number;
  playerOutcome: 'SUCCESS' | 'FAILURE' | 'SABOTAGE';
  targetCellId: number;
}

/**
 * Backward-compatible bridge for legacy callers.
 */
export async function resolveQuestAndMutateWorld(params: LegacyQuestResolutionParams) {
  return resolveThreadByParty(pool, {
    threadId: params.questId,
    playerOutcome: params.playerOutcome
  });
}
