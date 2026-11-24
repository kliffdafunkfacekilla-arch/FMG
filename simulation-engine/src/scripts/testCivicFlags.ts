import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { generateBurgSectorLayers } from "../engine/maps/SectorMapGenerator.js";
import { generateWardDistrictMap } from "../engine/maps/WardDistrict.js";
import { extractBurgCivicFlags, computeSiegeDefenseMultiplier } from "../engine/maps/civicFlags.js";
import { resolveCombat } from "../engine/combatEngine.js";
import { runSeeded } from "../engine/rng.js";
import { TILE, type RegionalNeighborhood } from "../engine/maps/TacticalTerrain.js";

function countTiles(grid: Uint8Array, tileId: number): number {
  let c = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] === tileId) c++;
  return c;
}

async function main() {
  console.log("=== Testing Civic Flags in Tactical Map Gen & Sieges (B6.3) ===");
  await applySchemaPatches(pool);

  // ---------------------------------------------------------------------------
  // 1. SectorMapGenerator places structures & props driven by all 7 flags
  // ---------------------------------------------------------------------------
  const baseBurg = { burg_id: 901, name: "Bannerwatch", urban_tier: 1, wealth: 500, unrest: 10, pop_null: 800, architecture_type: "ASHLAR_STONE" };
  const fortifiedBurg = { ...baseBurg, port: true, citadel: true, walls: true, plaza: true, temple: true, shanty: true, is_capital: true };
  const bareBurg = { ...baseBurg, port: false, citadel: false, walls: false, plaza: false, temple: false, shanty: false, is_capital: false };

  const fortMap = generateBurgSectorLayers(fortifiedBurg, "Avian Empire", 30627);
  const bareMap = generateBurgSectorLayers(bareBurg, "Avian Empire", 30627);

  const fortIds = new Set(fortMap.layer0.props.map((p) => p.id));
  const bareIds = new Set(bareMap.layer0.props.map((p) => p.id));

  for (const key of ["walls", "citadel", "plaza", "temple", "port_wharf", "shanty", "capital_seat"]) {
    assert.ok(fortIds.has(`prop_civic_${key}_901`), `Missing fortified prop_civic_${key}_901`);
    assert.ok(!bareIds.has(`prop_civic_${key}_901`), `Unexpected bare prop_civic_${key}_901`);
  }
  assert.ok(countTiles(fortMap.layer0.grid, 2) > countTiles(bareMap.layer0.grid, 2), "Port flag should generate waterfront water tiles");
  assert.deepEqual(fortMap.layer0.features.civicFlags, extractBurgCivicFlags(fortifiedBurg, 1));
  console.log("1. SectorMapGenerator responds to all 7 civic flags (walls/citadel/plaza/temple/port/shanty/capital)... PASSED");

  // ---------------------------------------------------------------------------
  // 2. WardDistrict gates perimeter walls, citadel keep, plaza, temple, port, shanty
  // ---------------------------------------------------------------------------
  const zero3x3 = () => [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const countrysideHood: RegionalNeighborhood = {
    terrain: [
      [1, 1, 1],
      [1, 4, 5],
      [1, 4, 4],
    ],
    infra: [
      [0, 0, 0],
      [0, 1, 2],
      [0, 1, 1],
    ],
    biome: [
      [4, 4, 4],
      [4, 4, 4],
      [4, 4, 4],
    ],
    elevation: [
      [35, 35, 35],
      [35, 35, 35],
      [35, 35, 35],
    ],
    vegetation: zero3x3(),
    chaos: zero3x3(),
  };

  const fortCitadelWard = generateWardDistrictMap({ burg: fortifiedBurg, factionName: "Avian Empire", cellId: 30627, rx: 49, ry: 49, ward: "CITADEL", biomeId: 4, hood: countrysideHood });
  const bareCitadelWard = generateWardDistrictMap({ burg: bareBurg, factionName: "Avian Empire", cellId: 30627, rx: 49, ry: 49, ward: "CITADEL", biomeId: 4, hood: countrysideHood });
  assert.ok(countTiles(fortCitadelWard.grid, TILE.ROCK) > countTiles(bareCitadelWard.grid, TILE.ROCK), "Walls + citadel flags must generate perimeter walls & stone keep");
  assert.ok(fortCitadelWard.props.some((p) => p.id.startsWith("prop_civic_citadel_")), "Expected prop_civic_citadel in fortified CITADEL ward");
  assert.ok(fortCitadelWard.props.some((p) => p.id.startsWith("prop_gate_")), "Expected perimeter wall gate when walls=true");
  assert.ok(!bareCitadelWard.props.some((p) => p.id.startsWith("prop_gate_")), "Expected no perimeter wall gate when walls=false");

  const shantyWard = generateWardDistrictMap({ burg: fortifiedBurg, factionName: "Avian Empire", cellId: 30627, rx: 48, ry: 50, ward: "RESIDENTIAL", biomeId: 4, hood: countrysideHood });
  assert.ok(shantyWard.props.some((p) => p.id.startsWith("prop_civic_shanty_")), "Expected prop_civic_shanty in RESIDENTIAL ward");
  assert.ok(shantyWard.props.some((p) => p.id.startsWith("prop_civic_temple_")), "Expected prop_civic_temple");
  assert.ok(shantyWard.props.some((p) => p.id.startsWith("prop_civic_port_")), "Expected prop_civic_port");
  console.log("2. WardDistrict perimeter walls, keep, plaza, temple, port & shanty structures verified... PASSED");

  // ---------------------------------------------------------------------------
  // 3. Live Ostraka burgs (`Excelsis Citadel` #1 vs `Whider-Track` #153)
  // ---------------------------------------------------------------------------
  const excRow = (await pool.query(`SELECT * FROM sim_burg_economy WHERE burg_id = 1`)).rows[0];
  const whiRow = (await pool.query(`SELECT * FROM sim_burg_economy WHERE burg_id = 153`)).rows[0];
  assert.ok(excRow && whiRow, "Missing Excelsis #1 or Whider-Track #153 in sim_burg_economy");

  const excMap = generateBurgSectorLayers(excRow, "Avian Empire", Number(excRow.cell_id));
  const whiMap = generateBurgSectorLayers(whiRow, "Neutral", Number(whiRow.cell_id));
  const excProps = new Set(excMap.layer0.props.map((p) => p.id));
  const whiProps = new Set(whiMap.layer0.props.map((p) => p.id));
  assert.ok(excProps.has("prop_civic_citadel_1") && excProps.has("prop_civic_walls_1") && excProps.has("prop_civic_capital_seat_1"));
  assert.ok(!whiProps.has("prop_civic_citadel_153") && !whiProps.has("prop_civic_walls_153") && !whiProps.has("prop_civic_capital_seat_153"));
  console.log("3. Live Ostraka DB civic flags drive Excelsis #1 vs Whider-Track #153 generation... PASSED");

  // ---------------------------------------------------------------------------
  // 4. Siege resolution boosts defender score and lowers defender casualties
  // ---------------------------------------------------------------------------
  const fortMult = computeSiegeDefenseMultiplier({ walls: true, citadel: true, isCapital: true });
  const bareMult = computeSiegeDefenseMultiplier({ walls: false, citadel: false, isCapital: false });
  assert.equal(fortMult, 1.75);
  assert.equal(bareMult, 1.0);

  const fortRes = await runSeeded(12345, async () =>
    resolveCombat(
      { infantry: 28 },
      { infantry: 20 },
      { defenderFortifications: { walls: true, citadel: true, isCapital: true } }
    )
  );
  const bareRes = await runSeeded(12345, async () =>
    resolveCombat(
      { infantry: 28 },
      { infantry: 20 },
      { defenderFortifications: { walls: false, citadel: false, isCapital: false } }
    )
  );
  assert.ok(fortRes.defenderTotal > bareRes.defenderTotal * 1.6, `Fortified defender score (${fortRes.defenderTotal}) should exceed unfortified (${bareRes.defenderTotal})`);
  assert.equal(bareRes.winner, "ATTACKER", `Unfortified outnumbered defenders should lose under equal tech, got ${bareRes.winner}`);
  assert.equal(fortRes.winner, "DEFENDER", `Fortified defenders behind walls & citadel should hold, got ${fortRes.winner}`);
  assert.ok(Number(fortRes.defenderForces.infantry) > Number(bareRes.defenderForces.infantry), "Fortified defenders should preserve more troops");
  console.log(`4. Siege defense multiplier boosts defender power (${bareRes.defenderTotal} -> ${fortRes.defenderTotal})... PASSED`);

  console.log("\nALL CIVIC FLAG TESTS PASSED");
}

main()
  .then(() => pool.end().then(() => process.exit(0)))
  .catch(async (err) => {
    console.error("CIVIC FLAG TEST FAILED - COMMIT BLOCKED:", err.message || err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
