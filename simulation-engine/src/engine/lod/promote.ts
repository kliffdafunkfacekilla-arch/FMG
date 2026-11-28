import type { Db } from "../deltas/types.js";
import { getWorkplaceForProfession } from "../economy/goodCatalog.js";
import { adjustCohortCount, adjustCohortsBatch, type CohortKey } from "../entities/population.js";
import { upsertEntitiesBatch, upsertEntity, type UpsertEntityInput } from "../entities/registry.js";
import { hashSeed, mulberry32 } from "../rng.js";
import { deriveCitizenMotives } from "../rpg/paragonMotives.js";
import { loadTownNameBooks, NameBook } from "../names/names.js";

export interface PromoteFilter {
  profession?: string | undefined;
  preferredProfessions?: string[] | undefined;
  species?: string | undefined;
  ageBand?: string | undefined;
  allegiance?: string | undefined;
  isNull?: boolean | undefined;
}

export interface PromotedPersonResult {
  citizenId: number;
  entityRef: string;
  name: string;
  profession: string;
  species: string;
  ageBand: string;
  sparkTier: string;
  isNull: boolean;
  allegiance: string;
  alreadyExisted: boolean;
  cohortKey: string;
}

export const CHILDHOOD_BACKGROUNDS = [
  "Apprenticed early at the forge; blistered palms taught them the stubborn value of endurance.",
  "Survived a bitter winter famine by foraging frozen marsh-moss with their elder siblings.",
  "Discovered strange sparks dancing along their fingertips while resting beside an ancient wardstone.",
  "Grew up listening to temple priests chant solemn hymns about the 12 Chaos Dragons and the seals.",
  "Witnessed a city watch raid on their parents' workshop over unpaid grain taxes.",
  "Raised on a frontier farm defending sheep herds from wandering packs.",
  "Spent quiet candlelit hours in a scriptorium copying civic tallies.",
  "Learned to sprint across rooftops carrying urgent missives for the merchant guild.",
];

export const TEMPERS = ["GREEDY", "FANATICAL", "DESPERATE", "SCHOLARLY", "STOIC", "VENGEFUL", "COMPASSIONATE", "CURIOUS"];
export const INSTINCTS = ["WARY", "CURIOUS", "AGGRESSIVE", "FEARFUL", "DEVOUT"];

function pickSeeded<T>(arr: readonly T[], rng: () => number, fallback: T): T {
  if (arr.length === 0) return fallback;
  return arr[Math.floor(rng() * arr.length)] ?? fallback;
}

export function buildCohortFilterKey(filter: PromoteFilter): string {
  return [
    filter.species ?? "*",
    filter.profession ?? "*",
    filter.ageBand ?? "*",
    filter.allegiance ?? "*",
    filter.isNull === undefined ? "*" : String(filter.isNull),
  ].join("|");
}

/**
 * Deterministically promotes 1 living person out of a matching `population_cohorts` bucket into
 * `population_demographics` and `entities` under a stable `(burgId, cohortKey, slotKey)`. Calling twice
 * with the same `(burgId, filter, slotKey)` returns the exact same person without double-decrementing.
 */
