import type { Db } from "../deltas/types.js";
import {
  inferEntityKindAndSource,
  mapNpcIdToEntityRef,
  parseEntityRef,
  type EntityKind,
  type EntityLod,
} from "./refs.js";

export interface EntityRow {
  id: number;
  ref: string;
  kind: EntityKind;
  name: string;
  alive: boolean;
  lod: EntityLod;
  cell_id: number | null;
  rx: number | null;
  ry: number | null;
  z: number | null;
  x: number | null;
  y: number | null;
  source_table: string;
  source_id: string;
  created_tick: number;
  died_tick: number | null;
}

export interface UpsertEntityInput {
  ref: string;
  kind: EntityKind;
  name: string;
  alive?: boolean | undefined;
  lod?: EntityLod | undefined;
  cellId?: number | null | undefined;
  rx?: number | null | undefined;
  ry?: number | null | undefined;
  z?: number | null | undefined;
  x?: number | null | undefined;
  y?: number | null | undefined;
  sourceTable: string;
  sourceId: string;
  createdTick?: number | undefined;
  diedTick?: number | null | undefined;
}

function mapEntityRow(r: any): EntityRow {
  return {
    id: Number(r.id),
    ref: String(r.ref),
    kind: r.kind as EntityKind,
    name: String(r.name),
    alive: Boolean(r.alive),
    lod: (r.lod as EntityLod) || "macro",
    cell_id: r.cell_id !== null && r.cell_id !== undefined ? Number(r.cell_id) : null,
    rx: r.rx !== null && r.rx !== undefined ? Number(r.rx) : null,
    ry: r.ry !== null && r.ry !== undefined ? Number(r.ry) : null,
    z: r.z !== null && r.z !== undefined ? Number(r.z) : null,
    x: r.x !== null && r.x !== undefined ? Number(r.x) : null,
    y: r.y !== null && r.y !== undefined ? Number(r.y) : null,
    source_table: String(r.source_table),
    source_id: String(r.source_id),
    created_tick: Number(r.created_tick || 0),
    died_tick: r.died_tick !== null && r.died_tick !== undefined ? Number(r.died_tick) : null,
  };
}

export async function getEntityByRef(db: Db, ref: string): Promise<EntityRow | null> {
  const res = await db.query(`SELECT * FROM entities WHERE ref = $1 LIMIT 1`, [ref]);
  return res.rows[0] ? mapEntityRow(res.rows[0]) : null;
}

export async function upsertEntitiesBatch(db: Db, entries: UpsertEntityInput[]): Promise<number> {
  if (entries.length === 0) return 0;
  const dedup = new Map<string, UpsertEntityInput>();
  for (const e of entries) {
    dedup.set(e.ref, e);
  }
  const list = Array.from(dedup.values()).sort((a, b) => a.ref.localeCompare(b.ref));
  const res = await db.query(
    `INSERT INTO entities (
       ref, kind, name, alive, lod, cell_id, rx, ry, z, x, y, source_table, source_id, created_tick, died_tick
     )
     SELECT
       unnest($1::text[]),
       unnest($2::text[]),
       unnest($3::text[]),
       unnest($4::boolean[]),
       unnest($5::text[]),
       unnest($6::int[]),
       unnest($7::int[]),
       unnest($8::int[]),
       unnest($9::int[]),
       unnest($10::int[]),
       unnest($11::int[]),
       unnest($12::text[]),
       unnest($13::text[]),
       unnest($14::int[]),
       unnest($15::int[])
     ON CONFLICT (ref) DO UPDATE SET
       name = EXCLUDED.name,
       lod = CASE
         WHEN EXCLUDED.lod = 'micro' THEN 'micro'
         WHEN EXCLUDED.lod = 'meso' AND entities.lod = 'macro' THEN 'meso'
         ELSE entities.lod
       END,
       cell_id = COALESCE(EXCLUDED.cell_id, entities.cell_id),
       rx = COALESCE(EXCLUDED.rx, entities.rx),
       ry = COALESCE(EXCLUDED.ry, entities.ry),
       z = COALESCE(EXCLUDED.z, entities.z),
       x = COALESCE(EXCLUDED.x, entities.x),
       y = COALESCE(EXCLUDED.y, entities.y)`,
    [
      list.map((e) => e.ref),
      list.map((e) => e.kind),
      list.map((e) => e.name),
      list.map((e) => e.alive ?? true),
      list.map((e) => e.lod ?? "macro"),
      list.map((e) => e.cellId ?? null),
      list.map((e) => e.rx ?? null),
      list.map((e) => e.ry ?? null),
      list.map((e) => e.z ?? null),
      list.map((e) => e.x ?? null),
      list.map((e) => e.y ?? null),
      list.map((e) => e.sourceTable),
      list.map((e) => e.sourceId),
      list.map((e) => e.createdTick ?? 0),
      list.map((e) => e.diedTick ?? null),
    ]
  );
  return res.rowCount || list.length;
}

