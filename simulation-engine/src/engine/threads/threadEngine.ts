import { Pool, PoolClient } from "pg";
import type { Db } from "../deltas/types.js";
import { npcMatchesRef } from "../entities/refs.js";
import { resolveActorRef } from "../entities/resolve.js";

export type ThreadState = "proposed" | "open" | "escalated" | "resolved" | "expired" | "failed" | "rejected";
export type ThreadOrigin = "reaction" | "beat" | "arc" | "world" | "drama" | "director" | "gm" | "escalation";
export type StorylineScale = "scene" | "thread" | "arc" | "saga";

export interface ThreadWorldDelta {
  unrestDelta?: number | undefined;
  wealthDelta?: number | undefined;
  foodDelta?: number | undefined;
  rawMaterialsDelta?: number | undefined;
  crimeRateDelta?: number | undefined;
  actorTagsAdd?: string[] | undefined;
  actorTagsRemove?: string[] | undefined;
  actorDispositionDelta?: number | undefined;
  actorAlive?: boolean | undefined;
  propTagsAdd?: string[] | undefined;
  propTagsRemove?: string[] | undefined;
  propNameMatch?: string | undefined;
  sectorTagsAdd?: string[] | undefined;
  sectorTagsRemove?: string[] | undefined;
  narrativeSummary: string;
}

export interface SimThread {
  id: number;
  parent_id?: number | null | undefined;
  scale?: StorylineScale | undefined;
  scope_cells?: number[] | undefined;
  question: string;
  stakes: string;
  actor_ids: string[];
  cell_id: number;
  rx: number;
  ry: number;
  clock: number;
  clock_max: number;
  state: ThreadState;
  origin: ThreadOrigin;
  source?: string | undefined;
  created_tick: number;
  resolved_tick: number | null;
  resolution: string | null;
  rule_id?: string | null;
  why?: string | null | undefined;
  facts?: any[] | undefined;
  hook?: Record<string, any> | undefined;
  rank_score?: number | undefined;
  on_expire?: ThreadWorldDelta | null;
  on_resolved_by_party?: ThreadWorldDelta | null;
}

export interface CreateThreadInput {
  parent_id?: number | null | undefined;
  scale?: StorylineScale | undefined;
  scope_cells?: number[] | undefined;
  question: string;
  stakes: string;
  actor_ids: string[];
  cell_id: number;
  rx: number;
  ry: number;
  z?: number | undefined;
  clock?: number | undefined;
  clock_max?: number | undefined;
  state?: ThreadState | undefined;
  origin?: ThreadOrigin | undefined;
  source?: string | undefined;
  created_tick: number;
  rule_id?: string | null | undefined;
  why?: string | null | undefined;
  facts?: any[] | undefined;
  hook?: Record<string, any> | undefined;
  rank_score?: number | undefined;
  on_expire?: ThreadWorldDelta | undefined;
  on_resolved_by_party?: ThreadWorldDelta | undefined;
}

async function hasStorylinesTable(client: Pool | PoolClient): Promise<boolean> {
  const res = await client.query(`SELECT to_regclass('storylines') IS NOT NULL AS ready`);
  return Boolean(res.rows[0]?.ready);
}

/**
 * Ensures the storyline / legacy sim_threads storage exists in PostgreSQL.
 */
