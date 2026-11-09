import { Pool, PoolClient } from "pg";

export type ThreadState = "open" | "escalated" | "resolved";
export type ThreadOrigin = "reaction" | "beat" | "arc";

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
}

/**
 * Ensures the sim_threads table exists in PostgreSQL.
 */
export async function ensureThreadTable(client: Pool | PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sim_threads (
      id             SERIAL PRIMARY KEY,
      question       TEXT NOT NULL,
      stakes         TEXT NOT NULL,
      actor_ids      TEXT[] NOT NULL DEFAULT '{}',
      cell_id        INT NOT NULL,
      rx             INT NOT NULL,
      ry             INT NOT NULL,
      clock          INT NOT NULL DEFAULT 0,
      clock_max      INT NOT NULL DEFAULT 6,
      state          VARCHAR(32) NOT NULL DEFAULT 'open',
      origin         VARCHAR(32) NOT NULL DEFAULT 'reaction',
      created_tick   INT NOT NULL DEFAULT 0,
      resolved_tick  INT DEFAULT NULL,
      resolution     TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sim_threads_state ON sim_threads(state);
    CREATE INDEX IF NOT EXISTS idx_sim_threads_loc ON sim_threads(cell_id, rx, ry);
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
      question, stakes, actor_ids, cell_id, rx, ry, clock, clock_max, state, origin, created_tick
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10)
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
      input.created_tick
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
      `SELECT * FROM sim_threads WHERE state = 'open' AND cell_id = $1 ORDER BY id ASC`,
      [cellId]
    );
    return res.rows;
  }

  const res = await client.query(
    `SELECT * FROM sim_threads WHERE state = 'open' ORDER BY id ASC`
  );
  return res.rows;
}