export async function upsertEntity(db: Db, input: UpsertEntityInput): Promise<void> {
  await upsertEntitiesBatch(db, [input]);
}

export async function markEntitiesDeadBatch(db: Db, refs: string[], diedTick: number): Promise<number> {
  if (refs.length === 0) return 0;
  const uniq = Array.from(new Set(refs)).sort();
  const res = await db.query(
    `UPDATE entities SET alive = false, died_tick = COALESCE(died_tick, $2)
     WHERE ref = ANY($1::text[]) AND (alive = true OR died_tick IS NULL)`,
    [uniq, diedTick]
  );
  return res.rowCount || 0;
}

export async function markEntityDead(db: Db, ref: string, diedTick: number): Promise<number> {
  return markEntitiesDeadBatch(db, [ref], diedTick);
}

/**
 * Resolves a ref or npc ID against the registry, creating the row on demand from its authoritative
 * source table (or from an explicit local map fallback for squads/creatures/local instances). Returns
 * null when a citizen/paragon/agent/faction/player ID does not exist in PostgreSQL (Rule 7).
 */
export async function ensureEntity(
  db: Db,
  rawRefOrNpcId: string,
  fallback?: Partial<UpsertEntityInput>
): Promise<EntityRow | null> {
  const ref = mapNpcIdToEntityRef(rawRefOrNpcId, {
    cellId: fallback?.cellId ?? undefined,
    rx: fallback?.rx ?? undefined,
    ry: fallback?.ry ?? undefined,
  });
  const existing = await getEntityByRef(db, ref);
  if (existing) return existing;

  const parsed = parseEntityRef(ref);
  if (parsed.prefix === "paragon" && parsed.numericId) {
    const r = await db.query(
      `SELECT p.id, p.name, p.title, b.cell_id
       FROM sim_paragons p
       LEFT JOIN sim_burg_economy b ON b.burg_id = p.burg_id
       WHERE p.id = $1 LIMIT 1`,
      [parsed.numericId]
    );
    const row = r.rows[0];
    if (!row) return null;
    await upsertEntity(db, {
      ref,
      kind: "person",
      name: row.title ? `${row.name} (${row.title})` : String(row.name),
      alive: true,
      lod: fallback?.lod ?? "macro",
      cellId: fallback?.cellId ?? (row.cell_id !== null && row.cell_id !== undefined ? Number(row.cell_id) : null),
      rx: fallback?.rx ?? null,
      ry: fallback?.ry ?? null,
      z: fallback?.z ?? null,
      x: fallback?.x ?? null,
      y: fallback?.y ?? null,
      sourceTable: "sim_paragons",
      sourceId: String(row.id),
      createdTick: fallback?.createdTick ?? 0,
    });
    return getEntityByRef(db, ref);
  }

  if (parsed.prefix === "citizen" && parsed.numericId) {
    const r = await db.query(
      `SELECT citizen_id, name, profession, home_cell_id, allegiance_status
       FROM population_demographics WHERE citizen_id = $1 LIMIT 1`,
      [parsed.numericId]
    );
    const row = r.rows[0];
    if (!row) return null;
    const isDead = String(row.allegiance_status || "").toUpperCase() === "DECEASED";
    await upsertEntity(db, {
      ref,
      kind: "person",
      name: row.profession ? `${row.name} (${row.profession})` : String(row.name),
      alive: !isDead,
      lod: fallback?.lod ?? "macro",
      cellId: fallback?.cellId ?? (row.home_cell_id !== null && row.home_cell_id !== undefined ? Number(row.home_cell_id) : null),
      rx: fallback?.rx ?? null,
      ry: fallback?.ry ?? null,
      z: fallback?.z ?? null,
      x: fallback?.x ?? null,
      y: fallback?.y ?? null,
      sourceTable: "population_demographics",
      sourceId: String(row.citizen_id),
      createdTick: fallback?.createdTick ?? 0,
    });
    return getEntityByRef(db, ref);
  }

  if (parsed.prefix === "agent" && parsed.numericId) {
    const r = await db.query(
      `SELECT id, name, location_cell_id FROM sim_agents WHERE id = $1 LIMIT 1`,
      [parsed.numericId]
    );
    const row = r.rows[0];
    if (!row) return null;
    await upsertEntity(db, {
      ref,
      kind: "person",
      name: String(row.name),
      alive: true,
      lod: fallback?.lod ?? "macro",
      cellId: fallback?.cellId ?? (row.location_cell_id !== null && row.location_cell_id !== undefined ? Number(row.location_cell_id) : null),
      rx: fallback?.rx ?? null,
      ry: fallback?.ry ?? null,
      z: fallback?.z ?? null,
      x: fallback?.x ?? null,
      y: fallback?.y ?? null,
      sourceTable: "sim_agents",
      sourceId: String(row.id),
      createdTick: fallback?.createdTick ?? 0,
    });
    return getEntityByRef(db, ref);
  }

  if (parsed.prefix === "faction" && parsed.numericId) {
    const r = await db.query(`SELECT id, name FROM sim_factions WHERE id = $1 LIMIT 1`, [parsed.numericId]);
    const row = r.rows[0];
    if (!row) return null;
    await upsertEntity(db, {
      ref,
      kind: "group",
      name: String(row.name),
      alive: true,
      lod: "macro",
      sourceTable: "sim_factions",
      sourceId: String(row.id),
      createdTick: fallback?.createdTick ?? 0,
    });
    return getEntityByRef(db, ref);
  }

  if (parsed.prefix === "player" && parsed.numericId) {
    const r = await db.query(`SELECT id, name FROM sim_player_character WHERE id = $1 LIMIT 1`, [parsed.numericId]);
    const row = r.rows[0];
    if (!row) return null;
    await upsertEntity(db, {
      ref,
      kind: "person",
      name: String(row.name),
      alive: true,
      lod: fallback?.lod ?? "micro",
      cellId: fallback?.cellId ?? null,
      rx: fallback?.rx ?? null,
      ry: fallback?.ry ?? null,
      z: fallback?.z ?? null,
      sourceTable: "sim_player_character",
      sourceId: String(row.id),
      createdTick: fallback?.createdTick ?? 0,
    });
    return getEntityByRef(db, ref);
  }

  if (parsed.prefix === "npcinst") {
    const r = await db.query(
      `SELECT id, name, alive, cell_id, current_rx, current_ry, local_pos FROM sim_npc_instances WHERE id = $1 LIMIT 1`,
      [parsed.rawId]
    );
    const row = r.rows[0];
    if (row) {
      await upsertEntity(db, {
        ref,
        kind: fallback?.kind ?? "person",
        name: String(row.name),
        alive: Boolean(row.alive),
        lod: "micro",
        cellId: Number(row.cell_id),
        rx: Number(row.current_rx),
        ry: Number(row.current_ry),
        z: 0,
        x: Array.isArray(row.local_pos) ? Number(row.local_pos[0]) : null,
        y: Array.isArray(row.local_pos) ? Number(row.local_pos[1]) : null,
        sourceTable: "sim_npc_instances",
        sourceId: String(row.id),
        createdTick: fallback?.createdTick ?? 0,
      });
      return getEntityByRef(db, ref);
    }
  }

  // Derived tactical map entities (squads, creatures, objects, bespoke sector NPCs) carry explicit metadata
  if (fallback?.name) {
    const meta = inferEntityKindAndSource(ref);
    await upsertEntity(db, {
      ref,
      kind: fallback.kind ?? meta.kind,
      name: fallback.name,
      alive: fallback.alive ?? true,
      lod: fallback.lod ?? "micro",
      cellId: fallback.cellId ?? null,
      rx: fallback.rx ?? null,
      ry: fallback.ry ?? null,
      z: fallback.z ?? null,
      x: fallback.x ?? null,
      y: fallback.y ?? null,
      sourceTable: fallback.sourceTable ?? meta.sourceTable,
      sourceId: fallback.sourceId ?? meta.sourceId,
      createdTick: fallback.createdTick ?? 0,
    });
    return getEntityByRef(db, ref);
  }

  return null;
}