export async function ensureThreadTable(client: Pool | PoolClient): Promise<void> {
  if (await hasStorylinesTable(client)) {
    return;
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS sim_threads (
      id                   SERIAL PRIMARY KEY,
      question             TEXT NOT NULL,
      stakes               TEXT NOT NULL,
      actor_ids            TEXT[] NOT NULL DEFAULT '{}',
      cell_id              INT NOT NULL,
      rx                   INT NOT NULL,
      ry                   INT NOT NULL,
      clock                INT NOT NULL DEFAULT 0,
      clock_max            INT NOT NULL DEFAULT 6,
      state                VARCHAR(32) NOT NULL DEFAULT 'open',
      origin               VARCHAR(32) NOT NULL DEFAULT 'reaction',
      created_tick         INT NOT NULL DEFAULT 0,
      resolved_tick        INT DEFAULT NULL,
      resolution           TEXT DEFAULT NULL,
      rule_id              VARCHAR(64) DEFAULT NULL,
      on_expire            JSONB DEFAULT '{}'::jsonb,
      on_resolved_by_party JSONB DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_sim_threads_state ON sim_threads(state);
    CREATE INDEX IF NOT EXISTS idx_sim_threads_loc ON sim_threads(cell_id, rx, ry);
    ALTER TABLE sim_threads ADD COLUMN IF NOT EXISTS rule_id VARCHAR(64) DEFAULT NULL;
    ALTER TABLE sim_threads ADD COLUMN IF NOT EXISTS on_expire JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE sim_threads ADD COLUMN IF NOT EXISTS on_resolved_by_party JSONB DEFAULT '{}'::jsonb;
  `);
}

/**
 * Validates that every actor ID resolves through the unified entity registry (Rule 7).
 */
export async function validateActorIds(
  client: Db,
  actorIds: string[]
): Promise<{ valid: boolean; invalidIds: string[] }> {
  if (!actorIds || actorIds.length === 0) {
    return { valid: true, invalidIds: [] };
  }

  const invalidIds: string[] = [];

  for (const id of actorIds) {
    const cleanId = String(id).trim();
    if (!cleanId) continue;
    const entity = await resolveActorRef(client, cleanId);
    if (!entity) {
      invalidIds.push(cleanId);
    }
  }

  return {
    valid: invalidIds.length === 0,
    invalidIds
  };
}

/**
 * True when a map NPC matches one of the thread's actors via entity_ref or legacy id mapping.
 */
export function npcIsActor(npc: any, actorIds: Iterable<string>): boolean {
  return npcMatchesRef(npc, actorIds);
}

/**
 * Creates a new thread in sim_threads.
 * Enforces Rule 7: Rejects thread creation if any actor_id is invalid/hallucinated.
 */
export async function createThread(
  client: Pool | PoolClient,
  input: CreateThreadInput
): Promise<SimThread> {
  await ensureThreadTable(client);

  const actorValidation = await validateActorIds(client, input.actor_ids);
  if (!actorValidation.valid) {
    throw new Error(
      `[Thread Creation Guard] Rejected thread creation: Unknown/invented actor IDs: [${actorValidation.invalidIds.join(
        ", "
      )}]. Every actor_id must exist in the database (Rule 7).`
    );
  }

  const useStorylines = await hasStorylinesTable(client);
  if (!useStorylines) {
    const res = await client.query(
      `
      INSERT INTO sim_threads (
        question, stakes, actor_ids, cell_id, rx, ry, clock, clock_max, state, origin, created_tick,
        rule_id, on_expire, on_resolved_by_party
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        input.question,
        input.stakes,
        input.actor_ids,
        input.cell_id,
        input.rx,
        input.ry,
        input.clock ?? 0,
        input.clock_max ?? 6,
        input.origin ?? "reaction",
        input.created_tick,
        input.rule_id || null,
        JSON.stringify(input.on_expire || {}),
        JSON.stringify(input.on_resolved_by_party || {})
      ]
    );
    return res.rows[0];
  }

  const origin = input.origin ?? "reaction";
  const source =
    input.source ??
    (origin === "arc" ? "arc" : origin === "world" ? "world" : origin === "beat" ? "beat" : "reaction");
  const cleanActors = Array.from(new Set((input.actor_ids || []).map((a) => String(a).trim()).filter(Boolean)));
  const scopeCells = input.scope_cells && input.scope_cells.length > 0 ? input.scope_cells : [input.cell_id];

  const res = await client.query(
    `
    INSERT INTO storylines (
      parent_id, scale, scope_cells, cell_id, rx, ry, z,
      question, stakes, actor_ids, clock, clock_max, state,
      origin, source, rule_id, why, facts, hook, rank_score,
      created_tick, on_expire, on_resolved_by_party
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20,
      $21, $22::jsonb, $23::jsonb
    )
    RETURNING
      id::int AS id,
      parent_id,
      scale,
      scope_cells,
      question,
      stakes,
      actor_ids,
      COALESCE(cell_id, scope_cells[1], 0)::int AS cell_id,
      rx,
      ry,
      clock,
      clock_max,
      state,
      origin,
      source,
      created_tick,
      resolved_tick,
      resolution_text AS resolution,
      rule_id,
      why,
      facts,
      hook,
      rank_score::float AS rank_score,
      on_expire,
      on_resolved_by_party
    `,
    [
      input.parent_id ?? null,
      input.scale ?? "thread",
      scopeCells,
      input.cell_id,
      input.rx,
      input.ry,
      input.z ?? 0,
      input.question,
      input.stakes,
      cleanActors,
      input.clock ?? 0,
      input.clock_max ?? 6,
      input.state ?? "open",
      origin,
      source,
      input.rule_id || null,
      input.why || null,
      JSON.stringify(input.facts || []),
      JSON.stringify(input.hook || {}),
      input.rank_score ?? 0,
      input.created_tick,
      JSON.stringify(input.on_expire || {}),
      JSON.stringify(input.on_resolved_by_party || {}),
    ]
  );

  const row = res.rows[0];
  for (const ref of cleanActors) {
    await client.query(
      `INSERT INTO storyline_actors (storyline_id, entity_ref, role) VALUES ($1, $2, 'actor') ON CONFLICT DO NOTHING`,
      [row.id, ref]
    );
  }
  return row;
}

