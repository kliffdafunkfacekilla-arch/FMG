import FlatQueue from "flatqueue";
import { createPRNG, PRNG } from "../../core/random";
import type { Grid } from "../../core/types";

import { Names } from "./name-generator";

export interface Culture {
	id: number;
	name: string;
	color: string;
	center: number; // cell ID of capital/origin
	base: number; // nameBase index
	habitat: "land" | "ocean" | "amphibious";
}

const CULTURE_COLORS = [
	"#e11d48",
	"#2563eb",
	"#16a34a",
	"#ca8a04",
	"#9333ea",
	"#0891b2",
	"#ea580c",
	"#db2777",
	"#4f46e5",
	"#65a30d",
];

const CULTURE_NAMES = [
	"Common",
	"Highland",
	"Riverine",
	"Nomadic",
	"Maritime",
	"Oasis",
	"Forest",
	"Glacial",
	"Sylvan",
	"Steppe",
];

// biomesData for basic habitability checking
const biomesData = {
	habitability: [0, 0, 0, 4, 10, 22, 25, 50, 100, 80, 50, 12, 0, 0],
	cost: [10, 10, 10, 30, 30, 22, 10, 30, 50, 70, 90, 100, 10, 10],
};

function getBiomeCost(b: number, biome: number, type: string): number {
	if (b === biome) return 10; // tiny penalty for native biome
	if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
	if (type === "Nomadic" && biome > 4 && biome < 10)
		return biomesData.cost[biome] * 10; // forest biome penalty for nomads
	return biomesData.cost[biome] * 2; // general non-native biome penalty
}

function getHeightCost(
	h: number,
	area: number,
	type: string,
	biome: number,
): number {
	const isHabitableWater = h < 20 && biomesData.habitability[biome] > 0;
	if (isHabitableWater) {
		if (type !== "Aquatic") return area * 100; // massive penalty for non-aquatics entering the sea
		return 0; // aquatics thrive
	}
	if (type === "Aquatic" && h >= 20) return area * 100; // massive penalty for aquatics going on land!
	if (!isHabitableWater) {
		if (type === "Naval" && h < 20) return area * 2; // low sea/lake crossing penalty for Naval cultures
		if (type === "Nomadic" && h < 20) return area * 50; // giant sea/lake crossing penalty for Nomads
		if (h < 20) return area * 6; // general sea/lake crossing penalty
	}
	if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
	if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
	if (type === "Highland") return 0; // no penalty for highlanders on highlands
	if (h >= 67) return 200; // general mountains crossing penalty
	if (h >= 44) return 30; // general hills crossing penalty
	return 0;
}

function getRiverCost(riverId: number, flux: number, type: string): number {
	if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
	if (!riverId) return 0; // no penalty for others if there is no river
	return Math.max(20, Math.min(100, flux / 10)); // river penalty from 20 to 100 based on flux
}

function getTypeCost(t: number, type: string): number {
	if (t === 1)
		return type === "Naval" || type === "Lake"
			? 0
			: type === "Nomadic"
				? 60
				: 20; // penalty for coastline
	if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
	if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
	return 0;
}

