/**
 * World health: the numbers the dashboard needs to tell a stable world from a slow death spiral.
 *
 * recordHealthSnapshot() runs once per committed tick (masterOrchestrator, after COMMIT) and writes one row
 * to sim_health_history. Trends and alarms are read back from that table, because most of these numbers can
 * not be rebuilt afterwards (once a town has emptied, its population curve is gone).
 *
 * The same module answers the three map tiers: global (the whole world), region (a focus cell and the ring of
 * neighbours the meso layer steps) and ground (one regional sector and the sectors around it).
 */
import type { Db } from "../deltas/types.js";

/** Numbers recorded every tick. Stored as JSON, so adding one needs no migration. */
export interface WorldMetrics {
  burgs: number;
  satellites: number;
  emptyBurgs: number;
  ruins: number;
  popNull: number;
  popAttuned: number;
  popTotal: number;
  cohorts: number;
  unrestAvg: number;
  unrest70: number;
  unrest90: number;
  crimeAvg: number;
  crime100: number;
  food0: number;
  foodTotal: number;
  wealthTotal: number;
  healthAvg: number;
  factions: number;
  agents: number;
  paragons: number;
  entitiesMeso: number;
  entitiesMicro: number;
  storiesProposed: number;
  storiesOpen: number;
  arcsOpen: number;
  storiesResolvedTick: number;
  storiesFailedTick: number;
  storiesOpenedTick: number;
  eventsTick: number;
  eventsMajorTick: number;
  ecoPlants: number;
  ecoPrey: number;
  ecoPredators: number;
  ecoBlight: number;
  focusedRegions: number;
  /** Per focused region (by focus cell id): the ring's own numbers, so the regional pane can draw trends. */
  regions?: Record<string, RingMetrics>;
}