/**
 * Fetches all currently open threads, optionally filtered by cell_id.
 */
export async function getOpenThreads(
  client: Pool | PoolClient,
  cellId?: number
): Promise<SimThread[]> {
  await ensureThreadTable(client);

  if (cellId !== undefined) {
    const res = await client.query(
      `SELECT * FROM sim_threads WHERE state IN ('open', 'escalated') AND cell_id = $1 ORDER BY id ASC`,
      [cellId]
    );
    return res.rows;
  }

  const res = await client.query(
    `SELECT * FROM sim_threads WHERE state IN ('open', 'escalated') ORDER BY id ASC`
  );
  return res.rows;
}

export interface ThreadClockAdvanceSummary {
  threadsTicked: number;
  threadsEscalated: number;
  threadsResolved: number;
  worldDeltasApplied: Array<{
    threadId: number;
    cellId: number;
    burgId?: number | undefined;
    unrestDelta: number;
    resolution: string;
  }>;
}

export interface ThreadStateEvaluation {
  isResolved: boolean;
  outcomeType: 'DEATH' | 'FREEDOM' | 'FLIGHT' | 'COMPROMISE' | 'EXPIRED' | 'UNRESOLVED';
  actorState?: 'dead' | 'free' | 'fugitive' | 'imprisoned' | undefined;
  resolutionNarrative: string;
  actorTagsToAdd?: string[] | undefined;
  actorTagsToRemove?: string[] | undefined;
  actorDispositionDelta?: number | undefined;
  sectorTagsToAdd?: string[] | undefined;
  sectorTagsToRemove?: string[] | undefined;
  propTagsToAdd?: string[] | undefined;
  propTagsToRemove?: string[] | undefined;
  propNameMatch?: string | undefined;
  unrestDelta: number;
  wealthDelta: number;
  foodDelta: number;
  rawMaterialsDelta: number;
  crimeRateDelta: number;
}

/**
 * Systemically evaluates the true physical state of a thread's actors and props.
 * Replaces canned scripts with real living entity states:
 * - If actor is DEAD: Absence causes tool shortages, economic decline, and anger.
 * - If actor is FREED: Liberation reopens shops, clears tool shortages, stabilizes burg.
 * - If actor FLED: Actor becomes an outlaw/fugitive, leaves empty shop and supply drought.
 * - If actor is BRIBED/COMPROMISED: Corruption entrenches, crime rate rises.
 */
