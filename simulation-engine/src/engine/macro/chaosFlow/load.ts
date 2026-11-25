import { DAYS_PER_WEEK } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";
import {
  computeChaosFlowState,
  lunarSurgeModifier,
  parseChaosFlowAnchor,
  type ChaosFlowAnchor,
  type ChaosFlowSnapshot,
  type ChaosPruneCandidate,
  type ChaosSampleCell,
  type ChaosShoreCell,
  type LiveChaosFlowState,
} from "./step.js";

/**
 * Loads the chaos flow snapshot: fixed anchors, optional weekly prune candidates, and optional
 * bi-daily bank cells (fetched via a single batched LATERAL GiST box query) + agent role counts.
 */
export async function loadChaosFlow(
  db: Db,
  tick: number,
  calendarData?: { active_flow?: string; dragon_domain?: string; moon_phase?: string }
): Promise<ChaosFlowSnapshot> {
  const ctx = {
    activeFlow: calendarData?.active_flow || "Mass",
    dragonDomain: calendarData?.dragon_domain || "Tiraton",
    lunarSurgeMod: lunarSurgeModifier(calendarData?.moon_phase || "The Halo"),
  };

  const anchorRes = await db.query(
    `SELECT flow_id, name, dragon_name, elemental_power, source_coord, sink_coord
     FROM sim_chaos_flows ORDER BY flow_id ASC`
  );
  const anchors = anchorRes.rows
    .map(parseChaosFlowAnchor)
    .filter((a: ChaosFlowAnchor | null): a is ChaosFlowAnchor => a !== null);

  if (anchors.length === 0) {
    console.warn("[chaosFlowAgent] sim_chaos_flows has no seeded flows; run the map ingest (world reset).");
    return {
      tick,
      ctx,
      anchors: [],
      liveFlows: [],
      pruneCandidates: [],
      shoreCells: [],
      sampleCellsByPoint: [],
      agentCounts: { cultist: 0, warden: 0, chainZealot: 0 },
    };
  }

  const liveFlows: LiveChaosFlowState[] = anchors.map((a: ChaosFlowAnchor) => computeChaosFlowState(a, tick, ctx));

  const pruneCandidates: ChaosPruneCandidate[] = [];
  const shoreCells: ChaosShoreCell[] = [];
  if (tick % DAYS_PER_WEEK === 0) {
    const pruneFlows = liveFlows.filter((f) => f.waypoints?.length > 0);
    if (pruneFlows.length > 0) {
      const pruneRes = await db.query(
        `WITH flow_specs AS (
           SELECT unnest($1::int[]) AS flow_id,
                  unnest($2::text[]) AS ley_tag,
                  unnest($3::text[]) AS zone_type
         )
         SELECT DISTINCT fs.flow_id, c.id, c.center_x, c.center_y
         FROM flow_specs fs
         JOIN sim_cells c ON (
           EXISTS (SELECT 1 FROM sim_cell_tags t WHERE t.cell_id = c.id AND t.z_layer = 0 AND t.tags ? fs.ley_tag)
           OR EXISTS (SELECT 1 FROM sim_chaos_zones z WHERE z.cell_id = c.id AND z.type = fs.zone_type)
         )
         ORDER BY fs.flow_id ASC, c.id ASC`,
        [
          pruneFlows.map((f) => f.flowId),
          pruneFlows.map((f) => `#DragonLeys_${f.dragonName}`),
          pruneFlows.map((f) => `${f.elementalPower.toUpperCase()}_CHAOS_LEYS`),
        ]
      );
      for (const r of pruneRes.rows) {
        pruneCandidates.push({
          flowId: Number(r.flow_id),
          cellId: Number(r.id),
          centerX: Number(r.center_x) || 0,
          centerY: Number(r.center_y) || 0,
        });
      }
    }

    const shoreRes = await db.query(
      `SELECT cell_id,
              ARRAY(SELECT e FROM jsonb_array_elements_text(tags) e WHERE e LIKE '#DragonLeys\\_%') AS ley_tags
       FROM sim_cell_tags
       WHERE z_layer = 0 AND tags ? '#ChaosFlowShores'
       ORDER BY cell_id ASC`
    );
    for (const r of shoreRes.rows) {
      shoreCells.push({
        cellId: Number(r.cell_id),
        leyTags: Array.isArray(r.ley_tags) ? r.ley_tags.map(String) : [],
      });
    }
  }

  const sampleCellsByPoint: ChaosSampleCell[][] = [];
  const agentCounts = { cultist: 0, warden: 0, chainZealot: 0 };

  if (tick % 2 === 0) {
    const ptOrds: number[] = [];
    const ptXs: number[] = [];
    const ptYs: number[] = [];
    for (const flow of liveFlows) {
      const samplePts = [flow.waypoints[2], flow.waypoints[5], flow.waypoints[8]].filter(Boolean);
      for (const pt of samplePts) {
        if (!pt) continue;
        ptOrds.push(ptOrds.length);
        ptXs.push(pt.x);
        ptYs.push(pt.y);
        sampleCellsByPoint.push([]);
      }
    }

    if (ptOrds.length > 0) {
      const cellRes = await db.query(
        `WITH pts AS (
           SELECT * FROM unnest($1::int[], $2::float8[], $3::float8[]) AS p(pt_ord, x, y)
         )
         SELECT p.pt_ord, c.id, c.center_x, c.center_y, c.eco_blight
         FROM pts p
         CROSS JOIN LATERAL (
           SELECT id, center_x, center_y, eco_blight
           FROM sim_cells
           WHERE point(center_x, center_y) <@ box(point(p.x - 70, p.y - 70), point(p.x + 70, p.y + 70))
           ORDER BY id ASC
           LIMIT 4
         ) c
         ORDER BY p.pt_ord ASC, c.id ASC`,
        [ptOrds, ptXs, ptYs]
      );
      for (const r of cellRes.rows) {
        const idx = Number(r.pt_ord);
        const list = sampleCellsByPoint[idx];
        if (list) {
          list.push({
            id: Number(r.id),
            centerX: Number(r.center_x) || 0,
            centerY: Number(r.center_y) || 0,
            ecoBlight: Number(r.eco_blight) || 0,
          });
        }
      }
    }

    const cntRes = await db.query(
      `SELECT role, COUNT(*)::int AS cnt
       FROM sim_agents
       WHERE role IN ('Cultist', 'Warden', 'Chain_Zealot')
       GROUP BY role`
    );
    for (const r of cntRes.rows) {
      if (r.role === "Cultist") agentCounts.cultist = Number(r.cnt) || 0;
      else if (r.role === "Warden") agentCounts.warden = Number(r.cnt) || 0;
      else if (r.role === "Chain_Zealot") agentCounts.chainZealot = Number(r.cnt) || 0;
    }
  }

  return {
    tick,
    ctx,
    anchors,
    liveFlows,
    pruneCandidates,
    shoreCells,
    sampleCellsByPoint,
    agentCounts,
  };
}