export function generateCultures(
	grid: Grid,
	heights: Uint8Array,
	biomes: Uint8Array,
	count = 6,
	seed: string,
	flux?: Float32Array,
	rivers?: Uint16Array,
	existingCultures?: Culture[],
	underwaterCount = 0,
): { cultures: Culture[]; cellCultures: Uint8Array; cellSecondaryCultures: Uint8Array } {
	const pointsN = heights.length;
	const cellCultures = new Uint8Array(pointsN).fill(0); // 0 = Wild / No Culture
	const cellSecondaryCultures = new Uint8Array(pointsN).fill(0); // 0 = Wild / No Secondary Culture
	const cultures: Culture[] = [];
	const rng = createPRNG(seed);

	const safeFlux = flux || new Float32Array(pointsN).fill(0);
	const safeRivers = rivers || new Uint16Array(pointsN).fill(0);
	const safeTypes = grid.cells.t || new Int8Array(pointsN).fill(0);

	// 1. Select culture seeds based on suitability
	const candidates: number[] = [];
	for (let i = 0; i < pointsN; i++) {
		if (heights[i] >= 20 && biomes[i] !== 11) {
			candidates.push(i);
		}
	}

	const oceanCandidates: number[] = [];
	if (underwaterCount > 0) {
		for (let i = 0; i < pointsN; i++) {
			if (heights[i] < 20) {
				oceanCandidates.push(i);
			}
		}
	}

	if (candidates.length === 0 && oceanCandidates.length === 0) {
		return { cultures, cellCultures, cellSecondaryCultures };
	}

	// Shuffle candidates
	candidates.sort(() => rng() - 0.5);
	const actualCount = Math.min(count, candidates.length);
	const centers = candidates.slice(0, actualCount);

	// Shuffle ocean candidates
	let actualOceanCount = 0;
	let oceanCenters: number[] = [];
	if (underwaterCount > 0 && oceanCandidates.length > 0) {
		oceanCandidates.sort(() => rng() - 0.5);
		actualOceanCount = Math.min(underwaterCount, oceanCandidates.length);
		oceanCenters = oceanCandidates.slice(0, actualOceanCount);
	}

	// Initialize seeds
	type QItem = {
		cellId: number;
		cost: number;
		cultureId: number;
		type: string;
		nativeBiome: number;
		expansionism: number;
		habitat: "land" | "ocean" | "amphibious";
	};
	const queue = new FlatQueue<QItem>();

	// Add land seeds
	for (let i = 0; i < actualCount; i++) {
		const cultureId = i + 1;
		const center = centers[i];
		const existing = existingCultures?.find((c) => c.id === cultureId);

		const name = CULTURE_NAMES[i % CULTURE_NAMES.length];

		let base = i % 10; // Default to standard sequential bases
		let type = "Generic";
		if (name === "Highland") {
			type = "Highland";
			base = 22; // Celtic/Keltan
		} else if (name === "Nomadic" || name === "Steppe") {
			type = "Nomadic";
			base = 31; // Mongolian/Ulus
		} else if (name === "Maritime") {
			type = "Naval";
			base = 25; // Polynesian/Maui
		} else if (name === "Riverine") {
			type = "River";
			base = 18; // Arabic/Eurabic
		} else if (name === "Sylvan") {
			type = "Sylvan";
			base = 33; // Elven/Quenian
		}

		let cultureName = existing ? existing.name : Names.getBase(base);
		if (
			!existing &&
			!cultureName.endsWith("ic") &&
			!cultureName.endsWith("ian") &&
			!cultureName.endsWith("an")
		) {
			cultureName += "ian";
		}

		const habitat = existing ? existing.habitat : "land";

		cultures.push({
			id: cultureId,
			name: cultureName,
			color: existing?.color || CULTURE_COLORS[i % CULTURE_COLORS.length],
			center,
			base,
			habitat,
		});
		cellCultures[center] = cultureId;

		queue.push(
			{
				cellId: center,
				cost: 0,
				cultureId,
				type,
				nativeBiome: biomes[center],
				expansionism: 1.0,
				habitat,
			},
			0,
		);
	}

	// Add underwater seeds
	for (let i = 0; i < actualOceanCount; i++) {
		const cultureId = actualCount + i + 1;
		const center = oceanCenters[i];
		const existing = existingCultures?.find((c) => c.id === cultureId);

		const aquaticNames = ["Abyssal", "Pelagic", "Triton", "Coral", "Siren", "Marid", "Aquan", "DeepSea"];
		const name = aquaticNames[i % aquaticNames.length];
		let base = 25; // Polynesian/Naval base
		let type = "Aquatic";

		let cultureName = existing ? existing.name : name + "ian";
		const habitat = "ocean";

		const aquaticColors = ["#00ffff", "#00ced1", "#1e90ff", "#20b2aa", "#40e0d0", "#4682b4", "#5f9ea0"];

		cultures.push({
			id: cultureId,
			name: cultureName,
			color: existing?.color || aquaticColors[i % aquaticColors.length],
			center,
			base,
			habitat,
		});
		cellCultures[center] = cultureId;

		queue.push(
			{
				cellId: center,
				cost: 0,
				cultureId,
				type,
				nativeBiome: biomes[center],
				expansionism: 1.5, // Expand well in oceans
				habitat,
			},
			0,
		);
	}

	// 2. Dijkstra expansion
	const minCost = new Float32Array(pointsN).fill(Infinity);
	for (let i = 0; i < actualCount; i++) {
		minCost[centers[i]] = 0;
	}
	for (let i = 0; i < actualOceanCount; i++) {
		minCost[oceanCenters[i]] = 0;
	}

	const maxExpansionCost = pointsN * 0.6;

	// Simple priority queue loop (Dijkstra)
	while (queue.length > 0) {
		const curr = queue.pop()!;

		if (curr.cost > minCost[curr.cellId]) continue;

		const neighbors = grid.cells.c[curr.cellId] || [];
		for (const n of neighbors) {
			const sourceBiome = biomes[curr.cellId];
			const targetBiome = biomes[n];

			const biomeCost = getBiomeCost(curr.nativeBiome, targetBiome, curr.type);
			const biomeChangeCost = sourceBiome === targetBiome ? 0 : 20;
			let heightCost = getHeightCost(
				heights[n],
				grid.cells.area ? grid.cells.area[n] : 1,
				curr.type,
				targetBiome,
			);
			if (curr.habitat === "amphibious") {
				heightCost = 0;
			}
			const riverCost = getRiverCost(safeRivers[n], safeFlux[n], curr.type);
			const typeCost = getTypeCost(safeTypes[n], curr.type);

			let habitatCost = 0;
			if (curr.habitat === "land" && heights[n] < 20) habitatCost += 3000;
			if (curr.habitat === "ocean" && heights[n] >= 20) habitatCost += 3000;

			const cellCost =
				(biomeCost +
					biomeChangeCost +
					heightCost +
					riverCost +
					typeCost +
					habitatCost) /
				curr.expansionism;
			const totalCost = curr.cost + cellCost;

			if (totalCost > maxExpansionCost) continue;

			if (totalCost < minCost[n]) {
				// If another culture already owned this cell or was close, make it secondary before taking over
				if (cellCultures[n] > 0 && cellCultures[n] !== curr.cultureId) {
					cellSecondaryCultures[n] = cellCultures[n];
				}
				minCost[n] = totalCost;
				if (curr.habitat === "ocean" || heights[n] >= 20 || targetBiome !== 11) {
					cellCultures[n] = curr.cultureId;
				}
				queue.push(
					{
						cellId: n,
						cost: totalCost,
						cultureId: curr.cultureId,
						type: curr.type,
						nativeBiome: curr.nativeBiome,
						expansionism: curr.expansionism,
						habitat: curr.habitat,
					},
					totalCost,
				);
			} else if (cellCultures[n] > 0 && cellCultures[n] !== curr.cultureId) {
				// Border logic: if we couldn't take over the cell because it's already well-established,
				// but we are close (cost is within a threshold of minCost), make us the secondary culture.
				const threshold = 150; 
				if (totalCost < minCost[n] + threshold) {
					cellSecondaryCultures[n] = curr.cultureId;
				}
			}
		}
	}

	return { cultures, cellCultures, cellSecondaryCultures };
}