export function evaluateThreadState(
  thread: SimThread,
  npcs: any[],
  props: any[]
): ThreadStateEvaluation {
  const actorIds = new Set((thread.actor_ids || []).map(id => String(id)));
  const threadActors = (npcs || []).filter(n => npcIsActor(n, actorIds));
  const primaryActor = threadActors[0];

  if (!primaryActor) {
    return {
      isResolved: false,
      outcomeType: 'UNRESOLVED',
      resolutionNarrative: 'Thread actors not currently present in sector.',
      unrestDelta: 0,
      wealthDelta: 0,
      foodDelta: 0,
      rawMaterialsDelta: 0,
      crimeRateDelta: 0
    };
  }

  const isDead = primaryActor.alive === false ||
    (primaryActor.hp !== undefined && primaryActor.hp <= 0) ||
    primaryActor.tags?.includes('#Dead') ||
    primaryActor.tags?.includes('#Slain') ||
    primaryActor.tags?.includes('#Executed');

  if (isDead) {
    const actorName = primaryActor.name || 'The captive';
    const isSmith = primaryActor.role?.toLowerCase().includes('smith') || primaryActor.tags?.some((t: string) => t.toLowerCase().includes('smith') || t.toLowerCase().includes('artisan'));
    
    return {
      isResolved: true,
      outcomeType: 'DEATH',
      resolutionNarrative: `${actorName} was slain. Their permanent absence leaves the district reeling; their craft lies abandoned and public fury boils over.`,
      actorTagsToAdd: ['#Dead', '#Slain', '#MartyrOfRebellion'],
      actorTagsToRemove: ['#InCustody', '#Imprisoned', '#AnxiousBehavior'],
      sectorTagsToAdd: isSmith ? ['#BrokenTools', '#SupplyDrought', '#MartialTerror'] : ['#MartialTerror'],
      propTagsToAdd: isSmith ? ['#ForgeDismantled', '#RubbleChoked'] : undefined,
      propNameMatch: isSmith ? 'forge' : undefined,
      unrestDelta: 25,
      wealthDelta: -250,
      foodDelta: isSmith ? -100 : 0,
      rawMaterialsDelta: isSmith ? -150 : 0,
      crimeRateDelta: 10
    };
  }

  const isFree = !primaryActor.tags?.includes('#InCustody') && !primaryActor.tags?.includes('#Imprisoned');
  const isFugitive = primaryActor.tags?.includes('#Fugitive') || primaryActor.tags?.includes('#InHiding') || primaryActor.tags?.includes('#Exiled');

  if (isFree && isFugitive) {
    const actorName = primaryActor.name || 'The artisan';
    return {
      isResolved: true,
      outcomeType: 'FLIGHT',
      resolutionNarrative: `${actorName} escaped the garrison's clutches and vanished into the wilds as a fugitive. The shop remains abandoned.`,
      actorTagsToAdd: ['#Fugitive', '#InHiding'],
      actorTagsToRemove: ['#InCustody', '#Imprisoned'],
      sectorTagsToAdd: ['#BlacksmithAbsence', '#SupplyDrought'],
      unrestDelta: 10,
      wealthDelta: -100,
      foodDelta: -50,
      rawMaterialsDelta: -80,
      crimeRateDelta: 5
    };
  }

  const isNonCustodyThread =
    thread.origin === 'world' ||
    String(thread.rule_id || '').startsWith('WORLD_') ||
    thread.rule_id === 'LOCAL_PARAGON_FRICTION' ||
    thread.rule_id === 'LOCAL_CITIZEN_TROUBLE' ||
    thread.rule_id === 'LOCAL_AGENT_TROUBLE' ||
    thread.rule_id === 'AUTONOMOUS_CLASH';

  if (isFree && !isNonCustodyThread) {
    const actorName = primaryActor.name || 'The artisan';
    const isSmith = primaryActor.role?.toLowerCase().includes('smith') || primaryActor.tags?.some((t: string) => t.toLowerCase().includes('smith') || t.toLowerCase().includes('artisan'));

    return {
      isResolved: true,
      outcomeType: 'FREEDOM',
      resolutionNarrative: `${actorName} was cleared and freed from garrison custody, returning to active trade. Local morale surges as tools and repairs resume.`,
      actorTagsToAdd: ['#RebelAlly', '#VindicatedArtisan'],
      actorTagsToRemove: ['#InCustody', '#Imprisoned', '#SupplyDrought', '#AnxiousBehavior'],
      actorDispositionDelta: 3,
      sectorTagsToAdd: isSmith ? ['#SmithyOperational'] : [],
      sectorTagsToRemove: ['#WatchPatrolsActive', '#SupplyDrought'],
      propTagsToAdd: isSmith ? ['#SmithyOperational'] : undefined,
      propTagsToRemove: isSmith ? ['#SmithyClosed', '#BoardedDoor'] : undefined,
      propNameMatch: isSmith ? 'forge' : undefined,
      unrestDelta: -15,
      wealthDelta: 150,
      foodDelta: 30,
      rawMaterialsDelta: 100,
      crimeRateDelta: -5
    };
  }

  return {
    isResolved: false,
    outcomeType: 'UNRESOLVED',
    resolutionNarrative: 'Situation remains unresolved; actor is still held in custody.',
    unrestDelta: 0,
    wealthDelta: 0,
    foodDelta: 0,
    rawMaterialsDelta: 0,
    crimeRateDelta: 0
  };
}

/**
 * Resolves a thread naturally based on evaluated entity states.
 */
export async function resolveThreadNaturally(
  client: Pool | PoolClient,
  thread: SimThread,
  evaluation: ThreadStateEvaluation,
  currentTick: number,
  loreDate?: string
): Promise<{ burgId?: number | undefined; unrestDelta: number; wealthDelta: number; resolution: string }> {
  const delta: ThreadWorldDelta = {
    unrestDelta: evaluation.unrestDelta,
    wealthDelta: evaluation.wealthDelta,
    foodDelta: evaluation.foodDelta,
    rawMaterialsDelta: evaluation.rawMaterialsDelta,
    crimeRateDelta: evaluation.crimeRateDelta,
    actorTagsAdd: evaluation.actorTagsToAdd,
    actorTagsRemove: evaluation.actorTagsToRemove,
    actorDispositionDelta: evaluation.actorDispositionDelta,
    propTagsAdd: evaluation.propTagsToAdd,
    propTagsRemove: evaluation.propTagsToRemove,
    propNameMatch: evaluation.propNameMatch,
    sectorTagsAdd: evaluation.sectorTagsToAdd,
    sectorTagsRemove: evaluation.sectorTagsToRemove,
    narrativeSummary: evaluation.resolutionNarrative
  };

  const deltaResult = await applyThreadWorldDelta(
    client,
    thread,
    delta,
    currentTick,
    loreDate,
    evaluation.outcomeType === 'EXPIRED' ? 'THREAD_EXPIRED' : 'THREAD_RESOLVED_BY_PARTY'
  );

  const useStorylines = await hasStorylinesTable(client);
  if (useStorylines) {
    await client.query(
      `UPDATE storylines
       SET state = 'resolved',
           resolved_tick = $1,
           resolution_text = $2,
           resolution = $3::jsonb
       WHERE id = $4`,
      [
        currentTick,
        evaluation.resolutionNarrative,
        JSON.stringify({
          outcomeType: evaluation.outcomeType,
          unrestDelta: evaluation.unrestDelta,
          wealthDelta: evaluation.wealthDelta,
          foodDelta: evaluation.foodDelta,
          rawMaterialsDelta: evaluation.rawMaterialsDelta,
          crimeRateDelta: evaluation.crimeRateDelta,
          narrativeSummary: evaluation.resolutionNarrative,
        }),
        thread.id,
      ]
    );
  } else {
    await client.query(
      `UPDATE sim_threads 
       SET state = 'resolved', resolved_tick = $1, resolution = $2 
       WHERE id = $3`,
      [currentTick, evaluation.resolutionNarrative, thread.id]
    );
  }

  return deltaResult;
}

