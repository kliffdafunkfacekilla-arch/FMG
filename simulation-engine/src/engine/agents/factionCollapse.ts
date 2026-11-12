/**
 * Faction collapse: a sovereign faction with no living burg left cannot hold land or wage war.
 *
 * Avian Empire and Port Sunder lost every burg and every coin yet kept 800+ cells and 16 wars between
 * them, and Skyroost Academy (no land at all) stayed at war. Each tick:
 *  - a faction with no living burg and an empty treasury collapses: its land returns to the wild
 *    (faction_id NULL) and its wars end;
 *  - a faction with no living burg and no land has nothing to fight over: its wars end.
 * Landless-of-towns factions that still have money (nomads like the Dust-Husk Riders) are left alone.
 * The faction row stays, for history. Neutrals (id 0) are never touched.
 */
type Db = { query: (text: string, params?: any[]) => Promise<any> };

export async function runFactionCollapse(client: Db, tick: number, loreDate: string): Promise<number> {
  const res = await client.query(`
    WITH alive AS (
      SELECT DISTINCT COALESCE(b.occupier_faction_id, c.faction_id) AS fid
      FROM sim_burg_economy b JOIN sim_cells c ON c.id = b.cell_id
      WHERE b.pop_null + COALESCE(b.pop_attuned, 0) > 0
    )
    SELECT f.id, f.name, COALESCE(f.treasury, 0) AS treasury,
           (SELECT count(*) FROM sim_cells c WHERE c.faction_id = f.id)::int AS cells,
           (SELECT count(*) FROM sim_diplomacy d WHERE (d.faction_a_id = f.id OR d.faction_b_id = f.id) AND d.status = 'WAR')::int AS wars
    FROM sim_factions f
    WHERE f.id <> 0 AND f.id NOT IN (SELECT fid FROM alive WHERE fid IS NOT NULL)`);

  let changed = 0;
  for (const f of res.rows) {
    const bankrupt = Number(f.treasury) <= 0;
    const collapse = bankrupt && f.cells > 0;
    const landless = f.cells === 0;
    if (!collapse && !(landless && f.wars > 0)) continue;

    if (f.wars > 0) {
      await client.query(
        `UPDATE sim_diplomacy SET status = 'PEACE', tension = 0 WHERE (faction_a_id = $1 OR faction_b_id = $1) AND status = 'WAR'`,
        [f.id]
      );
    }
    if (collapse) {
      await client.query(`UPDATE sim_cells SET faction_id = NULL WHERE faction_id = $1`, [f.id]);
    }
    await client.query(
      `INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date) VALUES ($1, $2, $3, 'CRITICAL', $4, $5)`,
      [
        tick,
        collapse ? 'FACTION_COLLAPSED' : 'FACTION_WARS_ENDED',
        collapse
          ? `🏚️ THE FALL OF ${String(f.name).toUpperCase()}: with no town left and an empty treasury, ${f.name} has collapsed. Its ${f.cells} provinces return to the wild${f.wars ? ` and its ${f.wars} wars are over` : ''}.`
          : `🕊️ ${f.name}, holding neither town nor land, can no longer wage war; its ${f.wars} wars end.`,
        f.id,
        loreDate,
      ]
    );
    changed++;
  }
  return changed;
}
