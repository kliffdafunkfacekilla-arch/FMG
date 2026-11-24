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
 * row and `entities` entry (registry, threads, story arcs, cached maps, convoys, non-civilian, or named
 * in events/GM memories).
 */
export async function findNotableCitizenIds(db: Db): Promise<Set<number>> {
  const notable = new Set<number>();

  const refQueries = [
    `SELECT source_id::int AS cid FROM entities WHERE source_table = 'population_demographics' AND source_id ~ '^\\d+$'`,
    `SELECT DISTINCT (substring(aid FROM '^citizen:(\\d+)$'))::int AS cid FROM sim_threads, unnest(actor_ids) AS aid WHERE aid ~ '^citizen:\\d+$'`,
    `SELECT DISTINCT (substring(actor_id FROM '^citizen:(\\d+)$'))::int AS cid FROM sim_story_arcs WHERE actor_id ~ '^citizen:\\d+$'`,
    `SELECT DISTINCT (substring((elem->>'id') FROM '^npc_(?:citizen|ward|demographic)_(\\d+)$'))::int AS cid FROM sim_sector_layers, jsonb_array_elements(COALESCE(npcs, '[]'::jsonb)) AS elem WHERE (elem->>'id') ~ '^npc_(?:citizen|ward|demographic)_\\d+$'`,
    `SELECT DISTINCT merchant_citizen_id AS cid FROM sim_trade_shipments WHERE merchant_citizen_id IS NOT NULL`,
    `SELECT DISTINCT (elem::text)::int AS cid FROM sim_trade_shipments, jsonb_array_elements(COALESCE(crew_citizen_ids, '[]'::jsonb)) AS elem WHERE elem::text ~ '^\\d+$'`,
    `SELECT citizen_id AS cid FROM population_demographics WHERE allegiance_status <> 'CIVILIAN'`,
  ];

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
 * ensuring all notables carry entries in `entities`. Exact conservation holds across every burg.
 */
export async function backfillPopulationCohorts(
  db: Db,
  opts: { tick?: number | undefined; force?: boolean | undefined } = {}
): Promise<{ cohorts: number; cohortPeople: number; notablePeople: number; notablesRegistered: number }> {
  const tick = opts.tick ?? 1;
  if (!opts.force) {
    const existing = await db.query(`SELECT COUNT(*)::int AS cohorts, COALESCE(SUM(count), 0)::int AS people FROM population_cohorts`);
    const cnt = Number(existing.rows[0]?.cohorts || 0);
    if (cnt > 0) {
      const notableIds = await findNotableCitizenIds(db);
      const idArr = Array.from(notableIds);
      const notRes = idArr.length > 0
        ? await db.query(
            `SELECT COALESCE(SUM(unit_size), 0)::int AS p FROM population_demographics WHERE citizen_id = ANY($1::int[]) AND allegiance_status NOT IN ('DECEASED', 'DEPARTED')`,
            [idArr]
          )
        : { rows: [{ p: 0 }] };
      return {
        cohorts: cnt,
        cohortPeople: Number(existing.rows[0]?.people || 0),
        notablePeople: Number(notRes.rows[0]?.p || 0),
        notablesRegistered: idArr.length,
      };
    }
  }

  const notableIds = Array.from(await findNotableCitizenIds(db)).sort((a, b) => a - b);

  // Register any missing notable citizens in `entities` before computing non-notable cohorts
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

/**
 * Adjusts a single cohort bucket cleanly (clamped at >= 0, deleting empty zeroed rows only if desired; keeps row at 0 by default).
 */
export async function adjustCohortCount(db: Db, key: CohortKey, delta: number): Promise<number> {
  if (delta === 0) return 0;
  const res = await db.query(
    `INSERT INTO population_cohorts (burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, GREATEST(0, $8))
     ON CONFLICT (burg_id, species, profession, age_band, spark_tier, is_null, allegiance)
     DO UPDATE SET count = GREATEST(0, population_cohorts.count + $8)
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
 * Adapter reading adult civilian workforce per (burgId, profession) from `population_cohorts` +
 * living notable adult civilians, falling back to `population_demographics` if cohorts are unpopulated.
 */
export async function getBurgCohortWorkforce(
  db: Db,
  burgIds?: number[] | undefined
): Promise<Map<number, Record<string, WorkforceCounts>>> {
  const out = new Map<number, Record<string, WorkforceCounts>>();
  const hasCohorts = await db.query(`SELECT 1 FROM population_cohorts LIMIT 1`);
  const filterByBurgs = Array.isArray(burgIds) && burgIds.length > 0;

  if (hasCohorts.rows.length === 0) {
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

  const unitRes = filterByBurgs
    ? await db.query(`SELECT burg_id, COALESCE(record_unit, 12) AS unit FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`, [burgIds])
    : await db.query(`SELECT burg_id, COALESCE(record_unit, 12) AS unit FROM sim_burg_economy`);
  const burgUnit = new Map<number, number>(unitRes.rows.map((r: any) => [Number(r.burg_id), Math.min(40, Math.max(3, Number(r.unit || 12)))]));

  const cohRes = filterByBurgs
    ? await db.query(
        `SELECT burg_id, COALESCE(profession, '') AS profession, COALESCE(SUM(count), 0)::int AS people
         FROM population_cohorts
         WHERE burg_id = ANY($1::int[]) AND age_band = 'ADULT' AND allegiance = 'CIVILIAN' AND count > 0
         GROUP BY burg_id, COALESCE(profession, '')
         ORDER BY burg_id, profession`,
        [burgIds]
      )
    : await db.query(
        `SELECT burg_id, COALESCE(profession, '') AS profession, COALESCE(SUM(count), 0)::int AS people
         FROM population_cohorts
         WHERE age_band = 'ADULT' AND allegiance = 'CIVILIAN' AND count > 0
         GROUP BY burg_id, COALESCE(profession, '')
         ORDER BY burg_id, profession`
      );

  for (const r of cohRes.rows) {
    const bId = Number(r.burg_id);
    const prof = String(r.profession || "");
    const people = Number(r.people || 0);
    const unit = burgUnit.get(bId) || 12;
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
 * Verifies the conservation invariant per burg:
 * `SUM(cohorts.count) + living notables === baseline living non-temporarily-promoted population`,
 * and records maximum drift against `sim_burg_economy.(pop_null + pop_attuned)`.
 */
export async function checkCohortConservation(
  db: Db,
  burgIds?: number[] | undefined
): Promise<ConservationReport> {
  const filterByBurgs = Array.isArray(burgIds) && burgIds.length > 0;
  const sql = `
    WITH coh AS (
      SELECT burg_id, COALESCE(SUM(count), 0)::int AS coh_people
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
           (COALESCE(coh.coh_people, 0) + COALESCE(notables.notable_people, 0))::int AS actual_people
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
    if (expected !== actual) {
      mismatches.push({ burgId: bid, expected, actual });
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
