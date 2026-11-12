/**
 * Fingerprint of the world after a simulated day, for replay comparisons (testTickReplay, benchTick).
 */
import pool from "../db/pool.js";

/** Hashes of what a day changes: burgs, cells, agents, people, threads and that day's events. */
export async function worldFingerprint(tick: number, baseCitizenId: number): Promise<Record<string, string>> {
  const q = async (sql: string, args: any[] = []) => String((await pool.query(sql, args)).rows[0]?.h ?? "");
  return {
    burgs: await q(`SELECT md5(string_agg(b::text, '|' ORDER BY burg_id)) h FROM sim_burg_economy b`),
    cells: await q(`SELECT md5(string_agg(concat_ws(',', id, faction_id, eco_plants, eco_prey, eco_predators, eco_blight, current_temp), '|' ORDER BY id)) h FROM sim_cells`),
    agents: await q(`SELECT md5(string_agg(concat_ws(',', id, location_cell_id, target_cell_id, state, corruption, drained_power), '|' ORDER BY id)) h FROM sim_agents`),
    // New citizens' ids come from a sequence, and sequences do not roll back: hash those without their id
    people: await q(`SELECT md5(string_agg(concat_ws(',', CASE WHEN citizen_id <= $1 THEN citizen_id END, settlement_id, allegiance_status, life_stage, name, profession, unit_size), '|' ORDER BY citizen_id <= $1 DESC, CASE WHEN citizen_id <= $1 THEN citizen_id END, settlement_id, name, profession)) h FROM population_demographics`, [baseCitizenId]),
    events: await q(`SELECT md5(string_agg(concat_ws(',', type, burg_id, message), '|' ORDER BY type, burg_id, message)) h FROM sim_events WHERE tick = $1`, [tick]),
  };
}
