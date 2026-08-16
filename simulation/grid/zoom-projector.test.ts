import { describe, expect, it } from "vitest";
import type { AppState } from "../../state/store";
import { generateJitteredGrid } from "./grid-generator";
import { projectZoomState } from "./zoom-projector";

describe("Zoom Projector Engine", () => {
	it("should project parent values onto sub-grid during zoom in", () => {
		// 1. Create mock parent state
		const width = 1000;
		const height = 600;
		const parentGrid = generateJitteredGrid(
			width,
			height,
			100,
			"zoom-parent-seed",
		);
		const parentN = parentGrid.points.length;

		// Heights: Left half is ocean (10), right half is land (30)
		const heights = new Uint8Array(parentN);
		const temp = new Float32Array(parentN);
		const prec = new Uint8Array(parentN);
		const biomes = new Uint8Array(parentN);
		for (let i = 0; i < parentN; i++) {
			const [x, y] = parentGrid.points[i];
			heights[i] = x < 500 ? 10 : 30;
			temp[i] = 20.0;
			prec[i] = 100;
			biomes[i] = x < 500 ? 0 : 6; // 0 = marine, 6 = forest
		}

		const parentState: AppState = {
			width,
			height,
			seed: "zoom-parent-seed",
			cellsDesired: 100,
			tick: 0,
			calendar: null,
			grid: parentGrid,
			heights,
			temp,
			prec,
			flowDirections: new Int32Array(parentN).fill(-1),
			flux: new Float32Array(parentN).fill(1.0),
			rivers: new Uint16Array(parentN).fill(0),
			biomes,
			weekdays: [],
			months: [],
			seasons: [],
			moons: [],
			plants: new Float32Array(parentN).fill(120),
			herbivores: new Float32Array(parentN).fill(50),
			predators: new Float32Array(parentN).fill(5),
			farmingCells: new Uint8Array(parentN),
			loggingCells: new Uint8Array(parentN),
			magicTypes: [],
			magicNodes: [],
			magicFlux: new Float32Array(parentN),
			magePopulation: new Uint32Array(parentN),
			oceanCurrents: new Float32Array(parentN),
			oceanNutrients: new Float32Array(parentN),
			upwellingFlux: new Float32Array(parentN),
			zoom: 1.0,
			offsetX: 0,
			offsetY: 0,
			zoomTier: "global",
			parentStates: [],
			focusBounds: null,
			preyRate: 100,
			predRate: 100,
			magicSens: 1.0,
			showGrid: false,
			showRivers: false,
			showRoutes: false,
			showBurgs: false,
			showMilitary: false,
			showMarkers: false,
			showLabels: false,
			showZones: false,
			states: [],
			burgs: [],
			cultures: [],
			religions: [],
			relations: [],
			provinces: [],
			military: [],
			layerOrder: [],
			layerStyles: {},
		};

		// 2. Perform regional zoom in onto the center land area: [400, 200] -> [900, 500] (fully land area)
		const bounds = { minX: 600, minY: 100, maxX: 900, maxY: 400 };
		const subState = projectZoomState(parentState, bounds, "regional");

		// 3. Verifications
		expect(subState.zoomTier).toBe("regional");
		expect(subState.parentStates.length).toBe(1);
		expect(subState.parentStates[0].zoomTier).toBe("global");

		// Since we zoomed into the land portion (x between 600 and 900), all sub-grid cells should be land
		const subN = subState.grid!.points.length;
		for (let i = 0; i < subN; i++) {
			expect(subState.heights![i]).toBe(30);
			expect(subState.biomes![i]).toBe(6);
			expect(subState.temp![i]).toBe(20.0);
			expect(subState.plants![i]).toBe(120);
		}
	});
});
