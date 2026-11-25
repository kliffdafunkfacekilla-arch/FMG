import { loadCellTagMap } from "../../cellTags.js";
import type { Db } from "../../deltas/types.js";
import type { FactionBorderSnap, FactionDiplomacySnap, FactionPlanningSnapshot } from "./step.js";

/**
 * Loads ordered sovereign factions, burgs, regiments, paragons, diplomacy, borders, and cell tags.
 */
export async function loadFactionPlanning(
  client: Db,
  tick: number,
  loreDate: string
): Promise<FactionPlanningSnapshot> {
  const factionRes = await client.query(`SELECT * FROM sim_factions ORDER BY id`);
  const burgRes = await client.query(`
    SELECT b.burg_id, b.pop_null, COALESCE(b.pop_attuned, 0)::int AS pop_attuned, c.faction_id, b.unrest, b.crime_rate, b.food, b.health,
           b.military_forces, b.wealth, b.port, b.citadel, b.walls, b.plaza, b.temple, b.shanty, b.is_capital, c.id as cell_id
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    WHERE c.faction_id IS NOT NULL
    ORDER BY b.burg_id
  `);
  const unitRes = await client.query(`SELECT * FROM sim_faction_units ORDER BY id`);
  const paragonRes = await client.query(`SELECT * FROM sim_paragons WHERE faction_id IS NOT NULL ORDER BY id`);
  const diploRes = await client.query(`SELECT * FROM sim_diplomacy ORDER BY faction_a_id, faction_b_id`);
  const bordersRes = await client.query(`SELECT * FROM sim_faction_borders ORDER BY id`);
  const sectorTagsMap = await loadCellTagMap(client as any);

  const diplomacy: FactionDiplomacySnap[] = diploRes.rows.map((d: any) => ({
    factionAId: Number(d.faction_a_id),
    factionBId: Number(d.faction_b_id),
    status: String(d.status || "PEACE"),
    tension: Number(d.tension ?? 0),
  }));

  const borders: FactionBorderSnap[] = bordersRes.rows.map((b: any) => ({
    factionA: Number(b.faction_a),
    factionB: Number(b.faction_b),
  }));

  const cellTagsByCell: Record<number, string[]> = {};
  for (const [cid, tags] of sectorTagsMap.entries()) {
    cellTagsByCell[cid] = tags;
  }

  return {
    tick,
    loreDate,
    factions: factionRes.rows,
    burgs: burgRes.rows,
    units: unitRes.rows,
    paragons: paragonRes.rows,
    diplomacy,
    borders,
    cellTagsByCell,
  };
}
