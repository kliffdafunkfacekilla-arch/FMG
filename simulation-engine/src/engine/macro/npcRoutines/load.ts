import type {
  ActionUtilityChoice,
  NPCInstinct,
  NPCTemper,
} from "../../ai/npcMindPure.js";
import type { Db } from "../../deltas/types.js";
import { sqlShuffle } from "../../rng.js";
import type {
  ActiveTradeRouteSnapshot,
  DeceasedNpcSnapshot,
  LivingNpcRoutineSnapshot,
  NpcRoutinesSnapshot,
} from "./step.js";

/**
 * Loads living persistent NPCs, recent events, active trade routes (preserving sqlShuffle order),
 * and unprocessed deceased producer NPCs in 3-4 flat SQL queries.
 */
export async function loadNpcRoutines(
  client: Db,
  tick: number,
  loreDate: string
): Promise<NpcRoutinesSnapshot> {
  const activeNpcsRes = await client.query(`
    SELECT n.*, b.food AS burg_food, b.wealth AS burg_wealth, b.unrest AS burg_unrest, b.crime_rate AS burg_crime
    FROM sim_npc_instances n
    LEFT JOIN sim_burg_economy b ON n.cell_id = b.cell_id
    WHERE n.alive = true ORDER BY n.id
    LIMIT 200
  `);

  const recentEvents: Array<{ burgId: number; type: string; message: string; tier?: string }> = [];
  if (activeNpcsRes.rows.length > 0) {
    const eventsRes = await client.query(
      `SELECT burg_id, type, message, tier
       FROM sim_events
       WHERE tick >= $1 - 1
       ORDER BY id DESC
       LIMIT 100`,
      [tick]
    );
    for (const ev of eventsRes.rows) {
      recentEvents.push({
        burgId: ev.burg_id || 0,
        type: String(ev.type),
        message: String(ev.message),
        ...(ev.tier ? { tier: String(ev.tier) } : {}),
      });
    }
  }

  const livingNpcs: LivingNpcRoutineSnapshot[] = activeNpcsRes.rows.map((row: any) => ({
    id: String(row.id),
    cellId: Number(row.cell_id),
    role: row.role || "Citizen",
    instinct: (row.instinct || "WARY") as NPCInstinct,
    temper: (row.temper || "STOIC") as NPCTemper,
    needs: typeof row.needs === "object" && row.needs !== null
      ? row.needs
      : { food: 0.8, rest: 0.8, coin: 0.5, safety: 0.8, company: 0.5 },
    mood: typeof row.mood === "object" && row.mood !== null
      ? row.mood
      : { fear: 0.1, anger: 0.1, joy: 0.2 },
    beliefs: Array.isArray(row.beliefs) ? row.beliefs : [],
    socialLinks: Array.isArray(row.social_links) ? row.social_links : [],
    scheduleState: (row.schedule_state as ActionUtilityChoice) || "ROUTINE_WORK",
    burgFood: Number(row.burg_food) || 300,
    burgWealth: Number(row.burg_wealth) || 500,
    burgUnrest: Number(row.burg_unrest) || 10,
    burgCrime: Number(row.burg_crime) || 15,
  }));

  const routesRes = await client.query(`
    SELECT r.source_burg_id, r.dest_burg_id, r.volume, r.risk_level,
           s.food AS src_food, d.food AS dst_food
    FROM sim_trade_routes r
    JOIN sim_burg_economy s ON r.source_burg_id = s.burg_id
    JOIN sim_burg_economy d ON r.dest_burg_id = d.burg_id
    WHERE r.status = 'ACTIVE'
    ORDER BY ${sqlShuffle("r.source_burg_id || '-' || r.dest_burg_id")}
    LIMIT 10
  `);
  const activeRoutes: ActiveTradeRouteSnapshot[] = routesRes.rows.map((r: any) => ({
    sourceBurgId: Number(r.source_burg_id),
    destBurgId: Number(r.dest_burg_id),
    volume: Number(r.volume) || 0,
    riskLevel: Number(r.risk_level) || 0,
    srcFood: Number(r.src_food) || 0,
    dstFood: Number(r.dst_food) || 0,
  }));

  const deceasedRes = await client.query(`
    SELECT n.id, n.cell_id, n.role,
           (n.updated_at >= NOW() - INTERVAL '1 day') AS recent,
           b.burg_id
    FROM sim_npc_instances n
    LEFT JOIN sim_burg_economy b ON b.cell_id = n.cell_id
    WHERE n.alive = false AND n.processed_for_economy IS NOT TRUE
    ORDER BY n.id ASC
  `);
  const deceasedNpcs: DeceasedNpcSnapshot[] = deceasedRes.rows.map((r: any) => ({
    id: String(r.id),
    cellId: Number(r.cell_id),
    burgId: r.burg_id !== null && r.burg_id !== undefined ? Number(r.burg_id) : null,
    role: String(r.role || ""),
    recent: Boolean(r.recent),
  }));

  return {
    tick,
    loreDate,
    livingNpcs,
    recentEvents,
    activeRoutes,
    deceasedNpcs,
  };
}