/**
 * Applies specific world changes defined in a ThreadWorldDelta to PostgreSQL:
 * 1. Mutates sim_burg_economy (unrest, wealth, food, raw_materials, crime_rate)
 * 2. Mutates sim_sector_layers (actor tags, disposition, alive status, prop tags, sector tags)
 * 3. Records a chronicler rumor in sim_events
 */
export async function applyThreadWorldDelta(
  client: Pool | PoolClient,
  thread: SimThread,
  delta: ThreadWorldDelta,
  currentTick: number,
  loreDate?: string,
  eventType: "THREAD_EXPIRED" | "THREAD_RESOLVED_BY_PARTY" | "THREAD_THWARTED_BY_LOCALS" = "THREAD_EXPIRED"
): Promise<{ burgId?: number | undefined; unrestDelta: number; wealthDelta: number; resolution: string }> {
  const unrestDelta = delta.unrestDelta ?? 0;
  const wealthDelta = delta.wealthDelta ?? 0;
  const foodDelta = delta.foodDelta ?? 0;
  const rawMaterialsDelta = delta.rawMaterialsDelta ?? 0;
  const crimeRateDelta = delta.crimeRateDelta ?? 0;
  const resolutionText = delta.narrativeSummary || `Thread #${thread.id} reached resolution at tick ${currentTick}: ${thread.stakes}`;

  // 1. Mutate sim_burg_economy
  const burgRes = await client.query(
    `SELECT burg_id, unrest, wealth, food, raw_materials, crime_rate FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`,
    [thread.cell_id]
  );
  let burgId: number | undefined;

  if (burgRes.rows.length > 0) {
    burgId = burgRes.rows[0].burg_id;
    await client.query(
      `UPDATE sim_burg_economy 
       SET unrest = LEAST(100, GREATEST(0, unrest + $1)),
           wealth = GREATEST(0, wealth + $2),
           food = GREATEST(0, food + $3),
           raw_materials = GREATEST(0, raw_materials + $4),
           crime_rate = LEAST(100, GREATEST(0, crime_rate + $5))
       WHERE burg_id = $6`,
      [unrestDelta, wealthDelta, foodDelta, rawMaterialsDelta, crimeRateDelta, burgId]
    );
  }

  // 2. Mutate sim_sector_layers: the surface layer only. (Without z_layer this read an arbitrary level
  //    and wrote it back over all three, copying surface NPCs into cellars and ramparts.)
  const layerRes = await client.query(
    `SELECT npcs, props, features FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`,
    [thread.cell_id, thread.rx, thread.ry]
  );
  if (layerRes.rows.length > 0) {
    let npcs = Array.isArray(layerRes.rows[0].npcs) ? layerRes.rows[0].npcs : [];
    let props = Array.isArray(layerRes.rows[0].props) ? layerRes.rows[0].props : [];
    let features = layerRes.rows[0].features && typeof layerRes.rows[0].features === "object" ? layerRes.rows[0].features : {};
    let mutated = false;

    // Mutate thread actors
    const actorSet = new Set((thread.actor_ids || []).map(String));
    npcs = npcs.map((npc: any) => {
      if (npcIsActor(npc, actorSet)) {
        mutated = true;
        let tags = Array.isArray(npc.tags) ? [...npc.tags] : [];
        if (delta.actorTagsRemove) {
          tags = tags.filter((t: string) => !delta.actorTagsRemove!.includes(t));
        }
        if (delta.actorTagsAdd) {
          for (const t of delta.actorTagsAdd) {
            if (!tags.includes(t)) tags.push(t);
          }
        }
        const disposition = (npc.disposition || 0) + (delta.actorDispositionDelta ?? 0);
        const alive = delta.actorAlive !== undefined ? delta.actorAlive : (npc.alive ?? true);
        return {
          ...npc,
          tags,
          disposition,
          alive
        };
      }
      return npc;
    });

    // Mutate props if specified
    if (delta.propTagsAdd || delta.propTagsRemove) {
      props = props.map((p: any) => {
        const matchesName = !delta.propNameMatch || (p.name && p.name.toLowerCase().includes(delta.propNameMatch.toLowerCase()));
        if (matchesName) {
          mutated = true;
          let tags = Array.isArray(p.tags) ? [...p.tags] : [];
          if (delta.propTagsRemove) {
            tags = tags.filter((t: string) => !delta.propTagsRemove!.includes(t));
          }
          if (delta.propTagsAdd) {
            for (const t of delta.propTagsAdd) {
              if (!tags.includes(t)) tags.push(t);
            }
          }
          return { ...p, tags };
        }
        return p;
      });
    }

    // Mutate sector environmental tags
    if (delta.sectorTagsAdd || delta.sectorTagsRemove) {
      let envTags: string[] = Array.isArray(features.environmental_tags) ? [...features.environmental_tags] : [];
      if (delta.sectorTagsRemove) {
        envTags = envTags.filter(t => !delta.sectorTagsRemove!.includes(t));
      }
      if (delta.sectorTagsAdd) {
        for (const t of delta.sectorTagsAdd) {
          if (!envTags.includes(t)) envTags.push(t);
        }
      }
      features = { ...features, environmental_tags: envTags };
      mutated = true;
    }

    if (mutated) {
      await client.query(
        `UPDATE sim_sector_layers SET npcs = $1, props = $2, features = $3 WHERE cell_id = $4 AND rx = $5 AND ry = $6 AND z_layer = 0`,
        [JSON.stringify(npcs), JSON.stringify(props), JSON.stringify(features), thread.cell_id, thread.rx, thread.ry]
      );
    }
  }

  // 3. Log rumor to sim_events for tavern gossip & news
  await client.query(
    `INSERT INTO sim_events (tick, burg_id, lore_date, type, message, tier)
     VALUES ($1, $2, $3, $4, $5, 'MAJOR')`,
    [
      currentTick,
      burgId || null,
      loreDate || `Tick ${currentTick}`,
      eventType === "THREAD_RESOLVED_BY_PARTY" ? "PARTY_RESOLVED_THREAD" : "THREAD_RESOLVED",
      `📜 [${eventType === "THREAD_RESOLVED_BY_PARTY" ? "HEROIC INTERVENTION" : "THREAD RESOLUTION"}] ${resolutionText}`
    ]
  );

  return { burgId, unrestDelta, wealthDelta, resolution: resolutionText };
}

