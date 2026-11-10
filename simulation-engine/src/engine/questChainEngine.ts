import { Pool, PoolClient } from 'pg';
import pool from '../db/pool.js';
import {
  SimThread,
  ThreadWorldDelta,
  applyThreadWorldDelta
} from './threads/threadEngine.js';

export interface ResolveThreadByPartyInput {
  threadId: number;
  playerOutcome: 'SUCCESS' | 'FAILURE' | 'SABOTAGE';
  resolutionNarrative?: string;
  currentTick?: number;
  loreDate?: string;
}

export interface ResolveThreadByPartyResult {
  threadId: number;
  state: 'resolved';
  resolvedTick: number;
  burgId?: number | undefined;
  unrestDelta: number;
  wealthDelta: number;
  resolution: string;
  deltaApplied: ThreadWorldDelta;
}

/**
 * Resolves an active narrative thread via player action (STORY_AUDIT Step 5).
 * Applies thread.on_resolved_by_party (or on_expire on failure/sabotage) directly to:
 * - sim_burg_economy (unrest, wealth, food, raw_materials)
 * - sim_sector_layers (actor tags, disposition, alive status, prop tags, sector features)
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

  // 2. Select appropriate outcome delta based on party outcome
  let chosenDelta: ThreadWorldDelta;
  if (input.playerOutcome === 'SUCCESS') {
    chosenDelta =
      thread.on_resolved_by_party && typeof thread.on_resolved_by_party === 'object' && Object.keys(thread.on_resolved_by_party).length > 0
        ? (typeof thread.on_resolved_by_party === 'string' ? JSON.parse(thread.on_resolved_by_party) : thread.on_resolved_by_party)
        : {
            unrestDelta: -10,
            wealthDelta: 100,
            narrativeSummary: `Party successfully intervened in thread #${thread.id}: ${thread.question}`
          };
  } else {
    // FAILURE or SABOTAGE: consequences realize as unaddressed or worse
    chosenDelta =
      thread.on_expire && typeof thread.on_expire === 'object' && Object.keys(thread.on_expire).length > 0
        ? (typeof thread.on_expire === 'string' ? JSON.parse(thread.on_expire) : thread.on_expire)
        : {
            unrestDelta: 15,
            wealthDelta: -150,
            narrativeSummary: `Party failed or sabotaged intervention in thread #${thread.id}: ${thread.stakes}`
          };
  }

  if (input.resolutionNarrative) {
    chosenDelta = {
      ...chosenDelta,
      narrativeSummary: input.resolutionNarrative
    };
  }

  // 3. Apply world delta to sim_burg_economy, sim_sector_layers, and sim_events
  const deltaResult = await applyThreadWorldDelta(
    client,
    thread,
    chosenDelta,
    currentTick,
    input.loreDate,
    'THREAD_RESOLVED_BY_PARTY'
  );

  // 4. Update sim_threads record
  await client.query(
    `UPDATE sim_threads 
     SET state = 'resolved', resolved_tick = $1, resolution = $2 
     WHERE id = $3`,
    [currentTick, deltaResult.resolution, thread.id]
  );

  return {
    threadId: thread.id,
    state: 'resolved',
    resolvedTick: currentTick,
    burgId: deltaResult.burgId,
    unrestDelta: deltaResult.unrestDelta,
    wealthDelta: deltaResult.wealthDelta,
    resolution: deltaResult.resolution,
    deltaApplied: chosenDelta
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
