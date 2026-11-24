import { Pool, PoolClient } from 'pg';
import pool from '../../db/pool.js';
import type { Db, Delta } from '../deltas/types.js';
import { flushStepDeltas } from '../deltas/index.js';
import type { ActionRecord } from './actions.js';
import type { StoryProposalSpec } from './sources/types.js';
import {
  SimThread,
  ThreadWorldDelta,
  evaluateThreadState,
  resolveThreadNaturally,
  createThread,
  npcIsActor
} from '../threads/threadEngine.js';
import {
  generateThreadResolutionAftermath,
  ThreadAftermathSynthesis
} from '../rpg/directorBridge.js';
import { advanceArcForThread } from '../threads/storyArcs.js';

export interface ResolveThreadByPartyInput {
  threadId: number;
  playerOutcome?: 'SUCCESS' | 'FAILURE' | 'SABOTAGE';
  resolutionNarrative?: string;
  currentTick?: number;
  loreDate?: string;
}

export interface ResolveThreadByPartyResult {
  /** Set when the thread was a beat of a managed story arc. */
  arcProgress?: { arcId: number; state: string; phase: number; nextThreadId: number | null } | null;
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
 * Systemically resolves an active storyline/thread via player action.
 * Evaluates the real physical state of sector entities (dead, free, fugitive, working)
 * and ripples consequences into sector layers, burg economy, and historical events,
 * updating the unified storylines table (exposed through the sim_threads view).
 */
export async function resolveThreadByParty(
  client: Pool | PoolClient,
  input: ResolveThreadByPartyInput
): Promise<ResolveThreadByPartyResult> {
  const currentTick = input.currentTick ?? 1;

  // 1. Fetch active storyline (or legacy sim_threads row via view)
  const threadRes = await client.query(
    `SELECT * FROM sim_threads WHERE id = $1 LIMIT 1`,
    [input.threadId]
  );
  if (threadRes.rows.length === 0) {
    throw new Error(`[StoryResolve] Thread #${input.threadId} not found in storylines.`);
  }

  const thread: SimThread = threadRes.rows[0];
  if (thread.state === 'resolved') {
    throw new Error(`[StoryResolve] Thread #${input.threadId} is already resolved at tick ${thread.resolved_tick}.`);
  }

  // 2. Fetch current physical sector layer state
  const layerRes = await client.query(
    `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`,
    [thread.cell_id, thread.rx, thread.ry]
  );
  const npcs = Array.isArray(layerRes.rows[0]?.npcs) ? layerRes.rows[0].npcs : [];
  const props = Array.isArray(layerRes.rows[0]?.props) ? layerRes.rows[0].props : [];

  // 3. Systemically evaluate real entity states
  let evaluation = evaluateThreadState(thread, npcs, props);

  const isWorldThread = thread.origin === 'world' || String(thread.rule_id || '').startsWith('WORLD_');
  if (!evaluation.isResolved && input.playerOutcome) {
    if (input.playerOutcome === 'SUCCESS' && !isWorldThread) {
      const targetNpc = npcs.find((n: any) => npcIsActor(n, [String(thread.actor_ids[0])]));
      if (targetNpc) {
        targetNpc.tags = (targetNpc.tags || []).filter((t: string) => !['#InCustody', '#Imprisoned'].includes(t));
        targetNpc.tags.push('#RebelAlly', '#VindicatedArtisan');
        targetNpc.disposition = (targetNpc.disposition || 0) + 3;
      }
      evaluation = evaluateThreadState(thread, npcs, props);
    } else if (input.playerOutcome === 'FAILURE' || input.playerOutcome === 'SABOTAGE') {
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

  const declared = typeof thread.on_resolved_by_party === 'string' ? JSON.parse(thread.on_resolved_by_party) : thread.on_resolved_by_party;
  if (!evaluation.isResolved && input.playerOutcome === 'SUCCESS' && declared && Object.keys(declared).length > 0) {
    evaluation = {
      isResolved: true,
      outcomeType: 'COMPROMISE',
      resolutionNarrative: declared.narrativeSummary || `The party resolved it: ${thread.question}`,
      actorTagsToAdd: declared.actorTagsAdd,
      actorTagsToRemove: declared.actorTagsRemove,
      actorDispositionDelta: declared.actorDispositionDelta,
      sectorTagsToAdd: declared.sectorTagsAdd,
      sectorTagsToRemove: declared.sectorTagsRemove,
      propTagsToAdd: declared.propTagsAdd,
      propTagsToRemove: declared.propTagsRemove,
      propNameMatch: declared.propNameMatch,
      unrestDelta: declared.unrestDelta ?? 0,
      wealthDelta: declared.wealthDelta ?? 0,
      foodDelta: declared.foodDelta ?? 0,
      rawMaterialsDelta: declared.rawMaterialsDelta ?? 0,
      crimeRateDelta: declared.crimeRateDelta ?? 0
    };
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

  // 5. AI Story Director aftermath reasoning
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

    const currentLayerRes = await client.query(
      `SELECT props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`,
      [thread.cell_id, thread.rx, thread.ry]
    );
    const currentProps = Array.isArray(currentLayerRes.rows[0]?.props) ? currentLayerRes.rows[0].props : [];

    if (aftermath?.forensicTags && aftermath.forensicTags.length > 0 && currentProps.length > 0) {
      const primaryProp = currentProps.find((p: any) => String(p.id) === String(thread.actor_ids[0])) || currentProps[0];
      if (primaryProp) {
        primaryProp.tags = Array.from(new Set([...(primaryProp.tags || []), ...aftermath.forensicTags]));
        await client.query(
          `UPDATE sim_sector_layers SET props = $1 WHERE cell_id = $2 AND rx = $3 AND ry = $4 AND z_layer = 0`,
          [JSON.stringify(currentProps), thread.cell_id, thread.rx, thread.ry]
        );
      }
    }

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
        source: 'reaction',
        rule_id: followUp.rule_id || 'RULE_EMERGENT_AFTERMATH'
      });
    }
  } catch (err: any) {
    console.warn(`[StoryResolve] Aftermath synthesis skipped: ${err.message}`);
  }

