/**
 * One-off repair: clears live data written before the 2026-11-11 canon fixes.
 *
 * 1. Chaos-ley zones (sim_chaos_zones, type <POWER>_CHAOS_LEYS) far from their own flow's corridor.
 *    Before the fix, the flows ran along the wrong courses, so these zones mark the old paths.
 *    A flow's course never strays more than CORRIDOR units from its prison -> Verge line.
 * 2. Agents and grind canyons named for retired dragons: renamed to the canon dragon of their Power.
 * 3. The current calendar row: season and moon phase recomputed from its tick (canon calendar).
 * 4. Flow narrow spots and waypoints: recomputed for the current tick.
 *
 * Left alone on purpose: sim_events (a history log; old entries record what was written then) and
 * eco_blight (it wears off each tick through the trophic and warden agents).
 *
 * Dry run by default. Pass --apply to write everything in one transaction.
 *   node dist/scripts/repairStaleCanonData.js
 *   node dist/scripts/repairStaleCanonData.js --apply
 */
import pool from "../db/pool.js";
import { CANON_DRAGON_PRISONS, VERGE_COORD } from "../engine/canon/dragonPrisons.js";
import { dateForTick } from "../engine/canon/calendar.js";
import { computeChaosFlowState, lunarSurgeModifier, parseChaosFlowAnchor } from "../engine/agents/chaosFlowAgent.js";

// Max meander (70 * 1.8) + flow half-width and the adjacent band (~90), rounded up.
const CORRIDOR = 250;
// Retired name -> canon dragon of the same Power (Canon/02 "Old dragon names"; Powers from the old tables).
const RETIRED_TO_CANON: Record<string, string> = {
  Tyrustis: "Vahn", Aurgenas: "Ulex", Metrion: "Eldra", Opecten: "Lophex", Termhill: "Sevrath",
};
const CANON_BY_POWER = new Map(CANON_DRAGON_PRISONS.map(p => [p.power, p.dragon]));

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function renameRetired(text: string): string {
  return text.replace(/\b(Tyrustis|Aurgenas|Metrion|Opecten|Termhill)\b/g, m => RETIRED_TO_CANON[m] ?? m);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    // 1. Stale chaos-ley zones
    const zones = await client.query(
      `SELECT z.id, z.type, c.center_x, c.center_y FROM sim_chaos_zones z
       JOIN sim_cells c ON c.id = z.cell_id WHERE z.type LIKE '%\\_CHAOS\\_LEYS'`
    );
    const prisonByPower = new Map(CANON_DRAGON_PRISONS.map(p => [p.power.toUpperCase(), p]));
    const staleZoneIds: number[] = [];
    for (const z of zones.rows) {
      const p = prisonByPower.get(String(z.type).replace(/_CHAOS_LEYS$/, ""));
      if (!p) { staleZoneIds.push(z.id); continue; }
      const d = distToSegment(Number(z.center_x), Number(z.center_y), p.x, p.y, VERGE_COORD.x, VERGE_COORD.y);
      if (d > CORRIDOR) staleZoneIds.push(z.id);
    }
    console.log(`1. Chaos-ley zones: ${staleZoneIds.length} of ${zones.rows.length} lie off their flow's corridor.`);

    // 2. Retired dragon names
    const agents = await client.query(
      `SELECT id, name FROM sim_agents WHERE name ~ '\\m(Tyrustis|Aurgenas|Metrion|Opecten|Termhill)\\M'`
    );
    const canyons = await client.query(`SELECT id, name, dragon_name, dragon_domain FROM sim_grind_canyons`);
    const canyonFixes = canyons.rows
      .map((c: any) => {
        const canon = CANON_BY_POWER.get(c.dragon_domain);
        if (!canon || c.dragon_name === canon) return null;
        const name = String(c.name).split(String(c.dragon_name)).join(canon);
        return { id: c.id, dragon: canon, name, from: c.dragon_name };
      })
      .filter(Boolean) as { id: number; dragon: string; name: string; from: string }[];
    console.log(`2. Retired names: ${agents.rows.length} agents, ${canyonFixes.length} grind canyons (dragon does not match its Power).`);
    for (const a of agents.rows.slice(0, 3)) console.log(`     agent ${a.id}: "${a.name}" -> "${renameRetired(a.name)}"`);
    for (const c of canyonFixes.slice(0, 3)) console.log(`     canyon ${c.id}: ${c.from} -> ${c.dragon} "${c.name}"`);

    // 3. Calendar row
    const calRes = await client.query(`SELECT id, tick, season, moon_phase FROM sim_calendar ORDER BY id DESC LIMIT 1`);
    const cal = calRes.rows[0];
    const date = cal ? dateForTick(Number(cal.tick)) : null;
    if (cal && date) {
      console.log(`3. Calendar (tick ${cal.tick}): "${cal.season}" / "${cal.moon_phase}" -> "${date.season}" / "${date.moonPhase}"`);
    }

    // 4. Flow courses for the current tick
    const flows = await client.query(`SELECT flow_id, name, dragon_name, elemental_power, source_coord, sink_coord FROM sim_chaos_flows`);
    const tick = cal ? Number(cal.tick) : 0;
    const courses = flows.rows.map((r: any) => {
      const anchor = parseChaosFlowAnchor(r);
      if (!anchor || !date) return null;
      const st = computeChaosFlowState(anchor, tick, {
        activeFlow: anchor.elementalPower, dragonDomain: anchor.dragonName, lunarSurgeMod: lunarSurgeModifier(date.moonPhase),
      });
      return { flowId: anchor.flowId, st };
    }).filter(Boolean) as { flowId: number; st: ReturnType<typeof computeChaosFlowState> }[];
    console.log(`4. Flow courses: ${courses.length} recomputed for tick ${tick}.`);

    if (!apply) {
      console.log("\nDry run: nothing written. Re-run with --apply to write.");
      return;
    }

    await client.query("BEGIN");
    if (staleZoneIds.length) await client.query(`DELETE FROM sim_chaos_zones WHERE id = ANY($1::int[])`, [staleZoneIds]);
    for (const a of agents.rows) await client.query(`UPDATE sim_agents SET name = $1 WHERE id = $2`, [renameRetired(a.name), a.id]);
    for (const c of canyonFixes) await client.query(`UPDATE sim_grind_canyons SET dragon_name = $1, name = $2 WHERE id = $3`, [c.dragon, c.name, c.id]);
    if (cal && date) await client.query(`UPDATE sim_calendar SET season = $1, moon_phase = $2 WHERE id = $3`, [date.season, date.moonPhase, cal.id]);
    for (const c of courses) {
      await client.query(
        `UPDATE sim_chaos_flows SET current_surge = $1, current_width = $2, waypoints = $3, narrow_spots = $4, updated_at = NOW() WHERE flow_id = $5`,
        [c.st.currentSurge, c.st.currentWidth, JSON.stringify(c.st.waypoints), JSON.stringify(c.st.narrowSpots), c.flowId]
      );
    }
    await client.query("COMMIT");
    console.log("\nApplied in one transaction.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Repair failed:", err);
  process.exit(1);
});