export async function promoteFromCohort(
  db: Db,
  burgId: number,
  filter: PromoteFilter,
  slotKey: string,
  tick: number = 1
): Promise<PromotedPersonResult | null> {
  const cohortKey = buildCohortFilterKey(filter);

  const existingSlot = await db.query(
    `SELECT ps.*, p.name
     FROM promoted_slots ps
     JOIN population_demographics p ON p.citizen_id = ps.citizen_id
     WHERE ps.burg_id = $1 AND ps.cohort_key = $2 AND ps.slot_key = $3
     LIMIT 1`,
    [burgId, cohortKey, slotKey]
  );
  if (existingSlot.rows.length > 0) {
    const s = existingSlot.rows[0];
    return {
      citizenId: Number(s.citizen_id),
      entityRef: String(s.entity_ref),
      name: String(s.name),
      profession: String(s.profession),
      species: String(s.species),
      ageBand: String(s.age_band),
      sparkTier: String(s.spark_tier),
      isNull: Boolean(s.is_null),
      allegiance: String(s.allegiance),
      alreadyExisted: true,
      cohortKey,
    };
  }

  const conds: string[] = ["burg_id = $1", "count > 0"];
  const params: any[] = [burgId];
  let idx = 2;
  if (filter.profession) { conds.push(`profession = $${idx++}`); params.push(filter.profession); }
  if (filter.species) { conds.push(`species = $${idx++}`); params.push(filter.species); }
  if (filter.ageBand) { conds.push(`age_band = $${idx++}`); params.push(filter.ageBand); }
  if (filter.allegiance) { conds.push(`allegiance = $${idx++}`); params.push(filter.allegiance); }
  if (filter.isNull !== undefined) { conds.push(`is_null = $${idx++}`); params.push(filter.isNull); }

  const pickRes = await db.query(
    `SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count
     FROM population_cohorts
     WHERE ${conds.join(" AND ")}
     ORDER BY count DESC, profession ASC, species ASC, age_band ASC, spark_tier ASC, is_null DESC
     LIMIT 1`,
    params
  );
  if (pickRes.rows.length === 0) return null;
  const coh = pickRes.rows[0];

  const burgMetaRes = await db.query(`SELECT cell_id, name FROM sim_burg_economy WHERE burg_id = $1 LIMIT 1`, [burgId]);
  const cellId = burgMetaRes.rows[0]?.cell_id ? Number(burgMetaRes.rows[0].cell_id) : null;
  const burgName = String(burgMetaRes.rows[0]?.name || `Burg #${burgId}`);

  await adjustCohortCount(
    db,
    {
      burgId,
      species: String(coh.species),
      profession: String(coh.profession),
      ageBand: String(coh.age_band),
      sparkTier: String(coh.spark_tier),
      isNull: Boolean(coh.is_null),
      allegiance: String(coh.allegiance),
    },
    -1
  );

  const rng = mulberry32(hashSeed(`${burgId}:${cohortKey}:${slotKey}`));
  const species = String(coh.species);
  const profession = String(coh.profession);
  const ageBand = String(coh.age_band);
  const sparkTier = String(coh.spark_tier);
  const isNull = Boolean(coh.is_null);
  const allegiance = String(coh.allegiance);

  const name = (await loadTownNameBooks(db, [burgId])).get(burgId)!.make(species, rng);
  const temper = pickSeeded(TEMPERS, rng, "STOIC");
  const instinct = pickSeeded(INSTINCTS, rng, "WARY");
  const childhood = pickSeeded(CHILDHOOD_BACKGROUNDS, rng, CHILDHOOD_BACKGROUNDS[0]!);
  const age = ageBand === "CHILD" ? 7 + Math.floor(rng() * 8) : ageBand === "ELDER" ? 56 + Math.floor(rng() * 18) : 20 + Math.floor(rng() * 28);
  const wp = getWorkplaceForProfession(profession, burgName);
  const motives = deriveCitizenMotives({ profession, temper, instinct, allegiance_status: allegiance });
  const motivation = `Active ${profession} at ${wp.name} in ${burgName}.`;

  const insRes = await db.query(
    `INSERT INTO population_demographics (
       settlement_id, home_cell_id, name, profession, species,
       is_null, spark_tier, attunement_level, chaos_attraction_index,
       temper, instinct, motivation, traits, social_links, allegiance_status,
       unit_size, life_stage, age, childhood_background, is_immigrant,
       workplace_type, workplace_name, want, flaw, line_wont_cross
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12, $13::jsonb, '[]'::jsonb, $14,
       1, $15, $16, $17, false,
       $18, $19, $20, $21, $22
     ) RETURNING citizen_id`,
    [
      burgId,
      cellId,
      name,
      profession,
      species,
      isNull,
      sparkTier,
      isNull ? 0 : 0.3,
      isNull ? 0 : 1.5,
      temper,
      instinct,
      motivation,
      JSON.stringify([temper, instinct]),
      allegiance,
      ageBand,
      age,
      childhood,
      wp.type,
      wp.name,
      motives.want,
      motives.flaw,
      motives.lineWontCross,
    ]
  );

  const citizenId = Number(insRes.rows[0].citizen_id);
  const entityRef = `citizen:${citizenId}`;

  await upsertEntity(db, {
    ref: entityRef,
    kind: "person",
    name: profession ? `${name} (${profession})` : name,
    alive: true,
    lod: "micro",
    cellId,
    sourceTable: "population_demographics",
    sourceId: String(citizenId),
    createdTick: tick,
  });

  await db.query(
    `INSERT INTO promoted_slots (
       burg_id, cohort_key, slot_key, citizen_id, entity_ref,
       species, profession, age_band, spark_tier, is_null, allegiance, created_tick
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      burgId,
      cohortKey,
      slotKey,
      citizenId,
      entityRef,
      species,
      profession,
      ageBand,
      sparkTier,
      isNull,
      allegiance,
      tick,
    ]
  );

  return {
    citizenId,
    entityRef,
    name,
    profession,
    species,
    ageBand,
    sparkTier,
    isNull,
    allegiance,
    alreadyExisted: false,
    cohortKey,
  };
}

export interface PromoteBatchSpec {
  burgId: number;
  filter: PromoteFilter;
  slotKey: string;
  permanent?: boolean | undefined;
  birthplace?: string | undefined;
  motivationOverride?: string | undefined;
  workplaceBurgName?: string | undefined;
  allegianceOverride?: string | undefined;
}

/**
 * Deterministically promotes up to N people across one or more burgs in <= 7 batched SQL queries
 * regardless of batch size (checking existing slots, loading cohorts, adjusting counts, inserting
 * `population_demographics`, upserting `entities`, and recording non-permanent `promoted_slots`).
 */
export async function promoteBatchFromCohorts(
  db: Db,
  specs: PromoteBatchSpec[],
  tick: number = 1
): Promise<Array<PromotedPersonResult | null>> {
  if (specs.length === 0) return [];
  const results: Array<PromotedPersonResult | null> = new Array(specs.length).fill(null);

  const cohortKeys = specs.map((s) => buildCohortFilterKey(s.filter));
  const tupleKeys = specs.map((s, i) => `${s.burgId}\0${cohortKeys[i]}\0${s.slotKey}`);

  const slotCheckRes = await db.query(
    `SELECT ps.burg_id, ps.cohort_key, ps.slot_key, ps.citizen_id, ps.entity_ref,
            ps.species, ps.profession, ps.age_band, ps.spark_tier, ps.is_null, ps.allegiance, p.name
     FROM promoted_slots ps
     JOIN population_demographics p ON p.citizen_id = ps.citizen_id
     JOIN (
       SELECT unnest($1::int[]) AS burg_id,
              unnest($2::text[]) AS cohort_key,
              unnest($3::text[]) AS slot_key
     ) req ON ps.burg_id = req.burg_id AND ps.cohort_key = req.cohort_key AND ps.slot_key = req.slot_key`,
    [specs.map((s) => s.burgId), cohortKeys, specs.map((s) => s.slotKey)]
  );

  const existingByTuple = new Map<string, PromotedPersonResult>();
  for (const s of slotCheckRes.rows) {
    const tk = `${Number(s.burg_id)}\0${String(s.cohort_key)}\0${String(s.slot_key)}`;
    existingByTuple.set(tk, {
      citizenId: Number(s.citizen_id),
      entityRef: String(s.entity_ref),
      name: String(s.name),
      profession: String(s.profession),
      species: String(s.species),
      ageBand: String(s.age_band),
      sparkTier: String(s.spark_tier),
      isNull: Boolean(s.is_null),
      allegiance: String(s.allegiance),
      alreadyExisted: true,
      cohortKey: String(s.cohort_key),
    });
  }

  const missingIndices: number[] = [];
  const missingBurgSet = new Set<number>();
  for (let i = 0; i < specs.length; i++) {
    const ex = existingByTuple.get(tupleKeys[i]!);
    if (ex) {
      results[i] = ex;
    } else {
      missingIndices.push(i);
      missingBurgSet.add(specs[i]!.burgId);
    }
  }
  if (missingIndices.length === 0) return results;

  const missingBurgs = Array.from(missingBurgSet).sort((a, b) => a - b);
  const cohRes = await db.query(
    `SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count
     FROM population_cohorts
     WHERE burg_id = ANY($1::int[]) AND count > 0
     ORDER BY burg_id ASC, count DESC, profession ASC, species ASC, age_band ASC, spark_tier ASC, is_null DESC`,
    [missingBurgs]
  );

  interface WorkingBucket {
    burgId: number;
    species: string;
    profession: string;
    ageBand: string;
    sparkTier: string;
    isNull: boolean;
    allegiance: string;
    count: number;
  }
  const cohortsByBurg = new Map<number, WorkingBucket[]>();
  for (const r of cohRes.rows) {
    const bid = Number(r.burg_id);
    let arr = cohortsByBurg.get(bid);
    if (!arr) { arr = []; cohortsByBurg.set(bid, arr); }
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

  const metaRes = await db.query(
    `SELECT burg_id, cell_id, name FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`,
    [missingBurgs]
  );
  const burgMeta = new Map<number, { cellId: number | null; name: string }>();
  for (const r of metaRes.rows) {
    burgMeta.set(Number(r.burg_id), {
      cellId: r.cell_id !== null && r.cell_id !== undefined ? Number(r.cell_id) : null,
      name: String(r.name || `Burg #${r.burg_id}`),
    });
  }

  interface PendingInsert {
    specIdx: number;
    tupleKey: string;
    spec: PromoteBatchSpec;
    cohortKey: string;
    burgId: number;
    cellId: number | null;
    name: string;
    profession: string;
    species: string;
    isNull: boolean;
    sparkTier: string;
    temper: string;
    instinct: string;
    motivation: string;
    traitsJson: string;
    allegiance: string;
    storedAllegiance: string;
    ageBand: string;
    age: number;
    childhood: string;
    wpType: string;
    wpName: string;
    want: string;
    flaw: string;
    lineWontCross: string;
    birthplace: string | null;
  }

  const decOps: Array<CohortKey & { delta: number }> = [];
  const pending: PendingInsert[] = [];
  const dedupeIdx = new Map<string, number>();
  const nameBooks = await loadTownNameBooks(db, missingBurgs);

  for (const i of missingIndices) {
    const tk = tupleKeys[i]!;
    if (dedupeIdx.has(tk)) continue;

    const spec = specs[i]!;
    const f = spec.filter;
    const buckets = cohortsByBurg.get(spec.burgId) || [];
    const prefSet = f.preferredProfessions && f.preferredProfessions.length > 0 ? new Set(f.preferredProfessions) : null;

    const matchesBase = (b: WorkingBucket) =>
      b.count > 0 &&
      (!f.profession || b.profession === f.profession) &&
      (!f.species || b.species === f.species) &&
      (!f.ageBand || b.ageBand === f.ageBand) &&
      (!f.allegiance || b.allegiance === f.allegiance) &&
      (f.isNull === undefined || b.isNull === f.isNull);

    let chosen: WorkingBucket | undefined;
    if (prefSet) chosen = buckets.find((b) => matchesBase(b) && prefSet.has(b.profession));
    if (!chosen) chosen = buckets.find(matchesBase);
    if (!chosen) continue;

    chosen.count -= 1;
    decOps.push({
      burgId: chosen.burgId,
      species: chosen.species,
      profession: chosen.profession,
      ageBand: chosen.ageBand,
      sparkTier: chosen.sparkTier,
      isNull: chosen.isNull,
      allegiance: chosen.allegiance,
      delta: -1,
    });

    const ck = cohortKeys[i]!;
    const meta = burgMeta.get(spec.burgId) || { cellId: null, name: `Burg #${spec.burgId}` };
    const rng = mulberry32(hashSeed(`${spec.burgId}:${ck}:${spec.slotKey}`));
    const book = nameBooks.get(spec.burgId) || new NameBook();
    const name = book.make(chosen.species, rng);
    const temper = pickSeeded(TEMPERS, rng, "STOIC");
    const instinct = pickSeeded(INSTINCTS, rng, "WARY");
    const childhood = pickSeeded(CHILDHOOD_BACKGROUNDS, rng, CHILDHOOD_BACKGROUNDS[0]!);
    const age = chosen.ageBand === "CHILD" ? 7 + Math.floor(rng() * 8) : chosen.ageBand === "ELDER" ? 56 + Math.floor(rng() * 18) : 20 + Math.floor(rng() * 28);
    const wp = getWorkplaceForProfession(chosen.profession, spec.workplaceBurgName || meta.name);
    const storedAllegiance = spec.allegianceOverride || chosen.allegiance;
    const motives = deriveCitizenMotives({ profession: chosen.profession, temper, instinct, allegiance_status: storedAllegiance });
    const motivation = spec.motivationOverride || `Active ${chosen.profession} at ${wp.name} in ${meta.name}.`;

    dedupeIdx.set(tk, pending.length);
    pending.push({
      specIdx: i,
      tupleKey: tk,
      spec,
      cohortKey: ck,
      burgId: spec.burgId,
      cellId: meta.cellId,
      name,
      profession: chosen.profession,
      species: chosen.species,
      isNull: chosen.isNull,
      sparkTier: chosen.sparkTier,
      temper,
      instinct,
      motivation,
      traitsJson: JSON.stringify([temper, instinct]),
      allegiance: chosen.allegiance,
      storedAllegiance,
      ageBand: chosen.ageBand,
      age,
      childhood,
      wpType: wp.type,
      wpName: wp.name,
      want: motives.want,
      flaw: motives.flaw,
      lineWontCross: motives.lineWontCross,
      birthplace: spec.birthplace ?? null,
    });
  }

  if (pending.length === 0) return results;

  await adjustCohortsBatch(db, decOps);

  const insRes = await db.query(
    `INSERT INTO population_demographics (
       settlement_id, home_cell_id, name, profession, species,
       is_null, spark_tier, attunement_level, chaos_attraction_index,
       temper, instinct, motivation, traits, social_links, allegiance_status,
       unit_size, life_stage, age, childhood_background, is_immigrant,
       workplace_type, workplace_name, want, flaw, line_wont_cross, birthplace
     )
     SELECT
       unnest($1::int[]), unnest($2::int[]), unnest($3::text[]), unnest($4::text[]), unnest($5::text[]),
       unnest($6::boolean[]), unnest($7::text[]), unnest($8::real[]), unnest($9::real[]),
       unnest($10::text[]), unnest($11::text[]), unnest($12::text[]), unnest($13::jsonb[]), '[]'::jsonb, unnest($14::text[]),
       1, unnest($15::text[]), unnest($16::int[]), unnest($17::text[]), false,
       unnest($18::text[]), unnest($19::text[]), unnest($20::text[]), unnest($21::text[]), unnest($22::text[]), unnest($23::text[])
     RETURNING citizen_id`,
    [
      pending.map((p) => p.burgId),
      pending.map((p) => p.cellId),
      pending.map((p) => p.name),
      pending.map((p) => p.profession),
      pending.map((p) => p.species),
      pending.map((p) => p.isNull),
      pending.map((p) => p.sparkTier),
      pending.map((p) => (p.isNull ? 0 : 0.3)),
      pending.map((p) => (p.isNull ? 0 : 1.5)),
      pending.map((p) => p.temper),
      pending.map((p) => p.instinct),
      pending.map((p) => p.motivation),
      pending.map((p) => p.traitsJson),
      pending.map((p) => p.storedAllegiance),
      pending.map((p) => p.ageBand),
      pending.map((p) => p.age),
      pending.map((p) => p.childhood),
      pending.map((p) => p.wpType),
      pending.map((p) => p.wpName),
      pending.map((p) => p.want),
      pending.map((p) => p.flaw),
      pending.map((p) => p.lineWontCross),
      pending.map((p) => p.birthplace),
    ]
  );

  const entitiesBatch: UpsertEntityInput[] = [];
  const slotPending: Array<PendingInsert & { citizenId: number; entityRef: string }> = [];
  const promotedByTuple = new Map<string, PromotedPersonResult>();

  for (let idx = 0; idx < pending.length; idx++) {
    const p = pending[idx]!;
    const citizenId = Number(insRes.rows[idx]!.citizen_id);
    const entityRef = `citizen:${citizenId}`;
    entitiesBatch.push({
      ref: entityRef,
      kind: "person",
      name: p.profession ? `${p.name} (${p.profession})` : p.name,
      alive: true,
      lod: p.spec.permanent ? "macro" : "micro",
      cellId: p.cellId,
      sourceTable: "population_demographics",
      sourceId: String(citizenId),
      createdTick: tick,
    });
    if (!p.spec.permanent) {
      slotPending.push({ ...p, citizenId, entityRef });
    }
    promotedByTuple.set(p.tupleKey, {
      citizenId,
      entityRef,
      name: p.name,
      profession: p.profession,
      species: p.species,
      ageBand: p.ageBand,
      sparkTier: p.sparkTier,
      isNull: p.isNull,
      allegiance: p.storedAllegiance,
      alreadyExisted: false,
      cohortKey: p.cohortKey,
    });
  }

  await upsertEntitiesBatch(db, entitiesBatch);

  if (slotPending.length > 0) {
    await db.query(
      `INSERT INTO promoted_slots (
         burg_id, cohort_key, slot_key, citizen_id, entity_ref,
         species, profession, age_band, spark_tier, is_null, allegiance, created_tick
       )
       SELECT unnest($1::int[]), unnest($2::text[]), unnest($3::text[]), unnest($4::int[]), unnest($5::text[]),
              unnest($6::text[]), unnest($7::text[]), unnest($8::text[]), unnest($9::text[]), unnest($10::boolean[]),
              unnest($11::text[]), unnest($12::int[])
       ON CONFLICT (burg_id, cohort_key, slot_key) DO NOTHING`,
      [
        slotPending.map((s) => s.burgId),
        slotPending.map((s) => s.cohortKey),
        slotPending.map((s) => s.spec.slotKey),
        slotPending.map((s) => s.citizenId),
        slotPending.map((s) => s.entityRef),
        slotPending.map((s) => s.species),
        slotPending.map((s) => s.profession),
        slotPending.map((s) => s.ageBand),
        slotPending.map((s) => s.sparkTier),
        slotPending.map((s) => s.isNull),
        slotPending.map((s) => s.allegiance),
        slotPending.map(() => tick),
      ]
    );
  }

  for (const i of missingIndices) {
    if (!results[i]) results[i] = promotedByTuple.get(tupleKeys[i]!) || null;
  }
  return results;
}