  // If this thread was a beat of a managed story arc, move the arc on (or fail it if expired)
  const arcProgress = await advanceArcForThread(client, thread.id, evaluation.outcomeType === 'EXPIRED' ? 'expired' : 'party');

  return {
    arcProgress,
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

// =========================================================================
// Phase 11.2: Action-Driven Storyline Answer Conditions & Computed Consequences
// =========================================================================

export type ComputedResolutionMode = 'diplomatic' | 'violent' | 'covert';

export interface StorylineAnswerEvaluation {
  satisfied: boolean;
  mode: ComputedResolutionMode | null;
  triggerAction?: ActionRecord | undefined;
  reason: string;
}

const DIPLOMATIC_VERBS = new Set(['persuade', 'bribe', 'free', 'deliver', 'aid']);
const VIOLENT_VERBS = new Set(['attack', 'kill', 'burn', 'sabotage']);
const COVERT_VERBS = new Set(['steal', 'intimidate']);

function isActionSuccess(result: string): boolean {
  return !String(result || '').toLowerCase().startsWith('fail');
}

function sanitizeGrudgeActorRef(actorRef: string): string {
  const clean = String(actorRef || 'party').replace(/[^A-Za-z0-9_-]/g, '_');
  return clean || 'party';
}

/**
 * Evaluates answer conditions over recorded actions and living actor state without hardcoded payloads.
 */
export function evaluateStorylineAnswerConditions(
  storyline: { id: number; actor_ids: string[] },
  actions: ActionRecord[],
  entityAliveMap: Map<string, boolean>
): StorylineAnswerEvaluation {
  const actorSet = new Set((storyline.actor_ids || []).map(String));

  for (const act of actions) {
    if (!isActionSuccess(act.result)) continue;
    const matchesTarget = !act.target_ref || actorSet.size === 0 || actorSet.has(act.target_ref);
    if (!matchesTarget) continue;

    if (VIOLENT_VERBS.has(act.verb)) {
      return {
        satisfied: true,
        mode: 'violent',
        triggerAction: act,
        reason: `${act.actor_ref} forced a violent resolution via ${act.verb}${act.target_ref ? ` on ${act.target_ref}` : ''}.`,
      };
    }
    if (DIPLOMATIC_VERBS.has(act.verb)) {
      return {
        satisfied: true,
        mode: 'diplomatic',
        triggerAction: act,
        reason: `${act.actor_ref} settled the crisis peacefully via ${act.verb}${act.target_ref ? ` with ${act.target_ref}` : ''}.`,
      };
    }
    if (COVERT_VERBS.has(act.verb)) {
      return {
        satisfied: true,
        mode: 'covert',
        triggerAction: act,
        reason: `${act.actor_ref} resolved the crisis through ${act.verb}.`,
      };
    }
  }

  for (const ref of actorSet) {
    if (entityAliveMap.get(ref) === false) {
      return {
        satisfied: true,
        mode: 'violent',
        reason: `Primary actor ${ref} perished, forcing the crisis to conclude violently.`,
      };
    }
  }

  return { satisfied: false, mode: null, reason: 'No qualifying party action or state transition recorded yet.' };
}

export interface ComputeConsequencesInput {
  storylineId: number;
  question: string;
  cellId: number;
  rx: number;
  ry: number;
  burgId: number | null;
  burgName: string;
  targetRef: string | null;
  targetFactionId: number | null;
  partyRef: string;
  tick: number;
  mode: ComputedResolutionMode;
  witnessRefs: string[];
  citizenWitnessIds?: number[] | undefined;
}

export interface ComputedConsequencesResult {
  mode: ComputedResolutionMode;
  summary: string;
  unrestDelta: number;
  wealthDelta: number;
  crimeDelta: number;
  factionStandingDelta: number;
  deltas: Delta[];
  witnessGrudges: Array<{ ref: string; tag: string }>;
  followUpProposal: StoryProposalSpec | null;
}

/**
 * Pure computation of economic, standing, witness grudge, and delayed rumour consequences
 * from who acted, how they acted (diplomatic vs violent vs covert), and who witnessed it.
 */
export function computeStorylineConsequences(input: ComputeConsequencesInput): ComputedConsequencesResult {
  const deltas: Delta[] = [];
  const witnessRefs = Array.from(new Set(input.witnessRefs.filter(Boolean))).sort();
  const citizenIds = Array.from(new Set((input.citizenWitnessIds || []).filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  const witnessGrudges: Array<{ ref: string; tag: string }> = [];

  let unrestDelta = 0;
  let wealthDelta = 0;
  let crimeDelta = 0;
  let factionStandingDelta = 0;
  let summary = '';
  let followUpProposal: StoryProposalSpec | null = null;

  if (input.mode === 'diplomatic') {
    unrestDelta = -12;
    wealthDelta = 120;
    crimeDelta = -4;
    factionStandingDelta = 12;
    summary = `${input.partyRef} resolved "${input.question}" in ${input.burgName} diplomatically before bloodshed (${witnessRefs.length} witnesses).`;

    if (input.burgId) {
      deltas.push({
        kind: 'burg.adjust',
        burgId: input.burgId,
        unrest: unrestDelta,
        wealth: wealthDelta,
        crime: crimeDelta,
      });
    }
    if (input.targetFactionId && input.targetFactionId > 0) {
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: `faction:${input.targetFactionId}`,
        partyRef: input.partyRef,
        delta: factionStandingDelta,
        reason: `Diplomatic settlement in ${input.burgName}`,
        tick: input.tick,
      });
    }
    if (input.targetRef) {
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: input.targetRef,
        partyRef: input.partyRef,
        delta: 15,
        reason: `Fair negotiation in ${input.burgName}`,
        tick: input.tick,
      });
    }
    for (const wRef of witnessRefs) {
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: wRef,
        partyRef: input.partyRef,
        delta: 4,
        reason: `Witnessed peaceful resolution in ${input.burgName}`,
        tick: input.tick,
      });
    }
    deltas.push({
      kind: 'event.log',
      tick: input.tick,
      type: 'STORYLINE_RESOLVED_DIPLOMATIC',
      message: summary,
      tier: 'MAJOR',
      burgId: input.burgId ?? undefined,
      cellId: input.cellId,
      factionId: input.targetFactionId ?? undefined,
    });
    deltas.push({
      kind: 'scheduled.add',
      at: { tick: input.tick + 2, minute: 540 },
      event: {
        kind: 'WORLD_EVENT',
        payload: {
          burgId: input.burgId,
          cellId: input.cellId,
          message: `Merchants along the road speak warmly of ${input.partyRef}'s mediation in ${input.burgName}.`,
        },
      },
    });
  } else if (input.mode === 'violent') {
    unrestDelta = 18 + witnessRefs.length * 3;
    wealthDelta = -180;
    crimeDelta = 8;
    factionStandingDelta = -20;
    summary = `${input.partyRef} forced a violent end to "${input.question}" in ${input.burgName} (${witnessRefs.length} shocked witnesses).`;

    if (input.burgId) {
      deltas.push({
        kind: 'burg.adjust',
        burgId: input.burgId,
        unrest: unrestDelta,
        wealth: wealthDelta,
        crime: crimeDelta,
      });
    }
    if (input.targetFactionId && input.targetFactionId > 0) {
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: `faction:${input.targetFactionId}`,
        partyRef: input.partyRef,
        delta: factionStandingDelta,
        reason: `Violent intervention in ${input.burgName}`,
        tick: input.tick,
      });
    }
    if (input.targetRef) {
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: input.targetRef,
        partyRef: input.partyRef,
        delta: -35,
        reason: `Attacked during ${input.burgName} dispute`,
        tick: input.tick,
      });
    }

    const grudgeTag = `#Grudge:${sanitizeGrudgeActorRef(input.partyRef)}`;
    for (const wRef of witnessRefs) {
      witnessGrudges.push({ ref: wRef, tag: grudgeTag });
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: wRef,
        partyRef: input.partyRef,
        delta: -15,
        reason: `Witnessed violence by ${input.partyRef} in ${input.burgName}`,
        tick: input.tick,
      });
    }
    for (const cid of citizenIds) {
      deltas.push({
        kind: 'tags.add',
        target: { kind: 'citizen', citizenId: cid },
        tags: [grudgeTag],
      });
    }
    deltas.push({
      kind: 'event.log',
      tick: input.tick,
      type: 'STORYLINE_RESOLVED_VIOLENT',
      message: summary,
      tier: 'MAJOR',
      burgId: input.burgId ?? undefined,
      cellId: input.cellId,
      factionId: input.targetFactionId ?? undefined,
    });
    deltas.push({
      kind: 'scheduled.add',
      at: { tick: input.tick + 3, minute: 720 },
      event: {
        kind: 'WORLD_EVENT',
        payload: {
          burgId: input.burgId,
          cellId: input.cellId,
          message: `Word of ${input.partyRef}'s bloodshed in ${input.burgName} hardens local militias.`,
        },
      },
    });
    if (witnessRefs.length > 0) {
      followUpProposal = {
        scale: 'thread',
        parent_id: input.storylineId,
        scope_cells: [input.cellId],
        cell_id: input.cellId,
        rx: input.rx,
        ry: input.ry,
        question: `Will witness ${witnessRefs[0]} rally reprisals against ${input.partyRef} in ${input.burgName}?`,
        stakes: `Shaken by the bloodshed around "${input.question}", ${witnessRefs[0]} seeks allies for retaliation.`,
        actor_ids: [witnessRefs[0]!],
        clock_max: 6,
        source: 'reaction',
        origin: 'reaction',
        rule_id: `REPRISAL_${input.storylineId}`,
        why: `Witness ${witnessRefs[0]} saw violent resolution in ${input.burgName}.`,
        facts: [{ kind: 'storyline', id: `storyline:${input.storylineId}`, summary }],
        rank_score: 85,
      };
    }
  } else {
    unrestDelta = 6;
    wealthDelta = -60;
    crimeDelta = 5;
    factionStandingDelta = witnessRefs.length > 0 ? -8 : 0;
    summary = `${input.partyRef} resolved "${input.question}" in ${input.burgName} by covert means.`;

    if (input.burgId) {
      deltas.push({
        kind: 'burg.adjust',
        burgId: input.burgId,
        unrest: unrestDelta,
        wealth: wealthDelta,
        crime: crimeDelta,
      });
    }
    if (input.targetFactionId && input.targetFactionId > 0 && factionStandingDelta !== 0) {
      deltas.push({
        kind: 'standing.adjust',
        subjectRef: `faction:${input.targetFactionId}`,
        partyRef: input.partyRef,
        delta: factionStandingDelta,
        reason: `Witnessed covert interference in ${input.burgName}`,
        tick: input.tick,
      });
    }
    deltas.push({
      kind: 'event.log',
      tick: input.tick,
      type: 'STORYLINE_RESOLVED_COVERT',
      message: summary,
      tier: 'MINOR',
      burgId: input.burgId ?? undefined,
      cellId: input.cellId,
      factionId: input.targetFactionId ?? undefined,
    });
  }

  return {
    mode: input.mode,
    summary,
    unrestDelta,
    wealthDelta,
    crimeDelta,
    factionStandingDelta,
    deltas,
    witnessGrudges,
    followUpProposal,
  };
}

