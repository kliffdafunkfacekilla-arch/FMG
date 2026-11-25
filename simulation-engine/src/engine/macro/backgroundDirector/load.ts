import type { Db } from "../../deltas/types.js";
import type { Entity } from "../../rpg/narrativeTagEngine.js";
import type {
  BackgroundDirectorSnapshot,
  DirectorBurgSnapshot,
  DirectorSectorSnapshot,
} from "./step.js";

/**
 * Loads current cosmology phase, all rendered tactical sector layers, and matching burg
 * economy rows in at most 3 flat SQL queries.
 */
export async function loadBackgroundDirector(
  client: Db,
  tick: number,
  loreDate?: string
): Promise<BackgroundDirectorSnapshot> {
  const calRes = await client.query(
    `SELECT moon_phase, is_shadow_week, season, dragon_domain
     FROM sim_calendar
     ORDER BY tick DESC LIMIT 1`
  );
  const cal = calRes.rows[0] || {};
  const moonPhase = String(cal.moon_phase || "The Halo");
  const isShadowWeek = Boolean(cal.is_shadow_week);

  const sectorsRes = await client.query(
    `SELECT cell_id, rx, ry, z_layer, props, npcs, features, layer_name
     FROM sim_sector_layers ORDER BY cell_id, rx, ry, z_layer`
  );

  const sectors: DirectorSectorSnapshot[] = [];
  const populatedCellIds = new Set<number>();

  for (const row of sectorsRes.rows) {
    const cellId = Number(row.cell_id);
    const npcs: Entity[] = Array.isArray(row.npcs) ? row.npcs : [];
    const props: Entity[] = Array.isArray(row.props) ? row.props : [];
    const features = row.features && typeof row.features === "object" ? row.features : {};

    sectors.push({
      cellId,
      rx: Number(row.rx),
      ry: Number(row.ry),
      zLayer: Number(row.z_layer),
      npcs,
      props,
      features,
    });
    if (npcs.length > 0 || props.length > 0) {
      populatedCellIds.add(cellId);
    }
  }

  const burgsByCell: Record<number, DirectorBurgSnapshot> = {};
  if (populatedCellIds.size > 0) {
    const burgRes = await client.query(
      `SELECT burg_id, cell_id, name, unrest, food, wealth, crime_rate
       FROM sim_burg_economy
       WHERE cell_id = ANY($1::int[])
       ORDER BY burg_id ASC`,
      [Array.from(populatedCellIds).sort((a, b) => a - b)]
    );
    for (const r of burgRes.rows) {
      const cid = Number(r.cell_id);
      if (burgsByCell[cid] === undefined) {
        burgsByCell[cid] = {
          burgId: Number(r.burg_id),
          cellId: cid,
          name: String(r.name),
          unrest: Number(r.unrest) || 0,
          food: Number(r.food) || 0,
          wealth: Number(r.wealth) || 0,
          crimeRate: Number(r.crime_rate) || 0,
        };
      }
    }
  }

  return {
    tick,
    ...(loreDate !== undefined ? { loreDate } : {}),
    moonPhase,
    isShadowWeek,
    sectors,
    burgsByCell,
  };
}