/** Appends a cross-tick relationship/grudge tag onto a paragon or citizen row without duplicates. */
async function appendActorMemoryTag(client: Pool | PoolClient, typedId: string, tag: string): Promise<void> {
  const m = String(typedId || "").match(/^(paragon|citizen):(\d+)$/);
  if (!m) return;
  const kind = m[1];
  const id = Number(m[2]);
  if (kind === "paragon") {
    const r = await client.query(`SELECT traits FROM sim_paragons WHERE id = $1 LIMIT 1`, [id]);
    if (!r.rows[0]) return;
    let traits: string[] = [];
    try {
      const parsed = typeof r.rows[0].traits === "string" ? JSON.parse(r.rows[0].traits) : r.rows[0].traits;
      if (Array.isArray(parsed)) traits = parsed.map(String);
    } catch {}
    if (!traits.includes(tag)) {
      traits.push(tag);
      await client.query(`UPDATE sim_paragons SET traits = $1 WHERE id = $2`, [JSON.stringify(traits.slice(-12)), id]);
    }
  } else {
    const r = await client.query(`SELECT traits FROM population_demographics WHERE citizen_id = $1 LIMIT 1`, [id]);
    if (!r.rows[0]) return;
    const traits: string[] = Array.isArray(r.rows[0].traits) ? r.rows[0].traits.map(String) : [];
    if (!traits.includes(tag)) {
      traits.push(tag);
      await client.query(`UPDATE population_demographics SET traits = $1::jsonb WHERE citizen_id = $2`, [JSON.stringify(traits.slice(-12)), id]);
    }
  }
}