/**
 * Registers all NPCs on a generated or loaded sector layer and stamps entity_ref on each NPC.
 */
export async function syncLayerEntities(
  db: Db,
  cellId: number,
  rx: number,
  ry: number,
  z: number,
  npcs: any[],
  tick: number = 0
): Promise<void> {
  if (!Array.isArray(npcs) || npcs.length === 0) return;

  const batch: UpsertEntityInput[] = [];
  for (const npc of npcs) {
    if (!npc || !npc.id) continue;
    const ref = npc.entity_ref || mapNpcIdToEntityRef(String(npc.id), { cellId, rx, ry });
    npc.entity_ref = ref;
    const meta = inferEntityKindAndSource(ref, npc);
    batch.push({
      ref,
      kind: meta.kind,
      name: String(npc.name || npc.id),
      alive: npc.alive !== false,
      lod: "micro",
      cellId,
      rx,
      ry,
      z,
      x: Array.isArray(npc.pos) && Number.isFinite(Number(npc.pos[0])) ? Number(npc.pos[0]) : null,
      y: Array.isArray(npc.pos) && Number.isFinite(Number(npc.pos[1])) ? Number(npc.pos[1]) : null,
      sourceTable: meta.sourceTable,
      sourceId: meta.sourceId,
      createdTick: tick,
    });
  }

  await upsertEntitiesBatch(db, batch);
}

