import { describe, expect, it } from "vitest";
import type { MagicTypeConfig } from "../../state/store";
import { generateJitteredGrid } from "../grid/grid-generator";
import {
	applyMagicGeopoliticalVectors,
	calculateMagePopulations,
	calculateMagicFlux,
	generateLeyLines,
	generateMagicNodes,
	runMagicVolatilityChecks,
} from "./magic-system";

describe("Custom Magic System Simulation", () => {
	it("should generate magic nodes, ley-lines, intensity flux, and mages", () => {
		const grid = generateJitteredGrid(600, 400, 500, "magic-seed");
		const pointsN = grid.points.length;
		const heights = new Uint8Array(pointsN).fill(20);
		// Add a peak on cell 25 to spawn a node
		heights[25] = 90;

		const biomes = new Uint8Array(pointsN).fill(6); // Coniferous Forest

		// 1. Nodes & Ley-Lines MST
		const nodes = generateMagicNodes(grid, heights, biomes, 4);
		expect(nodes.length).toBe(4);
		expect(nodes).toContain(25); // Peak should be selected as a node

		const leyLines = generateLeyLines(grid, nodes);
		expect(leyLines.length).toBe(3); // MST with 4 nodes should have exactly 3 edges

		// 2. Magic Flux Intensity
		const flux = calculateMagicFlux(grid, nodes, leyLines);
		expect(flux.length).toBe(pointsN);
		expect(flux[25]).toBeCloseTo(100.0, 1); // Node center should have maximum flux

		// 3. Mage Populations
		const populations = new Float32Array(pointsN).fill(100.0);
		const magicTypes: MagicTypeConfig[] = [
			{
				name: "Pyromancy",
				wieldability: "innate",
				rarity: 0.01,
				cost: 20,
				volatility: { accidents: 0.1, crime: 0.05, instability: 0.05 },
				weights: {
					production: 1.2,
					military: 1.5,
					ecology: 0.8,
					growth: 1.0,
					taxation: 1.0,
				},
			},
		];

		const mages = calculateMagePopulations(flux, populations, magicTypes);
		expect(mages.length).toBe(pointsN);
		// Mage density should be higher near node center cell 25 than a far cell
		expect(mages[25]).toBeGreaterThan(mages[pointsN - 1]);

		// 4. Geopolitical Vectors
		const states = [
			{
				id: 1,
				name: "State A",
				color: "#111",
				capital: 1,
				center: 25,
				treasury: 1000,
				militaryPower: 100,
			},
		];
		const cellStates = new Uint8Array(pointsN).fill(1);

		applyMagicGeopoliticalVectors(
			states,
			[],
			cellStates,
			flux,
			mages,
			magicTypes,
		);
		// State A treasury/military should be scaled by the magic type vector weights
		expect(states[0].militaryPower).toBeGreaterThan(100);

		// 5. Volatility checks
		// Force biome on node cell 25 to coniferous forest (6)
		biomes[25] = 6;
		// Set high instability chance
		const volatileTypes: MagicTypeConfig[] = [
			{
				name: "Chaotic",
				wieldability: "innate",
				rarity: 0.01,
				cost: 10,
				volatility: { accidents: 0.5, crime: 0.5, instability: 1.0 }, // 100% instability
				weights: {
					production: 1.0,
					military: 1.0,
					ecology: 1.0,
					growth: 1.0,
					taxation: 1.0,
				},
			},
		];

		// Mock high probability loop
		let mutated = false;
<<<<<<< HEAD
		for (let k = 0; k < 500; k++) {
=======
		for (let k = 0; k < 100; k++) {
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
			const nextBiomes = runMagicVolatilityChecks(biomes, flux, volatileTypes);
			if (nextBiomes[25] === 3 || nextBiomes[25] === 4) {
				mutated = true;
				break;
			}
		}
		expect(mutated).toBe(true); // High flux node cell should eventually mutate biome
	});
});
