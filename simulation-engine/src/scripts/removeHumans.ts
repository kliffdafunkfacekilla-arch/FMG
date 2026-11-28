/**
 * Canon repair: this world has no humans (engine/canon/species.ts). Worlds built before that rule carry a "Human"
 * species in their population. This moves every one of them into the peoples their own town already has,
 * in proportion, so totals, ledgers and histories stay whole:
 *   population_cohorts      each Human cohort is split across the town's other species (largest remainder, exact).
 *   population_demographics each named Human becomes one of the town's peoples and gets a name from that culture,
 *                           changed everywhere it shows (entities, map NPCs, other people's ties, life events).
 *   sim_agents, sim_npc_instances, promoted_slots   species follows the home town the same way.
 *   sim_burg_economy        "Human" leaves the species mix; the rest is rescaled to 1.
 *   sim_sector_layers       map NPCs tagged "human" are tagged "mammal".
 *
 *   node dist/scripts/removeHumans.js            (dry run: counts what would change)
 *   node dist/scripts/removeHumans.js --apply    (one transaction)
 * Uses DATABASE_URL like everything else. Seeded per record, so a rerun on a copy gives the same result.
 */
import pool from "../db/pool.js";
import { DEFAULT_SPECIES, NOT_IN_WORLD } from "../engine/canon/species.js";
import { NameBook, loadTownNameBooks } from "../engine/names/names.js";
import { hashSeed, mulberry32 } from "../engine/rng.js";

const GONE = NOT_IN_WORLD.map((s) => s.toLowerCase());
const isGone = (s: unknown) => GONE.includes(String(s || "").trim().toLowerCase());

type Weights = Array<[string, number]>;

/** Splits n across weights so the parts are whole and add up to exactly n. */
function split(n: number, w: Weights): Array<[string, number]> {
  const total = w.reduce((a, [, x]) => a + x, 0);
  const raw = w.map(([s, x]) => [s, (n * x) / total] as [string, number]);
  const out = raw.map(([s, x]) => [s, Math.floor(x)] as [string, number]);
  let left = n - out.reduce((a, [, x]) => a + x, 0);
  const order = raw.map(([, x], i) => [i, x - Math.floor(x)] as [number, number]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k]![0]]![1]++;
  return out.filter(([, x]) => x > 0);
}

