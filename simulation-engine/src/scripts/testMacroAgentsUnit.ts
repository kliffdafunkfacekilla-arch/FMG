/**
 * Pure no-database unit tests for ported Phase 2.3 macro step() functions.
 */
import assert from "node:assert/strict";
import { mulberry32 } from "../engine/rng.js";
import { stepEncounter } from "../engine/macro/encounter/step.js";

function testEncounterUnit() {
  const emptyDeltas = stepEncounter({ agents: [], cellIds: [10, 20, 30] }, { tick: 2, random: mulberry32(42) });
  assert.equal(emptyDeltas.length, 0);

  const deltas = stepEncounter(
    {
      agents: [
        { id: 1, location_cell_id: 999 },
        { id: 2, location_cell_id: 999 },
      ],
      cellIds: [10, 20, 30, 40, 50],
    },
    { tick: 2, random: mulberry32(42) }
  );
  assert.equal(deltas.length, 2, "Expected one agent.update per wandering agent");
  for (const d of deltas) {
    assert.equal(d.kind, "agent.update");
    assert.ok([10, 20, 30, 40, 50].includes(d.fields.location_cell_id!), "Chosen cell must come from snapshot");
  }
  const replay = stepEncounter(
    {
      agents: [
        { id: 1, location_cell_id: 999 },
        { id: 2, location_cell_id: 999 },
      ],
      cellIds: [10, 20, 30, 40, 50],
    },
    { tick: 2, random: mulberry32(42) }
  );
  assert.deepEqual(deltas, replay, "stepEncounter must be deterministic for a fixed snapshot & seed");
  console.log("1. stepEncounter (no DB) deterministic wandering movement... PASSED");
}

function main() {
  console.log("=== Testing Pure Macro Agent step() Functions (No DB) ===");
  testEncounterUnit();
  console.log("\nALL PURE MACRO AGENT UNIT TESTS PASSED");
}

main();