export interface RingMetrics {
  cells: number;
  burgs: number;
  pop: number;
  food0: number;
  unrestAvg: number;
  crimeAvg: number;
  healthAvg: number;
  ecoPlants: number;
  ecoPrey: number;
  ecoPredators: number;
  agents: number;
  stories: number;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round1 = (v: unknown) => Math.round(num(v) * 10) / 10;

export async function collectWorldMetrics(db: Db, tick: number): Promise<WorldMetrics> {
  const r = (await db.query(
    `SELECT
       (SELECT json_build_object(
          'burgs', COUNT(*),
          'satellites', COUNT(*) FILTER (WHERE parent_burg_id IS NOT NULL),
          'emptyBurgs', COUNT(*) FILTER (WHERE pop_null + COALESCE(pop_attuned, 0) <= 0),
          'ruins', COUNT(*) FILTER (WHERE name LIKE '[Ruin]%'),
          'popNull', COALESCE(SUM(GREATEST(pop_null, 0)), 0),
          'popAttuned', COALESCE(SUM(GREATEST(COALESCE(pop_attuned, 0), 0)), 0),
          'unrestAvg', AVG(unrest),
          'unrest70', COUNT(*) FILTER (WHERE unrest >= 70),
          'unrest90', COUNT(*) FILTER (WHERE unrest >= 90),
          'crimeAvg', AVG(crime_rate),
          'crime100', COUNT(*) FILTER (WHERE crime_rate >= 100),
          'food0', COUNT(*) FILTER (WHERE food <= 0),
          'foodTotal', COALESCE(SUM(GREATEST(food, 0)), 0),
          'wealthTotal', COALESCE(SUM(GREATEST(wealth, 0)), 0),
          'healthAvg', AVG(health)
        ) FROM sim_burg_economy) AS burg,
       (SELECT COALESCE(SUM(count), 0) FROM population_cohorts) AS cohorts,
       (SELECT COUNT(*) FROM sim_factions) AS factions,
       (SELECT COUNT(*) FROM sim_agents) AS agents,
       (SELECT COUNT(*) FROM sim_paragons) AS paragons,
       (SELECT json_build_object(
          'meso', COUNT(*) FILTER (WHERE lod = 'meso'),
          'micro', COUNT(*) FILTER (WHERE lod = 'micro')
        ) FROM entities WHERE alive) AS ents,
       (SELECT json_build_object(
          'proposed', COUNT(*) FILTER (WHERE state = 'proposed'),
          'open', COUNT(*) FILTER (WHERE state IN ('open', 'escalated')),
          'arcs', COUNT(*) FILTER (WHERE state IN ('open', 'escalated') AND scale <> 'thread'),
          'resolved', COUNT(*) FILTER (WHERE resolved_tick = $1 AND state = 'resolved'),
          'failed', COUNT(*) FILTER (WHERE resolved_tick = $1 AND state IN ('failed', 'expired')),
          'opened', COUNT(*) FILTER (WHERE created_tick = $1)
        ) FROM storylines) AS st,
       (SELECT json_build_object(
          'all', COUNT(*),
          'major', COUNT(*) FILTER (WHERE tier IN ('MAJOR', 'CRITICAL'))
        ) FROM sim_events WHERE tick = $1) AS ev,
       (SELECT json_build_object(
          'plants', AVG(eco_plants), 'prey', AVG(eco_prey), 'pred', AVG(eco_predators), 'blight', AVG(eco_blight)
        ) FROM sim_cells WHERE z_layer = 0) AS eco,
       (SELECT CASE WHEN to_regclass('focused_regions') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM focused_regions) END) AS focused`,
    [tick]
  )).rows[0];

  const b = r.burg || {};
  const popNull = num(b.popNull);
  const popAttuned = num(b.popAttuned);
  return {
    burgs: num(b.burgs),
    satellites: num(b.satellites),
    emptyBurgs: num(b.emptyBurgs),
    ruins: num(b.ruins),
    popNull,
    popAttuned,
    popTotal: popNull + popAttuned,
    cohorts: num(r.cohorts),
    unrestAvg: round1(b.unrestAvg),
    unrest70: num(b.unrest70),
    unrest90: num(b.unrest90),
    crimeAvg: round1(b.crimeAvg),
    crime100: num(b.crime100),
    food0: num(b.food0),
    foodTotal: num(b.foodTotal),
    wealthTotal: num(b.wealthTotal),
    healthAvg: round1(b.healthAvg),
    factions: num(r.factions),
    agents: num(r.agents),
    paragons: num(r.paragons),
    entitiesMeso: num(r.ents?.meso),
    entitiesMicro: num(r.ents?.micro),
    storiesProposed: num(r.st?.proposed),
    storiesOpen: num(r.st?.open),
    arcsOpen: num(r.st?.arcs),
    storiesResolvedTick: num(r.st?.resolved),
    storiesFailedTick: num(r.st?.failed),
    storiesOpenedTick: num(r.st?.opened),
    eventsTick: num(r.ev?.all),
    eventsMajorTick: num(r.ev?.major),
    ecoPlants: round1(r.eco?.plants),
    ecoPrey: round1(r.eco?.prey),
    ecoPredators: round1(r.eco?.pred),
    ecoBlight: round1(r.eco?.blight),
    focusedRegions: num(r.focused),
  };
}

/** The focus cell and its nearest neighbours, chosen the same way the meso layer builds a region. */
export async function ringCellIds(db: Db, focusCellId: number, maxCells = 7): Promise<number[]> {
  const res = await db.query(
    `WITH c0 AS (SELECT COALESCE(center_x, 0) AS x, COALESCE(center_y, 0) AS y FROM sim_cells WHERE id = $1)
     SELECT c.id FROM sim_cells c, c0
     WHERE c.id = $1 OR (c.center_x BETWEEN c0.x - 65 AND c0.x + 65 AND c.center_y BETWEEN c0.y - 65 AND c0.y + 65)
     ORDER BY (c.id = $1) DESC, (COALESCE(c.center_x, 0) - c0.x)^2 + (COALESCE(c.center_y, 0) - c0.y)^2, c.id
     LIMIT $2`,
    [focusCellId, maxCells]
  );
  return res.rows.map((r: any) => Number(r.id));
}

export async function collectRingMetrics(db: Db, cellIds: number[]): Promise<RingMetrics> {
  const r = (await db.query(
    `SELECT
       (SELECT json_build_object(
          'burgs', COUNT(*),
          'pop', COALESCE(SUM(GREATEST(pop_null, 0) + GREATEST(COALESCE(pop_attuned, 0), 0)), 0),
          'food0', COUNT(*) FILTER (WHERE food <= 0),
          'unrest', AVG(unrest), 'crime', AVG(crime_rate), 'health', AVG(health)
        ) FROM sim_burg_economy WHERE cell_id = ANY($1::int[])) AS b,
       (SELECT json_build_object('plants', AVG(eco_plants), 'prey', AVG(eco_prey), 'pred', AVG(eco_predators))
        FROM sim_cells WHERE id = ANY($1::int[])) AS eco,
       (SELECT COUNT(*) FROM entities WHERE alive AND cell_id = ANY($1::int[])) AS agents,
       (SELECT COUNT(*) FROM storylines WHERE state IN ('open', 'escalated') AND cell_id = ANY($1::int[])) AS stories`,
    [cellIds]
  )).rows[0];
  return {
    cells: cellIds.length,
    burgs: num(r.b?.burgs),
    pop: num(r.b?.pop),
    food0: num(r.b?.food0),
    unrestAvg: round1(r.b?.unrest),
    crimeAvg: round1(r.b?.crime),
    healthAvg: round1(r.b?.health),
    ecoPlants: round1(r.eco?.plants),
    ecoPrey: round1(r.eco?.prey),
    ecoPredators: round1(r.eco?.pred),
    agents: num(r.agents),
    stories: num(r.stories),
  };
}

export interface TickInfo {
  totalMs: number;
  status: string;
  failedAgents: { agent: string; error: string }[];
  timings: Record<string, number>;
  queries: Record<string, number>;
}

/** Writes this tick's row. Never throws: a failed health record must not fail the day. */
export async function recordHealthSnapshot(db: Db, tick: number, info: TickInfo): Promise<void> {
  try {
    const ready = (await db.query(`SELECT to_regclass('sim_health_history') IS NOT NULL AS ok`)).rows[0]?.ok;
    if (!ready) return;
    const metrics = await collectWorldMetrics(db, tick);
    if (metrics.focusedRegions > 0) {
      const regions: Record<string, RingMetrics> = {};
      const fr = await db.query(`SELECT focus_cell_id, cell_ids FROM focused_regions ORDER BY focus_cell_id`);
      for (const row of fr.rows) {
        regions[String(row.focus_cell_id)] = await collectRingMetrics(db, (row.cell_ids || []).map(Number));
      }
      metrics.regions = regions;
    }
    const steps: Record<string, { ms: number; q: number }> = {};
    for (const [name, ms] of Object.entries(info.timings || {})) {
      steps[name] = { ms: Math.round(Number(ms) || 0), q: Number(info.queries?.[name] || 0) };
    }
    await db.query(
      `INSERT INTO sim_health_history (tick, total_ms, status, failed_agents, steps, metrics)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
       ON CONFLICT (tick) DO UPDATE SET recorded_at = now(), total_ms = EXCLUDED.total_ms, status = EXCLUDED.status,
         failed_agents = EXCLUDED.failed_agents, steps = EXCLUDED.steps, metrics = EXCLUDED.metrics`,
      [tick, Math.round(info.totalMs || 0), info.status, JSON.stringify(info.failedAgents || []), JSON.stringify(steps), JSON.stringify(metrics)]
    );
  } catch (e: any) {
    console.warn(`[health] could not record tick ${tick}: ${e?.message || e}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Alarms: rules over the history, so they work the same on the live world and on soak copies.
// ---------------------------------------------------------------------------------------------------------

export interface HealthRow {
  tick: number;
  total_ms: number;
  status: string;
  failed_agents: { agent: string; error: string }[];
  steps: Record<string, { ms: number; q: number }>;
  metrics: WorldMetrics;
}

export interface Alarm {
  id: string;
  level: "warn" | "critical";
  area: "population" | "economy" | "order" | "story" | "ecology" | "engine";
  title: string;
  detail: string;
}

/** Thresholds in one place, so tuning them is a one-line change. */
export const ALARM_RULES = {
  trendWindow: 50,
  popDropWarnPct: 2,
  popDropCriticalPct: 10,
  nullShareWarnPct: 5,
  ledgerDriftWarnPct: 5,
  food0WarnPct: 10,
  food0CriticalPct: 25,
  unrest70WarnPct: 25,
  unrest70CriticalPct: 50,
  crime100WarnPct: 10,
  emptyRiseWarn: 3,
  storyRepeatWarn: 5,
  storyFloodWarn: 300,
  slowTickWarnMs: 5000,
  slowStepWarnMs: 2000,
  predatorsFloor: 1,
  plantsFloor: 10,
};

const pct = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

export function evaluateAlarms(rows: HealthRow[], extra: { storyRepeat?: { cellId: number; ruleId: string; count: number } | null } = {}): Alarm[] {
  const out: Alarm[] = [];
  if (rows.length === 0) return out;
  const R = ALARM_RULES;
  const last = rows[rows.length - 1]!;
  const m = last.metrics;
  const back = rows.find((r) => r.tick >= last.tick - R.trendWindow) ?? rows[0]!;
  const b = back.metrics;
  const span = last.tick - back.tick;

  if (span > 0 && b.popTotal > 0) {
    const drop = pct(b.popTotal - m.popTotal, b.popTotal);
    if (drop >= R.popDropWarnPct) {
      out.push({
        id: "pop_decline", level: drop >= R.popDropCriticalPct ? "critical" : "warn", area: "population",
        title: `Population down ${drop.toFixed(1)}% in ${span} ticks`,
        detail: `${b.popTotal.toLocaleString()} → ${m.popTotal.toLocaleString()}`,
      });
    }
  }
  if (m.popTotal > 0 && pct(m.popNull, m.popTotal) < R.nullShareWarnPct) {
    out.push({ id: "nulls_vanishing", level: "warn", area: "population", title: `Nulls are ${pct(m.popNull, m.popTotal).toFixed(1)}% of people`, detail: "The Null population is disappearing; check births and losses by group." });
  }
  const drift = pct(Math.abs(m.cohorts - m.popTotal), m.popTotal);
  if (m.popTotal > 0 && drift >= R.ledgerDriftWarnPct) {
    out.push({ id: "ledger_drift", level: "warn", area: "population", title: `Population ledgers differ by ${drift.toFixed(1)}%`, detail: `Towns ${m.popTotal.toLocaleString()} vs cohorts ${m.cohorts.toLocaleString()}. Run reconcileCohorts.` });
  }
  const f0 = pct(m.food0, m.burgs);
  if (f0 >= R.food0WarnPct) {
    out.push({ id: "famine", level: f0 >= R.food0CriticalPct ? "critical" : "warn", area: "economy", title: `${m.food0} towns have no food (${f0.toFixed(0)}%)`, detail: span > 0 ? `${b.food0} ${span} ticks ago` : "" });
  }
  const u70 = pct(m.unrest70, m.burgs);
  if (u70 >= R.unrest70WarnPct) {
    out.push({ id: "unrest", level: u70 >= R.unrest70CriticalPct ? "critical" : "warn", area: "order", title: `${m.unrest70} towns at unrest 70+ (${u70.toFixed(0)}%)`, detail: `${m.unrest90} of them at 90+` });
  }
  if (pct(m.crime100, m.burgs) >= R.crime100WarnPct) {
    out.push({ id: "crime", level: "warn", area: "order", title: `${m.crime100} towns at maximum crime`, detail: `Average crime ${m.crimeAvg}` });
  }
  if (span > 0 && m.emptyBurgs - b.emptyBurgs >= R.emptyRiseWarn) {
    out.push({ id: "emptying", level: "warn", area: "population", title: `${m.emptyBurgs - b.emptyBurgs} towns emptied in ${span} ticks`, detail: `${m.emptyBurgs} empty, ${m.ruins} ruins` });
  }
  if (extra.storyRepeat && extra.storyRepeat.count >= R.storyRepeatWarn) {
    const s = extra.storyRepeat;
    out.push({ id: "story_loop", level: "warn", area: "story", title: `${s.ruleId} opened ${s.count}× in cell ${s.cellId}`, detail: "The same crisis keeps reopening for one place." });
  }
  if (m.storiesOpen + m.storiesProposed >= R.storyFloodWarn) {
    out.push({ id: "story_flood", level: "warn", area: "story", title: `${m.storiesOpen + m.storiesProposed} live stories`, detail: "More open stories than a party could ever touch." });
  }
  const recent = rows.filter((r) => r.tick > last.tick - 10);
  const failed = recent.flatMap((r) => (r.failed_agents || []).map((f) => ({ tick: r.tick, ...f })));
  if (failed.length > 0) {
    const f = failed[failed.length - 1]!;
    out.push({ id: "agent_failed", level: "critical", area: "engine", title: `${failed.length} agent failure${failed.length > 1 ? "s" : ""} in the last 10 ticks`, detail: `${f.agent} at tick ${f.tick}: ${String(f.error).slice(0, 140)}` });
  }
  if (last.total_ms >= R.slowTickWarnMs) {
    out.push({ id: "slow_tick", level: "warn", area: "engine", title: `Last tick took ${(last.total_ms / 1000).toFixed(1)} s`, detail: "" });
  }
  const slowSteps = Object.entries(last.steps || {}).filter(([, s]) => s.ms >= R.slowStepWarnMs);
  if (slowSteps.length > 0) {
    out.push({ id: "slow_step", level: "warn", area: "engine", title: `Slow step: ${slowSteps.map(([n, s]) => `${n} ${s.ms} ms`).join(", ")}`, detail: "" });
  }
  if (m.ecoPredators < R.predatorsFloor) {
    out.push({ id: "predators_gone", level: "warn", area: "ecology", title: `Predators average ${m.ecoPredators}`, detail: "Predators are close to extinct world-wide." });
  }
  if (m.ecoPlants < R.plantsFloor) {
    out.push({ id: "plants_gone", level: "critical", area: "ecology", title: `Plants average ${m.ecoPlants}`, detail: "The food web has no base." });
  }
  const order = { critical: 0, warn: 1 } as const;
  return out.sort((a, b2) => order[a.level] - order[b2.level]);
}
