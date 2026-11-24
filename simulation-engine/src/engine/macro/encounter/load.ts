import type { Db } from "../../deltas/types.js";

export interface EncounterAgentRow {
  id: number;
  location_cell_id: number | null;
}

export interface EncounterSnapshot {
  agents: EncounterAgentRow[];
  cellIds: number[];
}

export async function loadEncounter(db: Db): Promise<EncounterSnapshot> {
  const agentsRes = await db.query(
    `SELECT id, location_cell_id FROM sim_agents WHERE role IN ('Beasts', 'Criminal') ORDER BY id ASC`
  );
  const agents: EncounterAgentRow[] = agentsRes.rows.map((r: any) => ({
    id: Number(r.id),
    location_cell_id: r.location_cell_id !== null && r.location_cell_id !== undefined ? Number(r.location_cell_id) : null,
  }));
  if (agents.length === 0) {
    return { agents, cellIds: [] };
  }
  const cellRes = await db.query(`SELECT id FROM sim_cells ORDER BY id ASC`);
  const cellIds: number[] = cellRes.rows.map((r: any) => Number(r.id));
  return { agents, cellIds };
}
