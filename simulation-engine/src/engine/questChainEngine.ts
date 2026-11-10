import { Pool, PoolClient } from 'pg';
import pool from '../db/pool.js';
import {
  SimThread,
  ThreadWorldDelta,
  applyThreadWorldDelta,
  evaluateThreadState,
  resolveThreadNaturally,
  createThread,
  ThreadStateEvaluation
} from './threads/threadEngine.js';
import {
  generateThreadResolutionAftermath,
  ThreadAftermathSynthesis
} from './rpg/directorBridge.js';

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
  aftermath?: ThreadAftermathSynthesis | undefined;
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

  // 5. AI Story Director aftermath reasoning: forensic tags, scene loot, burg shifts, and follow-up threads
  let aftermath: ThreadAftermathSynthesis | undefined;
  try {
    const eligibleNpcs = npcs.map((n: any) => ({
      id: String(n.id),
      name: String(n.name),
      role: n.role,
      profession: n.profession,
      tags: Array.isArray(n.tags) ? n.tags : []
    }));
    const eligibleProps = props.map((p: any) => ({
      id: String(p.id),
      type: p.name || 'Prop',
      lx: p.pos ? p.pos[0] : 128,
      ly: p.pos ? p.pos[1] : 128,
      tags: Array.isArray(p.tags) ? p.tags : []
    }));

    aftermath = await generateThreadResolutionAftermath(
      thread,
      evaluation,
      eligibleNpcs,
      eligibleProps,
      `Cell #${thread.cell_id}`,
      input.resolutionNarrative
    );

    // Apply forensic tags to sector props
    const currentLayerRes = await client.query(
      `SELECT props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 LIMIT 1`,
      [thread.cell_id, thread.rx, thread.ry]
    );
    const currentProps = Array.isArray(currentLayerRes.rows[0]?.props) ? currentLayerRes.rows[0].props : [];

    if (aftermath?.forensicTags && aftermath.forensicTags.length > 0 && currentProps.length > 0) {
      const primaryProp = currentProps.find((p: any) => String(p.id) === String(thread.actor_ids[0])) || currentProps[0];
      if (primaryProp) {
        primaryProp.tags = Array.from(new Set([...(primaryProp.tags || []), ...aftermath.forensicTags]));
        await client.query(
          `UPDATE sim_sector_layers SET props = $1 WHERE cell_id = $2 AND rx = $3 AND ry = $4`,
          [JSON.stringify(currentProps), thread.cell_id, thread.rx, thread.ry]
        );
      }
    }

    // If an emergent follow-up thread was proposed, validate and create it in sim_threads
    if (aftermath?.followUpThread) {
      const followUp = aftermath.followUpThread;
      await createThread(client, {
        question: followUp.question,
        stakes: followUp.stakes,
        actor_ids: [followUp.actor_id],
        cell_id: thread.cell_id,
        rx: thread.rx,
        ry: thread.ry,
        clock: 0,
        clock_max: followUp.clock_max,
        created_tick: currentTick,
        origin: 'reaction',
        rule_id: followUp.rule_id || 'RULE_EMERGENT_AFTERMATH'
      });
    }
  } catch (err: any) {
    console.warn(`[QuestChainEngine] Aftermath synthesis skipped: ${err.message}`);
  }

  return {
    threadId: thread.id,
    state: 'resolved',
    resolvedTick: currentTick,
    outcomeType: evaluation.outcomeType,
    burgId: deltaResult.burgId,
    unrestDelta: deltaResult.unrestDelta,
    wealthDelta: deltaResult.wealthDelta,
    resolution: deltaResult.resolution,
    deltaApplied: appliedDelta,
    aftermath
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
