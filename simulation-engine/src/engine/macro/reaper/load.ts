import type { Db } from "../../deltas/types.js";
import type {
  ReaperGhostBurg,
  ReaperGhostShipment,
  ReaperSnapshot,
} from "./step.js";

/**
 * Loads uninhabited burgs (`pop_null <= 0 AND pop_attuned <= 0`) and—only when any exist—their
 * in-transit shipments, caravan crew citizens, and local paragons. Fast path costs 1 query.
 */
export async function loadReaper(client: Db, tick: number): Promise<ReaperSnapshot> {
  const ghostsRes = await client.query(
    `SELECT burg_id, name, occupier_faction_id, COALESCE(urban_tier, 0)::int AS urban_tier
     FROM sim_burg_economy
     WHERE pop_null <= 0 AND COALESCE(pop_attuned, 0) <= 0
     ORDER BY burg_id ASC`
  );
  if (ghostsRes.rows.length === 0) {
    return {
      tick,
      ghostBurgs: [],
      ghostShipments: [],
      caravanCitizenIds: [],
      paragonIds: [],
    };
  }

  const ghostBurgs: ReaperGhostBurg[] = ghostsRes.rows.map((r: any) => ({
    burgId: Number(r.burg_id),
    name: String(r.name || ""),
    occupierFactionId:
      r.occupier_faction_id !== null && r.occupier_faction_id !== undefined
        ? Number(r.occupier_faction_id)
        : null,
    urbanTier: Number(r.urban_tier) || 0,
  }));
  const ids = ghostBurgs.map((b) => b.burgId);

  const shipRes = await client.query(
    `SELECT id, merchant_citizen_id, crew_citizen_ids,
            COALESCE(path_index, 0)::int AS path_index,
            COALESCE(current_cell_id, 0)::int AS current_cell_id,
            COALESCE(eta_ticks, 0)::int AS eta_ticks
     FROM sim_trade_shipments
     WHERE status = 'IN_TRANSIT' AND (source_burg_id = ANY($1) OR dest_burg_id = ANY($1))
     ORDER BY id ASC`,
    [ids]
  );

  const candidateCrewIds = new Set<number>();
  const ghostShipments: ReaperGhostShipment[] = shipRes.rows.map((s: any) => {
    const mid = Number(s.merchant_citizen_id) || 0;
    if (mid > 0) candidateCrewIds.add(mid);
    const crewRaw = Array.isArray(s.crew_citizen_ids) ? s.crew_citizen_ids : [];
    const crewCitizenIds: number[] = [];
    for (const cid of crewRaw) {
      const n = Number(cid) || 0;
      if (n > 0) {
        crewCitizenIds.push(n);
        candidateCrewIds.add(n);
      }
    }
    return {
      id: Number(s.id),
      merchantCitizenId: mid,
      crewCitizenIds,
      pathIndex: Number(s.path_index) || 0,
      currentCellId: Number(s.current_cell_id) || 0,
      etaTicks: Number(s.eta_ticks) || 0,
    };
  });

  let caravanCitizenIds: number[] = [];
  if (candidateCrewIds.size > 0) {
    const crewRes = await client.query(
      `SELECT citizen_id
       FROM population_demographics
       WHERE citizen_id = ANY($1::int[]) AND allegiance_status = 'ON_CARAVAN'
       ORDER BY citizen_id ASC`,
      [Array.from(candidateCrewIds).sort((a, b) => a - b)]
    );
    caravanCitizenIds = crewRes.rows.map((r: any) => Number(r.citizen_id));
  }

  const paraRes = await client.query(
    `SELECT id FROM sim_paragons WHERE burg_id = ANY($1::int[]) ORDER BY id ASC`,
    [ids]
  );
  const paragonIds = paraRes.rows.map((r: any) => Number(r.id));

  return {
    tick,
    ghostBurgs,
    ghostShipments,
    caravanCitizenIds,
    paragonIds,
  };
}
