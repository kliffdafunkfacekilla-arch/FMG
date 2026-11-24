import type { Db } from "../deltas/types.js";
import { adjustCohortCount } from "../entities/population.js";

export interface UnfocusAreaOptions {
  cellIds: number[];
  burgId?: number | undefined;
  sinceTick?: number | undefined;
}

export interface UnfocusAreaResult {
  keptRefs: string[];
  demotedCount: number;
  deltaSummary: Record<string, number>;
}

/**
 * Returns true if a temporarily promoted citizen interacted with the world, party, or storylines
 * and therefore must stay a permanent notable rather than folding back into their cohort.
 */
export async function isPromotedCitizenProtected(
  db: Db,
  citizenId: number,
  entityRef: string,
  name: string
): Promise<boolean> {
  const citRes = await db.query(
    `SELECT allegiance_status FROM population_demographics WHERE citizen_id = $1 LIMIT 1`,
    [citizenId]
  );
  if (citRes.rows.length === 0) return false;
  if (String(citRes.rows[0].allegiance_status || "").toUpperCase() !== "CIVILIAN") return true;

  const entRes = await db.query(`SELECT alive FROM entities WHERE ref = $1 LIMIT 1`, [entityRef]);
  if (entRes.rows.length > 0 && entRes.rows[0].alive === false) return true;

  const threadRes = await db.query(
    `SELECT 1 FROM sim_threads WHERE $1 = ANY(actor_ids) LIMIT 1`,
    [entityRef]
  );
  if (threadRes.rows.length > 0) return true;

  const arcRes = await db.query(
    `SELECT 1 FROM sim_story_arcs WHERE actor_id = $1 LIMIT 1`,
    [entityRef]
  );
  if (arcRes.rows.length > 0) return true;

  const ovRes = await db.query(
    `SELECT 1 FROM map_overlays WHERE object_ref = $1 LIMIT 1`,
    [entityRef]
  );
  if (ovRes.rows.length > 0) return true;

  const shipRes = await db.query(
    `SELECT 1 FROM sim_trade_shipments WHERE merchant_citizen_id = $1 LIMIT 1`,
    [citizenId]
  );
  if (shipRes.rows.length > 0) return true;

  const actTableRes = await db.query(`SELECT to_regclass('actions') IS NOT NULL AS ready`);
  if (actTableRes.rows[0]?.ready) {
    const actRes = await db.query(
      `SELECT 1 FROM actions WHERE target_ref = $1 OR $1 = ANY(witnesses) LIMIT 1`,
      [entityRef]
    );
    if (actRes.rows.length > 0) return true;
  }

  if (name) {
    const evRes = await db.query(
      `SELECT 1 FROM sim_events WHERE message ILIKE '%' || $1 || '%' LIMIT 1`,
      [name]
    );
    if (evRes.rows.length > 0) return true;
    const memRes = await db.query(
      `SELECT 1 FROM sim_gm_memories WHERE summary ILIKE '%' || $1 || '%' LIMIT 1`,
      [name]
    );
    if (memRes.rows.length > 0) return true;
  }

  return false;
}

/**
 * Compresses an area back to macro LOD: folds meso/micro delta counts since focus, retains any
 * interacted/dead/story-linked citizens as permanent notables, and returns untouched promoted faces
 * cleanly to their `population_cohorts` bucket.
 */
export async function unfocusArea(db: Db, opts: UnfocusAreaOptions): Promise<UnfocusAreaResult> {
  const cellIds = opts.cellIds.filter((c) => Number.isFinite(c) && c > 0);
  const sinceTick = opts.sinceTick ?? 0;

  const deltaRes = await db.query(
    `SELECT kind, COUNT(*)::int AS cnt
     FROM world_deltas
     WHERE tick >= $1 AND source LIKE ANY(ARRAY['micro:%','meso:%','lod:%'])
     GROUP BY kind
     ORDER BY kind ASC`,
    [sinceTick]
  );
  const deltaSummary: Record<string, number> = {};
  for (const r of deltaRes.rows) {
    deltaSummary[String(r.kind)] = Number(r.cnt || 0);
  }

  const slotRows =
    opts.burgId && opts.burgId > 0
      ? await db.query(
          `SELECT ps.*, p.name, p.unit_size
           FROM promoted_slots ps
           LEFT JOIN population_demographics p ON p.citizen_id = ps.citizen_id
           WHERE ps.burg_id = $1
           ORDER BY ps.citizen_id ASC`,
          [opts.burgId]
        )
      : cellIds.length > 0
        ? await db.query(
            `SELECT ps.*, p.name, p.unit_size
             FROM promoted_slots ps
             LEFT JOIN population_demographics p ON p.citizen_id = ps.citizen_id
             WHERE p.home_cell_id = ANY($1::int[])
             ORDER BY ps.citizen_id ASC`,
            [cellIds]
          )
        : { rows: [] };

  const keptRefs: string[] = [];
  let demotedCount = 0;

  for (const s of slotRows.rows) {
    const citizenId = Number(s.citizen_id);
    const entityRef = String(s.entity_ref);
    const name = String(s.name || "");
    const unitSize = Math.max(1, Number(s.unit_size || 1));

    const protectedNotable = await isPromotedCitizenProtected(db, citizenId, entityRef, name);
    if (protectedNotable) {
      keptRefs.push(entityRef);
      await db.query(`DELETE FROM promoted_slots WHERE citizen_id = $1`, [citizenId]);
      continue;
    }

    await adjustCohortCount(
      db,
      {
        burgId: Number(s.burg_id),
        species: String(s.species),
        profession: String(s.profession),
        ageBand: String(s.age_band),
        sparkTier: String(s.spark_tier),
        isNull: Boolean(s.is_null),
        allegiance: String(s.allegiance),
      },
      unitSize
    );
    await db.query(`DELETE FROM promoted_slots WHERE citizen_id = $1`, [citizenId]);
    await db.query(`DELETE FROM entities WHERE ref = $1`, [entityRef]);
    await db.query(`DELETE FROM population_demographics WHERE citizen_id = $1`, [citizenId]);
    demotedCount++;
  }

  if (cellIds.length > 0) {
    await db.query(
      `UPDATE entities
       SET lod = 'macro'
       WHERE cell_id = ANY($1::int[]) AND alive = true AND source_table <> 'sim_player_character'`,
      [cellIds]
    );
  }

  return { keptRefs, demotedCount, deltaSummary };
}
