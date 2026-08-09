import { describe, it, expect } from "vitest";
import { initializeEcology, simulateEcologyStep, EcologyRates } from "./ecology-simulator";
import { Grid } from "../../core/types";

describe("Cellular Automata Ecology Simulation", () => {
  const mockGrid: Grid = {
    cellsDesired: 10,
    cellsX: 5,
    cellsY: 2,
    points: [[100, 100], [200, 100], [300, 100], [400, 100], [500, 100], [100, 200], [200, 200], [300, 200], [400, 200], [500, 200]],
    cells: {
      v: [[1, 2], [0, 2], [0, 1]],
      c: [[1, 5], [0, 2, 6], [1, 3, 7], [2, 4, 8], [3, 9], [0, 6], [1, 5, 7], [2, 6, 8], [3, 7, 9], [4, 8]],
      b: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      i: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    },
    vertices: { p: [], v: [], c: [] }
  };

  const rates: EcologyRates = {
    plantGrowthRate: 0.1,
    herbivoreGrazingRate: 0.001,
    herbivoreReproductionRate: 0.0005,
    herbivoreDeathRate: 0.05,
    predatorHuntingRate: 0.002,
    predatorReproductionRate: 0.001,
    predatorDeathRate: 0.1,
  };

  it("initializes ecology with correct array types and default values", () => {
    const cellsCount = 10;
    const state = initializeEcology(cellsCount);

    expect(state.plants).toBeInstanceOf(Float32Array);
    expect(state.herbivores).toBeInstanceOf(Float32Array);
    expect(state.predators).toBeInstanceOf(Float32Array);

    expect(state.plants.length).toBe(cellsCount);
    expect(state.herbivores.length).toBe(cellsCount);
    expect(state.predators.length).toBe(cellsCount);

    expect(state.plants[0]).toBe(100.0);
    expect(state.herbivores[0]).toBe(20.0);
    expect(state.predators[0]).toBe(5.0);
  });

  it("models human stressors: farming locks plants and suppresses wildlife", () => {
    const pointsN = 10;
    const state = initializeEcology(pointsN);
    const heights = new Uint8Array(pointsN).fill(25);
    const temp = new Float32Array(pointsN).fill(20);
    const prec = new Uint8Array(pointsN).fill(100);
    const biomes = new Uint8Array(pointsN).fill(6); // Coniferous Forest

    const farmingCells = new Uint8Array(pointsN).fill(0);
    farmingCells[3] = 1; // Cell 3 is farmed

    const loggingCells = new Uint8Array(pointsN).fill(0);

    simulateEcologyStep(state, mockGrid, heights, temp, prec, biomes, farmingCells, loggingCells, rates);

    // Farmed cell 3 should have locked plant value and suppressed herbivores
    expect(state.plants[3]).toBe(400.0);
    expect(state.herbivores[3]).toBeLessThan(20.0 * 0.7 + 0.1); // Wiped out
  });

  it("models human stressors: logging depletes forest mass and triggers biome shifts", () => {
    const pointsN = 10;
    const state = initializeEcology(pointsN);
    // Lower initial plant mass on cell 5 to test threshold
    state.plants[5] = 30.0;

    const heights = new Uint8Array(pointsN).fill(25);
    const temp = new Float32Array(pointsN).fill(20);
    const prec = new Uint8Array(pointsN).fill(100);
    const biomes = new Uint8Array(pointsN).fill(6); // Coniferous Forest

    const farmingCells = new Uint8Array(pointsN).fill(0);
    const loggingCells = new Uint8Array(pointsN).fill(0);
    loggingCells[5] = 1; // Cell 5 is logged

    const nextBiomes = simulateEcologyStep(state, mockGrid, heights, temp, prec, biomes, farmingCells, loggingCells, rates);

    // Logged cell 5 plant density should fall below 20.0, converting biome to Grassland (5)
    expect(state.plants[5]).toBeLessThan(20.0);
    expect(nextBiomes[5]).toBe(5); // Grassland
  });

  it("organism migration is blocked by water/extreme biomes", () => {
    const pointsN = 10;
    const state = initializeEcology(pointsN);
    
    // Set high herbivore density on cell 0 to watch diffusion
    state.herbivores[0] = 500.0;
    // Set all other cells to 0 herbivores
    for (let i = 1; i < pointsN; i++) {
      state.herbivores[i] = 0.0;
    }

    const heights = new Uint8Array(pointsN).fill(25);
    // Make cell 1 (neighbor of cell 0) water (height 10)
    heights[1] = 10;

    const temp = new Float32Array(pointsN).fill(20);
    const prec = new Uint8Array(pointsN).fill(100);
    const biomes = new Uint8Array(pointsN).fill(6);

    const farmingCells = new Uint8Array(pointsN).fill(0);
    const loggingCells = new Uint8Array(pointsN).fill(0);

    simulateEcologyStep(state, mockGrid, heights, temp, prec, biomes, farmingCells, loggingCells, rates);

    // Cell 1 is a water barrier, so herbivores should not diffuse into it (should stay 0 or near 0)
    expect(state.herbivores[1]).toBe(0.0);
    
    // Cell 5 is land neighbor, so herbivores should diffuse into cell 5
    expect(state.herbivores[5]).toBeGreaterThan(0.0);
  });
});
