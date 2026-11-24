import { Router } from "express";
import pool from "../db/pool";
import { executeMasterTick, type TickResult } from "../engine/masterOrchestrator";
import { resetWorld } from "../engine/resetWorld";
import { FACTION_SPECIALTIES } from "../engine/economy/factionSpecialties";
import { VERGE_COORD } from "../engine/canon/dragonPrisons.js";
import { addCellTags, loadCellTagMap } from "../engine/cellTags.js";

const observerRouter = Router();
type Db = { query: (text: string, params?: any[]) => Promise<any> };

function safeParseJson<T>(raw: any, fallback: T): T {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === "string") {
        try { return (JSON.parse(raw) ?? fallback) as T; } catch { return fallback; }
    }
    return raw as T;
}

export async function resolveBorderWarPair(
    db: Db,
    cellId: number
): Promise<{ myFactionId: number; enemyFactionId: number }> {
    const cellRes = await db.query("SELECT faction_id FROM sim_cells WHERE id = $1", [cellId]);
    let myFactionId = Number(cellRes.rows[0]?.faction_id || 0);
    if (myFactionId <= 0) {
        const firstFacRes = await db.query("SELECT id FROM sim_factions WHERE id > 0 ORDER BY id ASC LIMIT 1");
        myFactionId = Number(firstFacRes.rows[0]?.id || 29);
    }

    const borderRes = await db.query(
        `SELECT CASE WHEN faction_a = $1 THEN faction_b ELSE faction_a END AS enemy_id
         FROM sim_faction_borders
         WHERE (faction_a = $1 AND faction_b > 0) OR (faction_b = $1 AND faction_a > 0)
         ORDER BY id ASC
         LIMIT 1`,
        [myFactionId]
    );
    let enemyFactionId = Number(borderRes.rows[0]?.enemy_id || 0);
    if (enemyFactionId <= 0 || enemyFactionId === myFactionId) {
        const altRes = await db.query(
            "SELECT id FROM sim_factions WHERE id > 0 AND id <> $1 ORDER BY id ASC LIMIT 1",
            [myFactionId]
        );
        enemyFactionId = Number(altRes.rows[0]?.id || (myFactionId === 29 ? 30 : 29));
    }
    return { myFactionId, enemyFactionId };
}

