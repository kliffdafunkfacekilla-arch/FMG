/**
 * Gives every named person a name of their own within their town. Worlds made before engine/names drew from a
 * dozen names per species, so neighbours could share one ("five Skye Feather-Bounds in Excelsis").
 * For each town, the first holder of a name keeps it; each later holder gets a fresh name (same species, same
 * family name when that still leaves it unique), changed everywhere it is shown:
 *   population_demographics.name, entities.name, map NPCs (sim_sector_layers), other people's ties.
 *
 *   node dist/scripts/fixDuplicateNames.js            (dry run: lists the renames)
 *   node dist/scripts/fixDuplicateNames.js --apply    (one transaction)
 * Uses DATABASE_URL like everything else.
 */
import pool from "../db/pool.js";
import { familyName, NameBook, stripRole } from "../engine/names/names.js";
import { hashSeed, mulberry32 } from "../engine/rng.js";
import { DEFAULT_SPECIES } from "../engine/canon/species.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = (await pool.query(`SELECT current_database() AS d`)).rows[0].d;
  const rows = (await pool.query(
    `SELECT citizen_id, settlement_id, name, species, profession FROM population_demographics
     WHERE settlement_id IS NOT NULL ORDER BY settlement_id, citizen_id`
  )).rows;

  const byTown = new Map<number, any[]>();
  for (const r of rows) {
    const t = Number(r.settlement_id);
    if (!byTown.has(t)) byTown.set(t, []);
    byTown.get(t)!.push(r);
  }

  const renames: Array<{ id: number; from: string; to: string; profession: string; town: number }> = [];
  for (const [town, people] of byTown) {
    const book = new NameBook();
    const seen = new Set<string>();
    const dupes: any[] = [];
    for (const p of people) {
      const key = stripRole(p.name).toLowerCase();
      if (seen.has(key)) dupes.push(p);
      else { seen.add(key); book.add(p.name); }
    }
    for (const p of dupes) {
      const rng = mulberry32(hashSeed(`rename:${p.citizen_id}`));
      const to = book.make(String(p.species || DEFAULT_SPECIES), rng, familyName(p.name));
      renames.push({ id: Number(p.citizen_id), from: String(p.name), to, profession: String(p.profession || ""), town });
    }
  }

  console.log(`[names] ${db}: ${rows.length} named people, ${renames.length} share a name with a neighbour.`);
  for (const r of renames.slice(0, 40)) console.log(`  #${r.id} (burg ${r.town}) ${r.from} -> ${r.to}`);
  if (renames.length > 40) console.log(`  ...and ${renames.length - 40} more`);
  if (!apply || renames.length === 0) {
    if (!apply && renames.length) console.log(`Dry run. Rerun with --apply to rename them.`);
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = renames.map((r) => r.id);
    const names = renames.map((r) => r.to);
    await client.query(
      `UPDATE population_demographics p SET name = v.name
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS name) v WHERE p.citizen_id = v.id`,
      [ids, names]
    );
    await client.query(
      `UPDATE entities e SET name = CASE WHEN v.prof <> '' THEN v.name || ' (' || v.prof || ')' ELSE v.name END
       FROM (SELECT unnest($1::text[]) AS ref, unnest($2::text[]) AS name, unnest($3::text[]) AS prof) v WHERE e.ref = v.ref`,
      [ids.map((id) => `citizen:${id}`), names, renames.map((r) => r.profession)]
    );
    // Map NPCs: "Old Name (Role)" -> "New Name (Role)" for the NPC with this citizen's id.
    const layers = await client.query(
      `SELECT cell_id, rx, ry, z_layer, npcs FROM sim_sector_layers
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(npcs) n WHERE n->>'id' = ANY($1::text[]))`,
      [ids.map((id) => `npc_citizen_${id}`)]
    );
    const newName = new Map(renames.map((r) => [`npc_citizen_${r.id}`, r]));
    for (const l of layers.rows) {
      const npcs = (l.npcs as any[]).map((n) => {
        const r = newName.get(String(n.id));
        if (!r) return n;
        const role = /\(([^)]*)\)\s*$/.exec(String(n.name || ""));
        return { ...n, name: role ? `${r.to} (${role[1]})` : r.to };
      });
      await client.query(
        `UPDATE sim_sector_layers SET npcs = $5::jsonb WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4`,
        [l.cell_id, l.rx, l.ry, l.z_layer, JSON.stringify(npcs)]
      );
    }
    // Ties that point at a renamed person by id.
    const tied = await client.query(
      `SELECT citizen_id, social_links FROM population_demographics
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(social_links, '[]'::jsonb)) l WHERE (l->>'citizenId')::int = ANY($1::int[]))`,
      [ids]
    );
    const byId = new Map(renames.map((r) => [r.id, r.to]));
    for (const t of tied.rows) {
      const links = (t.social_links as any[]).map((l) => (byId.has(Number(l.citizenId)) ? { ...l, name: byId.get(Number(l.citizenId)) } : l));
      await client.query(`UPDATE population_demographics SET social_links = $2::jsonb WHERE citizen_id = $1`, [t.citizen_id, JSON.stringify(links)]);
    }
    await client.query("COMMIT");
    console.log(`[names] Renamed ${renames.length} people (${layers.rowCount} map layers, ${tied.rowCount} people's ties updated).`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[names] failed:", e?.message || e);
  process.exit(1);
});