/** Promotes an escalating clash into an active arc entry in storylines (and sim_story_arcs view). */
async function promoteThreadToArcIfNeeded(client: Pool | PoolClient, thread: any, currentTick: number): Promise<void> {
  try {
    const useStorylines = await hasStorylinesTable(client);
    const existing = await client.query(
      `SELECT 1 FROM sim_story_arcs WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND state = 'active' LIMIT 1`,
      [thread.cell_id, thread.rx ?? 50, thread.ry ?? 50]
    );
    if ((existing.rowCount || 0) > 0) return;

    const beats = [
      { phase: 1, objective: thread.question, discovery_method: "Witnesses and local aftermath" },
      { phase: 2, objective: `Contain the fallout between ${Array.isArray(thread.actor_ids) ? thread.actor_ids.join(" and ") : "rival factions"}`, discovery_method: "Direct confrontation or mediation" }
    ];

    if (!useStorylines) {
      await client.query(
        `INSERT INTO sim_story_arcs (arc_key, cell_id, rx, ry, z, inciting_incident, beats, active_phase, state, thread_ids, actor_id, source, created_tick)
         VALUES ($1, $2, $3, $4, 0, $5, $6::jsonb, 1, 'active', $7::int[], $8, 'escalation', $9)`,
        [
          `clash_${thread.cell_id}_${thread.created_tick}`.slice(0, 160),
          thread.cell_id,
          thread.rx ?? 50,
          thread.ry ?? 50,
          thread.stakes,
          JSON.stringify(beats),
          [Number(thread.id)],
          Array.isArray(thread.actor_ids) && thread.actor_ids[0] ? String(thread.actor_ids[0]) : null,
          currentTick
        ]
      );
      return;
    }

    const actors: string[] = Array.isArray(thread.actor_ids) ? thread.actor_ids.map(String) : [];
    const arcRes = await client.query(
      `INSERT INTO storylines (
         scale, scope_cells, cell_id, rx, ry, z,
         question, stakes, actor_ids, clock, clock_max, state,
         origin, source, arc_key, active_phase, created_tick
       )
       VALUES ('arc', $1, $2, $3, $4, 0, $5, $6, $7, 1, $8, 'open', 'arc', 'escalation', $9, 1, $10)
       RETURNING id`,
      [
        [Number(thread.cell_id)],
        Number(thread.cell_id),
        thread.rx ?? 50,
        thread.ry ?? 50,
        thread.stakes,
        thread.stakes,
        actors,
        beats.length,
        `clash_${thread.cell_id}_${thread.created_tick}`.slice(0, 160),
        currentTick,
      ]
    );
    const arcId = Number(arcRes.rows[0].id);
    for (const ref of actors) {
      await client.query(
        `INSERT INTO storyline_actors (storyline_id, entity_ref, role) VALUES ($1, $2, 'actor') ON CONFLICT DO NOTHING`,
        [arcId, ref]
      );
    }
    for (const beat of beats) {
      await client.query(
        `INSERT INTO storyline_beats (storyline_id, phase, objective, discovery, state)
         VALUES ($1, $2, $3, $4, $5)`,
        [arcId, beat.phase, beat.objective, beat.discovery_method, beat.phase === 1 ? "open" : "pending"]
      );
    }
    await client.query(
      `UPDATE storylines SET parent_id = $1 WHERE id = $2 AND parent_id IS NULL`,
      [arcId, Number(thread.id)]
    );
  } catch {
    // sim_story_arcs may not exist in isolated unit tests
  }
}

/**
 * Advances all active thread clocks by 1 tick (STORY_AUDIT Step 3).
 * When clock reaches clock_max, the thread resolves automatically,
 * applying its specific on_expire world change (no generic constants).
 */
