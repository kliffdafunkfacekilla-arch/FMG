import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { flushStepDeltas } from "../engine/deltas/index.js";
import { mapNpcIdToEntityRef, npcMatchesRef } from "../engine/entities/refs.js";
import { backfillEntities, ensureEntity, getEntityByRef, markEntityDead } from "../engine/entities/registry.js";
import { generateBurgSectorLayers } from "../engine/maps/SectorMapGenerator.js";
import { generateWardDistrictMap } from "../engine/maps/WardDistrict.js";
import { validateActorIds } from "../engine/threads/threadEngine.js";
import { isolateTest } from "./testIsolation.js";

async function main() {
  console.log("=== Testing Unified Entity Registry & Map References (Phase 4) ===");
  await migrate(pool);

  // 1. Backfill populates entities idempotently without bulk-inserting all ~320k civilians
  const { totalEntities } = await backfillEntities(pool, 1);
  assert.ok(totalEntities > 0 && totalEntities < 50000, `Unexpected backfill count: ${totalEntities}`);
  const afterSecond = await backfillEntities(pool, 1);
  assert.equal(afterSecond.totalEntities, totalEntities, "backfillEntities must be idempotent");
  console.log(`1. backfillEntities idempotent (${totalEntities} entities registered)... PASSED`);

  // 2. Every actor_id in sim_threads resolves via the registry (and fake IDs fail Rule 7)
  const threadsRes = await pool.query(`SELECT id, actor_ids FROM sim_threads ORDER BY id ASC`);
  for (const row of threadsRes.rows) {
    const checkRes = await validateActorIds(pool, row.actor_ids || []);
    assert.equal(checkRes.valid, true, `Thread #${row.id} failed entity validation: ${JSON.stringify(checkRes.invalidIds)}`);
    for (const rawAid of row.actor_ids || []) {
      const ref = rawAid.startsWith("npc_") ? mapNpcIdToEntityRef(rawAid) : rawAid;
      if (/^(paragon|citizen|agent|faction|player):/.test(ref)) {
        const ent = await getEntityByRef(pool, ref);
        assert.ok(ent, `Thread #${row.id} actor "${rawAid}" missing from entities registry`);
      }
    }
  }
  const fakeCheck = await validateActorIds(pool, ["paragon:99999999", "citizen:99999999", "hallucinated_bob"]);
  assert.equal(fakeCheck.valid, false);
  assert.equal(fakeCheck.invalidIds.length, 3);
  console.log("2. Thread actor_ids resolve through registry & hallucinated IDs rejected... PASSED");

  // 3. Cached map NPCs carry entity_ref and resolve in entities
  const layersRes = await pool.query(
    `SELECT cell_id, rx, ry, npcs FROM sim_sector_layers WHERE jsonb_array_length(COALESCE(npcs, '[]'::jsonb)) > 0`
  );
  assert.ok(layersRes.rows.length > 0, "Need at least 1 cached sector layer with NPCs");
  for (const row of layersRes.rows) {
    for (const npc of row.npcs) {
      assert.ok(npc.entity_ref, `Cached NPC ${npc.id} at cell ${row.cell_id} missing entity_ref`);
      const ent = await getEntityByRef(pool, npc.entity_ref);
      assert.ok(ent, `Cached NPC entity_ref ${npc.entity_ref} missing from entities table`);
    }
  }
  console.log("3. Cached sim_sector_layers NPCs carry entity_ref & registry rows... PASSED");

  // 4. SectorMapGenerator & WardDistrict stamp entity_ref while preserving legacy npc_* ids
  const sampleMap = generateBurgSectorLayers(
    { burg_id: 1, name: "Excelsis", urban_tier: 2, pop_null: 200, wealth: 500, unrest: 10, walls: true, citadel: true },
    "Avian Empire",
    30627,
    [{ citizen_id: 42, name: "Kaelen Test", profession: "Smith", species: "Wolf-Kin", spark_tier: "NONE" }],
    [],
    [{ id: 7, name: "Lord Vance", title: "Mayor", corruption_score: 0 }]
  );
  assert.ok(sampleMap.layer0.npcs.length > 0);
  for (const n of [...sampleMap.layer0.npcs, ...sampleMap.layerMinus1.npcs, ...sampleMap.layerPlus1.npcs]) {
    assert.ok(n.id.startsWith("npc_"), `Legacy id must stay npc_*: ${n.id}`);
    assert.ok(n.entity_ref, `Generated NPC ${n.id} missing entity_ref`);
  }
  assert.ok(npcMatchesRef({ id: "npc_paragon_7", entity_ref: "paragon:7" }, ["paragon:7"]));

  const wardMap = generateWardDistrictMap({
    burg: { burg_id: 1, name: "Excelsis", urban_tier: 2, walls: true, citadel: true },
    factionName: "Avian Empire",
    cellId: 30627,
    rx: 49,
    ry: 50,
    ward: "CITADEL",
    biomeId: 4,
    citizens: [{ citizen_id: 42, name: "Kaelen Test", profession: "Guard", species: "Wolf-Kin" }],
    paragons: [{ id: 8, name: "Captain Brandt", title: "Watch Commander" }],
  });
  for (const n of wardMap.npcs) {
    assert.ok(n.entity_ref, `Ward NPC ${n.id} missing entity_ref`);
  }
  console.log("4. SectorMapGenerator & WardDistrict stamp entity_ref cleanly... PASSED");

  // 5. Deleting/killing a paragon marks its entity dead; ensureEntity promotes ordinary citizens on demand
  const paragonRow = (await pool.query(`SELECT id FROM sim_paragons ORDER BY id ASC LIMIT 1`)).rows[0];
  assert.ok(paragonRow);
  const pRef = `paragon:${paragonRow.id}`;
  await pool.query("SAVEPOINT entity_death_test");
  await flushStepDeltas(pool, "test:entity", 55, [{ kind: "entity.die", ref: pRef, diedTick: 55 }]);
  const deadEnt = await getEntityByRef(pool, pRef);
  assert.equal(deadEnt?.alive, false, "entity.die delta must mark entity alive = false");
  assert.equal(deadEnt?.died_tick, 55);
  await pool.query("ROLLBACK TO SAVEPOINT entity_death_test");

  await pool.query("SAVEPOINT entity_mark_test");
  await markEntityDead(pool, pRef, 77);
  const deadDirect = await getEntityByRef(pool, pRef);
  assert.equal(deadDirect?.alive, false);
  assert.equal(deadDirect?.died_tick, 77);
  const anyCit = (await pool.query(`SELECT citizen_id FROM population_demographics ORDER BY citizen_id DESC LIMIT 1`)).rows[0];
  const promoted = await ensureEntity(pool, `citizen:${anyCit.citizen_id}`);
  assert.ok(promoted && promoted.ref === `citizen:${anyCit.citizen_id}`, "ensureEntity must register valid citizen on demand");
  assert.equal(await ensureEntity(pool, "citizen:999999999"), null, "ensureEntity must reject non-existent IDs");
  await pool.query("ROLLBACK TO SAVEPOINT entity_mark_test");
  console.log("5. entity.die / markEntityDead & on-demand ensureEntity verified... PASSED");

  console.log("\nALL ENTITY REGISTRY TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ENTITY REGISTRY TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