/**
 * Backfills the unified entity registry idempotently from paragons, agents, player characters,
 * factions, NPC instances, cached map NPCs, and notable citizens (never bulk-inserting ~320k
 * indistinguishable civilians).
 */
export async function backfillEntities(db: Db, tick: number = 0): Promise<{ totalEntities: number }> {
  // 1. Paragons
  await db.query(
    `INSERT INTO entities (ref, kind, name, alive, lod, cell_id, source_table, source_id, created_tick)
     SELECT 'paragon:' || p.id, 'person',
            CASE WHEN p.title IS NOT NULL AND p.title <> '' THEN p.name || ' (' || p.title || ')' ELSE p.name END,
            true, 'macro', b.cell_id, 'sim_paragons', p.id::text, $1::int
     FROM sim_paragons p
     LEFT JOIN sim_burg_economy b ON b.burg_id = p.burg_id
     ON CONFLICT (ref) DO NOTHING`,
    [tick]
  );

  // 2. Agents
  await db.query(
    `INSERT INTO entities (ref, kind, name, alive, lod, cell_id, source_table, source_id, created_tick)
     SELECT 'agent:' || id, 'person', COALESCE(name, 'Agent #' || id),
            true, 'macro', location_cell_id, 'sim_agents', id::text, $1::int
     FROM sim_agents
     ON CONFLICT (ref) DO NOTHING`,
    [tick]
  );

  // 3. Player Characters
  await db.query(
    `INSERT INTO entities (ref, kind, name, alive, lod, source_table, source_id, created_tick)
     SELECT 'player:' || id, 'person', COALESCE(name, 'Adventurer #' || id),
            true, 'micro', 'sim_player_character', id::text, $1::int
     FROM sim_player_character
     ON CONFLICT (ref) DO NOTHING`,
    [tick]
  );

  // 4. Factions
  await db.query(
    `INSERT INTO entities (ref, kind, name, alive, lod, source_table, source_id, created_tick)
     SELECT 'faction:' || id, 'group', COALESCE(name, 'Faction #' || id),
            true, 'macro', 'sim_factions', id::text, $1::int
     FROM sim_factions
     ON CONFLICT (ref) DO NOTHING`,
    [tick]
  );

  // 5. Existing persisted micro NPC instances
  await db.query(
    `INSERT INTO entities (ref, kind, name, alive, lod, cell_id, rx, ry, z, x, y, source_table, source_id, created_tick, died_tick)
     SELECT 'npcinst:' || id, 'person', COALESCE(name, id),
            COALESCE(alive, true), 'micro', cell_id, current_rx, current_ry, 0,
            CASE WHEN array_length(local_pos, 1) >= 1 THEN local_pos[1] ELSE NULL END,
            CASE WHEN array_length(local_pos, 1) >= 2 THEN local_pos[2] ELSE NULL END,
            'sim_npc_instances', id, $1::int, CASE WHEN COALESCE(alive, true) THEN NULL ELSE $1::int END
     FROM sim_npc_instances
     ON CONFLICT (ref) DO NOTHING`,
    [tick]
  );

  // 6. Notable citizens only (referenced by threads, arcs, cached map NPCs, or mutated by sim)
  await db.query(
    `WITH thread_cits AS (
       SELECT DISTINCT (substring(aid FROM '^citizen:(\\d+)$'))::int AS cid
       FROM sim_threads, unnest(actor_ids) AS aid
       WHERE aid ~ '^citizen:\\d+$'
     ),
     arc_cits AS (
       SELECT DISTINCT (substring(actor_id FROM '^citizen:(\\d+)$'))::int AS cid
       FROM sim_story_arcs
       WHERE actor_id ~ '^citizen:\\d+$'
     ),
     map_cits AS (
       SELECT DISTINCT (substring((elem->>'id') FROM '^npc_(?:citizen|ward|demographic)_(\\d+)$'))::int AS cid
       FROM sim_sector_layers, jsonb_array_elements(COALESCE(npcs, '[]'::jsonb)) AS elem
       WHERE (elem->>'id') ~ '^npc_(?:citizen|ward|demographic)_\\d+$'
     ),
     notable_ids AS (
       SELECT cid FROM thread_cits WHERE cid IS NOT NULL
       UNION
       SELECT cid FROM arc_cits WHERE cid IS NOT NULL
       UNION
       SELECT cid FROM map_cits WHERE cid IS NOT NULL
       UNION
       SELECT citizen_id AS cid
       FROM population_demographics
       WHERE allegiance_status <> 'CIVILIAN'
     )
     INSERT INTO entities (ref, kind, name, alive, lod, cell_id, source_table, source_id, created_tick, died_tick)
     SELECT 'citizen:' || p.citizen_id, 'person',
            CASE WHEN p.profession IS NOT NULL AND p.profession <> '' THEN p.name || ' (' || p.profession || ')' ELSE p.name END,
            (p.allegiance_status <> 'DECEASED'),
            'macro', p.home_cell_id, 'population_demographics', p.citizen_id::text, $1::int,
            CASE WHEN p.allegiance_status = 'DECEASED' THEN $1::int ELSE NULL END
     FROM population_demographics p
     JOIN notable_ids n ON n.cid = p.citizen_id
     ON CONFLICT (ref) DO NOTHING`,
    [tick]
  );

  // 7. Stamp entity_ref on any cached sim_sector_layers NPCs and register squads/creatures/locals
  const layersRes = await db.query(
    `SELECT cell_id, rx, ry, z_layer, npcs FROM sim_sector_layers WHERE jsonb_array_length(COALESCE(npcs, '[]'::jsonb)) > 0`
  );
  for (const row of layersRes.rows) {
    const npcs: any[] = Array.isArray(row.npcs) ? row.npcs : [];
    const hadMissingRef = npcs.some((n) => n && n.id && !n.entity_ref);
    await syncLayerEntities(db, Number(row.cell_id), Number(row.rx), Number(row.ry), Number(row.z_layer), npcs, tick);
    if (hadMissingRef) {
      await db.query(
        `UPDATE sim_sector_layers SET npcs = $1::jsonb WHERE cell_id = $2 AND rx = $3 AND ry = $4 AND z_layer = $5`,
        [JSON.stringify(npcs), row.cell_id, row.rx, row.ry, row.z_layer]
      );
    }
  }

  const countRes = await db.query(`SELECT COUNT(*)::int AS c FROM entities`);
  return { totalEntities: Number(countRes.rows[0]?.c || 0) };
}