export async function advanceThreadClocks(
  client: Pool | PoolClient,
  currentTick: number,
  loreDate?: string
): Promise<ThreadClockAdvanceSummary> {
  await ensureThreadTable(client);

  const summary: ThreadClockAdvanceSummary = {
    threadsTicked: 0,
    threadsEscalated: 0,
    threadsResolved: 0,
    worldDeltasApplied: []
  };

  const openRes = await client.query(
    `SELECT * FROM sim_threads WHERE state IN ('open', 'escalated') ORDER BY id ASC`
  );

  for (const thread of openRes.rows) {
    summary.threadsTicked++;

    // Autonomous multi-actor clashes resolve via opposed instigator-vs-target rolls each tick
    if (thread.rule_id === "AUTONOMOUS_CLASH" && Array.isArray(thread.actor_ids) && thread.actor_ids.length >= 2) {
      const seedKey = Number(thread.cell_id || 0) * 13 + Number(thread.created_tick || 0) * 7 + Number(thread.clock || 0) * 5;
      const instRoll = ((currentTick * 37 + seedKey) % 12) + 1;
      const targRoll = ((currentTick * 29 + seedKey * 3) % 12) + 1;

      if (targRoll > instRoll) {
        if (thread.clock <= 0) {
          summary.threadsResolved++;
          const thwartedOutcome: ThreadWorldDelta =
            thread.on_resolved_by_party && typeof thread.on_resolved_by_party === "object" && Object.keys(thread.on_resolved_by_party).length > 0
              ? (typeof thread.on_resolved_by_party === "string" ? JSON.parse(thread.on_resolved_by_party) : thread.on_resolved_by_party)
              : {
                  unrestDelta: -3,
                  narrativeSummary: `Local resistance thwarted the clash before it boiled over: ${thread.stakes}`
                };
          const deltaResult = await applyThreadWorldDelta(client, thread, thwartedOutcome, currentTick, loreDate, "THREAD_THWARTED_BY_LOCALS");
          await client.query(
            `UPDATE sim_threads SET clock = 0, state = 'resolved', resolved_tick = $1, resolution = $2 WHERE id = $3`,
            [currentTick, deltaResult.resolution, thread.id]
          );
          await appendActorMemoryTag(client, String(thread.actor_ids[0]), `#ThwartedBy:${thread.actor_ids[1]}`);
          await appendActorMemoryTag(client, String(thread.actor_ids[1]), `#Resisted:${thread.actor_ids[0]}`);
          summary.worldDeltasApplied.push({
            threadId: thread.id,
            cellId: thread.cell_id,
            burgId: deltaResult.burgId,
            unrestDelta: deltaResult.unrestDelta,
            resolution: deltaResult.resolution
          });
          continue;
        }
        const pushedBack = Math.max(0, thread.clock - 1);
        await client.query(`UPDATE sim_threads SET clock = $1 WHERE id = $2`, [pushedBack, thread.id]);
        continue;
      }
    }

    const nextClock = thread.clock + 1;

    if (nextClock < thread.clock_max) {
      // Check escalation at half clock_max
      const shouldEscalate = nextClock >= Math.ceil(thread.clock_max / 2) && thread.state === "open";
      const nextState = shouldEscalate ? "escalated" : thread.state;
      if (shouldEscalate) summary.threadsEscalated++;

      await client.query(
        `UPDATE sim_threads SET clock = $1, state = $2 WHERE id = $3`,
        [nextClock, nextState, thread.id]
      );
      if (shouldEscalate && thread.rule_id === "AUTONOMOUS_CLASH") {
        await promoteThreadToArcIfNeeded(client, thread, currentTick);
      }
    } else {
      // Reached clock_max: RESOLVE ON ITS OWN!
      summary.threadsResolved++;

      // Parse thread-specific on_expire outcome
      const onExpireOutcome: ThreadWorldDelta =
        thread.on_expire && typeof thread.on_expire === "object" && Object.keys(thread.on_expire).length > 0
          ? (typeof thread.on_expire === "string" ? JSON.parse(thread.on_expire) : thread.on_expire)
          : {
              unrestDelta: 10,
              wealthDelta: -100,
              narrativeSummary: `Clock expired at tick ${currentTick}: Unaddressed crisis resolved unfavorably. Stakes realized: ${thread.stakes}`
            };

      const deltaResult = await applyThreadWorldDelta(
        client,
        thread,
        onExpireOutcome,
        currentTick,
        loreDate,
        "THREAD_EXPIRED"
      );

      await client.query(
        `UPDATE storylines
         SET clock = $1,
             state = 'resolved',
             resolved_tick = $2,
             resolution_text = $3,
             resolution = $4::jsonb
         WHERE id = $5`,
        [
          nextClock,
          currentTick,
          deltaResult.resolution,
          JSON.stringify({
            outcomeType: "EXPIRED",
            expired: true,
            unrestDelta: onExpireOutcome.unrestDelta ?? 0,
            wealthDelta: onExpireOutcome.wealthDelta ?? 0,
            foodDelta: onExpireOutcome.foodDelta ?? 0,
            narrativeSummary: deltaResult.resolution,
          }),
          thread.id,
        ]
      ).catch(async () => {
        await client.query(
          `UPDATE sim_threads SET clock = $1, state = 'resolved', resolved_tick = $2, resolution = $3 WHERE id = $4`,
          [nextClock, currentTick, deltaResult.resolution, thread.id]
        );
      });
      if (thread.rule_id === "AUTONOMOUS_CLASH" && Array.isArray(thread.actor_ids) && thread.actor_ids.length >= 2) {
        await appendActorMemoryTag(client, String(thread.actor_ids[0]), `#PrevailedOver:${thread.actor_ids[1]}`);
        await appendActorMemoryTag(client, String(thread.actor_ids[1]), `#Grudge:${thread.actor_ids[0]}`);
      }

      summary.worldDeltasApplied.push({
        threadId: thread.id,
        cellId: thread.cell_id,
        burgId: deltaResult.burgId,
        unrestDelta: deltaResult.unrestDelta,
        resolution: deltaResult.resolution
      });
    }
  }

  return summary;
}
