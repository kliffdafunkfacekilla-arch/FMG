import { describe, test, expect } from "vitest";
import { projectZoomState } from "./zoom-projector";
import { generateJitteredGrid } from "./grid-generator";
import type { AppState } from "../../state/store";

describe("Multi-Grid Zoom & Projection System Tests", () => {
	test("projectZoomState constructs valid sub-grid and inherits base properties", () => {
		// Mock a parent state
		const parentGrid = generateJitteredGrid(1000, 600, 100, "mock-seed");
		const N = parentGrid.points.length;

		const parentState: AppState = {
			width: 1000,
			height: 600,
			seed: "mock-seed",
			cellsDesired: 100,
			tick: 0,
			calendar: null,
			grid: parentGrid,
			heights: new Uint8Array(N).fill(15), // water depth
			temp: new Float32Array(N).fill(22),
			prec: new Uint8Array(N).fill(50),
			flowDirections: new Int32Array(N).fill(-1),
			flux: new Float32Array(N).fill(0),
			rivers: new Uint16Array(N).fill(0),
			biomes: new Uint8Array(N).fill(1),
			weekdays: [],
			months: [],
			seasons: [],
			moons: [],
			holidays: [],
			regions: [
				{
					id: 0,
					name: "Capital Region",
					centerX: 500,
					centerY: 300,
					radius: 100,
					localZones: [],
					units: [],
				},
			],
			activeRegionId: null,
			activeLocalId: null,
			globalLogs: [],
			regionalLogs: {},
			localLogs: {},
			plants: new Float32Array(N).fill(100),
			herbivores: new Float32Array(N).fill(50),
			predators: new Float32Array(N).fill(10),
			farmingCells: new Uint8Array(N).fill(0),
			loggingCells: new Uint8Array(N).fill(0),
			magicTypes: [],
			magicNodes: [],
			magicLeyLines: [],
			magicFlux: new Float32Array(N).fill(0),
			magePopulation: new Uint32Array(N).fill(0),
			oceanCurrents: new Float32Array(N * 2).fill(0),
			oceanNutrients: new Float32Array(N).fill(50),
			upwellingFlux: new Float32Array(N).fill(0),
			zoom: 1.0,
			offsetX: 0,
			offsetY: 0,
			zoomTier: "global",
			parentStates: [],
			focusBounds: null,
			preyRate: 100,
			predRate: 100,
			magicSens: 1.0,
			states: [],
			burgs: [],
			cultures: [],
			religions: [],
			relations: [],
			provinces: [],
			military: [],
			fringeGroups: [],
			layerOrder: [],
			layerStyles: {},
		};

		const bounds = { minX: 400, minY: 200, maxX: 600, maxY: 400 };
		const subState = projectZoomState(parentState, bounds, "regional");

		expect(subState.grid).toBeDefined();
		expect(subState.heights).toBeDefined();
		expect(subState.temp![0]).toBe(22);
		expect(subState.plants![0]).toBe(100);
		expect(subState.zoomTier).toBe("regional");
		expect(subState.parentStates.length).toBe(1);
		expect(subState.parentStates[0].zoomTier).toBe("global");
	});
});
