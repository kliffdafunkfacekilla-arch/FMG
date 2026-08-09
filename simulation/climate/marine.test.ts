import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import {
  calculateOceanCurrents,
  calculateUpwellingFlux,
  calculateOceanNutrients
} from "./marine-simulator";
import { initializeEcology, simulateEcologyStep } from "../ecology/ecology-simulator";

describe("Physical Marine Simulation", () => {
  it("should calculate coastline current deflections, upwelling flux routing, runoff, and marine ecology", () => {
    const grid = generateJitteredGrid(600, 400, 200, "marine-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(15); // Shallow ocean shelf

    // Set land coastline cells (heights >= 20)
    for (let i = 0; i < 20; i++) {
      heights[i] = 25;
    }

    // Set a deep trench cell (height < 5) at cell 50
    heights[50] = 3;

    // 1. Wind-Driven Surface Currents
    const currents = calculateOceanCurrents(grid, heights, 1.0, 0.0); // pure easterly winds
    expect(currents.length).toBe(pointsN * 2);
    // Ocean cell 50 should have active currents, land cell 0 should have zero currents
    expect(Math.hypot(currents[50 * 2], currents[50 * 2 + 1])).toBeCloseTo(1.0, 4);
    expect(currents[0 * 2]).toBe(0);

    // 2. Upwelling Flux (Ocean Rivers)
    const upwelling = calculateUpwellingFlux(grid, heights);
    expect(upwelling.length).toBe(pointsN);
    // Upwelling should route uphill and accumulate at shelves bordering land
    expect(upwelling[50]).toBe(15.0); // Trench base spring volume

    // 3. Coastal Nutrient Runoff & Diffusion
    const flowDirs = new Int32Array(pointsN).fill(-1);
    flowDirs[5] = 40; // land cell 5 river mouth flows into ocean cell 40
    const landFlux = new Float32Array(pointsN).fill(10.0);

    const nutrients = calculateOceanNutrients(grid, heights, flowDirs, landFlux, upwelling);
    expect(nutrients.length).toBe(pointsN);
    // Coastal ocean cell 40 should receive river runoff nutrients
    expect(nutrients[40]).toBeGreaterThan(0);

    // 4. Marine Ecology Integration
    const ecoState = initializeEcology(pointsN, heights);
    expect(ecoState.plants[40]).toBe(50.0); // Initial marine phytoplankton/kelp

    const biomes = new Uint8Array(pointsN).fill(1); // Marine biome
    const farming = new Uint8Array(pointsN).fill(0);
    const logging = new Uint8Array(pointsN).fill(0);
    const temp = new Float32Array(pointsN).fill(20);
    const prec = new Uint8Array(pointsN).fill(100);

    const rates = {
      plantGrowthRate: 0.2,
      herbivoreGrazingRate: 0.001,
      herbivoreReproductionRate: 0.002,
      herbivoreDeathRate: 0.05,
      predatorHuntingRate: 0.005,
      predatorReproductionRate: 0.003,
      predatorDeathRate: 0.1
    };

    // Run one ecology step
    simulateEcologyStep(
      ecoState,
      grid,
      heights,
      temp,
      prec,
      biomes,
      farming,
      logging,
      rates,
      undefined,
      nutrients
    );

    // Phytoplankton density at nutrient-rich cell 40 should grow larger than at nutrient-starved ocean cells
    expect(ecoState.plants[40]).toBeGreaterThan(50.0);
  });
});
