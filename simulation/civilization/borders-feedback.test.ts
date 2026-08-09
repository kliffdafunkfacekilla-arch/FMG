import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateStates } from "./state-generator";
import { Burg } from "./burg-generator";

describe("Geopolitical Border Expansionism Gates", () => {
  it("should halt border expansion for states with 0 expansionism", () => {
    const grid = generateJitteredGrid(600, 400, 500, "borders-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25); // All land
    const cellCultures = new Uint8Array(pointsN).fill(1);

    // Create 2 burgs (one for each state capital)
    const burg1: Burg = { id: 1, name: "Capital A", cell: 100, population: 5000, port: 0, type: "Generic", isCapital: true };
    const burg2: Burg = { id: 2, name: "Capital B", cell: 300, population: 4000, port: 0, type: "Generic", isCapital: true };
    const burgs = [burg1, burg2];

    // Create custom state configurations: State 1 is normal (1.0), State 2 is halted (0.0)
    const cultures = [{ id: 1, name: "Test Culture", color: "#111", center: 100, base: 1 }];

    const initial = generateStates(
      grid,
      heights,
      cellCultures,
      burgs,
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      cultures
    );

    // Override State 2 expansionism to 0 (simulating bankruptcy/starvation)
    const updatedStates = initial.states;
    const s2 = updatedStates.find(s => s.id === 2);
    if (s2) {
      s2.expansionism = 0.0;
    }

    // Rerun borders expansion passing updated states
    const rerun = generateStates(
      grid,
      heights,
      cellCultures,
      burgs,
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      cultures,
      updatedStates
    );

    const state1Cells = rerun.cellStates.filter(sId => sId === 1).length;
    const state2Cells = rerun.cellStates.filter(sId => sId === 2).length;

    expect(state1Cells).toBeGreaterThan(5);
    expect(state2Cells).toBeLessThanOrEqual(2); // Only capital cell is assigned
  });
});
