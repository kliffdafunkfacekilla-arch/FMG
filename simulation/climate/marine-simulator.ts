import type { Grid } from "../../core/types";

// Generate wind-driven surface currents deflected by coastlines
export function calculateOceanCurrents(
	grid: Grid,
	heights: Uint8Array,
	windX: number = 1.0, // default westerly winds
	windY: number = 0.0,
): Float32Array {
	const pointsN = heights.length;
	const currents = new Float32Array(pointsN * 2); // packed x,y components
	const points = grid.points;

	for (let i = 0; i < pointsN; i++) {
		if (heights[i] >= 20) continue; // Only simulate currents in ocean cells

		const neighbors = grid.cells.c[i] || [];
		let curX = windX;
		let curY = windY;

		// Deflect currents near coastlines to flow parallel to the shore
		let coastNormX = 0;
		let coastNormY = 0;
		let coastNeighborsCount = 0;

		const [px, py] = points[i];

		for (const n of neighbors) {
			if (heights[n] >= 20) {
				// Neighbor is land, calculate boundary deflection vector
				const [nx, ny] = points[n];
				const dx = nx - px;
				const dy = ny - py;
				const dist = Math.hypot(dx, dy);
				if (dist > 0) {
					coastNormX += dx / dist;
					coastNormY += dy / dist;
					coastNeighborsCount++;
				}
			}
		}

		if (coastNeighborsCount > 0) {
			// Normalize coast norm
			const len = Math.hypot(coastNormX, coastNormY);
			const nx = coastNormX / len;
			const ny = coastNormY / len;

			// Project wind vector onto the tangent of the coastline (deflection)
			const dotProd = curX * nx + curY * ny;
			curX -= dotProd * nx;
			curY -= dotProd * ny;
		}

		const curLen = Math.hypot(curX, curY);
		if (curLen > 0) {
			currents[i * 2] = curX / curLen;
			currents[i * 2 + 1] = curY / curLen;
		}
	}

	return currents;
}

// Generate upwelling flux (ocean rivers) running from deep trenches to shelves
export function calculateUpwellingFlux(
	grid: Grid,
	heights: Uint8Array,
): Float32Array {
	const pointsN = heights.length;
	const upwellingFlux = new Float32Array(pointsN);
	const upwellingDirections = new Int32Array(pointsN).fill(-1);

	// 1. Determine uphill upwelling flow routing direction (deepest ocean to shallowest shelf)
	for (let i = 0; i < pointsN; i++) {
		if (heights[i] >= 20) continue;

		const neighbors = grid.cells.c[i] || [];
		let bestTarget = -1;
		let bestHeight = heights[i];

		for (const n of neighbors) {
			if (heights[n] >= 20) {
				// Land neighbors terminate upwelling networks at coastal shelves
				bestTarget = n;
				break;
			}

			// Flow uphill from deep ocean to shallower ocean shelves
			if (heights[n] > bestHeight && heights[n] < 20) {
				bestHeight = heights[n];
				bestTarget = n;
			}
		}

		upwellingDirections[i] = bestTarget;
	}

	// 2. Accumulate upwelling volumes (Trenches heights < 5 act as springs)
	const sortedIndices = Array.from({ length: pointsN }, (_, idx) => idx).sort(
		(a, b) => heights[a] - heights[b],
	); // Sort deepest to shallowest

	// Set up baseline upwelling volumes
	for (let i = 0; i < pointsN; i++) {
		if (heights[i] < 20) {
			// Trench cells produce massive base upwelling flux
			upwellingFlux[i] = heights[i] < 5 ? 15.0 : 1.0;
		}
	}

	// Route and accumulate flow
	for (const i of sortedIndices) {
		if (heights[i] >= 20) continue;

		const target = upwellingDirections[i];
		if (target !== -1) {
			upwellingFlux[target] += upwellingFlux[i];
		}
	}

	return upwellingFlux;
}