export async function resolveStorylineFromActions(
  db: Db,
  opts: {
    storylineId: number;
    partyRef?: string | undefined;
    tick?: number | undefined;
    minute?: number | undefined;
  }
): Promise<{
  resolved: boolean;
  storylineId: number;
  mode: ComputedResolutionMode | null;
  consequences?: ComputedConsequencesResult | undefined;
  followUpId?: number | null | undefined;
}> {
  const stRes = await db.query(`SELECT * FROM storylines WHERE id = $1 LIMIT 1`, [opts.storylineId]);
  const st = stRes.rows[0];
  if (!st) throw new Error(`[StoryResolve] Storyline #${opts.storylineId} not found.`);
  if (st.state === 'resolved') {
    return { resolved: false, storylineId: opts.storylineId, mode: null };
  }

  let tick = opts.tick;
  if (!tick) {
    const calRes = await db.query(`SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1`);
    tick = Number(calRes.rows[0]?.tick || 1);
  }
  const minute = opts.minute ?? 0;

  const actRes = await db.query(
    `SELECT * FROM actions WHERE storyline_id = $1 ORDER BY tick ASC, id ASC`,
    [opts.storylineId]
  );
  const actions: ActionRecord[] = actRes.rows.map((r: any) => ({
    id: Number(r.id),
    tick: Number(r.tick || 0),
    minute: Number(r.minute || 0),
    actor_ref: String(r.actor_ref),
    verb: String(r.verb),
    target_ref: r.target_ref ? String(r.target_ref) : null,
    location: r.location && typeof r.location === 'object' ? r.location : { cellId: Number(st.cell_id || 0) },
    method: r.method ? String(r.method) : null,
    result: String(r.result),
    storyline_id: Number(r.storyline_id),
    witnesses: Array.isArray(r.witnesses) ? r.witnesses.map(String) : [],
  }));

  const actorIds: string[] = Array.isArray(st.actor_ids) ? st.actor_ids.map(String) : [];
  const entityAliveMap = new Map<string, boolean>();
  if (actorIds.length > 0) {
    const entRes = await db.query(`SELECT ref, alive FROM entities WHERE ref = ANY($1::text[])`, [actorIds]);
    for (const r of entRes.rows) entityAliveMap.set(String(r.ref), Boolean(r.alive));
  }

  const evalRes = evaluateStorylineAnswerConditions({ id: Number(st.id), actor_ids: actorIds }, actions, entityAliveMap);
  if (!evalRes.satisfied || !evalRes.mode) {
    return { resolved: false, storylineId: opts.storylineId, mode: null };
  }

  const cellId = Number(st.cell_id ?? st.scope_cells?.[0] ?? 0);
  const metaRes = await db.query(
    `SELECT b.burg_id, b.name AS burg_name, c.faction_id
     FROM sim_cells c
     LEFT JOIN sim_burg_economy b ON b.cell_id = c.id
     WHERE c.id = $1
     ORDER BY b.burg_id ASC NULLS LAST
     LIMIT 1`,
    [cellId]
  );
  const meta = metaRes.rows[0] || {};
  const trigger = evalRes.triggerAction;
  const partyRef = opts.partyRef || trigger?.actor_ref || 'player:1';
  const targetRef = trigger?.target_ref || actorIds[0] || null;
  const rawWitnesses = trigger?.witnesses && trigger.witnesses.length > 0
    ? trigger.witnesses
    : actorIds.filter((a) => a !== targetRef);

  const validWitnesses: string[] = [];
  const citizenWitnessIds: number[] = [];
  if (rawWitnesses.length > 0) {
    const wEnt = await db.query(`SELECT ref FROM entities WHERE ref = ANY($1::text[])`, [rawWitnesses]);
    for (const r of wEnt.rows) {
      const ref = String(r.ref);
      validWitnesses.push(ref);
      const m = /^citizen:(\d+)$/.exec(ref);
      if (m) citizenWitnessIds.push(Number(m[1]));
    }
  }

  const validTargetRef = targetRef && (await db.query(`SELECT 1 FROM entities WHERE ref = $1 LIMIT 1`, [targetRef])).rows.length > 0
    ? targetRef
    : null;

  const computed = computeStorylineConsequences({
    storylineId: opts.storylineId,
    question: String(st.question),
    cellId,
    rx: Number(st.rx ?? 50),
    ry: Number(st.ry ?? 50),
    burgId: meta.burg_id !== null && meta.burg_id !== undefined ? Number(meta.burg_id) : null,
    burgName: String(meta.burg_name || `Cell #${cellId}`),
    targetRef: validTargetRef,
    targetFactionId: meta.faction_id !== null && meta.faction_id !== undefined ? Number(meta.faction_id) : null,
    partyRef,
    tick,
    mode: evalRes.mode,
    witnessRefs: validWitnesses,
    citizenWitnessIds,
  });

  await flushStepDeltas(db, 'storyline_resolve', tick, computed.deltas, minute);

  await db.query(
    `UPDATE storylines
     SET state = 'resolved',
         resolved_tick = $1,
         resolution_text = $2,
         resolution = $3::jsonb
     WHERE id = $4`,
    [
      tick,
      computed.summary,
      JSON.stringify({
        mode: computed.mode,
        unrestDelta: computed.unrestDelta,
        wealthDelta: computed.wealthDelta,
        crimeDelta: computed.crimeDelta,
        factionStandingDelta: computed.factionStandingDelta,
        witnessGrudges: computed.witnessGrudges,
        triggerActionId: trigger?.id ?? null,
      }),
      opts.storylineId,
    ]
  );

  // Stamp non-citizen paragon witness grudges directly into sim_paragons.traits
  for (const wg of computed.witnessGrudges) {
    const pm = /^paragon:(\d+)$/.exec(wg.ref);
    if (pm) {
      const pid = Number(pm[1]);
      await db.query(
        `UPDATE sim_paragons
         SET traits = (
           SELECT jsonb_agg(DISTINCT elem)
           FROM jsonb_array_elements_text(COALESCE(traits::jsonb, '[]'::jsonb) || to_jsonb(ARRAY[$1::text])) AS elem
         )::text
         WHERE id = $2`,
        [wg.tag, pid]
      ).catch(() => {});
    }
  }

  let followUpId: number | null = null;
  if (computed.followUpProposal) {
    const fp = computed.followUpProposal;
    const fIns = await db.query(
      `INSERT INTO storylines (
         parent_id, scale, scope_cells, cell_id, rx, ry, z,
         question, stakes, actor_ids, clock, clock_max, state,
         origin, source, rule_id, why, facts, rank_score, created_tick
       )
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, 0, $10, 'proposed', $11, $12, $13, $14, $15::jsonb, $16, $17)
       RETURNING id`,
      [
        fp.parent_id ?? null,
        fp.scale,
        fp.scope_cells,
        fp.cell_id,
        fp.rx,
        fp.ry,
        fp.question,
        fp.stakes,
        fp.actor_ids,
        fp.clock_max ?? 6,
        fp.origin ?? 'reaction',
        fp.source,
        fp.rule_id ?? null,
        fp.why,
        JSON.stringify(fp.facts || []),
        fp.rank_score ?? 80,
        tick,
      ]
    );
    followUpId = Number(fIns.rows[0].id);
    for (const ref of fp.actor_ids) {
      await db.query(
        `INSERT INTO storyline_actors (storyline_id, entity_ref, role) VALUES ($1, $2, 'actor') ON CONFLICT DO NOTHING`,
        [followUpId, ref]
      );
    }
  }

  await advanceArcForThread(db as Pool | PoolClient, opts.storylineId, 'party').catch(() => null);

  return {
    resolved: true,
    storylineId: opts.storylineId,
    mode: computed.mode,
    consequences: computed,
    followUpId,
  };
}
