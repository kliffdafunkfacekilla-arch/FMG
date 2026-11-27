/**
 * Sim health API for the dashboard: per-tick history, alarms, and the numbers for each map tier
 * (global world, focused region + neighbours, ground sector + neighbours). Read-only.
 */
import { Router } from "express";
import pool from "../db/pool.js";
import {
  collectRingMetrics,
  collectWorldMetrics,
  evaluateAlarms,
  ringCellIds,
  type HealthRow,
} from "../engine/health/worldHealth.js";

export const healthRouter = Router();

const STORY_WINDOW = 200;

async function currentTick(): Promise<number> {
  const r = await pool.query(`SELECT COALESCE(MAX(tick), 0)::int AS t FROM sim_calendar`);
  return Number(r.rows[0]?.t || 0);
}

async function historyReady(): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass('sim_health_history') IS NOT NULL AS ok`);
  return !!r.rows[0]?.ok;
}

/** Last `limit` ticks (0 = all), thinned to at most `points` rows so long runs stay cheap to draw. */
async function loadHistory(limit: number, points: number): Promise<HealthRow[]> {
  if (!(await historyReady())) return [];
  const res = await pool.query(
    `SELECT tick, total_ms, status, failed_agents, steps, metrics FROM (
       SELECT * FROM sim_health_history ORDER BY tick DESC ${limit > 0 ? "LIMIT $1" : ""}
     ) h ORDER BY tick ASC`,
    limit > 0 ? [limit] : []
  );
  const rows = res.rows.map((r: any) => ({ ...r, tick: Number(r.tick), total_ms: Number(r.total_ms) })) as HealthRow[];
  if (points <= 0 || rows.length <= points) return rows;
  const step = rows.length / points;
  const out: HealthRow[] = [];
  for (let i = 0; i < points; i++) out.push(rows[Math.floor(i * step)]!);
  out[out.length - 1] = rows[rows.length - 1]!;
  return out;
}

/** The place where one crisis has opened most often recently (story loops). */
async function worstStoryRepeat(tick: number) {
  const r = await pool.query(
    `SELECT cell_id, rule_id, COUNT(*)::int AS c FROM storylines
     WHERE scale = 'thread' AND rule_id IS NOT NULL AND cell_id IS NOT NULL AND created_tick > $1
     GROUP BY cell_id, rule_id ORDER BY c DESC LIMIT 1`,
    [tick - STORY_WINDOW]
  );
  const row = r.rows[0];
  return row ? { cellId: Number(row.cell_id), ruleId: String(row.rule_id), count: Number(row.c) } : null;
}

healthRouter.get("/history", async (req, res) => {
  try {
    const limit = Math.max(0, Number(req.query.limit ?? 500) || 0);
    const points = Math.max(0, Number(req.query.points ?? 400) || 0);
    const rows = await loadHistory(limit, points);
    res.json({
      rows: rows.map((r) => ({ tick: r.tick, ms: r.total_ms, status: r.status, failed: (r.failed_agents || []).length, m: r.metrics })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Header numbers, change over 10 and 100 ticks, and the alarm list. */
healthRouter.get("/overview", async (_req, res) => {
  try {
    const tick = await currentTick();
    const rows = await loadHistory(STORY_WINDOW + 1, 0);
    const latest = rows.length ? rows[rows.length - 1]!.metrics : await collectWorldMetrics(pool, tick);
    const at = (back: number) => {
      const target = (rows[rows.length - 1]?.tick ?? tick) - back;
      const r = rows.find((x) => x.tick >= target);
      return r && r !== rows[rows.length - 1] ? r.metrics : null;
    };
    const storyRepeat = await worstStoryRepeat(tick);
    res.json({
      tick,
      recordedTicks: rows.length,
      latest,
      ago10: at(10),
      ago100: at(100),
      alarms: evaluateAlarms(rows, { storyRepeat }),
      lastTick: rows.length ? { tick: rows[rows.length - 1]!.tick, ms: rows[rows.length - 1]!.total_ms, status: rows[rows.length - 1]!.status } : null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** A focus cell and its ring: the area the meso layer steps in finer detail. */
healthRouter.get("/region/:cell", async (req, res) => {
  try {
    const cellId = Number(req.params.cell);
    if (!Number.isFinite(cellId)) return res.status(400).json({ error: "Invalid cell" });
    const focused = (await pool.query(
      `SELECT CASE WHEN to_regclass('focused_regions') IS NULL THEN NULL
              ELSE (SELECT row_to_json(f) FROM (SELECT focus_cell_id, cell_ids, focused_tick, last_meso_tick FROM focused_regions WHERE focus_cell_id = $1) f) END AS f`,
      [cellId]
    )).rows[0]?.f;
    const cellIds: number[] = focused?.cell_ids?.map(Number) ?? (await ringCellIds(pool, cellId));
    const [metrics, burgs, events, stories, cells, allFocused] = await Promise.all([
      collectRingMetrics(pool, cellIds),
      pool.query(
        `SELECT burg_id, cell_id, name, is_capital, GREATEST(pop_null, 0) + GREATEST(COALESCE(pop_attuned, 0), 0) AS pop,
                food, unrest, crime_rate, health, urban_tier
         FROM sim_burg_economy WHERE cell_id = ANY($1::int[]) ORDER BY (cell_id = $2) DESC, pop DESC`,
        [cellIds, cellId]
      ),
      pool.query(
        `SELECT tick, type, tier, message, cell_id FROM sim_events WHERE cell_id = ANY($1::int[]) ORDER BY id DESC LIMIT 10`,
        [cellIds]
      ),
      pool.query(
        `SELECT id, scale, state, question, clock, clock_max, rule_id, cell_id FROM storylines
         WHERE state IN ('proposed', 'open', 'escalated') AND cell_id = ANY($1::int[]) ORDER BY created_tick DESC LIMIT 12`,
        [cellIds]
      ),
      pool.query(
        `SELECT c.id, c.biome, f.name AS faction, round(c.eco_plants::numeric, 1) AS plants, round(c.eco_prey::numeric, 1) AS prey,
                round(c.eco_predators::numeric, 1) AS predators
         FROM sim_cells c LEFT JOIN sim_factions f ON f.id = c.faction_id WHERE c.id = ANY($1::int[]) ORDER BY (c.id = $2) DESC, c.id`,
        [cellIds, cellId]
      ),
      pool.query(`SELECT CASE WHEN to_regclass('focused_regions') IS NULL THEN '[]'::json
                  ELSE (SELECT COALESCE(json_agg(focus_cell_id ORDER BY focus_cell_id), '[]'::json) FROM focused_regions) END AS ids`),
    ]);
    // Trend for this ring, from the per-region numbers recorded while it was focused.
    const hist = focused
      ? (await pool.query(
          `SELECT tick, metrics->'regions'->$1::text AS r FROM sim_health_history
           WHERE metrics->'regions' ? $1::text ORDER BY tick DESC LIMIT 300`,
          [String(cellId)]
        )).rows.reverse().map((r: any) => ({ tick: Number(r.tick), ...r.r }))
      : [];
    res.json({
      cellId,
      focused: !!focused,
      focusedTick: focused?.focused_tick ?? null,
      lastMesoTick: focused?.last_meso_tick ?? null,
      focusedRegions: (allFocused.rows[0]?.ids || []).map(Number),
      ringCellIds: cellIds,
      metrics,
      history: hist,
      cells: cells.rows,
      burgs: burgs.rows.map((b: any) => ({ ...b, pop: Number(b.pop) })),
      events: events.rows,
      stories: stories.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** One regional sector (rx, ry in the 100x100 grid) and the 3x3 block of sectors around it. */
healthRouter.get("/ground/:cell", async (req, res) => {
  try {
    const cellId = Number(req.params.cell);
    const rx = Number(req.query.x ?? 50);
    const ry = Number(req.query.y ?? 50);
    if (![cellId, rx, ry].every(Number.isFinite)) return res.status(400).json({ error: "Invalid cell or coordinates" });
    const [layers, entities, stories, burg, events] = await Promise.all([
      pool.query(
        `SELECT rx, ry, layer_name, jsonb_array_length(COALESCE(npcs, '[]'::jsonb)) AS npcs,
                jsonb_array_length(COALESCE(props, '[]'::jsonb)) AS props, features->>'poiType' AS poi
         FROM sim_sector_layers WHERE cell_id = $1 AND z_layer = 0 AND rx BETWEEN $2 - 1 AND $2 + 1 AND ry BETWEEN $3 - 1 AND $3 + 1`,
        [cellId, rx, ry]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT kind, lod, COUNT(*)::int AS n FROM entities
         WHERE alive AND cell_id = $1 AND rx BETWEEN $2 - 1 AND $2 + 1 AND ry BETWEEN $3 - 1 AND $3 + 1
         GROUP BY kind, lod ORDER BY n DESC`,
        [cellId, rx, ry]
      ),
      pool.query(
        `SELECT id, scale, state, question, clock, clock_max, rx, ry FROM storylines
         WHERE state IN ('proposed', 'open', 'escalated') AND cell_id = $1
         ORDER BY (COALESCE(rx, 50) - $2)^2 + (COALESCE(ry, 50) - $3)^2 ASC LIMIT 8`,
        [cellId, rx, ry]
      ),
      pool.query(
        `SELECT burg_id, name, GREATEST(pop_null, 0) + GREATEST(COALESCE(pop_attuned, 0), 0) AS pop, food, unrest, crime_rate, health
         FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`,
        [cellId]
      ),
      pool.query(`SELECT tick, type, tier, message FROM sim_events WHERE cell_id = $1 ORDER BY id DESC LIMIT 6`, [cellId]),
    ]);
    const here = layers.rows.find((l: any) => Number(l.rx) === rx && Number(l.ry) === ry) || null;
    const ents = entities.rows.map((e: any) => ({ kind: e.kind, lod: e.lod, n: Number(e.n) }));
    res.json({
      cellId,
      rx,
      ry,
      sector: here ? { name: here.layer_name, npcs: Number(here.npcs), props: Number(here.props), poi: here.poi } : null,
      neighbourSectorsBuilt: layers.rows.length,
      entities: ents,
      entitiesTotal: ents.reduce((a, e) => a + e.n, 0),
      entitiesMicro: ents.filter((e) => e.lod === "micro").reduce((a, e) => a + e.n, 0),
      stories: stories.rows,
      burg: burg.rows[0] ? { ...burg.rows[0], pop: Number(burg.rows[0].pop) } : null,
      events: events.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Towns most at risk right now: hunger, unrest, crime and sickness, worst first. */
healthRouter.get("/towns", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(5, Number(req.query.limit ?? 25) || 25));
    const r = await pool.query(
      `SELECT burg_id, cell_id, name, is_capital, GREATEST(pop_null, 0) + GREATEST(COALESCE(pop_attuned, 0), 0) AS pop,
              food, unrest, crime_rate, health,
              (CASE WHEN food <= 0 THEN 30 ELSE 0 END) + unrest * 0.4 + LEAST(crime_rate, 100) * 0.2 + (100 - COALESCE(health, 100)) * 0.3 AS risk
       FROM sim_burg_economy
       WHERE pop_null + COALESCE(pop_attuned, 0) > 0
       ORDER BY risk DESC, pop DESC LIMIT $1`,
      [limit]
    );
    res.json({ towns: r.rows.map((t: any) => ({ ...t, pop: Number(t.pop), risk: Math.round(Number(t.risk)) })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Story health over the last STORY_WINDOW ticks: loops, hogged actors, how arcs end, how much of the map gets stories. */
healthRouter.get("/stories", async (_req, res) => {
  try {
    const tick = await currentTick();
    const since = tick - STORY_WINDOW;
    const [repeats, actors, outcomes, coverage] = await Promise.all([
      pool.query(
        `SELECT s.cell_id, s.rule_id, COUNT(*)::int AS c, MAX(b.name) AS place
         FROM storylines s LEFT JOIN sim_burg_economy b ON b.cell_id = s.cell_id
         WHERE s.scale = 'thread' AND s.rule_id IS NOT NULL AND s.created_tick > $1
         GROUP BY s.cell_id, s.rule_id ORDER BY c DESC LIMIT 8`,
        [since]
      ),
      pool.query(
        `SELECT a AS actor, COUNT(*)::int AS c FROM storylines, unnest(actor_ids) a
         WHERE created_tick > $1 GROUP BY a ORDER BY c DESC LIMIT 8`,
        [since]
      ),
      pool.query(
        `SELECT scale, state, COUNT(*)::int AS c FROM storylines
         WHERE created_tick > $1 OR state IN ('proposed', 'open', 'escalated') GROUP BY scale, state ORDER BY scale, state`,
        [since]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT cell_id)::int AS cells, COUNT(DISTINCT a)::int AS actors, COUNT(DISTINCT rule_id)::int AS kinds
         FROM storylines LEFT JOIN LATERAL unnest(actor_ids) a ON true WHERE created_tick > $1`,
        [since]
      ),
    ]);
    res.json({
      window: STORY_WINDOW,
      repeats: repeats.rows,
      actors: actors.rows,
      outcomes: outcomes.rows,
      coverage: coverage.rows[0] || { cells: 0, actors: 0, kinds: 0 },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Engine cost per step over recent ticks, the slowest ticks, and recent agent failures. */
healthRouter.get("/engine", async (req, res) => {
  try {
    const window = Math.min(1000, Math.max(5, Number(req.query.window ?? 50) || 50));
    const rows = await loadHistory(window, 0);
    const agg = new Map<string, { ms: number; q: number; max: number; n: number }>();
    for (const r of rows) {
      for (const [name, s] of Object.entries(r.steps || {})) {
        const a = agg.get(name) || { ms: 0, q: 0, max: 0, n: 0 };
        a.ms += s.ms; a.q += s.q; a.max = Math.max(a.max, s.ms); a.n++;
        agg.set(name, a);
      }
    }
    const steps = [...agg.entries()]
      .map(([step, a]) => ({ step, avgMs: Math.round(a.ms / a.n), maxMs: a.max, avgQueries: Math.round(a.q / a.n) }))
      .sort((a, b) => b.avgMs - a.avgMs);
    const failures = rows.flatMap((r) => (r.failed_agents || []).map((f) => ({ tick: r.tick, ...f }))).slice(-10).reverse();
    const slowest = [...rows].sort((a, b) => b.total_ms - a.total_ms).slice(0, 5).map((r) => ({ tick: r.tick, ms: r.total_ms }));
    const avgMs = rows.length ? Math.round(rows.reduce((a, r) => a + r.total_ms, 0) / rows.length) : 0;
    res.json({ window: rows.length, avgMs, steps, failures, slowest });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
