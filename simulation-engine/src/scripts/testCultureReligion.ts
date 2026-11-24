import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { runCultureReligionAgent } from "../engine/agents/cultureReligionAgent.js";
import { runSeeded, tickSeed } from "../engine/rng.js";

async function main() {
  console.log("=== Testing Culture Assimilation, Heresy Diffusion & Temple Pushback (B6.5) ===");
  await applySchemaPatches(pool);

  const calRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS t FROM sim_calendar`);
  const probeTick = Number(calRes.rows[0].t) + 1;

  // ---------------------------------------------------------------------------
  // 1. Cell-to-cell cultural conversion along sovereign borders (land-only)
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT culture_spread");
  const pairRes = await pool.query(`
    SELECT c.id AS target_id, COALESCE(c.culture_id, 0)::int AS old_culture,
           f.id AS faction_id, f.culture_id::int AS target_culture,
           n.id AS neighbor_id
    FROM sim_cells c
    JOIN sim_factions f ON f.id = c.faction_id
    CROSS JOIN LATERAL (
      SELECT c2.id FROM sim_cells c2
      WHERE c2.id <> c.id AND c2.elevation >= 20
        AND point(c2.center_x, c2.center_y) <@ box(
          point(c.center_x::float8 - 22.0, c.center_y::float8 - 22.0),
          point(c.center_x::float8 + 22.0, c.center_y::float8 + 22.0)
        )
      ORDER BY c2.id ASC LIMIT 1
    ) n
    WHERE c.elevation >= 20 AND f.culture_id > 0 AND COALESCE(c.culture_id, 0) <> f.culture_id
    ORDER BY c.id ASC LIMIT 1
  `);
  const p1 = pairRes.rows[0];
  assert.ok(p1, "Expected a sovereign mismatched land cell pair");

  // Ensure neighbor holds the sovereign's culture and isolate to just our test frontier cell
  await pool.query(`UPDATE sim_cells SET culture_id = $1 WHERE id = $2`, [p1.target_culture, p1.neighbor_id]);
  await pool.query(`UPDATE sim_cells SET faction_id = NULL WHERE id <> $1 AND faction_id IS NOT NULL`, [p1.target_id]);

  // Also grab an ocean cell adjacent check baseline
  const oceanCell = (await pool.query(`SELECT id, COALESCE(culture_id, 0)::int AS c FROM sim_cells WHERE elevation < 20 ORDER BY id ASC LIMIT 1`)).rows[0];
  const oldCultCount = Number((await pool.query(`SELECT cells FROM sim_cultures WHERE id = $1`, [p1.target_culture])).rows[0].cells);

  let assimilated = false;
  for (let attempt = 0; attempt < 6 && !assimilated; attempt++) {
    const res = await runSeeded(tickSeed(probeTick + attempt), () =>
      runCultureReligionAgent(pool, probeTick + attempt, "Culture Probe")
    );
    const updated = Number((await pool.query(`SELECT culture_id FROM sim_cells WHERE id = $1`, [p1.target_id])).rows[0].culture_id);
    if (updated === Number(p1.target_culture) && res.cultureConversions > 0) assimilated = true;
  }
  assert.ok(assimilated, `Expected cell #${p1.target_id} to assimilate to culture #${p1.target_culture}`);
  const newCultCount = Number((await pool.query(`SELECT cells FROM sim_cultures WHERE id = $1`, [p1.target_culture])).rows[0].cells);
  assert.ok(newCultCount > oldCultCount, "Expected sim_cultures.cells count to increment upon conversion");
  if (oceanCell) {
    const oceanAfter = Number((await pool.query(`SELECT COALESCE(culture_id, 0)::int AS c FROM sim_cells WHERE id = $1`, [oceanCell.id])).rows[0].c);
    assert.equal(oceanAfter, Number(oceanCell.c), "Ocean cells must never culturally convert");
  }
  await pool.query("ROLLBACK TO SAVEPOINT culture_spread");
  console.log(`1. Sovereign cell-to-cell cultural conversion (cell #${p1.target_id} -> culture #${p1.target_culture})... PASSED`);

  // ---------------------------------------------------------------------------
  // 2. Heresy & Cult spread from Cult / Chaos Zone cell to adjacent non-temple cell
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT heresy_spread");
  const cultSect = (await pool.query(`SELECT id, name, cells FROM sim_religions WHERE type = 'Cult' ORDER BY id ASC LIMIT 1`)).rows[0];
  const orgRel = (await pool.query(`SELECT id, name FROM sim_religions WHERE type = 'Organized' ORDER BY id ASC LIMIT 1`)).rows[0];
  assert.ok(cultSect && orgRel, "Expected Cult and Organized religions in DB");

  // Pick a land cell far from any temple=true burg and its immediate land neighbor
  const heresyPair = (await pool.query(`
    SELECT c1.id AS src_id, c2.id AS target_id
    FROM sim_cells c1
    JOIN sim_cells c2 ON c2.id <> c1.id AND c2.elevation >= 20
      AND point(c2.center_x, c2.center_y) <@ box(
        point(c1.center_x::float8 - 22.0, c1.center_y::float8 - 22.0),
        point(c1.center_x::float8 + 22.0, c1.center_y::float8 + 22.0)
      )
    WHERE c1.elevation >= 20
      AND NOT EXISTS (
        SELECT 1 FROM sim_burg_economy b JOIN sim_cells bc ON bc.id = b.cell_id
        WHERE b.temple = true
          AND ((c2.center_x - bc.center_x)^2 + (c2.center_y - bc.center_y)^2) <= 900
      )
    ORDER BY c1.id ASC, c2.id ASC LIMIT 1
  `)).rows[0];
  assert.ok(heresyPair, "Expected non-temple adjacent land cell pair for heresy diffusion");

  // Clear competing Cult/chaos cells so our isolated pair fires directly
  await pool.query(`UPDATE sim_cells SET religion_id = $1 WHERE id <> $2`, [orgRel.id, heresyPair.src_id]);
  await pool.query(`DELETE FROM sim_chaos_zones`);
  await pool.query(`UPDATE sim_cells SET religion_id = $1 WHERE id = $2`, [cultSect.id, heresyPair.src_id]);
  await pool.query(`INSERT INTO sim_chaos_zones (cell_id, intensity, type) VALUES ($1, 80, 'VOID_RIFT') ON CONFLICT DO NOTHING`, [heresyPair.src_id]);

  let spread = false;
  for (let attempt = 0; attempt < 6 && !spread; attempt++) {
    await runSeeded(tickSeed(probeTick + attempt), () =>
      runCultureReligionAgent(pool, probeTick + attempt, "Heresy Probe")
    );
    const nbRel = Number((await pool.query(`SELECT religion_id FROM sim_cells WHERE id = $1`, [heresyPair.target_id])).rows[0].religion_id);
    if (nbRel === Number(cultSect.id)) spread = true;
  }
  assert.ok(spread, `Expected heresy ${cultSect.name} (#${cultSect.id}) to spread from #${heresyPair.src_id} to #${heresyPair.target_id}`);
  const cultCountAfter = Number((await pool.query(`SELECT cells FROM sim_religions WHERE id = $1`, [cultSect.id])).rows[0].cells);
  assert.ok(cultCountAfter > Number(cultSect.cells), "Expected sim_religions.cells to increment after heresy spread");
  await pool.query("ROLLBACK TO SAVEPOINT heresy_spread");
  console.log(`2. Cell-to-cell heresy spread (${cultSect.name}: #${heresyPair.src_id} -> #${heresyPair.target_id})... PASSED`);

  // ---------------------------------------------------------------------------
  // 3. `temple = true` burg shields neighborhood and reconverts nearby Cult cells
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT temple_reconvert");
  const templeSite = (await pool.query(`
    SELECT b.burg_id, b.name, bc.id AS temple_cell_id, nb.id AS cult_neighbor_id
    FROM sim_burg_economy b
    JOIN sim_cells bc ON bc.id = b.cell_id
    JOIN sim_cells nb ON nb.id <> bc.id AND nb.elevation >= 20
      AND point(nb.center_x, nb.center_y) <@ box(
        point(bc.center_x::float8 - 30.0, bc.center_y::float8 - 30.0),
        point(bc.center_x::float8 + 30.0, bc.center_y::float8 + 30.0)
      )
      AND ((nb.center_x - bc.center_x)^2 + (nb.center_y - bc.center_y)^2) <= 900.0
    WHERE b.temple = true AND (b.pop_null > 0 OR COALESCE(b.pop_attuned, 0) > 0)
    ORDER BY b.burg_id ASC, nb.id ASC LIMIT 1
  `)).rows[0];
  assert.ok(templeSite, "Expected a temple = true burg with an adjacent land cell");

  await pool.query(`UPDATE sim_cells SET religion_id = $1 WHERE id = $2`, [orgRel.id, templeSite.temple_cell_id]);
  await pool.query(`UPDATE sim_cells SET religion_id = $1 WHERE id = $2`, [cultSect.id, templeSite.cult_neighbor_id]);

  const res = await runSeeded(tickSeed(probeTick), () =>
    runCultureReligionAgent(pool, probeTick, "Temple Pushback")
  );
  assert.ok(res.templeReconversions >= 1, "Expected at least 1 temple reconversion");
  const cleansedRel = Number((await pool.query(`SELECT religion_id FROM sim_cells WHERE id = $1`, [templeSite.cult_neighbor_id])).rows[0].religion_id);
  assert.equal(cleansedRel, Number(orgRel.id), `Expected temple burg ${templeSite.name} to reconvert #${templeSite.cult_neighbor_id} to ${orgRel.name}`);
  await pool.query("ROLLBACK TO SAVEPOINT temple_reconvert");
  console.log(`3. Temple burg (${templeSite.name}) reconverted heretical neighbor #${templeSite.cult_neighbor_id} to ${orgRel.name}... PASSED`);

  console.log("\nALL CULTURE & RELIGION TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("CULTURE & RELIGION TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
