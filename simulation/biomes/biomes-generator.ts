import type { Grid } from "../../core/types";

export const BIOME_NAMES: string[] = [
	"Marine", // 0
	"Hot desert", // 1
	"Cold desert", // 2
	"Savanna", // 3
	"Grassland", // 4
	"Tropical seasonal forest", // 5
	"Temperate deciduous forest", // 6
	"Tropical rainforest", // 7
	"Temperate rainforest", // 8
	"Taiga", // 9
	"Tundra", // 10
	"Glacier", // 11
	"Wetland", // 12
	"Brine pools", // 13
	"Still waters", // 14
	"Open seafloor", // 15
	"Seagrass meadows", // 16
	"Seasonal volcanic vents", // 17
	"Temperate kelp forests", // 18
	"Tropical reefs", // 19
	"Temperate reefs", // 20
	"Deep fissure canyons", // 21
	"Artic waters", // 22
	"Under water glacier", // 23
	"Tidal plains", // 24
	"Chaos Land", // 25
	"Chaos Water", // 26
];

export const BIOME_COLORS: string[] = [
	"#466eab", // Marine
	"#fbe79f", // Hot desert
	"#b5b887", // Cold desert
	"#d2d082", // Savanna
	"#c8d68f", // Grassland
	"#b6d95d", // Tropical seasonal forest
	"#29bc56", // Temperate deciduous forest
	"#7dcb35", // Tropical rainforest
	"#409c43", // Temperate rainforest
	"#4b6b32", // Taiga
	"#96784b", // Tundra
	"#d5e7eb", // Glacier
	"#0b9131", // Wetland
	"#808000", // Brine pools
	"#000080", // Still waters
	"#000033", // Open seafloor
	"#2e8b57", // Seagrass meadows
	"#ff4500", // Seasonal volcanic vents
	"#004B49", // Temperate kelp forests
	"#006994", // Tropical reefs
	"#4682b4", // Temperate reefs
	"#000011", // Deep fissure canyons
	"#5f9ea0", // Artic waters
	"#b0e0e6", // Under water glacier
	"#20b2aa", // Tidal plains
	"#4B0082", // Chaos Land
	"#190033", // Chaos Water
];

const biomesMatrix = [
	// hot ↔ cold [>19°C; <-4°C]; dry ↕ wet
	new Uint8Array([
		1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
		10,
	]),
	new Uint8Array([
		3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10,
		10,
	]),
	new Uint8Array([
		5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10,
		10,
	]),
	new Uint8Array([
		5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10,
		10,
	]),
	new Uint8Array([
		7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10,
		10,
	]),
];

function isWetland(
	moisture: number,
	temperature: number,
	height: number,
): boolean {
	if (temperature <= -2) return false; // too cold
	if (moisture > 40 && height < 25) return true; // near coast
	if (moisture > 24 && height > 24 && height < 60) return true; // off coast
	return false;
}

export function getBiomeId(
	moisture: number,
	temperature: number,
	height: number,
	hasRiver: boolean,
	localNutrients?: number,
): number {
	if (height < 20) {
		if (temperature < -5) return 23; // Frozen Sea

		// Use localNutrients as the ocean's "moisture/rain" equivalent
		const nutrientScore = localNutrients || 0;
		
		const nutrientBand = Math.min(Math.floor(nutrientScore / 15), 4); // [0-4]
		const tempBand = Math.min(Math.max(Math.floor(20 - temperature), 0), 25); // [0-25]

		// Fetch the "land" biome ID from the matrix
		const landBiomeId = biomesMatrix[nutrientBand]?.[tempBand] ?? 4; 
		
		// Map the land biome ID to its marine counterpart (1:1 with ID + 12)
		const marineMap: Record<number, number> = {
			1: 13, // Hot desert -> Brine pools
			2: 14, // Cold desert -> Still waters
			3: 15, // Savanna -> Open seafloor
			4: 16, // Grassland -> Seagrass meadows
			5: 17, // Tropical seasonal forest -> Seasonal volcanic vents
			6: 18, // Temperate deciduous forest -> Temperate kelp forests
			7: 19, // Tropical rainforest -> Tropical reefs
			8: 20, // Temperate rainforest -> Temperate reefs
			9: 21,  // Taiga -> Deep fissure canyons
			10: 22, // Tundra -> Artic waters
			11: 23, // Glacier -> Under water glacier
			12: 24  // Wetland -> Tidal plains
		};

		return marineMap[landBiomeId] ?? 0;
	}

	if (temperature < -5) return 11; // Glacier/Ice cap
	if (temperature >= 25 && !hasRiver && moisture < 8) return 1; // Hot desert
	if (isWetland(moisture, temperature, height)) return 12; // Wetland

	const moistureBand = Math.min(Math.floor(moisture / 5), 4); // [0-4]
	const temperatureBand = Math.min(
		Math.max(Math.floor(20 - temperature), 0),
		25,
	); // [0-25]

	return biomesMatrix[moistureBand]?.[temperatureBand] ?? 4; // fallback to Grassland (4)
}

export function generateBiomes(
	grid: Grid,
	heights: Uint8Array,
	temp: Float32Array,
	prec: Uint8Array,
	rivers: Uint16Array,
	oceanNutrients?: Float32Array,
): Uint8Array {
	const pointsN = heights.length;
	const biomes = new Uint8Array(pointsN);

	const calculateMoisture = (cellId: number): number => {
		let moisture = prec[cellId] || 0;
		if (rivers && rivers[cellId] > 0) {
			moisture += 2; // base moisture bump near rivers
		}
		const neighbors = grid.cells.c[cellId] || [];
		const moistAround = neighbors
			.filter((n) => heights[n] >= 20)
			.map((n) => prec[n] || 0)
			.concat([moisture]);
		const avgMoisture =
			moistAround.reduce((sum, v) => sum + v, 0) / moistAround.length;
		return parseFloat((4 + avgMoisture).toFixed(2));
	};

	for (let cellId = 0; cellId < pointsN; cellId++) {
		const height = heights[cellId];
		const hasRiver = rivers ? rivers[cellId] > 0 : false;
		const moisture = height < 20 ? (prec[cellId] || 0) : calculateMoisture(cellId);
		const temperature = temp[cellId] || 0;
		const localNutrients = oceanNutrients ? oceanNutrients[cellId] : undefined;

		biomes[cellId] = getBiomeId(
			moisture,
			temperature,
			height,
			hasRiver,
			localNutrients,
		);
	}

	return biomes;
}
