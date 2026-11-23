import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { parseAzgaarMap } from "../db/parseAzgaarMap.js";
import { VERGE_COORD, CORAL_CROWN_COORD } from "../engine/canon/dragonPrisons.js";

async function main() {
  console.log("=== Testing Ostraka_full.map Parser & Seeded DB Datasets ===");

  try {
    // 1. Verify direct .map parsing & reGraph() reconstruction
    const parsed = parseAzgaarMap();
    assert.equal(parsed.width, 6125, `Expected width 6125, got ${parsed.width}`);
    assert.equal(parsed.height, 2496, `Expected height 2496, got ${parsed.height}`);
    assert.equal(parsed.cells.length, 58091, `Expected 58091 cells, got ${parsed.cells.length}`);
    assert.equal(parsed.states.length, 27, `Expected 27 active states, got ${parsed.states.length}`);
    assert.equal(parsed.burgs.length, 189, `Expected 189 burgs, got ${parsed.burgs.length}`);
    assert.equal(parsed.cultures.length, 75, `Expected 75 cultures, got ${parsed.cultures.length}`);
    assert.equal(parsed.religions.length, 42, `Expected 42 religions, got ${parsed.religions.length}`);
    assert.equal(parsed.goods.length, 71, `Expected 71 goods, got ${parsed.goods.length}`);
    assert.equal(parsed.markets.length, 31, `Expected 31 markets, got ${parsed.markets.length}`);
    assert.equal(parsed.deals.length, 3837, `Expected 3837 deals, got ${parsed.deals.length}`);
    assert.equal(parsed.rivers.length, 1625, `Expected 1625 rivers, got ${parsed.rivers.length}`);
    assert.equal(parsed.routes.length, 1685, `Expected 1685 routes, got ${parsed.routes.length}`);
    assert.ok(parsed.markers.length >= 15, `Expected >= 15 markers, got ${parsed.markers.length}`);

    const excelsis = parsed.burgs.find((b) => Number(b.i) === 1);
    assert.ok(excelsis, "Burg #1 (Excelsis Citadel) missing from parsed burgs");
    assert.equal(excelsis.name, "Excelsis Citadel");
    assert.equal(Number(excelsis.cell), 30627);
    assert.equal(Number(excelsis.state), 29);

    const vergeMarker = parsed.markers.find((m) => Number(m.cell) === VERGE_COORD.cell);
    assert.ok(vergeMarker, `Verge marker missing at cell ${VERGE_COORD.cell}`);

    const sevenFallsMarker = parsed.markers.find((m) => Number(m.cell) === 30987);
    assert.ok(sevenFallsMarker, "Seven Falls marker missing at cell 30987");

    const coralCell = parsed.cells[CORAL_CROWN_COORD.cell];
    assert.ok(coralCell && coralCell.geometry, `Coral Crown cell ${CORAL_CROWN_COORD.cell} missing`);

    const cell30627 = parsed.cells[30627];
    assert.ok(cell30627 && cell30627.geometry, "Cell 30627 missing reconstructed Voronoi geometry");
    const poly = JSON.parse(cell30627.geometry);
    assert.equal(poly.type, "Polygon");
    assert.ok(Array.isArray(poly.coordinates?.[0]) && poly.coordinates[0].length >= 4);

    console.log("1. parseAzgaarMap() exact reGraph() & entities... PASSED");

    // 2. Verify PostgreSQL ingested Ostraka tables & datasets
    const countOf = async (table: string) => {
      const res = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${table}`);
      return Number(res.rows[0].cnt);
    };

    assert.equal(await countOf("sim_cells"), 58091, "sim_cells row count mismatch");
    assert.equal(await countOf("sim_burg_economy"), 189, "sim_burg_economy row count mismatch");
    assert.equal(await countOf("sim_cultures"), 75, "sim_cultures row count mismatch");
    assert.equal(await countOf("sim_religions"), 42, "sim_religions row count mismatch");
    assert.equal(await countOf("sim_goods"), 71, "sim_goods row count mismatch");
    assert.equal(await countOf("sim_markets"), 31, "sim_markets row count mismatch");
    assert.equal(await countOf("sim_trade_deals"), 3837, "sim_trade_deals row count mismatch");
    assert.equal(await countOf("sim_rivers"), 1625, "sim_rivers row count mismatch");
    assert.equal(await countOf("sim_roads"), 1685, "sim_roads row count mismatch");
    assert.equal(await countOf("sim_route_graph"), 14984, "sim_route_graph row count mismatch");
    assert.equal(await countOf("sim_faction_units"), 144, "sim_faction_units row count mismatch");
    assert.equal(await countOf("sim_sacred_groves"), 12, "sim_sacred_groves row count mismatch");
    assert.equal(await countOf("sim_chaos_flows"), 12, "sim_chaos_flows row count mismatch");
    assert.ok((await countOf("sim_world_landmarks")) >= 15, "sim_world_landmarks count < 15");

    const dbExcelsisRes = await pool.query(
      `SELECT b.burg_id, b.name, b.cell_id, b.pop_null, b.pop_attuned, f.name AS faction_name
       FROM sim_burg_economy b
       LEFT JOIN sim_cells c ON c.id = b.cell_id
       LEFT JOIN sim_factions f ON f.id = c.faction_id
       WHERE b.burg_id = 1`
    );
    assert.equal(dbExcelsisRes.rows.length, 1, "DB missing Excelsis Citadel (burg_id = 1)");
    const dbExcelsis = dbExcelsisRes.rows[0];
    assert.equal(dbExcelsis.name, "Excelsis Citadel");
    assert.equal(Number(dbExcelsis.cell_id), 30627);
    assert.equal(dbExcelsis.faction_name, "Avian Empire");

    const minPopRes = await pool.query(
      `SELECT MIN(pop_null)::int AS min_null, MIN(pop_attuned)::int AS min_attuned FROM sim_burg_economy`
    );
    assert.ok(Number(minPopRes.rows[0].min_null) >= 50, "Expected pop_null floor >= 50");
    assert.ok(Number(minPopRes.rows[0].min_attuned) >= 50, "Expected pop_attuned floor >= 50");

    const seqRes = await pool.query(`SELECT last_value::int AS lv FROM sim_factions_id_seq`);
    assert.ok(Number(seqRes.rows[0].lv) >= 54, `Expected sim_factions_id_seq >= 54, got ${seqRes.rows[0].lv}`);

    console.log("2. Live PostgreSQL Ostraka datasets & Excelsis Citadel slice... PASSED");
    console.log("ALL OSTRAKA MAP PARSER & DB TESTS PASSED");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