observerRouter.get("/economy/specialties", async (req, res) => {
    try {
        const embargoesRes = await pool.query(`
            SELECT d.id, d.faction_a_id, d.faction_b_id, d.status, d.tension,
                   f1.name AS faction1_name, f2.name AS faction2_name
            FROM sim_diplomacy d
            JOIN sim_factions f1 ON d.faction_a_id = f1.id
            JOIN sim_factions f2 ON d.faction_b_id = f2.id
            WHERE d.status = 'WAR'
            ORDER BY d.id DESC
        `);

        const tradeEventsRes = await pool.query(`
            SELECT id, tick, type, message, tier, lore_date, burg_id, faction_id, outlaw_id
            FROM sim_events
            WHERE type IN ('CARAVAN_DISPATCH', 'INTER_FACTION_TRADE', 'CARAVAN_RAIDED', 'TRADE_EMBARGO_CHOKEPOINT')
            ORDER BY id DESC LIMIT 40
        `);

        const [shipmentsRes, countsRes, marketsRes, goodsRes, commodityRes] = await Promise.all([
            pool.query(`
                SELECT s.id, s.source_burg_id, sb.name AS source_burg_name,
                       s.dest_burg_id, db.name AS dest_burg_name,
                       s.source_faction_id, s.dest_faction_id,
                       s.transport_mode, s.good_id, s.good_key, s.good_name,
                       s.quantity, s.unit_price, s.total_gold, s.tariff_gold,
                       s.guard_count, s.current_cell_id, s.path_index,
                       jsonb_array_length(COALESCE(s.path_cells, '[]'::jsonb))::int AS path_length,
                       s.status, s.dispatched_tick, s.eta_ticks, s.resolved_tick,
                       s.merchant_citizen_id, p.name AS merchant_name
                FROM sim_trade_shipments s
                LEFT JOIN sim_burg_economy sb ON sb.burg_id = s.source_burg_id
                LEFT JOIN sim_burg_economy db ON db.burg_id = s.dest_burg_id
                LEFT JOIN population_demographics p ON p.citizen_id = s.merchant_citizen_id
                ORDER BY CASE WHEN s.status = 'IN_TRANSIT' THEN 0 ELSE 1 END, s.id DESC
                LIMIT 80
            `).catch(() => ({ rows: [] })),
            pool.query(`SELECT status, COUNT(*)::int AS count FROM sim_trade_shipments GROUP BY status`)
                .catch(() => ({ rows: [] })),
            pool.query(`
                SELECT m.id, m.center_burg_id, b.name AS center_burg_name, m.fee_paid, m.goods
                FROM sim_markets m
                LEFT JOIN sim_burg_economy b ON b.burg_id = m.center_burg_id
                ORDER BY m.id ASC
            `).catch(() => ({ rows: [] })),
            pool.query(`SELECT id, name, value FROM sim_goods ORDER BY id ASC`).catch(() => ({ rows: [] })),
            pool.query(`
                SELECT commodity, base_price, current_price, global_supply, global_demand, last_updated_tick
                FROM sim_commodity_prices
                ORDER BY commodity ASC
            `).catch(() => ({ rows: [] }))
        ]);

        const shipmentCounts: Record<string, number> = { IN_TRANSIT: 0, DELIVERED: 0, INTERCEPTED: 0, ABORTED: 0 };
        for (const r of countsRes.rows) {
            shipmentCounts[String(r.status || "IN_TRANSIT")] = Number(r.count || 0);
        }

        const goodMetaById = new Map<number, { name: string; value: number }>();
        for (const g of goodsRes.rows) {
            goodMetaById.set(Number(g.id), { name: String(g.name || `Good #${g.id}`), value: Number(g.value || 1) });
        }

        const markets = marketsRes.rows.map((m: any) => {
            const goodsObj = safeParseJson<Record<string, { price?: number; stock?: number }>>(m.goods, {});
            const entries = Object.entries(goodsObj).map(([gidStr, info]) => {
                const gid = Number(gidStr);
                const meta = goodMetaById.get(gid) || { name: `Good #${gid}`, value: 1 };
                const price = Number(info?.price || meta.value);
                const stock = Number(info?.stock || 0);
                return {
                    goodId: gid,
                    name: meta.name,
                    price: Math.round(price * 100) / 100,
                    baseValue: meta.value,
                    stock: Math.round(stock * 10) / 10,
                    ratio: price / Math.max(0.1, meta.value)
                };
            });
            const totalStock = Math.round(entries.reduce((s, e) => s + e.stock, 0));
            const topGoods = entries
                .filter((e) => e.stock > 0 || e.ratio > 1.05)
                .sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || b.ratio - a.ratio || b.stock - a.stock || a.goodId - b.goodId)
                .slice(0, 4);
            return {
                id: Number(m.id),
                center_burg_id: Number(m.center_burg_id || 0),
                center_burg_name: String(m.center_burg_name || `Market #${m.id}`),
                fee_paid: Number(m.fee_paid || 0),
                trackedGoodsCount: entries.length,
                totalStock,
                topGoods
            };
        });

        res.json({
            status: "ok",
            specialties: Object.values(FACTION_SPECIALTIES),
            activeEmbargoes: embargoesRes.rows,
            recentTradeEvents: tradeEventsRes.rows,
            shipments: shipmentsRes.rows,
            shipmentCounts,
            markets,
            commodityPrices: commodityRes.rows
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Active physical trade convoys for 2D map overlay
observerRouter.get("/shipments", async (req, res) => {
    try {
        const rowsRes = await pool.query(`
            SELECT s.id, s.source_burg_id, sb.name AS source_burg_name, sb.cell_id AS source_cell_id,
                   s.dest_burg_id, db.name AS dest_burg_name, db.cell_id AS dest_cell_id,
                   s.transport_mode, s.good_key, s.good_name, s.quantity,
                   s.total_gold, s.tariff_gold, s.guard_count,
                   s.current_cell_id, s.path_cells, s.path_index, s.eta_ticks, s.dispatched_tick,
                   p.name AS merchant_name
            FROM sim_trade_shipments s
            LEFT JOIN sim_burg_economy sb ON sb.burg_id = s.source_burg_id
            LEFT JOIN sim_burg_economy db ON db.burg_id = s.dest_burg_id
            LEFT JOIN population_demographics p ON p.citizen_id = s.merchant_citizen_id
            WHERE s.status = 'IN_TRANSIT'
            ORDER BY s.id ASC
            LIMIT 150
        `).catch(() => ({ rows: [] }));

        res.json({
            shipments: rowsRes.rows.map((r: any) => ({
                ...r,
                path_cells: safeParseJson<number[]>(r.path_cells, [])
            }))
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// World trouble threads feed across all cells
observerRouter.get("/threads", async (req, res) => {
    try {
        const threadsRes = await pool.query(`
            SELECT t.*, b.burg_id, b.name AS burg_name
            FROM sim_threads t
            LEFT JOIN LATERAL (
                SELECT burg_id, name FROM sim_burg_economy WHERE cell_id = t.cell_id ORDER BY burg_id ASC LIMIT 1
            ) b ON true
            ORDER BY CASE WHEN t.state = 'escalated' THEN 0 WHEN t.state = 'open' THEN 1 ELSE 2 END, t.id DESC
            LIMIT 100
        `).catch(() => ({ rows: [] }));

        const countsRes = await pool.query(`SELECT state, COUNT(*)::int AS c FROM sim_threads GROUP BY state`)
            .catch(() => ({ rows: [] }));
        const counts: Record<string, number> = { open: 0, escalated: 0, resolved: 0, expired: 0 };
        for (const r of countsRes.rows) counts[String(r.state || "open")] = Number(r.c || 0);

        const paragonIds = new Set<number>();
        const citizenIds = new Set<number>();
        const agentIds = new Set<number>();
        for (const t of threadsRes.rows) {
            const list: string[] = Array.isArray(t.actor_ids) ? t.actor_ids : [];
            for (const raw of list) {
                const [prefix, idStr] = String(raw).split(":");
                const n = Number(idStr);
                if (!Number.isInteger(n) || n <= 0) continue;
                if (prefix === "paragon") paragonIds.add(n);
                else if (prefix === "citizen") citizenIds.add(n);
                else if (prefix === "agent") agentIds.add(n);
            }
        }

        const actorNames = new Map<string, string>();
        if (paragonIds.size > 0) {
            const pr = await pool.query(`SELECT id, name, title FROM sim_paragons WHERE id = ANY($1::int[])`, [Array.from(paragonIds)]);
            for (const r of pr.rows) actorNames.set(`paragon:${r.id}`, `${r.title ? `${r.title} ` : ""}${r.name}`);
        }
        if (citizenIds.size > 0) {
            const cr = await pool.query(`SELECT citizen_id, name, profession FROM population_demographics WHERE citizen_id = ANY($1::int[])`, [Array.from(citizenIds)]);
            for (const r of cr.rows) actorNames.set(`citizen:${r.citizen_id}`, `${r.name}${r.profession ? ` (${r.profession})` : ""}`);
        }
        if (agentIds.size > 0) {
            const ar = await pool.query(`SELECT id, name, role FROM sim_agents WHERE id = ANY($1::int[])`, [Array.from(agentIds)]);
            for (const r of ar.rows) actorNames.set(`agent:${r.id}`, `${r.name}${r.role ? ` (${r.role})` : ""}`);
        }

        const threads = threadsRes.rows.map((t: any) => ({
            ...t,
            actors: (Array.isArray(t.actor_ids) ? t.actor_ids : []).map((aid: string) => ({
                id: aid,
                label: actorNames.get(aid) || aid
            }))
        }));

        res.json({ threads, counts });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
export interface TickHealthSummary {
  tick: number;
  totalMs: number;
  status: "success" | "partial";
  failedAgents: { agent: string; error: string }[];
  slowestSteps: { step: string; ms: number; queries: number }[];
  at: string;
}

/** Summarizes total duration, failure state, and top-3 slowest pipeline steps for /status. */
export function summarizeTickHealth(
  result: TickResult,
  at = new Date().toISOString()
): TickHealthSummary {
  const slowestSteps = Object.entries(result.timings || {})
    .map(([step, ms]) => ({
      step,
      ms: Math.round(Number(ms) || 0),
      queries: Number(result.queries?.[step] || 0),
    }))
    .sort((a, b) => b.ms - a.ms || a.step.localeCompare(b.step))
    .slice(0, 3);

  const failedAgents = Array.isArray(result.failedAgents)
    ? result.failedAgents.map((f) => ({
        agent: String(f.agent),
        error: String(f.error),
      }))
    : [];

  return {
    tick: Number(result.currentTick || 0),
    totalMs: Math.round(Number(result.totalMs) || 0),
    status: result.status === "partial" || failedAgents.length > 0 ? "partial" : "success",
    failedAgents,
    slowestSteps,
    at,
  };
}

let tickInProgress = false;
let resetInProgress = false;
// The last tick failure (manual, batch or autoplay), so the dashboard can show it. Cleared by the next good tick.
let lastTickError: { tick: number | null; message: string; at: string } | null = null;
let lastTickHealth: TickHealthSummary | null = null;

async function currentTick(): Promise<number | null> {
  const r = await pool.query("SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1");
  return r.rows[0] ? Number(r.rows[0].tick) : null;
}

/** Runs one tick under the shared lock and records success or failure for /status. */
async function runTrackedTick() {
  try {
    const result = await executeMasterTick();
    lastTickHealth = summarizeTickHealth(result);
    // A partial day committed, but some agents' work was rolled back: show which on the dashboard
    lastTickError = result.failedAgents.length
      ? { tick: result.currentTick, message: `Agents rolled back: ${result.failedAgents.map(f => `${f.agent} (${f.error})`).join("; ")}`, at: new Date().toISOString() }
      : null;
    return result;
  } catch (e: any) {
    lastTickError = { tick: await currentTick().catch(() => null), message: e?.message || String(e), at: new Date().toISOString() };
    throw e;
  }
}

let autoplayTimer: any = null;
observerRouter.post("/autoplay", (req, res) => {
    const { enabled } = req.body;
    if (enabled && !autoplayTimer) {
        autoplayTimer = setInterval(async () => {
            if (!tickInProgress && !resetInProgress) {
                tickInProgress = true;
                try { await runTrackedTick(); } catch(e) { console.error("Autoplay tick err", e); }
                tickInProgress = false;
            }
        }, 1500);
    } else if (!enabled && autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
    res.json({ autoplay: !!autoplayTimer });
});
observerRouter.get("/autoplay", (req, res) => {
    res.json({ autoplay: !!autoplayTimer });
});

// Cheap poll target: the dashboard polls this and refetches everything else only when `tick` changes.
observerRouter.get("/status", async (req, res) => {
  try {
    res.json({ tick: await currentTick(), tickInProgress, resetInProgress, autoplay: !!autoplayTimer, lastTickError, lastTickHealth });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Static cell geometry and terrain. Large (~11 MB): the dashboard loads it once per page.
// Ordered by id so /map_live columns line up with it.
observerRouter.get("/map", async (req, res) => {
  try {
    const z = parseInt(req.query.z as string) || 0;
    const cells = await pool.query(`SELECT id, faction_id, biome, center_x, center_y, geometry, eco_plants, eco_prey, eco_predators, eco_resources, elevation, z_layer FROM sim_cells WHERE z_layer = $1 ORDER BY id`, [z]);
    res.json({ cells: cells.rows.map(c => ({ ...c, geometry: typeof c.geometry === "string" ? (function(){ try { return JSON.parse(c.geometry); } catch(e) { return null; } })() : c.geometry })) });
  } catch(e: any) {
    res.status(500).json({error: e.message});
  }
});

// The per-cell values the simulation changes every tick (owner and ecology), as parallel columns in id order.
// The dashboard merges these into the geometry it loaded from /map, instead of reloading 11 MB.
observerRouter.get("/map_live", async (req, res) => {
  try {
    const z = parseInt(req.query.z as string) || 0;
    const r = await pool.query(
      `SELECT id, faction_id, round(eco_plants::numeric, 1) AS p, round(eco_prey::numeric, 1) AS y, round(eco_predators::numeric, 1) AS d
       FROM sim_cells WHERE z_layer = $1 ORDER BY id`, [z]);
    res.json({
      tick: await currentTick(),
      id: r.rows.map(c => c.id),
      faction_id: r.rows.map(c => c.faction_id),
      eco_plants: r.rows.map(c => c.p === null ? null : Number(c.p)),
      eco_prey: r.rows.map(c => c.y === null ? null : Number(c.y)),
      eco_predators: r.rows.map(c => c.d === null ? null : Number(c.d)),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// What the dashboard header, faction list, event feed and unrest overlay need. Fetched once per tick.
observerRouter.get("/state", async (req, res) => {
  try {
    const [factions, events, economy, calendar] = await Promise.all([
      pool.query("SELECT id, name, color, trait_aggression, treasury FROM sim_factions ORDER BY id"),
      pool.query("SELECT * FROM sim_events ORDER BY tick DESC, id DESC LIMIT 100"),
      pool.query("SELECT b.burg_id, b.cell_id, b.unrest, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id"),
      pool.query("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1"),
    ]);
    res.json({
      factions: factions.rows,
      events: events.rows,
      economy: economy.rows,
      calendar: calendar.rows[0] || null,
      tickInProgress,
      resetInProgress,
    });
  } catch (error: any) {
    console.error("Observer state error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

observerRouter.post("/tick", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: autoplayTimer ? "Autoplay is running: stop it to step by hand." : "A tick is already running. Please wait." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "World reset in progress. Please wait." });
  }

  tickInProgress = true;
  try {
    const result = await runTrackedTick();
    res.json(result);
  } catch (error: any) {
    console.error("Tick error:", error.stack);
    res.status(500).json({ error: error.message || "Tick failed" });
  } finally {
    tickInProgress = false;
  }
});

// Run batch ticks at will (1, 5, 10)
observerRouter.post("/batch_ticks", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: autoplayTimer ? "Autoplay is running: stop it to step by hand." : "A tick is already running. Please wait." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "World reset in progress. Please wait." });
  }

  const count = Math.min(Math.max(Number(req.body.count || 1), 1), 25);
  tickInProgress = true;
  try {
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = await runTrackedTick();
      results.push(r);
    }
    res.json({
      success: true,
      countRun: results.length,
      finalTick: results[results.length - 1]?.currentTick,
      ticks: results
    });
  } catch (error: any) {
    console.error("Batch tick error:", error.stack);
    res.status(500).json({ error: error.message || "Batch tick failed" });
  } finally {
    tickInProgress = false;
  }
});

// Sector data: every burg, the 12 Dragon Prisons, and the Verge
observerRouter.get("/sectors", async (req, res) => {
  try {
    const burgsRes = await pool.query(`
      SELECT b.burg_id, b.name, b.cell_id, b.food, b.wealth, b.unrest, b.urban_tier,
             b.pop_null, COALESCE(b.pop_attuned, 0)::int AS pop_attuned,
             (COALESCE(b.pop_null, 0) + COALESCE(b.pop_attuned, 0))::int AS total_pop,
             b.crime_rate, b.occupier_faction_id,
             c.faction_id, f.name as faction_name, f.color as faction_color
      FROM sim_burg_economy b
      LEFT JOIN sim_cells c ON b.cell_id = c.id
      LEFT JOIN sim_factions f ON COALESCE(b.occupier_faction_id, c.faction_id) = f.id
      ORDER BY b.name ASC
    `);

    const paragonsRes = await pool.query(`
      SELECT id, burg_id, name, title, traits, corruption_score
      FROM sim_paragons
      WHERE burg_id IS NOT NULL
      ORDER BY id ASC
    `);

    const layersRes = await pool.query(`
      SELECT DISTINCT ON (cell_id) cell_id, features
      FROM sim_sector_layers
      WHERE z_layer = 0
      ORDER BY cell_id, created_at DESC
    `);
    // Tags live per cell (engine/cellTags.ts), not only on rendered tactical layers.
    const tagMap = await loadCellTagMap(pool);
    const featuresByCell = new Map<number, any>();
    for (const r of layersRes.rows) featuresByCell.set(Number(r.cell_id), { ...(r.features || {}) });
    for (const [cellId, tags] of tagMap) {
      featuresByCell.set(cellId, { ...(featuresByCell.get(cellId) || {}), environmental_tags: tags });
    }

    const grovesRes = await pool.query(`
      SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength,
             COALESCE((SELECT COUNT(*)::int FROM sim_agents a WHERE a.role = 'Warden' AND a.target_grove_id = g.id), 0) AS warden_count,
             COALESCE((SELECT COUNT(*)::int FROM sim_agents a WHERE a.role = 'Cultist' AND a.target_grove_id = g.id), 0) AS cultist_count
      FROM sim_sacred_groves g
      ORDER BY g.id ASC
    `);

    // The Verge: where all twelve flows meet and drain (Canon/03 §1 item 5).
    const flowsRes = await pool.query(`
      SELECT flow_id, name, dragon_name, elemental_power, current_surge
      FROM sim_chaos_flows ORDER BY flow_id
    `);

    res.json({
      burgs: burgsRes.rows,
      paragons: paragonsRes.rows,
      sectorFeatures: Array.from(featuresByCell, ([cell_id, features]) => ({ cell_id, features })),
      prisons: grovesRes.rows,
      verge: {
        name: "The Verge",
        cell_id: VERGE_COORD.cell,
        description: "All twelve flows meet at the Verge: a crater at the head of the Engineer's Range, with a permanent chaos storm and the floating ruin of the Fae capital at its heart, and the Sacred Spire on its rim. It drains chaos back into the void (Canon/03).",
        flows: flowsRes.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get fringe factions detail with their established subterranean lairs
observerRouter.get("/fringe_detail", async (req, res) => {
  try {
    const factionsRes = await pool.query(`
      SELECT o.*,
             COALESCE(SUM(l.manpower), 0)::int AS lair_manpower,
             (COALESCE(o.manpower, 0) + COALESCE(SUM(l.manpower), 0))::int AS total_manpower
      FROM sim_outlaw_factions o
      LEFT JOIN sim_fringe_lairs l ON l.faction_id = o.id
      GROUP BY o.id, o.name, o.type, o.origin_cell_id, o.manpower, o.worker_groups, o.wealth, o.heat, o.description, o.contraband_types
      ORDER BY o.name ASC
    `);
    const lairsRes = await pool.query(`
      SELECT l.*, b.name as burg_name
      FROM sim_fringe_lairs l
      LEFT JOIN sim_burg_economy b ON l.burg_id = b.burg_id
      ORDER BY l.id ASC
    `);
    res.json({
      factions: factionsRes.rows,
      lairs: lairsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Filtered event log API for specific sectors, burgs, or fringe factions
observerRouter.get("/filtered_events", async (req, res) => {
  try {
    const { burg_id, burg_name, faction_id, cell_id, keyword, tier, limit = 150 } = req.query;
    let query = "SELECT * FROM sim_events WHERE 1=1";
    const params: any[] = [];

    if (burg_id) {
      if (burg_name) {
        params.push(Number(burg_id));
        params.push(`%${burg_name}%`);
        query += ` AND (burg_id = $${params.length - 1} OR message ILIKE $${params.length})`;
      } else {
        params.push(Number(burg_id));
        query += ` AND burg_id = $${params.length}`;
      }
    }
    // Fringe (outlaw) factions: their events carry outlaw_id. Older events stored the outlaw id in
    // faction_id, where it collides with sovereign ids, so those are matched by name instead.
    const outlawId = (req.query as any).outlaw_id;
    if (outlawId) {
      params.push(Number(outlawId));
      if (keyword) {
        params.push(`%${keyword}%`);
        query += ` AND (outlaw_id = $${params.length - 1} OR message ILIKE $${params.length})`;
      } else {
        query += ` AND outlaw_id = $${params.length}`;
      }
    } else if (faction_id && keyword) {
      params.push(Number(faction_id));
      params.push(`%${keyword}%`);
      query += ` AND (faction_id = $${params.length - 1} OR message ILIKE $${params.length})`;
    } else if (faction_id) {
      params.push(Number(faction_id));
      query += ` AND faction_id = $${params.length}`;
    } else if (keyword) {
      const kw = String(keyword).trim();
      if (kw.toLowerCase() === 'verge') {
        // The Verge drains all twelve flows: its feed is the flow and surge events plus anything naming it or the Spire.
        query += ` AND (message ILIKE '%Verge%' OR message ILIKE '%Sacred Spire%' OR type IN ('CHAOS_SURGE', 'SHADOW_WEEK_ECLIPSE'))`;
      } else {
        params.push(`%${kw}%`);
        query += ` AND (message ILIKE $${params.length} OR type ILIKE $${params.length})`;
      }
    }
    if (tier && tier !== 'ALL') {
      params.push(tier);
      query += ` AND tier = $${params.length}`;
    }

    query += ` ORDER BY id DESC LIMIT ${Math.min(Number(limit), 300)}`;

    const eventsRes = await pool.query(query, params);
    res.json({ events: eventsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive Trophic Ecology telemetry: flora, fauna, predator-prey balance, and active anomalies
observerRouter.get("/ecology", async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT 
        ROUND(AVG(eco_plants)::numeric, 1) as avg_plants,
        ROUND(AVG(eco_prey)::numeric, 1) as avg_prey,
        ROUND(AVG(eco_predators)::numeric, 1) as avg_predators,
        ROUND(AVG(COALESCE(eco_apex, 5.0))::numeric, 1) as avg_apex,
        ROUND(AVG(COALESCE(eco_blight, 0.0))::numeric, 1) as avg_blight
      FROM sim_cells
    `);

    // Hotspots first, then each one's nearest burg by map distance (it used ABS(cell_id - id) <= 6,
    // which compares cell id numbers, not places, and also returned one row per matching burg)
    const predatorHotspots = await pool.query(`
      SELECT h.cell_id, h.eco_predators, h.eco_prey, nb.name AS nearby_burg
      FROM (
        SELECT c.id AS cell_id, c.eco_predators, c.eco_prey, c.center_x, c.center_y
        FROM sim_cells c
        WHERE c.eco_predators > (c.eco_prey * 1.2) AND c.eco_predators >= 15
        ORDER BY c.eco_predators DESC LIMIT 5
      ) h
      LEFT JOIN LATERAL (
        SELECT b.name FROM sim_burg_economy b JOIN sim_cells bc ON bc.id = b.cell_id
        ORDER BY (bc.center_x - h.center_x) ^ 2 + (bc.center_y - h.center_y) ^ 2 LIMIT 1
      ) nb ON true
      ORDER BY h.eco_predators DESC
    `);

    const chaosFloraHotspots = await pool.query(`
      SELECT h.cell_id, h.eco_plants, h.intensity, h.chaos_type, nb.name AS nearby_burg
      FROM (
        SELECT c.id AS cell_id, c.eco_plants, z.intensity, z.type AS chaos_type, c.center_x, c.center_y
        FROM sim_cells c JOIN sim_chaos_zones z ON c.id = z.cell_id
        WHERE z.intensity >= 30
        ORDER BY z.intensity DESC LIMIT 5
      ) h
      LEFT JOIN LATERAL (
        SELECT b.name FROM sim_burg_economy b JOIN sim_cells bc ON bc.id = b.cell_id
        ORDER BY (bc.center_x - h.center_x) ^ 2 + (bc.center_y - h.center_y) ^ 2 LIMIT 1
      ) nb ON true
      ORDER BY h.intensity DESC
    `);

    const eventsRes = await pool.query(`
      SELECT * FROM sim_events
      WHERE type IN ('FLORA_MUTAGENESIS', 'HERBIVORE_CROP_RAID', 'STARVING_PREDATOR_MIGRATION', 'CHAOS_BEAST_MUTATION', 'TROPHIC_DISRUPTION')
      ORDER BY id DESC
      LIMIT 20
    `);

    res.json({
      averages: statsRes.rows[0],
      predatorHotspots: predatorHotspots.rows,
      chaosFloraHotspots: chaosFloraHotspots.rows,
      recentEvents: eventsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// The 12 Primordial Chaos Flows & Narrow Crossings
observerRouter.get("/chaos_flows", async (req, res) => {
  try {
    const flowsRes = await pool.query(`SELECT * FROM sim_chaos_flows ORDER BY flow_id ASC`);
    const calRes = await pool.query(`SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1`);
    const zonesSummary = await pool.query(`SELECT COUNT(*) as total_zones, ROUND(AVG(intensity)::numeric, 1) as avg_intensity FROM sim_chaos_zones`);

    const flows = flowsRes.rows.map(f => ({
      ...f,
      waypoints: typeof f.waypoints === "string" ? JSON.parse(f.waypoints) : f.waypoints,
      narrow_spots: typeof f.narrow_spots === "string" ? JSON.parse(f.narrow_spots) : f.narrow_spots,
      is_surging: Number(f.current_surge) >= 1.8,
      is_flooding: Number(f.current_surge) >= 2.4
    }));

    res.json({
      flows,
      calendar: calRes.rows[0] || null,
      zonesSummary: zonesSummary.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get notable citizens in a burg, highlighting their active narrative tags, stockpile & workforce
observerRouter.get("/burg_citizens", async (req, res) => {
  try {
    const { burg_id, limit = 20 } = req.query;
    if (!burg_id) {
      return res.status(400).json({ error: "burg_id is required" });
    }
    const burgIdNum = Number(burg_id);
    const citizensRes = await pool.query(`
      SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation, traits, life_stage, age
      FROM population_demographics
      WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
      ORDER BY 
        CASE WHEN traits::text LIKE '%#%' THEN 0 ELSE 1 END,
        citizen_id ASC
      LIMIT $2
    `, [burgIdNum, Math.min(Number(limit), 50)]);

    const paragonsRes = await pool.query(`
      SELECT id, name, title, traits, corruption_score
      FROM sim_paragons
      WHERE burg_id = $1
    `, [burgIdNum]);

    const stockpileRes = await pool.query(`
      SELECT s.complex_inventory, b.resource_profile
      FROM sim_burg_economy b
      LEFT JOIN sim_industrial_stockpiles s ON s.burg_id = b.burg_id
      WHERE b.burg_id = $1
    `, [burgIdNum]);

    const workforceRes = await pool.query(`
      SELECT COALESCE(profession, 'Unassigned') AS profession,
             COUNT(*) FILTER (WHERE allegiance_status = 'CIVILIAN')::int AS active_records,
             COUNT(*) FILTER (WHERE allegiance_status = 'ON_CARAVAN')::int AS on_caravan_records,
             COALESCE(SUM(unit_size), 0)::int AS people
      FROM population_demographics
      WHERE settlement_id = $1
        AND life_stage = 'ADULT'
        AND allegiance_status IN ('CIVILIAN', 'ON_CARAVAN')
      GROUP BY profession
      ORDER BY active_records DESC, on_caravan_records DESC, profession ASC
    `, [burgIdNum]);

    const sRow = stockpileRes.rows[0];
    res.json({
      burg_id: burgIdNum,
      citizens: citizensRes.rows,
      paragons: paragonsRes.rows,
      stockpile: safeParseJson<Record<string, number>>(sRow?.complex_inventory, {}),
      resourceProfile: safeParseJson<any>(sRow?.resource_profile, {}),
      workforce: workforceRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive Metaphysics & Cosmic Telemetry: Dragon Prisons, Grey Wardens, Eyeless Elders, Ancient Wards & Cults
observerRouter.get("/metaphysics", async (req, res) => {
  try {
    const grovesRes = await pool.query(`
      SELECT id, cell_id, dragon_name, power_domain, seal_strength
      FROM sim_sacred_groves
      ORDER BY seal_strength ASC
    `);

    const wardsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_wards,
        COUNT(*) FILTER (WHERE is_charged = true) as charged_wards,
        COUNT(*) FILTER (WHERE is_charged = false) as recharging_wards
      FROM sim_ancient_path_wards
    `);

    const wardensRes = await pool.query(`
      SELECT sub_role, state, COUNT(*) as count, ROUND(AVG(corruption)::numeric, 1) as avg_corruption, ROUND(AVG(age_ticks)::numeric, 1) as avg_age
      FROM sim_agents
      WHERE role = 'Warden'
      GROUP BY sub_role, state
    `);

    const cultistsRes = await pool.query(`
      SELECT state, sub_role, COUNT(*) as count, ROUND(AVG(corruption)::numeric, 1) as avg_corruption
      FROM sim_agents
      WHERE role = 'Cultist'
      GROUP BY state, sub_role
    `);

    const hermitsRes = await pool.query(`
      SELECT COUNT(*) as mad_hermits FROM sim_agents WHERE role = 'Mad_Hermit'
    `);

    const recentEventsRes = await pool.query(`
      SELECT tick, type, message, tier, cell_id, lore_date
      FROM sim_events
      WHERE type IN (
        'WARDEN_FINAL_SACRIFICE',
        'WARDEN_ANCIENT_WARD_AWAKENING',
        'SPARKBORN_DRIVEN_MAD',
        'WARDEN_VOW_TAKEN',
        'WARDEN_BECOMES_EYELESS_ELDER',
        'EYELESS_ELDER_CRYPT_VIGIL',
        'WORLD_ENDING_APOCALYPSE',
        'CULT_PRIEST_ASCENSION',
        'WARDEN_CLASH'
      )
      ORDER BY id DESC
      LIMIT 25
    `);

    res.json({
      dragon_groves: grovesRes.rows,
      ancient_wards: wardsRes.rows[0],
      wardens: wardensRes.rows,
      cultists: cultistsRes.rows,
      mad_hermits: parseInt(hermitsRes.rows[0]?.mad_hermits || '0'),
      recent_events: recentEventsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Controlled Instability Crises (Famine & Bandits, Chaos Surge & Abandonment, Hard Winter, Corrupt Leader Embargo, Border War)
observerRouter.post("/trigger_crisis", async (req, res) => {
  try {
    const { type, cellId: rawCellId, burgId: rawBurgId, intensity = 85 } = req.body;
    let cellId = Number(rawCellId) || 0;
    let burgId = Number(rawBurgId) || 0;

    // Resolve cell/burg if only one provided
    if (burgId && !cellId) {
      const bRes = await pool.query("SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1", [burgId]);
      if (bRes.rows.length > 0) cellId = Number(bRes.rows[0].cell_id);
    } else if (cellId && !burgId) {
      const bRes = await pool.query("SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1", [cellId]);
      if (bRes.rows.length > 0) burgId = Number(bRes.rows[0].burg_id);
    }

    if (!cellId) cellId = 30627; // Excelsis Citadel (Avian Empire capital)

    const calRes = await pool.query("SELECT tick, year, month_name, day_of_month FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const row = calRes.rows[0];
    const tick = Number(row?.tick || 1);
    const loreDate = row ? `Year ${row.year}, ${row.month_name} Day ${row.day_of_month}` : `Year 31, Month 12, Day 40`;

    let eventMessage = "";
    let eventType = type;
    let eventTier = "MAJOR";

    switch (type) {
      case "CHAOS_SURGE": {
        eventType = "CHAOS_SURGE";
        eventTier = "CRITICAL";
        // 1. Spike chaos zone intensity to 95
        await pool.query(`
          INSERT INTO sim_chaos_zones (cell_id, intensity, type)
          VALUES ($1, $2, 'PRIMORDIAL_CHAOS_SURGE')
          ON CONFLICT (cell_id, type) DO UPDATE SET intensity = EXCLUDED.intensity
        `, [cellId, Math.max(85, intensity)]);

        // 2. Infect burg with unrest & blight
        if (burgId) {
          await pool.query(`
            UPDATE sim_burg_economy
            SET unrest = LEAST(100, unrest + 35),
                health = GREATEST(10, health - 30),
                food = GREATEST(0, food - 500)
            WHERE burg_id = $1
          `, [burgId]);
        }

        eventMessage = `⚡ PRIMORDIAL CHAOS SURGE: An unpredictable aether rupture tore through Cell #${cellId}! Reality warped at ${intensity}% intensity, withering local crops and driving citizens into chaos panic!`;
        break;
      }

      case "DEEP_COLD_FREEZE": {
        eventType = "HARSH_WINTER_FREEZE";
        eventTier = "MAJOR";
        // 1. Shift calendar to Dimfreeze, the deep-cold season
        await pool.query(`
          UPDATE sim_calendar
          SET season = 'Dimfreeze'
          WHERE id = (SELECT id FROM sim_calendar ORDER BY id DESC LIMIT 1)
        `);

        // 2. Drop cell temperature to sub-zero
        await pool.query(`UPDATE sim_cells SET current_temp = -18 WHERE id = $1`, [cellId]);

        // 3. Freeze burg granaries and food stores
        if (burgId) {
          await pool.query(`
            UPDATE sim_burg_economy
            SET food = GREATEST(0, (food * 0.4)::int),
                unrest = LEAST(100, unrest + 20)
            WHERE burg_id = $1
          `, [burgId]);
        }

        eventMessage = `❄️ DEEP COLD BLIZZARD: A catastrophic arctic freeze gripped Cell #${cellId} (-18°C)! Farmlands froze solid, granary reserves rotted in uninsulated silos, and severe food rationing commenced!`;
        break;
      }

      case "FAMINE_BANDIT_REVOLT": {
        eventType = "BANDIT_RAIDERS_EMERGE";
        eventTier = "CRITICAL";
        // 1. Empty burg food
        if (burgId) {
          await pool.query(`
            UPDATE sim_burg_economy
            SET food = 0,
                unrest = LEAST(100, unrest + 40),
                pop_null = GREATEST(12, pop_null - 60)
            WHERE burg_id = $1
          `, [burgId]);
        }

        // 2. Siphon 60 defectors into outlaw cartels
        await pool.query(`
          UPDATE sim_outlaw_factions
          SET manpower = manpower + 60
          WHERE id = (SELECT id FROM sim_outlaw_factions ORDER BY RANDOM() LIMIT 1)
        `);

        eventMessage = `🍞 FAMINE & BANDIT REBELLION: Total grain exhaustion in Cell #${cellId} drove 60 starving laborers and garrison deserters into the surrounding hills as roving highway bandits, cutting off supply lines!`;
        break;
      }

      case "CORRUPT_EMBEZZLE_EMBARGO": {
        eventType = "COMPASS_TRADE_EMBARGO";
        eventTier = "MAJOR";
        // 1. Corrupt the local mayor
        if (burgId) {
          await pool.query(`
            UPDATE sim_paragons
            SET corruption_score = 95
            WHERE burg_id = $1 AND title ILIKE '%Mayor%'
          `, [burgId]);

          // 2. Empty municipal treasury
          await pool.query(`
            UPDATE sim_burg_economy
            SET wealth = GREATEST(0, wealth - 400),
                unrest = LEAST(100, unrest + 25)
            WHERE burg_id = $1
          `, [burgId]);
        }

        // 3. Inject CompassEmbargo tag into sector features
        await addCellTags(pool, cellId, ["#CompassEmbargo", "#TradeBlockaded"]);

        eventMessage = `⚖️ GILDED COMPASS TRADE EMBARGO: Local authorities in Cell #${cellId} were caught embezzling municipal treasury funds and defaulting on mercantile credit! The Gilded Compass has declared an immediate trade blockade, freezing commercial shipping!`;
        break;
      }

      case "BORDER_WAR": {
        eventType = "DECLARE_WAR";
        eventTier = "CRITICAL";
        // 1. Resolve real Ostraka sovereign factions (no dead Holgaland 1/2 fallback)
        const { myFactionId, enemyFactionId } = await resolveBorderWarPair(pool, cellId);
        const fA = Math.min(myFactionId, enemyFactionId);
        const fB = Math.max(myFactionId, enemyFactionId);

        // 2. Set diplomacy to WAR with max tension
        await pool.query(`
          INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
          VALUES ($1, $2, 'WAR', 100)
          ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100
        `, [fA, fB]);

        const [fName1, fName2] = await Promise.all([
          pool.query("SELECT name FROM sim_factions WHERE id = $1", [myFactionId]),
          pool.query("SELECT name FROM sim_factions WHERE id = $1", [enemyFactionId])
        ]);

        const n1 = fName1.rows[0]?.name || `Faction ${myFactionId}`;
        const n2 = fName2.rows[0]?.name || `Faction ${enemyFactionId}`;

        eventMessage = `⚔️ BORDER WAR ERUPTION: Geopolitical tensions along the frontier of Cell #${cellId} have ignited! ${n1} and ${n2} have entered open WAR, deploying legion detachments to the front!`;
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown crisis type: ${type}` });
    }

    // Insert logged event
    await pool.query(
      `INSERT INTO sim_events (tick, type, message, tier, cell_id, burg_id, lore_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tick, eventType, eventMessage, eventTier, cellId, burgId || null, loreDate]
    );

    res.json({
      success: true,
      crisis: type,
      cellId,
      burgId,
      event: {
        tick,
        type: eventType,
        tier: eventTier,
        message: eventMessage,
        loreDate
      }
    });
  } catch (err: any) {
    console.error("Crisis trigger error:", err);
    res.status(500).json({ error: err.message });
  }
});

observerRouter.post("/reset", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: "Cannot reset while a tick is in progress." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "Reset already in progress." });
  }

  // Halt background autoplay during world reset to prevent race conditions
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }

  resetInProgress = true;
  try {
    console.log("[API] World reset requested...");
    const result = await resetWorld();
    lastTickHealth = null;
    lastTickError = null;
    console.log("[API] World reset complete:", result.stats);
    res.json(result);
  } catch (error: any) {
    console.error("Reset error:", error.message);
    res.status(500).json({ error: error.message || "Reset failed" });
  } finally {
    resetInProgress = false;
  }
});

export default observerRouter;