function pickWeighted(w: Weights, rng: () => number): string {
  const total = w.reduce((a, [, x]) => a + x, 0);
  let r = rng() * total;
  for (const [s, x] of w) if ((r -= x) <= 0) return s;
  return w[w.length - 1]![0];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  const db = (await client.query(`SELECT current_database() AS d`)).rows[0].d;
  try {
    await client.query("BEGIN");

    // Each town's own peoples, by headcount (cohorts are the bulk of everyone).
    const mix = await client.query(
      `SELECT burg_id, species, SUM(count)::bigint AS n FROM population_cohorts
       WHERE NOT (lower(species) = ANY($1::text[])) AND count > 0 GROUP BY 1, 2 ORDER BY 1, 2`,
      [GONE]
    );
    const townMix = new Map<number, Weights>();
    const worldMix = new Map<string, number>();
    for (const r of mix.rows) {
      const b = Number(r.burg_id);
      if (!townMix.has(b)) townMix.set(b, []);
      townMix.get(b)!.push([String(r.species), Number(r.n)]);
      worldMix.set(String(r.species), (worldMix.get(String(r.species)) || 0) + Number(r.n));
    }
    const world: Weights = Array.from(worldMix.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (world.length === 0) world.push([DEFAULT_SPECIES, 1]);
    const mixFor = (burg: unknown) => townMix.get(Number(burg)) || world;

    // 1. Cohorts.
    const coh = await client.query(
      `SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count FROM population_cohorts
       WHERE lower(species) = ANY($1::text[]) ORDER BY burg_id, profession, age_band, spark_tier, is_null, allegiance`,
      [GONE]
    );
    let movedPeople = 0;
    for (const c of coh.rows) {
      movedPeople += Number(c.count);
      for (const [sp, n] of split(Number(c.count), mixFor(c.burg_id))) {
        await client.query(
          `INSERT INTO population_cohorts (burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (burg_id, species, profession, age_band, spark_tier, is_null, allegiance)
           DO UPDATE SET count = population_cohorts.count + EXCLUDED.count`,
          [c.burg_id, sp, c.profession, c.age_band, c.spark_tier, c.is_null, c.allegiance, n]
        );
      }
    }
    await client.query(`DELETE FROM population_cohorts WHERE lower(species) = ANY($1::text[])`, [GONE]);

    // 2. Named people: a species from their town, and a name from that species' culture, unique in town.
    const named = (await client.query(
      `SELECT citizen_id, settlement_id, name, profession FROM population_demographics
       WHERE lower(species) = ANY($1::text[]) ORDER BY citizen_id`,
      [GONE]
    )).rows;
    const towns = Array.from(new Set(named.map((p) => Number(p.settlement_id)).filter((b) => b > 0)));
    const books = await loadTownNameBooks(client, towns);
    const renames: Array<{ id: number; from: string; to: string; species: string; prof: string }> = [];
    for (const p of named) {
      const rng = mulberry32(hashSeed(`dehuman:${p.citizen_id}`));
      const species = pickWeighted(mixFor(p.settlement_id), rng);
      const town = Number(p.settlement_id);
      if (!books.has(town)) books.set(town, new NameBook());
      const to = books.get(town)!.make(species, rng);
      renames.push({ id: Number(p.citizen_id), from: String(p.name), to, species, prof: String(p.profession || "") });
    }
    for (const r of renames) {
      await client.query(`UPDATE population_demographics SET species = $2, name = $3 WHERE citizen_id = $1`, [r.id, r.species, r.to]);
      await client.query(
        `UPDATE entities SET name = CASE WHEN $3 <> '' THEN $2 || ' (' || $3 || ')' ELSE $2 END WHERE ref = $1`,
        [`citizen:${r.id}`, r.to, r.prof]
      );
      await client.query(
        `UPDATE sim_life_events SET text = replace(text, $2, $3)
         WHERE citizen_id = $1 OR other_citizen_id = $1`,
        [r.id, r.from, r.to]
      );
    }
    const byId = new Map(renames.map((r) => [r.id, r]));
    const tied = renames.length
      ? (await client.query(
          `SELECT citizen_id, social_links FROM population_demographics
           WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(social_links, '[]'::jsonb)) l
                         WHERE (l->>'citizenId')::int = ANY($1::int[]))`,
          [renames.map((r) => r.id)]
        )).rows
      : [];
    for (const t of tied) {
      const links = (t.social_links as any[]).map((l) => (byId.has(Number(l.citizenId)) ? { ...l, name: byId.get(Number(l.citizenId))!.to } : l));
      await client.query(`UPDATE population_demographics SET social_links = $2::jsonb WHERE citizen_id = $1`, [t.citizen_id, JSON.stringify(links)]);
    }

    // 3. Agents, map NPC instances, promoted slots: species from their home town.
    let others = 0;
    const agents = (await client.query(`SELECT id, home_burg_id FROM sim_agents WHERE lower(species) = ANY($1::text[]) ORDER BY id`, [GONE])).rows;
    for (const a of agents) {
      await client.query(`UPDATE sim_agents SET species = $2 WHERE id = $1`, [a.id, pickWeighted(mixFor(a.home_burg_id), mulberry32(hashSeed(`dehuman:agent:${a.id}`)))]);
      others++;
    }
    const inst = (await client.query(`SELECT ctid::text AS k FROM sim_npc_instances WHERE lower(species) = ANY($1::text[])`, [GONE])).rows;
    for (const i of inst) {
      await client.query(`UPDATE sim_npc_instances SET species = $2 WHERE ctid = $1::tid`, [i.k, pickWeighted(world, mulberry32(hashSeed(`dehuman:npc:${i.k}`)))]);
      others++;
    }
    const slots = (await client.query(`SELECT citizen_id FROM promoted_slots WHERE lower(species) = ANY($1::text[])`, [GONE])).rows;
    for (const s of slots) {
      const r = byId.get(Number(s.citizen_id));
      await client.query(`UPDATE promoted_slots SET species = $2 WHERE citizen_id = $1`, [s.citizen_id, r ? r.species : DEFAULT_SPECIES]);
      others++;
    }

    // 4. Town species mixes.
    const burgs = (await client.query(`SELECT burg_id, species_demographics FROM sim_burg_economy WHERE species_demographics ILIKE '%human%'`)).rows;
    let mixes = 0;
    for (const b of burgs) {
      let demo: Record<string, number> = {};
      try { demo = JSON.parse(b.species_demographics || "{}"); } catch { continue; }
      const kept = Object.entries(demo).filter(([s]) => !isGone(s));
      if (kept.length === Object.keys(demo).length) continue;
      const total = kept.reduce((a, [, x]) => a + Number(x), 0);
      const next = total > 0 ? Object.fromEntries(kept.map(([s, x]) => [s, Math.round((Number(x) / total) * 1000) / 1000])) : { [DEFAULT_SPECIES]: 1 };
      await client.query(`UPDATE sim_burg_economy SET species_demographics = $2 WHERE burg_id = $1`, [b.burg_id, JSON.stringify(next)]);
      mixes++;
    }

    // 5. Map NPCs: renamed people, and "human" tags.
    const layers = (await client.query(
      `SELECT cell_id, rx, ry, z_layer, npcs FROM sim_sector_layers WHERE npcs::text ILIKE '%human%' OR npcs::text ~ $1`,
      [renames.length ? renames.map((r) => `npc_citizen_${r.id}"`).join("|") : "^$"]
    )).rows;
    for (const l of layers) {
      const npcs = (l.npcs as any[]).map((n) => {
        let m = { ...n };
        if (Array.isArray(m.tags)) m.tags = m.tags.map((t: string) => (isGone(t) ? "mammal" : t));
        if (isGone(m.species)) m.species = DEFAULT_SPECIES;
        const r = byId.get(Number(String(m.id || "").replace("npc_citizen_", "")));
        if (r && String(m.id).startsWith("npc_citizen_")) {
          const role = /\(([^)]*)\)\s*$/.exec(String(m.name || ""));
          m.name = role ? `${r.to} (${role[1]})` : r.to;
          m.species = r.species;
        }
        return m;
      });
      await client.query(
        `UPDATE sim_sector_layers SET npcs = $5::jsonb WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4`,
        [l.cell_id, l.rx, l.ry, l.z_layer, JSON.stringify(npcs)]
      );
    }

    // Nothing human may remain.
    const left = (await client.query(
      `SELECT (SELECT COUNT(*) FROM population_cohorts WHERE lower(species) = ANY($1::text[]))
            + (SELECT COUNT(*) FROM population_demographics WHERE lower(species) = ANY($1::text[]))
            + (SELECT COUNT(*) FROM sim_agents WHERE lower(species) = ANY($1::text[]))
            + (SELECT COUNT(*) FROM sim_npc_instances WHERE lower(species) = ANY($1::text[])) AS n`,
      [GONE]
    )).rows[0].n;

    console.log(`[canon] ${db}: ${movedPeople} people in ${coh.rowCount} cohorts moved to their towns' own peoples; ` +
      `${renames.length} named people re-kinned and renamed; ${others} agents/NPCs; ${mixes} town mixes; ${layers.length} map layers. Left: ${left}.`);
    for (const r of renames.slice(0, 12)) console.log(`  #${r.id} ${r.from} -> ${r.to} (${r.species})`);
    if (renames.length > 12) console.log(`  ...and ${renames.length - 12} more`);
    if (Number(left) !== 0) throw new Error(`${left} human records remain`);

    if (apply) {
      await client.query("COMMIT");
      console.log("[canon] Applied.");
    } else {
      await client.query("ROLLBACK");
      console.log("[canon] Dry run (rolled back). Rerun with --apply.");
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[canon] failed:", e?.message || e);
  process.exit(1);
});
