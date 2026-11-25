import { loadCellTagMap } from "../../cellTags.js";
import type { Db } from "../../deltas/types.js";
import type { ParagonBurgSnap, ParagonRowSnap, ParagonsSnapshot } from "./step.js";

/**
 * Loads ordered burgs, paragons, and active sector cell tags in 3 flat queries.
 */
export async function loadParagons(
  client: Db,
  tick: number,
  loreDate: string
): Promise<ParagonsSnapshot> {
  const burgRes = await client.query(
    `SELECT burg_id, name, cell_id, pop_null, food, health, unrest, wealth, crime_rate, port
     FROM sim_burg_economy
     ORDER BY burg_id`
  );
  const paragonRes = await client.query(`SELECT * FROM sim_paragons ORDER BY id`);
  const sectorTagsMap = await loadCellTagMap(client as any);

  const burgs: ParagonBurgSnap[] = burgRes.rows.map((b: any) => ({
    burgId: Number(b.burg_id),
    name: String(b.name || `Burg #${b.burg_id}`),
    cellId: Number(b.cell_id || 0),
    popNull: Number(b.pop_null || 0),
    food: Number(b.food || 0),
    health: b.health !== null && b.health !== undefined ? Number(b.health) : 100,
    unrest: Number(b.unrest || 0),
    wealth: Number(b.wealth || 0),
    crimeRate: Number(b.crime_rate || 0),
    port: Boolean(b.port),
  }));

  const paragons: ParagonRowSnap[] = paragonRes.rows.map((p: any) => ({
    id: Number(p.id),
    burgId: p.burg_id !== null && p.burg_id !== undefined ? Number(p.burg_id) : null,
    outlawId: p.outlaw_id !== null && p.outlaw_id !== undefined ? Number(p.outlaw_id) : null,
    domain: p.domain ? String(p.domain) : null,
    title: String(p.title || ""),
    name: String(p.name || ""),
    traits: p.traits,
    corruptionScore: Number(p.corruption_score || 0),
  }));

  const cellTagsByCell: Record<number, string[]> = {};
  for (const [cid, tags] of sectorTagsMap.entries()) {
    cellTagsByCell[cid] = tags;
  }

  return { tick, loreDate, burgs, paragons, cellTagsByCell };
}