/**
 * Ensures at least `targetCount` living resident rows exist in `population_demographics` for micro/regional
 * map generation, promoting missing faces deterministically from `population_cohorts`.
 */
export async function ensureBurgMicroCast(
  db: Db,
  burgId: number | null | undefined,
  cellId: number,
  targetCount: number,
  slotPrefix: string,
  tick: number = 1,
  opts: { adultOnly?: boolean | undefined; permanent?: boolean | undefined; extraFilter?: Omit<PromoteFilter, "ageBand"> | undefined } = {}
): Promise<any[]> {
  const bid = burgId && burgId > 0 ? Number(burgId) : 0;
  const adultClause = opts.adultOnly === false ? "" : "AND life_stage = 'ADULT'";
  const querySql = `
    SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation,
           want, flaw, line_wont_cross, workplace_type, workplace_name, childhood_background,
           allegiance_status, unit_size
    FROM population_demographics
    WHERE (home_cell_id = $1 OR ($2::int > 0 AND settlement_id = $2))
      ${adultClause}
      AND allegiance_status NOT IN ('DECEASED', 'DEPARTED')
    ORDER BY citizen_id ASC
    LIMIT $3`;

  const initial = await db.query(querySql, [cellId, bid, targetCount]);
  if (initial.rows.length >= targetCount || bid <= 0) {
    return initial.rows;
  }

  const needed = targetCount - initial.rows.length;
  const specs: PromoteBatchSpec[] = [];
  for (let i = 0; i < needed; i++) {
    specs.push({
      burgId: bid,
      filter: {
        ...(opts.extraFilter || {}),
        ageBand: opts.adultOnly === false ? undefined : "ADULT",
        allegiance: opts.extraFilter?.allegiance ?? "CIVILIAN",
      },
      slotKey: `${slotPrefix}:${initial.rows.length + i}`,
      permanent: opts.permanent,
    });
  }

  const promoted = (await promoteBatchFromCohorts(db, specs, tick)).filter((r) => r !== null);
  if (promoted.length === 0) return initial.rows;

  const updated = await db.query(querySql, [cellId, bid, targetCount]);
  return updated.rows;
}
