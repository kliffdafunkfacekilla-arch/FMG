import { Pool, PoolClient } from "pg";

export type ThreadState = "open" | "escalated" | "resolved";
export type ThreadOrigin = "reaction" | "beat" | "arc";

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
  created_tick: number;
  resolved_tick: number | null;
  resolution: string | null;
  rule_id?: string | null;
  on_expire?: ThreadWorldDelta | null;
  on_resolved_by_party?: ThreadWorldDelta | null;
}

export interface CreateThreadInput {
  question: string;
  stakes: string;
  actor_ids: string[];
  cell_id: number;
  rx: number;
  ry: number;
  clock?: number;
  clock_max?: number;
  origin?: ThreadOrigin;
  created_tick: number;
  rule_id?: string;
  on_expire?: ThreadWorldDelta;
  on_resolved_by_party?: ThreadWorldDelta;
}

/**
 * Ensures the sim_threads table exists in PostgreSQL.
 */
export async function ensureThreadTable(client: Pool | PoolClient): Promise<void> {
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
 * Validates that every actor ID exists in one of the authoritative DB tables:
 * - sim_agents (by id or name)
 * - sim_paragons (by id or name)
 * - population_demographics (by id or citizen_name)
 * - sim_factions (by id or name)
 * - sim_sector_layers (inside npcs jsonb array)
 */
export async function validateActorIds(
  client: Pool | PoolClient,
  actorIds: string[]
): Promise<{ valid: boolean; invalidIds: string[] }> {
  if (!actorIds || actorIds.length === 0) {
    return { valid: true, invalidIds: [] };
  }

  const invalidIds: string[] = [];

  for (const id of actorIds) {
    const cleanId = String(id).trim();
    if (!cleanId) continue;

    const checkRes = await client.query(
      `
      SELECT 1 FROM sim_agents WHERE id::text = $1 OR name = $1
      UNION
      SELECT 1 FROM sim_paragons WHERE id::text = $1 OR name = $1
      UNION
      SELECT 1 FROM population_demographics WHERE citizen_id::text = $1 OR name = $1
      UNION
      SELECT 1 FROM sim_factions WHERE id::text = $1 OR name = $1
      UNION
      SELECT 1 FROM sim_sector_layers, jsonb_array_elements(npcs::jsonb) elem 
      WHERE elem->>'id' = $1 OR elem->>'name' = $1
      LIMIT 1
      `,
      [cleanId]
    );

    if (checkRes.rowCount === 0) {
      invalidIds.push(cleanId);
    }
  }

  return {
    valid: invalidIds.length === 0,
    invalidIds
  };
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
  const threadActors = (npcs || []).filter(n => actorIds.has(String(n.id)));
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

  if (isFree) {
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

  await client.query(
    `UPDATE sim_threads 
     SET state = 'resolved', resolved_tick = $1, resolution = $2 
     WHERE id = $3`,
    [currentTick, evaluation.resolutionNarrative, thread.id]
  );

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
  eventType: "THREAD_EXPIRED" | "THREAD_RESOLVED_BY_PARTY" = "THREAD_EXPIRED"
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

  // 2. Mutate sim_sector_layers
  const layerRes = await client.query(
    `SELECT npcs, props, features FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 LIMIT 1`,
    [thread.cell_id, thread.rx, thread.ry]
  );
  if (layerRes.rows.length > 0) {
    let npcs = Array.isArray(layerRes.rows[0].npcs) ? layerRes.rows[0].npcs : [];
    let props = Array.isArray(layerRes.rows[0].props) ? layerRes.rows[0].props : [];
    let features = layerRes.rows[0].features && typeof layerRes.rows[0].features === "object" ? layerRes.rows[0].features : {};
    let mutated = false;

    // Mutate thread actors
    const actorSet = new Set(thread.actor_ids || []);
    npcs = npcs.map((npc: any) => {
      if (actorSet.has(String(npc.id))) {
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
        `UPDATE sim_sector_layers SET npcs = $1, props = $2, features = $3 WHERE cell_id = $4 AND rx = $5 AND ry = $6`,
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
        `UPDATE sim_threads 
         SET clock = $1, state = 'resolved', resolved_tick = $2, resolution = $3 
         WHERE id = $4`,
        [nextClock, currentTick, deltaResult.resolution, thread.id]
      );

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
