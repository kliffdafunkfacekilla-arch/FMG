import type { Grid } from "../../core/types";

export interface EcologyState {
	plants: Float32Array;
	herbivores: Float32Array;
	predators: Float32Array;
}

export function initializeEcology(
	cellsCount: number,
	heights?: Uint8Array,
): EcologyState {
	const plants = new Float32Array(cellsCount);
	const herbivores = new Float32Array(cellsCount);
	const predators = new Float32Array(cellsCount);

	for (let i = 0; i < cellsCount; i++) {
		const isOcean = heights ? heights[i] < 20 : false;
		plants[i] = isOcean ? 50.0 : 100.0; // Initial plant/phytoplankton population
		herbivores[i] = isOcean ? 10.0 : 20.0; // Initial herbivore/zooplankton population
		predators[i] = isOcean ? 2.0 : 5.0; // Initial predator/marine carnivore population
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
	oceanNutrients?: Float32Array,
	customSpecies?: any[],
	speciesPopulations?: Record<number, Float32Array>
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

		const isOcean = heights[i] < 20;

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

		let K = 800.0 * tempFactor * precFactor;

		if (isOcean) {
			const biome = biomes[i];
			let baseOceanK = 250.0; // default marine shelf (0)
			
			if (biome === 13) {
				baseOceanK = 500.0; // Shallow Reef
			} else if (biome === 14) {
				baseOceanK = 600.0; // Kelp Forest
			} else if (biome === 15) {
				baseOceanK = 150.0; // Pelagic Zone
			} else if (biome === 16) {
				baseOceanK = 40.0;  // Abyssal Plain
			} else if (biome === 17) {
				baseOceanK = 20.0;  // Oceanic Trench
			} else if (biome === 11) {
				baseOceanK = 10.0;  // Glacier/Ice Water
			}

			// Undersea carrying capacity is driven by temperature (optimal cooler for kelp, warmer for reef)
			// and boosted heavily by upwelling ocean nutrients
			const nutrientMult = oceanNutrients ? (0.5 + (oceanNutrients[i] / 40.0)) : 1.0;
			K = baseOceanK * nutrientMult * Math.max(0.2, tempFactor);
		}

		// Lotka-Volterra dynamics with logistical limits
		const magMult = magicEcologyWeights ? magicEcologyWeights[i] : 1.0;
		const growthMult = Math.max(0.1, magMult);
		const plantGrowth =
			rates.plantGrowthRate * P * (1 - P / Math.max(1, K)) * growthMult;
		const plantLoss = rates.herbivoreGrazingRate * P * H;

		const herbivoreGrowth = rates.herbivoreReproductionRate * P * H;
		const herbivoreLoss =
			rates.herbivoreDeathRate * H + rates.predatorHuntingRate * H * C;

		const predatorGrowth = rates.predatorReproductionRate * H * C;
		const predatorLoss = rates.predatorDeathRate * C;

		// Apply Human Stressors
		const isFarming = farmingCells[i] === 1;
		const isLogging = loggingCells[i] === 1;

		if (isOcean) {
			if (isFarming) {
				// Undersea kelp/algae aquaculture: locks plants at managed baseline, keeps herbivores fairly healthy
				nextPlants[i] = 300.0;
				nextHerbivores[i] = Math.max(0, H + herbivoreGrowth * 0.9 - herbivoreLoss);
				nextPredators[i] = Math.max(0, C + predatorGrowth * 0.9 - predatorLoss);
			} else {
				nextPlants[i] = Math.max(0, P + plantGrowth - plantLoss);
				nextHerbivores[i] = Math.max(0, H + herbivoreGrowth - herbivoreLoss);
				nextPredators[i] = Math.max(0, C + predatorGrowth - predatorLoss);
			}

			if (isLogging) {
				// Industrial overfishing / coral dredging / whaling saps marine life:
				nextPlants[i] = Math.max(0, nextPlants[i] - 20.0);
				nextHerbivores[i] = Math.max(0, nextHerbivores[i] * 0.6);
				nextPredators[i] = Math.max(0, nextPredators[i] * 0.5); // whaling / overfishing sharks

				// Undersea degradation:
				// Degrade coral reefs (13) or kelp forests (14) into open pelagic zones (15) or marine shelf (0) if over-harvested
				const currentBiome = updatedBiomes[i];
				if (currentBiome === 13 && nextPlants[i] < 15.0) {
					updatedBiomes[i] = 0; // Degrade Reef to standard marine shelf
				} else if (currentBiome === 14 && nextPlants[i] < 15.0) {
					updatedBiomes[i] = 15; // Degrade Kelp to Pelagic open water
				}
			}
		} else {
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
				const isForest =
					currentBiome === 6 || currentBiome === 8 || currentBiome === 9;
				if (isForest && nextPlants[i] < 20.0) {
					updatedBiomes[i] = 5; // Convert to Grassland
				}
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
		const migratedFraction =
			(validNeighborsCount / neighbors.length) * migrationRate;
		nextPlants[i] -= nextPlants[i] * migratedFraction * 0.2;
		nextHerbivores[i] -= nextHerbivores[i] * migratedFraction;
		nextPredators[i] -= nextPredators[i] * migratedFraction;
	}

	// 3. Accumulate diffusion values and write back to state arrays
	for (let i = 0; i < pointsN; i++) {
		const isOcean = heights[i] < 20;
		if (farmingCells[i] === 1) {
			if (isOcean) {
				// Undersea aquaculture: lock plants at 300.0, mild wildlife impact
				state.plants[i] = 300.0;
				state.herbivores[i] = Math.max(0, nextHerbivores[i]);
				state.predators[i] = Math.max(0, nextPredators[i]);
			} else {
				// Terrestrial farming: lock plants at 400.0, heavy wildlife impact
				state.plants[i] = 400.0;
				state.herbivores[i] = Math.max(0, nextHerbivores[i] * 0.7);
				state.predators[i] = Math.max(0, nextPredators[i] * 0.7);
			}
		} else {
			state.plants[i] = Math.max(0, nextPlants[i] + diffusedP[i]);
			state.herbivores[i] = Math.max(0, nextHerbivores[i] + diffusedH[i]);
			state.predators[i] = Math.max(0, nextPredators[i] + diffusedC[i]);
		}
	}
	// 4. Custom Flora & Fauna Engine
	if (customSpecies && speciesPopulations) {
		for (const sp of customSpecies) {
			const pop = speciesPopulations[sp.id];
			if (!pop) continue;

			const growthFactor = sp.growthRate / 50.0; 
			const migrationFactor = (sp.expansionRate / 100.0) * 0.1; 
			
			const nextPop = new Float32Array(pointsN);
			const diffPop = new Float32Array(pointsN);

			for (let i = 0; i < pointsN; i++) {
				const currentPop = pop[i];
				const b = updatedBiomes[i];
				
				// Habitat check
				const isLand = heights[i] >= 20;
				if ((sp.habitat === "land" && !isLand) || (sp.habitat === "marine" && isLand)) {
					nextPop[i] = Math.max(0, currentPop * 0.5); // Die off rapidly in wrong habitat
					continue;
				}

				// Biome preference multiplier
				let biomeMult = 0.1; // Default poor survival
				if (b === sp.primaryBiome) biomeMult = 1.0;
				else if (b === sp.secondaryBiome) biomeMult = 0.5;
				else if (b === sp.tertiaryBiome) biomeMult = 0.2;

				// Local limit based on plant/herbivore availability
				let K = 1000.0 * biomeMult;
				if (sp.type === "fauna") {
					if (sp.subType === "carnivore") {
						K = Math.min(K, state.herbivores[i] * 5.0);
					} else {
						K = Math.min(K, state.plants[i] * 2.0);
					}
				}

				// Growth
				const growth = growthFactor * currentPop * (1 - currentPop / Math.max(1, K));
				nextPop[i] = Math.max(0, currentPop + growth);

				// Diffuse
				if (nextPop[i] > 10) {
					const neighbors = grid.cells.c[i] || [];
					const migVal = nextPop[i] * migrationFactor;
					let validCount = 0;
					
					for (const n of neighbors) {
						const nIsLand = heights[n] >= 20;
						if ((sp.habitat === "land" && nIsLand) || (sp.habitat === "marine" && !nIsLand)) {
							validCount++;
							diffPop[n] += migVal / neighbors.length;
						}
					}
					nextPop[i] -= migVal * (validCount / neighbors.length);
				}
			}

			// Apply diffuses
			for (let i = 0; i < pointsN; i++) {
				pop[i] = Math.max(0, nextPop[i] + diffPop[i]);
			}
		}
	}

	return updatedBiomes;
}
