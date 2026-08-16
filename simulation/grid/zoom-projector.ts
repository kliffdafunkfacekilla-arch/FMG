import { generateJitteredGrid } from "./grid-generator";
import { generateHydrology } from "../hydrology/hydrology-generator";
import type { AppState } from "../../state/store";

export function projectZoomState(
	parentState: AppState,
	bounds: { minX: number; minY: number; maxX: number; maxY: number },
	nextTier: "regional" | "local",
): AppState {
	const width = parentState.width;
	const height = parentState.height;
	const cellsDesired = parentState.cellsDesired;

	// Create a stable seeded sub-grid
	const subSeed = `${parentState.seed}-${nextTier}-${Math.round(bounds.minX)}-${Math.round(bounds.minY)}`;
	const newGrid = generateJitteredGrid(width, height, cellsDesired, subSeed);
	const newCount = newGrid.points.length;

	// Project from parent space: parent coordinate corresponding to new point (x,y)
	const mapToParent = (x: number, y: number): [number, number] => {
		const px = bounds.minX + (x / width) * (bounds.maxX - bounds.minX);
		const py = bounds.minY + (y / height) * (bounds.maxY - bounds.minY);
		return [px, py];
	};

	// Setup a fast spatial grid for parentState grid to find nearest parent cell
	const binXCount = 50;
	const binYCount = 50;
	const binW = width / binXCount;
	const binH = height / binYCount;
	const bins: number[][] = Array.from({ length: binXCount * binYCount }, () => []);

	const parentGrid = parentState.grid!;
	const parentPoints = parentGrid.points;
	const parentN = parentPoints.length;

	for (let i = 0; i < parentN; i++) {
		const [px, py] = parentPoints[i];
		const bx = Math.min(binXCount - 1, Math.max(0, Math.floor(px / binW)));
		const by = Math.min(binYCount - 1, Math.max(0, Math.floor(py / binH)));
		bins[by * binXCount + bx].push(i);
	}

	const findNearestParentCell = (px: number, py: number): number => {
		let nearestId = 0;
		let minDist = Infinity;

		const centerBx = Math.min(binXCount - 1, Math.max(0, Math.floor(px / binW)));
		const centerBy = Math.min(binYCount - 1, Math.max(0, Math.floor(py / binH)));

		// Search 3x3 neighborhood of bins
		for (let dy = -1; dy <= 1; dy++) {
			const by = centerBy + dy;
			if (by < 0 || by >= binYCount) continue;
			for (let dx = -1; dx <= 1; dx++) {
				const bx = centerBx + dx;
				if (bx < 0 || bx >= binXCount) continue;

				const binIndices = bins[by * binXCount + bx];
				for (const idx of binIndices) {
					const [x2, y2] = parentPoints[idx];
					const dx2 = px - x2;
					const dy2 = py - y2;
					const dist = dx2 * dx2 + dy2 * dy2;
					if (dist < minDist) {
						minDist = dist;
						nearestId = idx;
					}
				}
			}
		}

		// Fallback to global search if bin neighborhood was empty
		if (minDist === Infinity) {
			for (let i = 0; i < parentN; i++) {
				const [x2, y2] = parentPoints[i];
				const dx2 = px - x2;
				const dy2 = py - y2;
				const dist = dx2 * dx2 + dy2 * dy2;
				if (dist < minDist) {
					minDist = dist;
					nearestId = i;
				}
			}
		}

		return nearestId;
	};

	// Allocate sub-grid state arrays
	const heights = new Uint8Array(newCount);
	const temp = new Float32Array(newCount);
	const prec = new Uint8Array(newCount);
	const biomes = new Uint8Array(newCount);
	const plants = new Float32Array(newCount);
	const herbivores = new Float32Array(newCount);
	const predators = new Float32Array(newCount);
	const farmingCells = new Uint8Array(newCount);
	const loggingCells = new Uint8Array(newCount);
	const magePopulation = new Uint32Array(newCount);
	const magicFlux = new Float32Array(newCount);
	const oceanCurrents = new Float32Array(newCount * 2);
	const oceanNutrients = new Float32Array(newCount);
	const upwellingFlux = new Float32Array(newCount);

	const parentHeights = parentState.heights!;
	const parentTemp = parentState.temp!;
	const parentPrec = parentState.prec!;
	const parentBiomes = parentState.biomes!;
	const parentPlants = parentState.plants || new Float32Array(parentN).fill(10);
	const parentHerbivores = parentState.herbivores || new Float32Array(parentN).fill(5);
	const parentPredators = parentState.predators || new Float32Array(parentN).fill(1);
	const parentFarming = parentState.farmingCells || new Uint8Array(parentN);
	const parentLogging = parentState.loggingCells || new Uint8Array(parentN);
	const parentMagePop = parentState.magePopulation || new Uint32Array(parentN);
	const parentMagicFlux = parentState.magicFlux || new Float32Array(parentN);
	const parentCurrents = parentState.oceanCurrents || new Float32Array(parentN * 2);
	const parentNutrients = parentState.oceanNutrients || new Float32Array(parentN);
	const parentUpwelling = parentState.upwellingFlux || new Float32Array(parentN);

	// Perform cell projections
	for (let i = 0; i < newCount; i++) {
		const [x, y] = newGrid.points[i];
		const [px, py] = mapToParent(x, y);
		const parentCellId = findNearestParentCell(px, py);

		heights[i] = parentHeights[parentCellId];
		temp[i] = parentTemp[parentCellId];
		prec[i] = parentPrec[parentCellId];
		biomes[i] = parentBiomes[parentCellId];
		plants[i] = parentPlants[parentCellId];
		herbivores[i] = parentHerbivores[parentCellId];
		predators[i] = parentPredators[parentCellId];
		farmingCells[i] = parentFarming[parentCellId];
		loggingCells[i] = parentLogging[parentCellId];
		magePopulation[i] = parentMagePop[parentCellId];
		magicFlux[i] = parentMagicFlux[parentCellId];
		oceanCurrents[i * 2] = parentCurrents[parentCellId * 2];
		oceanCurrents[i * 2 + 1] = parentCurrents[parentCellId * 2 + 1];
		oceanNutrients[i] = parentNutrients[parentCellId];
		upwellingFlux[i] = parentUpwelling[parentCellId];
	}

	// Generate high-resolution hydrology (rivers and flowDirections) for the sub-grid
	const hydrology = generateHydrology(newGrid, heights, prec);

	// Map states, cultures, and religions
	const projectedStates: any[] = [];
	const projectedBurgs: any[] = [];
	const projectedCultures: any[] = [];
	const projectedReligions: any[] = [];

	if (parentState.states) {
		for (const s of parentState.states) {
			projectedStates.push({
				...s,
				population: 0,
				treasury: s.treasury,
				militaryPower: s.militaryPower,
			});
		}
	}

	if (parentState.cultures) {
		for (const c of parentState.cultures) {
			projectedCultures.push({ ...c });
		}
	}

	if (parentState.religions) {
		for (const r of parentState.religions) {
			projectedReligions.push({ ...r });
		}
	}

	// Map cellStates, cellCultures, and cellReligions to new cells
	const cellStates = new Uint8Array(newCount);
	const cellCultures = new Uint8Array(newCount);
	const cellReligions = new Uint8Array(newCount);
	const parentCellStates = (parentState as any).cellStates || new Uint8Array(parentN);
	const parentCellCultures = (parentState as any).cellCultures || new Uint8Array(parentN);
	const parentCellReligions = parentState.cellReligions || new Uint8Array(parentN);

	for (let i = 0; i < newCount; i++) {
		const [x, y] = newGrid.points[i];
		const [px, py] = mapToParent(x, y);
		const pId = findNearestParentCell(px, py);
		cellStates[i] = parentCellStates[pId];
		cellCultures[i] = parentCellCultures[pId];
		cellReligions[i] = parentCellReligions[pId];
	}

	// Project burgs
	if (parentState.burgs) {
		for (const b of parentState.burgs) {
			const [bx, by] = parentPoints[b.cell];
			if (bx >= bounds.minX && bx <= bounds.maxX && by >= bounds.minY && by <= bounds.maxY) {
				const subX = ((bx - bounds.minX) / (bounds.maxX - bounds.minX)) * width;
				const subY = ((by - bounds.minY) / (bounds.maxY - bounds.minY)) * height;

				let closestNewCell = 0;
				let minDist = Infinity;
				for (let j = 0; j < newCount; j++) {
					const [nx, ny] = newGrid.points[j];
					const dx = subX - nx;
					const dy = subY - ny;
					const dist = dx * dx + dy * dy;
					if (dist < minDist) {
						minDist = dist;
						closestNewCell = j;
					}
				}

				projectedBurgs.push({
					...b,
					cell: closestNewCell,
				});

				for (const s of projectedStates) {
					if (s.capital === b.id) {
						s.center = closestNewCell;
					}
				}
			}
		}
	}

	return {
		...parentState,
		grid: newGrid,
		heights: hydrology.heights,
		flowDirections: hydrology.flowDirections,
		flux: hydrology.flux,
		rivers: hydrology.rivers,
		temp,
		prec,
		biomes,
		plants,
		herbivores,
		predators,
		farmingCells,
		loggingCells,
		magePopulation,
		magicFlux,
		oceanCurrents,
		oceanNutrients,
		upwellingFlux,
		cellStates,
		cellCultures,
		cellReligions,
		states: projectedStates,
		burgs: projectedBurgs,
		cultures: projectedCultures,
		religions: projectedReligions,
		zoomTier: nextTier,
		parentStates: [...parentState.parentStates, parentState],
		focusBounds: bounds,
		riverPoints: hydrology.riverPoints,
	} as any;
}
