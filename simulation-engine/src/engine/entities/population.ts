import type { Db } from "../deltas/types.js";
import { upsertEntitiesBatch, type UpsertEntityInput } from "./registry.js";

export interface CohortKey {
  burgId: number;
  species: string;
  profession: string;
  ageBand: string;
  sparkTier: string;
  isNull: boolean;
  allegiance: string;
}

export interface WorkforceCounts {
  records: number;
  people: number;
}

export interface ConservationReport {
  burgsChecked: number;
  exactMatches: number;
  maxLedgerDriftPct: number;
  mismatches: Array<{ burgId: number; expected: number; actual: number }>;
}

function extractCapitalizedNames(texts: string[]): string[] {
  const candidates = new Set<string>();
  const pairRe = /\b([A-Z][A-Za-z'-]{1,24}\s+[A-Z][A-Za-z'-]{1,24})\b/g;
  for (const raw of texts) {
    if (!raw) continue;
    let m: RegExpExecArray | null;
    pairRe.lastIndex = 0;
    while ((m = pairRe.exec(raw)) !== null) {
      candidates.add(m[1]!);
    }
    // Also overlap shifted capitalized pairs (e.g. "Watch Captain Elian Vance")
    const words = raw.match(/\b[A-Z][A-Za-z'-]{1,24}\b/g);
    if (words && words.length >= 2) {
      for (let i = 0; i < words.length - 1; i++) {
        candidates.add(`${words[i]} ${words[i + 1]}`);
      }
    }
  }
  return Array.from(candidates).sort();
}

/**
 * Returns every citizen_id that is individually notable and must keep a `population_demographics`
 * row and `entities` entry (registry, threads, storylines, actions, standing, overlays, cached maps,
 * convoys, promoted slots, non-civilian, or named in events/GM memories).
 */
export async function findNotableCitizenIds(db: Db): Promise<Set<number>> {
  const notable = new Set<number>();

  const refQueries = [
    `SELECT source_id::int AS cid FROM entities WHERE source_table = 'population_demographics' AND source_id ~ '^\\d+$'`,
    `SELECT DISTINCT (substring(aid FROM '^citizen:(\\d+)$'))::int AS cid FROM sim_threads, unnest(actor_ids) AS aid WHERE aid ~ '^citizen:\\d+$'`,
    `SELECT DISTINCT (substring(actor_id FROM '^citizen:(\\d+)$'))::int AS cid FROM sim_story_arcs WHERE actor_id ~ '^citizen:\\d+$'`,
    `SELECT DISTINCT (substring((elem->>'id') FROM '^npc_(?:citizen|ward|demographic)_(\\d+)$'))::int AS cid FROM sim_sector_layers, jsonb_array_elements(COALESCE(npcs, '[]'::jsonb)) AS elem WHERE (elem->>'id') ~ '^npc_(?:citizen|ward|demographic)_\\d+$'`,
    `SELECT DISTINCT (substring((elem->>'entity_ref') FROM '^citizen:(\\d+)$'))::int AS cid FROM sim_sector_layers, jsonb_array_elements(COALESCE(npcs, '[]'::jsonb)) AS elem WHERE (elem->>'entity_ref') ~ '^citizen:\\d+$'`,
    `SELECT DISTINCT merchant_citizen_id AS cid FROM sim_trade_shipments WHERE merchant_citizen_id IS NOT NULL`,
    `SELECT DISTINCT (elem::text)::int AS cid FROM sim_trade_shipments, jsonb_array_elements(COALESCE(crew_citizen_ids, '[]'::jsonb)) AS elem WHERE elem::text ~ '^\\d+$'`,
    `SELECT citizen_id AS cid FROM population_demographics WHERE allegiance_status <> 'CIVILIAN'`,
  ];

  const tblCheck = await db.query(`
    SELECT to_regclass('promoted_slots') IS NOT NULL AS ps,
           to_regclass('storylines') IS NOT NULL AS sl,
           to_regclass('storyline_actors') IS NOT NULL AS sla,
           to_regclass('actions') IS NOT NULL AS act,
           to_regclass('standing') IS NOT NULL AS std,
           to_regclass('map_overlays') IS NOT NULL AS ov
  `);
  const tbl = tblCheck.rows[0] || {};
  if (tbl.ps) refQueries.push(`SELECT DISTINCT citizen_id AS cid FROM promoted_slots WHERE citizen_id IS NOT NULL`);
  if (tbl.sl) refQueries.push(`SELECT DISTINCT (substring(aid FROM '^citizen:(\\d+)$'))::int AS cid FROM storylines, unnest(actor_ids) AS aid WHERE aid ~ '^citizen:\\d+$'`);
  if (tbl.sla) refQueries.push(`SELECT DISTINCT (substring(entity_ref FROM '^citizen:(\\d+)$'))::int AS cid FROM storyline_actors WHERE entity_ref ~ '^citizen:\\d+$'`);
  if (tbl.act) {
    refQueries.push(`SELECT DISTINCT (substring(ref FROM '^citizen:(\\d+)$'))::int AS cid FROM (SELECT target_ref AS ref FROM actions UNION ALL SELECT unnest(witnesses) AS ref FROM actions) t WHERE ref ~ '^citizen:\\d+$'`);
  }
  if (tbl.std) refQueries.push(`SELECT DISTINCT (substring(subject_ref FROM '^citizen:(\\d+)$'))::int AS cid FROM standing WHERE subject_ref ~ '^citizen:\\d+$'`);
  if (tbl.ov) refQueries.push(`SELECT DISTINCT (substring(object_ref FROM '^citizen:(\\d+)$'))::int AS cid FROM map_overlays WHERE object_ref ~ '^citizen:\\d+$'`);

  for (const sql of refQueries) {
    const r = await db.query(sql);
    for (const row of r.rows) {
      const cid = Number(row.cid);
      if (Number.isFinite(cid) && cid > 0) notable.add(cid);
    }
  }

  // Roadmap 8.1 warning: keep every citizen whose name already appeared in chronicle events or GM memories,
  // excluding names belonging to PCs/paragons/agents and scoping geographically to prevent homonym fanout.
  const excludedNames = new Set<string>();
  for (const sql of [
    `SELECT DISTINCT name FROM sim_player_character WHERE name IS NOT NULL`,
    `SELECT DISTINCT name FROM sim_paragons WHERE name IS NOT NULL`,
    `SELECT DISTINCT name FROM sim_agents WHERE name IS NOT NULL`,
  ]) {
    const nr = await db.query(sql);
    for (const r of nr.rows) excludedNames.add(String(r.name));
  }

  const evRows = await db.query(
    `SELECT DISTINCT burg_id, cell_id, message FROM sim_events WHERE message IS NOT NULL`
  );
  const burgPairs = new Map<string, [number, string]>();
  const cellPairs = new Map<string, [number, string]>();
  const globalNames = new Set<string>();

  for (const r of evRows.rows) {
    const names = extractCapitalizedNames([String(r.message || "")]).filter((n) => !excludedNames.has(n));
    if (names.length === 0) continue;
    const bid = r.burg_id !== null && r.burg_id !== undefined ? Number(r.burg_id) : null;
    const cid = r.cell_id !== null && r.cell_id !== undefined ? Number(r.cell_id) : null;
    if (bid && bid > 0) {
      for (const nm of names) burgPairs.set(`${bid}:${nm}`, [bid, nm]);
    } else if (cid && cid > 0) {
      for (const nm of names) cellPairs.set(`${cid}:${nm}`, [cid, nm]);
    } else {
      for (const nm of names) globalNames.add(nm);
    }
  }

  const memTexts = await db.query(`SELECT DISTINCT summary FROM sim_gm_memories WHERE summary IS NOT NULL`);
  for (const nm of extractCapitalizedNames(memTexts.rows.map((r: any) => String(r.summary || "")))) {
    if (!excludedNames.has(nm)) globalNames.add(nm);
  }

  if (burgPairs.size > 0) {
    const vals = Array.from(burgPairs.values());
    const matched = await db.query(
      `SELECT DISTINCT ON (p.settlement_id, p.name) p.citizen_id
       FROM population_demographics p
       JOIN (SELECT unnest($1::int[]) AS bid, unnest($2::text[]) AS nm) q
         ON p.settlement_id = q.bid AND p.name = q.nm
       ORDER BY p.settlement_id, p.name, p.citizen_id ASC`,
      [vals.map((v) => v[0]), vals.map((v) => v[1])]
    );
    for (const row of matched.rows) notable.add(Number(row.citizen_id));
  }

  if (cellPairs.size > 0) {
    const vals = Array.from(cellPairs.values());
    const matched = await db.query(
      `SELECT DISTINCT ON (p.home_cell_id, p.name) p.citizen_id
       FROM population_demographics p
       JOIN (SELECT unnest($1::int[]) AS cid, unnest($2::text[]) AS nm) q
         ON p.home_cell_id = q.cid AND p.name = q.nm
       ORDER BY p.home_cell_id, p.name, p.citizen_id ASC`,
      [vals.map((v) => v[0]), vals.map((v) => v[1])]
    );
    for (const row of matched.rows) notable.add(Number(row.citizen_id));
  }

  if (globalNames.size > 0) {
    const matched = await db.query(
      `SELECT DISTINCT ON (name) citizen_id
       FROM population_demographics
       WHERE name = ANY($1::text[])
       ORDER BY name, citizen_id ASC`,
      [Array.from(globalNames)]
    );
    for (const row of matched.rows) notable.add(Number(row.citizen_id));
  }

  return notable;
}

/**
 * Aggregating living non-notable `population_demographics` records into `population_cohorts` while
 * ensuring all notables carry entries in `entities`. Once non-notable rows have been pruned, preserves
 * existing `population_cohorts` rows cleanly even under `force: true`.
 */
export async function backfillPopulationCohorts(
  db: Db,
  opts: { tick?: number | undefined; force?: boolean | undefined } = {}
): Promise<{ cohorts: number; cohortPeople: number; notablePeople: number; notablesRegistered: number }> {
  const tick = opts.tick ?? 1;
  const existing = await db.query(`SELECT COUNT(*)::int AS cohorts, COALESCE(SUM(count), 0)::int AS people FROM population_cohorts`);
  const existingCohorts = Number(existing.rows[0]?.cohorts || 0);

  if (!opts.force && existingCohorts > 0) {
    const notableIds = await findNotableCitizenIds(db);
    const idArr = Array.from(notableIds);
    const notRes = idArr.length > 0
      ? await db.query(
          `SELECT COALESCE(SUM(unit_size), 0)::int AS p FROM population_demographics WHERE citizen_id = ANY($1::int[]) AND allegiance_status NOT IN ('DECEASED', 'DEPARTED')`,
          [idArr]
        )
      : { rows: [{ p: 0 }] };
    return {
      cohorts: existingCohorts,
      cohortPeople: Number(existing.rows[0]?.people || 0),
      notablePeople: Number(notRes.rows[0]?.p || 0),
      notablesRegistered: idArr.length,
    };
  }

  const notableIds = Array.from(await findNotableCitizenIds(db)).sort((a, b) => a - b);

  // Register any missing notable citizens in `entities` before evaluating cohorts
  let notablesRegistered = 0;
  if (notableIds.length > 0) {
    const notRows = await db.query(
      `SELECT citizen_id, name, profession, home_cell_id, allegiance_status
       FROM population_demographics
       WHERE citizen_id = ANY($1::int[])
       ORDER BY citizen_id ASC`,
      [notableIds]
    );
    const batch: UpsertEntityInput[] = notRows.rows.map((p: any) => {
      const dead = String(p.allegiance_status || "").toUpperCase() === "DECEASED";
      return {
        ref: `citizen:${p.citizen_id}`,
        kind: "person",
        name: p.profession ? `${p.name} (${p.profession})` : String(p.name || `Citizen #${p.citizen_id}`),
        alive: !dead,
        lod: "macro",
        cellId: p.home_cell_id !== null && p.home_cell_id !== undefined ? Number(p.home_cell_id) : null,
        sourceTable: "population_demographics",
        sourceId: String(p.citizen_id),
        createdTick: tick,
        diedTick: dead ? tick : null,
      };
    });
    for (let i = 0; i < batch.length; i += 2000) {
      notablesRegistered += await upsertEntitiesBatch(db, batch.slice(i, i + 2000));
    }
  }

  const nonNotableRes = await db.query(
    `SELECT COUNT(*)::int AS cnt
     FROM population_demographics
     WHERE allegiance_status NOT IN ('DECEASED', 'DEPARTED')
       AND settlement_id IS NOT NULL
       AND NOT (citizen_id = ANY($1::int[]))`,
    [notableIds.length > 0 ? notableIds : [-1]]
  );
  const nonNotableLiving = Number(nonNotableRes.rows[0]?.cnt || 0);

  if (nonNotableLiving === 0 && existingCohorts > 0) {
    const notStats = notableIds.length > 0
      ? await db.query(
          `SELECT COALESCE(SUM(COALESCE(unit_size, 1)), 0)::int AS p
           FROM population_demographics
           WHERE citizen_id = ANY($1::int[]) AND allegiance_status NOT IN ('DECEASED', 'DEPARTED')`,
          [notableIds]
        )
      : { rows: [{ p: 0 }] };
    return {
      cohorts: existingCohorts,
      cohortPeople: Number(existing.rows[0]?.people || 0),
      notablePeople: Number(notStats.rows[0]?.p || 0),
      notablesRegistered,
    };
  }

  await db.query(`DELETE FROM population_cohorts`);

  await db.query(
    `INSERT INTO population_cohorts (
       burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count
     )
     SELECT
       COALESCE(settlement_id, 0) AS burg_id,
       COALESCE(NULLIF(species, ''), 'Human') AS species,
       COALESCE(NULLIF(profession, ''), 'Commoner') AS profession,
       COALESCE(NULLIF(life_stage, ''), 'ADULT') AS age_band,
       COALESCE(NULLIF(spark_tier, ''), 'NONE') AS spark_tier,
       COALESCE(is_null, true) AS is_null,
       COALESCE(NULLIF(allegiance_status, ''), 'CIVILIAN') AS allegiance,
       COALESCE(SUM(COALESCE(unit_size, 1)), 0)::int AS count
     FROM population_demographics
     WHERE allegiance_status NOT IN ('DECEASED', 'DEPARTED')
       AND settlement_id IS NOT NULL
       AND NOT (citizen_id = ANY($1::int[]))
     GROUP BY 1, 2, 3, 4, 5, 6, 7
     HAVING COALESCE(SUM(COALESCE(unit_size, 1)), 0) > 0`,
    [notableIds.length > 0 ? notableIds : [-1]]
  );

  const [cohStats, notStats] = [
    await db.query(`SELECT COUNT(*)::int AS cohorts, COALESCE(SUM(count), 0)::int AS people FROM population_cohorts`),
    notableIds.length > 0
      ? await db.query(
          `SELECT COALESCE(SUM(COALESCE(unit_size, 1)), 0)::int AS p
           FROM population_demographics
           WHERE citizen_id = ANY($1::int[]) AND allegiance_status NOT IN ('DECEASED', 'DEPARTED')`,
          [notableIds]
        )
      : { rows: [{ p: 0 }] },
  ];

  return {
    cohorts: Number(cohStats.rows[0]?.cohorts || 0),
    cohortPeople: Number(cohStats.rows[0]?.people || 0),
    notablePeople: Number(notStats.rows[0]?.p || 0),
    notablesRegistered,
  };
}

function cohortBucketKey(k: CohortKey): string {
  return `${k.burgId}\0${k.species}\0${k.profession}\0${k.ageBand}\0${k.sparkTier}\0${k.isNull ? 1 : 0}\0${k.allegiance}`;
}

/**
 * Adjusts a single cohort bucket cleanly (clamped at >= 0).
 */
export async function adjustCohortCount(db: Db, key: CohortKey, delta: number): Promise<number> {
  if (delta === 0) return 0;
  if (delta < 0) {
    const res = await db.query(
      `UPDATE population_cohorts
       SET count = GREATEST(0, count + $8)
       WHERE burg_id = $1 AND species = $2 AND profession = $3 AND age_band = $4
         AND spark_tier = $5 AND is_null = $6 AND allegiance = $7
       RETURNING count`,
      [key.burgId, key.species, key.profession, key.ageBand, key.sparkTier, key.isNull, key.allegiance, Math.round(delta)]
    );
    return Number(res.rows[0]?.count || 0);
  }
  const res = await db.query(
    `INSERT INTO population_cohorts (burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (burg_id, species, profession, age_band, spark_tier, is_null, allegiance)
     DO UPDATE SET count = population_cohorts.count + $8
     RETURNING count`,
    [
      key.burgId,
      key.species,
      key.profession,
      key.ageBand,
      key.sparkTier,
      key.isNull,
      key.allegiance,
      Math.round(delta),
    ]
  );
  return Number(res.rows[0]?.count || 0);
}

/**
 * Applies many cohort adjustments in at most 2 batched SQL statements (1 UPDATE for decrements,
 * 1 UPSERT for increments), merging identical bucket keys first.
 */
export async function adjustCohortsBatch(
  db: Db,
  ops: Array<CohortKey & { delta: number }>
): Promise<number> {
  if (ops.length === 0) return 0;
  const merged = new Map<string, CohortKey & { delta: number }>();
  for (const op of ops) {
    const d = Math.round(op.delta);
    if (!Number.isFinite(d) || d === 0) continue;
    const k = cohortBucketKey(op);
    const prev = merged.get(k);
    if (prev) prev.delta += d;
    else merged.set(k, { ...op, delta: d });
  }

  const keys = Array.from(merged.keys()).sort();
  const positives: Array<CohortKey & { delta: number }> = [];
  const negatives: Array<CohortKey & { delta: number }> = [];
  for (const k of keys) {
    const item = merged.get(k)!;
    if (item.delta > 0) positives.push(item);
    else if (item.delta < 0) negatives.push(item);
  }

  let affected = 0;
  if (negatives.length > 0) {
    const res = await db.query(
      `UPDATE population_cohorts AS pc
       SET count = GREATEST(0, pc.count + v.delta)
       FROM (
         SELECT unnest($1::int[]) AS burg_id,
                unnest($2::text[]) AS species,
                unnest($3::text[]) AS profession,
                unnest($4::text[]) AS age_band,
                unnest($5::text[]) AS spark_tier,
                unnest($6::boolean[]) AS is_null,
                unnest($7::text[]) AS allegiance,
                unnest($8::int[]) AS delta
       ) AS v
       WHERE pc.burg_id = v.burg_id
         AND pc.species = v.species
         AND pc.profession = v.profession
         AND pc.age_band = v.age_band
         AND pc.spark_tier = v.spark_tier
         AND pc.is_null = v.is_null
         AND pc.allegiance = v.allegiance`,
      [
        negatives.map((x) => x.burgId),
        negatives.map((x) => x.species),
        negatives.map((x) => x.profession),
        negatives.map((x) => x.ageBand),
        negatives.map((x) => x.sparkTier),
        negatives.map((x) => x.isNull),
        negatives.map((x) => x.allegiance),
        negatives.map((x) => x.delta),
      ]
    );
    affected += res.rowCount || negatives.length;
  }

  if (positives.length > 0) {
    const res = await db.query(
      `INSERT INTO population_cohorts (burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count)
       SELECT unnest($1::int[]), unnest($2::text[]), unnest($3::text[]),
              unnest($4::text[]), unnest($5::text[]), unnest($6::boolean[]),
              unnest($7::text[]), unnest($8::int[])
       ON CONFLICT (burg_id, species, profession, age_band, spark_tier, is_null, allegiance)
       DO UPDATE SET count = population_cohorts.count + EXCLUDED.count`,
      [
        positives.map((x) => x.burgId),
        positives.map((x) => x.species),
        positives.map((x) => x.profession),
        positives.map((x) => x.ageBand),
        positives.map((x) => x.sparkTier),
        positives.map((x) => x.isNull),
        positives.map((x) => x.allegiance),
        positives.map((x) => x.delta),
      ]
    );
    affected += res.rowCount || positives.length;
  }

  return affected;
}

/**
 * Returns total living people (cohorts + living notables) per burg in at most 2 queries.
 */
export async function getBurgLivingTotals(
  db: Db,
  burgIds?: number[] | undefined
): Promise<Map<number, { people: number; cohortPeople: number; notablePeople: number; notableRecords: number }>> {
  const out = new Map<number, { people: number; cohortPeople: number; notablePeople: number; notableRecords: number }>();
  const filterByBurgs = Array.isArray(burgIds) && burgIds.length > 0;

  const cohRes = filterByBurgs
    ? await db.query(
        `SELECT burg_id, COALESCE(SUM(count), 0)::int AS p
         FROM population_cohorts
         WHERE burg_id = ANY($1::int[]) AND allegiance NOT IN ('DECEASED', 'DEPARTED') AND count > 0
         GROUP BY burg_id ORDER BY burg_id`,
        [burgIds]
      )
    : await db.query(
        `SELECT burg_id, COALESCE(SUM(count), 0)::int AS p
         FROM population_cohorts
         WHERE allegiance NOT IN ('DECEASED', 'DEPARTED') AND count > 0
         GROUP BY burg_id ORDER BY burg_id`
      );

  for (const r of cohRes.rows) {
    const bid = Number(r.burg_id);
    const cp = Number(r.p || 0);
    out.set(bid, { people: cp, cohortPeople: cp, notablePeople: 0, notableRecords: 0 });
  }

  const notRes = filterByBurgs
    ? await db.query(
        `SELECT p.settlement_id AS burg_id, COUNT(*)::int AS recs, COALESCE(SUM(COALESCE(p.unit_size, 1)), 0)::int AS p
         FROM population_demographics p
         WHERE p.settlement_id = ANY($1::int[])
           AND p.allegiance_status NOT IN ('DECEASED', 'DEPARTED')
           AND (
             p.allegiance_status <> 'CIVILIAN'
             OR EXISTS (SELECT 1 FROM entities e WHERE e.source_table = 'population_demographics' AND e.source_id = p.citizen_id::text AND e.alive = true)
           )
         GROUP BY p.settlement_id ORDER BY p.settlement_id`,
        [burgIds]
      )
    : await db.query(
        `SELECT p.settlement_id AS burg_id, COUNT(*)::int AS recs, COALESCE(SUM(COALESCE(p.unit_size, 1)), 0)::int AS p
         FROM population_demographics p
         WHERE p.settlement_id IS NOT NULL
           AND p.allegiance_status NOT IN ('DECEASED', 'DEPARTED')
           AND (
             p.allegiance_status <> 'CIVILIAN'
             OR EXISTS (SELECT 1 FROM entities e WHERE e.source_table = 'population_demographics' AND e.source_id = p.citizen_id::text AND e.alive = true)
           )
         GROUP BY p.settlement_id ORDER BY p.settlement_id`
      );

  for (const r of notRes.rows) {
    const bid = Number(r.burg_id);
    const np = Number(r.p || 0);
    const nr = Number(r.recs || 0);
    const cur = out.get(bid) || { people: 0, cohortPeople: 0, notablePeople: 0, notableRecords: 0 };
    cur.notablePeople += np;
    cur.notableRecords += nr;
    cur.people = cur.cohortPeople + cur.notablePeople;
    out.set(bid, cur);
  }

  return out;
}

/**
 * Retires `people` living CIVILIAN cohort headcount across requested burgs deterministically
 * (proportional pass + deterministic largest-first remainder pass) in <= 3 SQL queries total.
 */
export async function retireFromCohortsBatch(
  db: Db,
  requests: Array<{ burgId: number; people: number }>
): Promise<number> {
  const byBurg = new Map<number, number>();
  for (const r of requests) {
    const p = Math.round(r.people);
    if (p > 0) byBurg.set(r.burgId, (byBurg.get(r.burgId) || 0) + p);
  }
  if (byBurg.size === 0) return 0;

  const burgIds = Array.from(byBurg.keys()).sort((a, b) => a - b);
  const cohRes = await db.query(
    `SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count
     FROM population_cohorts
     WHERE burg_id = ANY($1::int[]) AND allegiance = 'CIVILIAN' AND count > 0
     ORDER BY burg_id ASC, count DESC, profession ASC, species ASC, age_band ASC, spark_tier ASC, is_null DESC`,
    [burgIds]
  );

  const bucketsByBurg = new Map<number, Array<CohortKey & { count: number }>>();
  for (const r of cohRes.rows) {
    const bid = Number(r.burg_id);
    let arr = bucketsByBurg.get(bid);
    if (!arr) { arr = []; bucketsByBurg.set(bid, arr); }
    arr.push({
      burgId: bid,
      species: String(r.species),
      profession: String(r.profession),
      ageBand: String(r.age_band),
      sparkTier: String(r.spark_tier),
      isNull: Boolean(r.is_null),
      allegiance: String(r.allegiance),
      count: Number(r.count),
    });
  }

  const ops: Array<CohortKey & { delta: number }> = [];
  let totalRetired = 0;

  for (const bid of burgIds) {
    const wanted = byBurg.get(bid) || 0;
    const rows = bucketsByBurg.get(bid) || [];
    const avail = rows.reduce((s, r) => s + r.count, 0);
    if (avail <= 0 || wanted <= 0) continue;

    let remaining = Math.min(wanted, avail);
    const taken = new Array<number>(rows.length).fill(0);

    // Proportional pass
    for (let i = 0; i < rows.length && remaining > 0; i++) {
      const share = Math.min(rows[i]!.count, Math.floor((wanted * rows[i]!.count) / avail));
      if (share > 0) {
        taken[i] = (taken[i] ?? 0) + share;
        remaining -= share;
      }
    }
    // Deterministic largest-first round-robin remainder pass
    while (remaining > 0) {
      let progressed = false;
      for (let i = 0; i < rows.length && remaining > 0; i++) {
        if (taken[i]! < rows[i]!.count) {
          taken[i]! += 1;
          remaining -= 1;
          progressed = true;
        }
      }
      if (!progressed) break;
    }

    for (let i = 0; i < rows.length; i++) {
      if (taken[i]! > 0) {
        const b = rows[i]!;
        ops.push({
          burgId: b.burgId,
          species: b.species,
          profession: b.profession,
          ageBand: b.ageBand,
          sparkTier: b.sparkTier,
          isNull: b.isNull,
          allegiance: b.allegiance,
          delta: -taken[i]!,
        });
        totalRetired += taken[i]!;
      }
    }
  }

  if (ops.length > 0) await adjustCohortsBatch(db, ops);
  return totalRetired;
}

/**
 * Year-end demographic maturation: ages kept notable citizens + shifts cohort age bands
 * deterministically (`CHILD -> ADULT` -> `ELDER` -> natural elder retirement).
 */
export async function ageCohortsYearly(
  db: Db,
  adultTradeMap: Record<string, string>
): Promise<void> {
  await db.query(
    `UPDATE population_demographics SET age = age + 1 WHERE allegiance_status NOT IN ('DECEASED', 'DEPARTED')`
  ).catch(() => {});

  const cohRes = await db.query(
    `SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count
     FROM population_cohorts
     WHERE allegiance = 'CIVILIAN'
       AND ((age_band = 'CHILD' AND count >= 16) OR (age_band = 'ADULT' AND count >= 40) OR (age_band = 'ELDER' AND count >= 20))
     ORDER BY burg_id ASC, profession ASC`
  );
  if (cohRes.rows.length === 0) return;

  const ops: Array<CohortKey & { delta: number }> = [];
  for (const r of cohRes.rows) {
    const count = Number(r.count || 0);
    const band = String(r.age_band);
    const base: CohortKey = {
      burgId: Number(r.burg_id),
      species: String(r.species),
      profession: String(r.profession),
      ageBand: band,
      sparkTier: String(r.spark_tier),
      isNull: Boolean(r.is_null),
      allegiance: String(r.allegiance),
    };
    if (band === "CHILD") {
      const grad = Math.floor(count / 16);
      if (grad > 0) {
        ops.push({ ...base, delta: -grad });
        ops.push({ ...base, ageBand: "ADULT", profession: adultTradeMap[base.profession] || "Laborer", delta: grad });
      }
    } else if (band === "ADULT") {
      const aged = Math.floor(count / 40);
      if (aged > 0) {
        ops.push({ ...base, delta: -aged });
        ops.push({ ...base, ageBand: "ELDER", delta: aged });
      }
    } else if (band === "ELDER") {
      const died = Math.floor(count / 20);
      if (died > 0) ops.push({ ...base, delta: -died });
    }
  }
  if (ops.length > 0) await adjustCohortsBatch(db, ops);
}

/**
 * Zeros all living CIVILIAN cohort headcount and marks remaining living CIVILIAN notables for emptied/ruined burgs.
 */
export async function zeroBurgsCohorts(
  db: Db,
  burgIds: number[],
  status: "DECEASED" | "DEPARTED" = "DEPARTED",
  motivation?: string
): Promise<void> {
  if (burgIds.length === 0) return;
  const uniq = Array.from(new Set(burgIds)).sort((a, b) => a - b);
  await db.query(
    `UPDATE population_cohorts SET count = 0 WHERE burg_id = ANY($1::int[]) AND allegiance = 'CIVILIAN'`,
    [uniq]
  );
  await db.query(
    `UPDATE population_demographics
     SET allegiance_status = $2::text,
         cause_of_death = CASE WHEN $2::text = 'DECEASED' THEN COALESCE(cause_of_death, 'FAMINE_OR_PLAGUE') ELSE cause_of_death END,
         motivation = COALESCE($3::text, motivation)
     WHERE settlement_id = ANY($1::int[]) AND allegiance_status = 'CIVILIAN'`,
    [uniq, status, motivation ?? null]
  );
}

/**
 * Transfers `pioneers` people deterministically from a parent burg's CIVILIAN cohorts to a child
 * satellite burg's cohorts (~75% ADULT preferring founding trades, ~25% CHILD), preserving conservation.
 */
export async function transferCohortsBetweenBurgs(
  db: Db,
  parentBurgId: number,
  satelliteBurgId: number,
  pioneers: number,
  preferredProfessions: string[]
): Promise<{ movedPeople: number }> {
  const target = Math.max(0, Math.round(pioneers));
  if (target <= 0) return { movedPeople: 0 };

  const res = await db.query(
    `SELECT species, profession, age_band, spark_tier, is_null, allegiance, count
     FROM population_cohorts
     WHERE burg_id = $1 AND allegiance = 'CIVILIAN' AND count > 0
     ORDER BY (age_band = 'ADULT') DESC,
              (profession = ANY($2::text[])) DESC,
              count DESC,
              profession ASC,
              species ASC,
              age_band ASC,
              spark_tier ASC`,
    [parentBurgId, preferredProfessions]
  );
  if (res.rows.length === 0) return { movedPeople: 0 };

  const rows = res.rows.map((r: any) => ({
    species: String(r.species),
    profession: String(r.profession),
    ageBand: String(r.age_band),
    sparkTier: String(r.spark_tier),
    isNull: Boolean(r.is_null),
    allegiance: String(r.allegiance),
    count: Number(r.count),
  }));

  let adultsGoal = Math.ceil(target * 0.75);
  let childGoal = target - adultsGoal;
  let moved = 0;
  const ops: Array<CohortKey & { delta: number }> = [];

  const takeFrom = (predicate: (r: typeof rows[number]) => boolean, cap: number): number => {
    let takenHere = 0;
    for (const r of rows) {
      if (takenHere >= cap) break;
      if (r.count <= 0 || !predicate(r)) continue;
      const take = Math.min(r.count, cap - takenHere);
      r.count -= take;
      takenHere += take;
      moved += take;
      const base = {
        species: r.species,
        profession: r.profession,
        ageBand: r.ageBand,
        sparkTier: r.sparkTier,
        isNull: r.isNull,
        allegiance: r.allegiance,
      };
      ops.push({ ...base, burgId: parentBurgId, delta: -take });
      ops.push({ ...base, burgId: satelliteBurgId, delta: take });
    }
    return takenHere;
  };

  const adultTaken = takeFrom((r) => r.ageBand === "ADULT", adultsGoal);
  const childTaken = takeFrom((r) => r.ageBand === "CHILD", childGoal + Math.max(0, adultsGoal - adultTaken));
  if (moved < target) {
    takeFrom(() => true, target - moved);
  }
  void childTaken;

  if (ops.length > 0) await adjustCohortsBatch(db, ops);
  return { movedPeople: moved };
}

/**
 * Adapter reading adult civilian workforce per (burgId, profession) from `population_cohorts` +
 * living notable adult civilians, falling back to `population_demographics` if cohorts are unpopulated.
 */
export async function getBurgCohortWorkforce(
  db: Db,
  burgIds?: number[] | undefined
): Promise<Map<number, Record<string, WorkforceCounts>>> {
  const out = new Map<number, Record<string, WorkforceCounts>>();
  const filterByBurgs = Array.isArray(burgIds) && burgIds.length > 0;

  const cohRes = filterByBurgs
    ? await db.query(
        `SELECT c.burg_id, COALESCE(c.profession, '') AS profession,
                COALESCE(SUM(c.count), 0)::int AS people,
                COALESCE(b.record_unit, 12)::int AS unit
         FROM population_cohorts c
         LEFT JOIN sim_burg_economy b ON b.burg_id = c.burg_id
         WHERE c.burg_id = ANY($1::int[]) AND c.age_band = 'ADULT' AND c.allegiance = 'CIVILIAN' AND c.count > 0
         GROUP BY c.burg_id, COALESCE(c.profession, ''), b.record_unit
         ORDER BY c.burg_id, profession`,
        [burgIds]
      )
    : await db.query(
        `SELECT c.burg_id, COALESCE(c.profession, '') AS profession,
                COALESCE(SUM(c.count), 0)::int AS people,
                COALESCE(b.record_unit, 12)::int AS unit
         FROM population_cohorts c
         LEFT JOIN sim_burg_economy b ON b.burg_id = c.burg_id
         WHERE c.age_band = 'ADULT' AND c.allegiance = 'CIVILIAN' AND c.count > 0
         GROUP BY c.burg_id, COALESCE(c.profession, ''), b.record_unit
         ORDER BY c.burg_id, profession`
      );

  if (cohRes.rows.length === 0) {
    const anyCohort = await db.query(`SELECT 1 FROM population_cohorts LIMIT 1`);
    if (anyCohort.rows.length === 0) {
      const res = filterByBurgs
        ? await db.query(
            `SELECT settlement_id, COALESCE(profession, '') AS profession,
                    COUNT(*)::int AS active_records, COALESCE(SUM(unit_size), 0)::int AS active_people
             FROM population_demographics
             WHERE settlement_id = ANY($1::int[]) AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
             GROUP BY settlement_id, COALESCE(profession, '')
             ORDER BY settlement_id, profession`,
            [burgIds]
          )
        : await db.query(
            `SELECT settlement_id, COALESCE(profession, '') AS profession,
                    COUNT(*)::int AS active_records, COALESCE(SUM(unit_size), 0)::int AS active_people
             FROM population_demographics
             WHERE life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
             GROUP BY settlement_id, COALESCE(profession, '')
             ORDER BY settlement_id, profession`
          );
      for (const r of res.rows) {
        const bId = Number(r.settlement_id);
        let map = out.get(bId);
        if (!map) { map = {}; out.set(bId, map); }
        map[String(r.profession || "")] = {
          records: Number(r.active_records) || 0,
          people: Number(r.active_people) || 0,
        };
      }
      return out;
    }
  }

  for (const r of cohRes.rows) {
    const bId = Number(r.burg_id);
    const prof = String(r.profession || "");
    const people = Number(r.people || 0);
    const unit = Math.min(40, Math.max(3, Number(r.unit || 12)));
    let map = out.get(bId);
    if (!map) { map = {}; out.set(bId, map); }
    map[prof] = {
      records: people > 0 ? Math.max(1, Math.round(people / unit)) : 0,
      people,
    };
  }

  const notableRes = filterByBurgs
    ? await db.query(
        `SELECT p.settlement_id, COALESCE(p.profession, '') AS profession,
                COUNT(*)::int AS rec_cnt, COALESCE(SUM(COALESCE(p.unit_size, 1)), 0)::int AS people
         FROM population_demographics p
         JOIN entities e ON e.source_table = 'population_demographics' AND e.source_id = p.citizen_id::text AND e.alive = true
         WHERE p.settlement_id = ANY($1::int[]) AND p.life_stage = 'ADULT' AND p.allegiance_status = 'CIVILIAN'
         GROUP BY p.settlement_id, COALESCE(p.profession, '')
         ORDER BY p.settlement_id, profession`,
        [burgIds]
      )
    : await db.query(
        `SELECT p.settlement_id, COALESCE(p.profession, '') AS profession,
                COUNT(*)::int AS rec_cnt, COALESCE(SUM(COALESCE(p.unit_size, 1)), 0)::int AS people
         FROM population_demographics p
         JOIN entities e ON e.source_table = 'population_demographics' AND e.source_id = p.citizen_id::text AND e.alive = true
         WHERE p.life_stage = 'ADULT' AND p.allegiance_status = 'CIVILIAN'
         GROUP BY p.settlement_id, COALESCE(p.profession, '')
         ORDER BY p.settlement_id, profession`
      );

  for (const r of notableRes.rows) {
    const bId = Number(r.settlement_id);
    const prof = String(r.profession || "");
    let map = out.get(bId);
    if (!map) { map = {}; out.set(bId, map); }
    const prev = map[prof] || { records: 0, people: 0 };
    map[prof] = {
      records: prev.records + (Number(r.rec_cnt) || 0),
      people: prev.people + (Number(r.people) || 0),
    };
  }

  return out;
}

/**
 * Verifies the conservation invariant per burg (exact pre-prune comparison against raw rows;
 * non-negative cohort integrity + ledger drift check post-prune).
 */
export async function checkCohortConservation(
  db: Db,
  burgIds?: number[] | undefined
): Promise<ConservationReport> {
  const filterByBurgs = Array.isArray(burgIds) && burgIds.length > 0;
  const unprunedCheck = await db.query(`
    SELECT EXISTS(
      SELECT 1 FROM population_demographics p
      WHERE p.allegiance_status = 'CIVILIAN'
        AND p.settlement_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.source_table = 'population_demographics' AND e.source_id = p.citizen_id::text)
        AND NOT EXISTS (SELECT 1 FROM promoted_slots ps WHERE ps.citizen_id = p.citizen_id)
    ) AS has_unpruned
  `);
  const hasUnpruned = Boolean(unprunedCheck.rows[0]?.has_unpruned);

  const sql = `
    WITH coh AS (
      SELECT burg_id, COALESCE(SUM(count), 0)::int AS coh_people, MIN(count)::int AS min_count
      FROM population_cohorts
      GROUP BY burg_id
    ),
    notables AS (
      SELECT p.settlement_id AS burg_id, COALESCE(SUM(COALESCE(p.unit_size, 1)), 0)::int AS notable_people
      FROM population_demographics p
      WHERE p.allegiance_status NOT IN ('DECEASED', 'DEPARTED')
        AND p.settlement_id IS NOT NULL
        AND (
          p.allegiance_status <> 'CIVILIAN'
          OR EXISTS (
            SELECT 1 FROM entities e
            WHERE e.source_table = 'population_demographics' AND e.source_id = p.citizen_id::text
          )
        )
      GROUP BY p.settlement_id
    ),
    baseline AS (
      SELECT p.settlement_id AS burg_id, COALESCE(SUM(COALESCE(p.unit_size, 1)), 0)::int AS total_people
      FROM population_demographics p
      WHERE p.allegiance_status NOT IN ('DECEASED', 'DEPARTED')
        AND p.settlement_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM promoted_slots ps WHERE ps.citizen_id = p.citizen_id)
      GROUP BY p.settlement_id
    )
    SELECT b.burg_id,
           (COALESCE(b.pop_null, 0) + COALESCE(b.pop_attuned, 0))::int AS ledger_pop,
           COALESCE(base.total_people, 0)::int AS expected_people,
           (COALESCE(coh.coh_people, 0) + COALESCE(notables.notable_people, 0))::int AS actual_people,
           COALESCE(coh.min_count, 0)::int AS min_count
    FROM sim_burg_economy b
    LEFT JOIN coh ON coh.burg_id = b.burg_id
    LEFT JOIN notables ON notables.burg_id = b.burg_id
    LEFT JOIN baseline base ON base.burg_id = b.burg_id
    ${filterByBurgs ? "WHERE b.burg_id = ANY($1::int[])" : ""}
    ORDER BY b.burg_id ASC`;

  const res = filterByBurgs ? await db.query(sql, [burgIds]) : await db.query(sql);

  const mismatches: ConservationReport["mismatches"] = [];
  let maxLedgerDriftPct = 0;

  for (const r of res.rows) {
    const bid = Number(r.burg_id);
    const expected = Number(r.expected_people || 0);
    const actual = Number(r.actual_people || 0);
    const ledger = Number(r.ledger_pop || 0);
    const minCount = Number(r.min_count || 0);
    if (minCount < 0 || (hasUnpruned && expected !== actual)) {
      mismatches.push({ burgId: bid, expected: hasUnpruned ? expected : 0, actual });
    }
    if (ledger > 0) {
      const driftPct = Math.abs(actual - ledger) / ledger;
      if (driftPct > maxLedgerDriftPct) maxLedgerDriftPct = driftPct;
    }
  }

  return {
    burgsChecked: res.rows.length,
    exactMatches: res.rows.length - mismatches.length,
    maxLedgerDriftPct: Number((maxLedgerDriftPct * 100).toFixed(2)),
    mismatches,
  };
}

/**
 * Ensures `population_cohorts` is backfilled, verifies 0 conservation mismatches, and deletes all
 * non-notable rows from `population_demographics`, leaving only notable & promoted individuals.
 */
export async function pruneNonNotableDemographics(
  db: Db,
  opts: { tick?: number | undefined } = {}
): Promise<{
  beforeRows: number;
  deletedRows: number;
  keptNotables: number;
  cohortRows: number;
  cohortPeople: number;
}> {
  const tick = opts.tick ?? 1;
  const beforeRows = Number((await db.query(`SELECT COUNT(*)::int AS c FROM population_demographics`)).rows[0]?.c || 0);
  const bf = await backfillPopulationCohorts(db, { force: true, tick });
  const report = await checkCohortConservation(db);
  if (report.mismatches.length > 0) {
    throw new Error(
      `Refusing to prune population_demographics: conservation failed on ${report.mismatches.length} burgs (${JSON.stringify(report.mismatches.slice(0, 5))})`
    );
  }

  const notableIds = Array.from(await findNotableCitizenIds(db)).sort((a, b) => a - b);
  const delRes = await db.query(
    `DELETE FROM population_demographics WHERE NOT (citizen_id = ANY($1::int[]))`,
    [notableIds.length > 0 ? notableIds : [-1]]
  );
  const keptNotables = Number((await db.query(`SELECT COUNT(*)::int AS c FROM population_demographics`)).rows[0]?.c || 0);

  return {
    beforeRows,
    deletedRows: Number(delRes.rowCount || 0),
    keptNotables,
    cohortRows: bf.cohorts,
    cohortPeople: bf.cohortPeople,
  };
}