// Compute coastal nutrient runoff and run wind-driven nutrient transport sweeps with trench shadows
export function calculateOceanNutrients(
	grid: Grid,
	heights: Uint8Array,
	flowDirections: Int32Array,
	landFlux: Float32Array,
	upwellingFlux: Float32Array,
	winds: number[] = [45, 45, 45, 45, 45, 45], // global wind angles
): Float32Array {
	const pointsN = heights.length;
	const nutrients = new Float32Array(pointsN);

	// 1. Thermal Currents (Ocean Rivers)
	// We trace paths from the deepest trenches ("mountains") flowing "uphill" to the land.
	const thermalCurrents = new Float32Array(pointsN);
	
	// Sort ocean cells by depth (lowest height first, which means deepest trench)
	const oceanCells = [];
	for (let i = 0; i < pointsN; i++) {
		if (heights[i] < 20) {
			oceanCells.push(i);
			// Base nutrient at trenches
			if (heights[i] < 5) {
				thermalCurrents[i] = 50.0 + Math.random() * 50.0;
			}
		}
	}
	// Sort by height ascending (deepest first)
	oceanCells.sort((a, b) => heights[a] - heights[b]);

	// Flow nutrients "uphill" from deep to shallow
	for (let i = 0; i < oceanCells.length; i++) {
		const cell = oceanCells[i];
		const currentPayload = thermalCurrents[cell];
		if (currentPayload <= 0) continue;

		const h = heights[cell];
		const neighbors = grid.cells.c[cell] || [];
		
		// Find neighbors that are shallower (higher height, up to coast)
		let bestNeighbor = -1;
		let maxDiff = -1;
		
		for (const n of neighbors) {
			const nh = heights[n];
			if (nh >= 20) continue; // Don't flow onto land
			if (nh > h) { // Must flow to shallower water
				const diff = nh - h;
				if (diff > maxDiff) {
					maxDiff = diff;
					bestNeighbor = n;
				}
			}
		}

		if (bestNeighbor !== -1) {
			// Pass 80% of nutrients uphill, leave 20%
			thermalCurrents[bestNeighbor] += currentPayload * 0.8;
			thermalCurrents[cell] = currentPayload * 0.2;
		}
	}

	// Add thermal current upwelling to baseline nutrients
	for (let i = 0; i < pointsN; i++) {
		if (heights[i] < 20) {
			nutrients[i] += (upwellingFlux[i] || 0) * 0.2 + thermalCurrents[i] * 0.5;
		}
	}

	// 2. Wind-driven Nutrient Transport Sweeps
	// Winds sweep across land, gather nutrients, deposit at coast/ocean, and drop all remaining in trenches
	const cellsX = grid.cellsX;
	const cellsY = grid.cellsY;

	// Westerly sweeps (Left to Right)
	for (let y = 0; y < cellsY; y++) {
		let windNutrients = 0.0;
		for (let x = 0; x < cellsX; x++) {
			const idx = y * cellsX + x;
			if (idx >= pointsN) break;

			const h = heights[idx];
			if (h >= 20) {
				// Wind sweeps land: gathers dust and agricultural runoff nutrients
				windNutrients = Math.min(100.0, windNutrients + 15.0);
			} else {
				// Wind crosses ocean: deposits nutrients
				if (windNutrients > 0) {
					const deposition = windNutrients * 0.15;
					nutrients[idx] += deposition;
					windNutrients = Math.max(0, windNutrients - deposition);
				}

				// Hitting a deep trench (depth < 5): drops all remaining nutrients
				if (h < 5) {
					nutrients[idx] += windNutrients;
					windNutrients = 0.0; // Trench nutrient shadow formed on the other side
				}
			}
		}
	}

	// Easterly sweeps (Right to Left)
	for (let y = 0; y < cellsY; y++) {
		let windNutrients = 0.0;
		for (let x = cellsX - 1; x >= 0; x--) {
			const idx = y * cellsX + x;
			if (idx < 0 || idx >= pointsN) continue;

			const h = heights[idx];
			if (h >= 20) {
				windNutrients = Math.min(100.0, windNutrients + 15.0);
			} else {
				if (windNutrients > 0) {
					const deposition = windNutrients * 0.15;
					nutrients[idx] += deposition;
					windNutrients = Math.max(0, windNutrients - deposition);
				}
				if (h < 5) {
					nutrients[idx] += windNutrients;
					windNutrients = 0.0; // Trench nutrient shadow
				}
			}
		}
	}

	// 3. Cellular Automata: Short-range local diffusion
	const nextNutrients = new Float32Array(pointsN);
	const diffusionRate = 0.1;

	for (let i = 0; i < pointsN; i++) {
		if (heights[i] >= 20) continue;

		const neighbors = grid.cells.c[i] || [];
		let validNeighborsCount = 0;
		let sumNutrients = 0;

		for (const n of neighbors) {
			if (heights[n] < 20) {
				const isTrenchBarrier = heights[i] < 5 && heights[n] >= 15;
				const mixFactor = isTrenchBarrier ? 0.2 : 1.0;

				sumNutrients += nutrients[n] * mixFactor;
				validNeighborsCount += mixFactor;
			}
		}

		if (validNeighborsCount > 0) {
			nextNutrients[i] =
				nutrients[i] * (1 - diffusionRate) +
				(sumNutrients / validNeighborsCount) * diffusionRate;
		} else {
			nextNutrients[i] = nutrients[i];
		}
	}

	return nextNutrients;
}
