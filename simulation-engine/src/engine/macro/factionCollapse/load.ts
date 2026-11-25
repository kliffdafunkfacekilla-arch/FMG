import type { Db } from "../../deltas/types.js";

export interface CollapseCandidate {
  id: number;
  name: string;
  treasury: number;
  /** Cell ids this faction owns (loaded only for candidates, ordered). */
  cellIds: number[];
  wars: number;
}

export interface FactionCollapseSnapshot {
  tick: number;
  loreDate: string;
  candidates: CollapseCandidate[];
}

/** Factions with no living burg, with their treasury, land and active wars (2 reads; cells only if any). */
export async function loadFactionCollapse(db: Db, tick: number, loreDate: string): Promise<FactionCollapseSnapshot> {
  const res = await db.query(`
    WITH alive AS (
      SELECT DISTINCT COALESCE(b.occupier_faction_id, c.faction_id) AS fid
      FROM sim_burg_economy b JOIN sim_cells c ON c.id = b.cell_id
      WHERE b.pop_null + COALESCE(b.pop_attuned, 0) > 0
    )
    SELECT f.id, f.name, COALESCE(f.treasury, 0) AS treasury,
           (SELECT count(*) FROM sim_diplomacy d WHERE (d.faction_a_id = f.id OR d.faction_b_id = f.id) AND d.status = 'WAR')::int AS wars
    FROM sim_factions f
    WHERE f.id <> 0 AND f.id NOT IN (SELECT fid FROM alive WHERE fid IS NOT NULL)
    ORDER BY f.id ASC`);
  if (res.rows.length === 0) return { tick, loreDate, candidates: [] };

  const ids = res.rows.map((r: any) => Number(r.id));
  const cellRes = await db.query(
    `SELECT id, faction_id FROM sim_cells WHERE faction_id = ANY($1::int[]) ORDER BY id ASC`,
    [ids]
  );
  const byFaction = new Map<number, number[]>();
  for (const c of cellRes.rows) {
    const fid = Number(c.faction_id);
    let arr = byFaction.get(fid);
    if (!arr) { arr = []; byFaction.set(fid, arr); }
    arr.push(Number(c.id));
  }
  return {
    tick,
    loreDate,
    candidates: res.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name),
      treasury: Number(r.treasury) || 0,
      cellIds: byFaction.get(Number(r.id)) || [],
      wars: Number(r.wars) || 0,
    })),
  };
}
