import { Grid } from "../../core/types";

export interface EcologyState {
  plants: Float32Array;
  herbivores: Float32Array;
  predators: Float32Array;
}

export function initializeEcology(cellsCount: number, heights?: Uint8Array): EcologyState {
  const plants = new Float32Array(cellsCount);
  const herbivores = new Float32Array(cellsCount);
  const predators = new Float32Array(cellsCount);

  for (let i = 0; i < cellsCount; i++) {
    const isOcean = heights ? heights[i] < 20 : false;
    plants[i] = isOcean ? 50.0 : 100.0;      // Initial plant/phytoplankton population
    herbivores[i] = isOcean ? 10.0 : 20.0;    // Initial herbivore/zooplankton population
    predators[i] = isOcean ? 2.0 : 5.0;       // Initial predator/marine carnivore population
  }

  return { plants, herbivores, predators };
}

export interface EcologyRates {
  plantGrowthRate: number;
  herbivoreGrazingRate: number;
  herbivoreReproductionRate: number;
  herbivoreDeathRate: number;
  predatorHuntingRate: number;
  predatorReproductionRate: number;
  predatorDeathRate: number;
}

// Check if a biome is a barrier for general land wildlife migration
// Biome indices: 1 = Marine, 2 = Lake, 3 = Desert, 12 = Glacier
function isBiomeBarrier(biome: number): boolean {
  return biome === 1 || biome === 2 || biome === 3 || biome === 12;
}

export function simulateEcologyStep(
  state: EcologyState,
  grid: Grid,
  heights: Uint8Array,
  temp: Float32Array,
  prec: Uint8Array,
  biomes: Uint8Array,
  farmingCells: Uint8Array,
  loggingCells: Uint8Array,
  rates: EcologyRates,
  magicEcologyWeights?: Float32Array,
  oceanNutrients?: Float32Array
): Uint8Array {
  const pointsN = heights.length;
  const nextPlants = new Float32Array(pointsN);
  const nextHerbivores = new Float32Array(pointsN);
  const nextPredators = new Float32Array(pointsN);
  const updatedBiomes = new Uint8Array(biomes);

  // 1. Cellular Automata: Logistical growth and Predator-Prey dynamics
  for (let i = 0; i < pointsN; i++) {
    const P = state.plants[i];
    const H = state.herbivores[i];
    const C = state.predators[i];

    // Climate influence on Carrying Capacity K
    // Optimal growth at 15°C to 25°C, suppressed by freezing cold (< 0°C) or severe drought (< 10 prec)
    const tVal = temp[i];
    const pVal = prec[i];

    let tempFactor = 1.0;
    if (tVal < 0) tempFactor = 0.1;
    else if (tVal < 10) tempFactor = 0.5;
    else if (tVal > 35) tempFactor = 0.3;

    let precFactor = 1.0;
    if (pVal < 10) precFactor = 0.1;
    else if (pVal < 30) precFactor = 0.6;

    const baseK = heights[i] < 20 ? 100.0 : 800.0;
    let K = baseK * tempFactor * precFactor;
    if (heights[i] < 20 && oceanNutrients) {
      K = Math.max(10.0, oceanNutrients[i] * 5.0);
    }

    // Lotka-Volterra dynamics with logistical limits
    const magMult = magicEcologyWeights ? magicEcologyWeights[i] : 1.0;
    const growthMult = Math.max(0.1, magMult);
    let plantGrowth = rates.plantGrowthRate * P * (1 - P / Math.max(1, K)) * growthMult;
    let plantLoss = rates.herbivoreGrazingRate * P * H;

    let herbivoreGrowth = rates.herbivoreReproductionRate * P * H;
    let herbivoreLoss = rates.herbivoreDeathRate * H + rates.predatorHuntingRate * H * C;

    let predatorGrowth = rates.predatorReproductionRate * H * C;
    let predatorLoss = rates.predatorDeathRate * C;

    // Apply Human Stressors
    const isFarming = farmingCells[i] === 1;
    const isLogging = loggingCells[i] === 1;

    if (isFarming) {
      // Farming locks plant growth at crop baseline, and wipes out wildlife
      nextPlants[i] = 400.0;
      nextHerbivores[i] = H * 0.7; // rapid population collapse due to hunting/fences
      nextPredators[i] = C * 0.7;
    } else {
      nextPlants[i] = Math.max(0, P + plantGrowth - plantLoss);
      nextHerbivores[i] = Math.max(0, H + herbivoreGrowth - herbivoreLoss);
      nextPredators[i] = Math.max(0, C + predatorGrowth - predatorLoss);
    }

    if (isLogging) {
      // Direct plant depletion
      nextPlants[i] = Math.max(0, nextPlants[i] - 15.0);

      // Gradual Deforestation Biome Shift:
      // Coniferous Forest (6), Deciduous Forest (8), Tropical Forest (9) convert to Grassland (5) if plants drop < 20
      const currentBiome = updatedBiomes[i];
      const isForest = currentBiome === 6 || currentBiome === 8 || currentBiome === 9;
      if (isForest && nextPlants[i] < 20.0) {
        updatedBiomes[i] = 5; // Convert to Grassland
      }
    }
  }

  // 2. Organism Migration (Diffusion Step)
  const migrationRate = 0.05; // 5% migration to neighbors
  const diffusedP = new Float32Array(pointsN);
  const diffusedH = new Float32Array(pointsN);
  const diffusedC = new Float32Array(pointsN);

  for (let i = 0; i < pointsN; i++) {
    const neighbors = grid.cells.c[i] || [];
    if (neighbors.length === 0) continue;

    const currentBiome = updatedBiomes[i];
    const isLand = heights[i] >= 20;

    // Plants propagate seeds slowly
    const plantMigVal = nextPlants[i] * migrationRate * 0.2;
    // Animals migrate faster
    const herbMigVal = nextHerbivores[i] * migrationRate;
    const predMigVal = nextPredators[i] * migrationRate;

    let validNeighborsCount = 0;
    for (const n of neighbors) {
      const targetBiome = updatedBiomes[n];
      const targetLand = heights[n] >= 20;

      // Biome compatibility barriers
      const isWaterBarrier = isLand !== targetLand;
      const isExtremeBarrier = isBiomeBarrier(targetBiome);

      if (!isWaterBarrier && !isExtremeBarrier) {
        validNeighborsCount++;
        diffusedP[n] += plantMigVal / neighbors.length;
        diffusedH[n] += herbMigVal / neighbors.length;
        diffusedC[n] += predMigVal / neighbors.length;
      }
    }

    // Retain non-migrated population in original cell
    const migratedFraction = (validNeighborsCount / neighbors.length) * migrationRate;
    nextPlants[i] -= nextPlants[i] * migratedFraction * 0.2;
    nextHerbivores[i] -= nextHerbivores[i] * migratedFraction;
    nextPredators[i] -= nextPredators[i] * migratedFraction;
  }

  // 3. Accumulate diffusion values and write back to state arrays
  for (let i = 0; i < pointsN; i++) {
    if (farmingCells[i] === 1) {
      state.plants[i] = 400.0;
      state.herbivores[i] = Math.max(0, nextHerbivores[i] * 0.7);
      state.predators[i] = Math.max(0, nextPredators[i] * 0.7);
    } else {
      state.plants[i] = Math.max(0, nextPlants[i] + diffusedP[i]);
      state.herbivores[i] = Math.max(0, nextHerbivores[i] + diffusedH[i]);
      state.predators[i] = Math.max(0, nextPredators[i] + diffusedC[i]);
    }
  }

  return updatedBiomes;
}
