import type { Grid } from "../../core/types";
import type { MagicTypeConfig } from "../../state/store";

export interface MagicNetwork {
	nodes: number[];
	leyLines: [number, number][]; // pairs of node cell indices
}

// Generate magical nodes at peaks or deep forest centers
export function generateMagicNodes(
	grid: Grid,
	heights: Uint8Array,
	biomes: Uint8Array,
	count = 6,
): number[] {
	const pointsN = heights.length;
	const candidates: { cellId: number; score: number }[] = [];

	for (let i = 0; i < pointsN; i++) {
		const isPeak = heights[i] > 70;
		const isDeepForest = biomes[i] === 9; // Tropical Forest
		if (isPeak || isDeepForest) {
			const score = heights[i] - 20 + (isDeepForest ? 50 : 0);
			candidates.push({ cellId: i, score });
		}
	}

	// Sort candidates by score descending
	candidates.sort((a, b) => b.score - a.score);

	// Take nodes that are spatially separated
	const nodes: number[] = [];
	const points = grid.points;

	for (const c of candidates) {
		if (nodes.length >= count) break;
		const [x1, y1] = points[c.cellId];

		// Ensure it is at least 150 units away from already selected nodes
		const isFar = nodes.every((nId) => {
			const [x2, y2] = points[nId];
			return Math.hypot(x2 - x1, y2 - y1) > 150;
		});

		if (isFar) {
			nodes.push(c.cellId);
		}
	}

	// Fallback to random centers if none found
	while (nodes.length < count && pointsN > 0) {
		const randCell = Math.floor(Math.random() * pointsN);
		if (!nodes.includes(randCell)) nodes.push(randCell);
	}

	return nodes;
}

// Connect nodes using Prim's algorithm to generate a Minimum Spanning Tree of Ley-Lines
export function generateLeyLines(
	grid: Grid,
	nodes: number[],
): [number, number][] {
	const leyLines: [number, number][] = [];
	if (nodes.length < 2) return leyLines;

	const points = grid.points;
	const connected = new Set<number>([nodes[0]]);
	const remaining = new Set<number>(nodes.slice(1));

	while (remaining.size > 0) {
		let minDist = Infinity;
		let bestEdge: [number, number] | null = null;

		for (const u of connected) {
			const [ux, uy] = points[u];
			for (const v of remaining) {
				const [vx, vy] = points[v];
				const dist = Math.hypot(vx - ux, vy - uy);
				if (dist < minDist) {
					minDist = dist;
					bestEdge = [u, v];
				}
			}
		}

		if (bestEdge) {
			const [u, v] = bestEdge;
			leyLines.push([u, v]);
			connected.add(v);
			remaining.delete(v);
		} else {
			break;
		}
	}

	return leyLines;
}

// Distance from point p to line segment ab
function distToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const l2 = dx * dx + dy * dy;
	if (l2 === 0) return Math.hypot(px - ax, py - ay);

	let t = ((px - ax) * dx + (py - ay) * dy) / l2;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Calculate cell-by-cell magical flux intensity based on nodes and ley-lines
export function calculateMagicFlux(
	grid: Grid,
	nodes: number[],
	leyLines: [number, number][],
): Float32Array {
	const pointsN = grid.points.length;
	const flux = new Float32Array(pointsN);
	const points = grid.points;

	for (let i = 0; i < pointsN; i++) {
		const [px, py] = points[i];
		let totalIntensity = 0.0;

		// Node intensity drop-off
		for (const n of nodes) {
			const [nx, ny] = points[n];
			const dist = Math.hypot(nx - px, ny - py);
			totalIntensity += 120.0 / (1.0 + dist * 0.08);
		}

		// Ley-line proximity intensity
		for (const [u, v] of leyLines) {
			const [ux, uy] = points[u];
			const [vx, vy] = points[v];
			const dist = distToSegment(px, py, ux, uy, vx, vy);
			totalIntensity += 60.0 / (1.0 + dist * 0.1);
		}

		flux[i] = Math.min(100.0, totalIntensity);
	}

	return flux;
}

// Calculate mage population density based on magic flux, types config, state wealth/size, and local religion
export function calculateMagePopulations(
	magicFlux: Float32Array,
	populations: Float32Array,
	magicTypes: MagicTypeConfig[],
	cellStates?: Uint8Array,
	states?: any[],
	cellReligions?: Uint8Array,
): Uint32Array {
	const pointsN = magicFlux.length;
	const magePop = new Uint32Array(pointsN);

	for (let i = 0; i < pointsN; i++) {
		const pop = populations[i] || 0;
		const flux = magicFlux[i] || 0.0;
		const stateId = cellStates ? cellStates[i] : 0;
		const localReligionId = cellReligions ? cellReligions[i] : 0;

		let totalRarity = 0.0;

		for (const t of magicTypes) {
			let active = true;

			// Scope constraints
			if (t.scope === "ley_line" && flux < 30.0) {
				active = false;
			}
			if (t.scope === "zone" && flux < 15.0) {
				active = false;
			}

			if (!active) continue;

			let rarity = t.rarity;

			if (t.wieldability === "innate") {
				rarity = t.rarity;
			} else if (t.wieldability === "learned") {
				if (stateId > 0 && states) {
					const stateObj = states.find((s: any) => s.id === stateId);
					if (stateObj) {
						const wealthFactor = (stateObj.treasury || 0) / 5000;
						const sizeFactor = (stateObj.population || 1000) / 20000;
						rarity = t.rarity * (1.0 + wealthFactor + sizeFactor);
					}
				}
			} else if (t.wieldability === "divine") {
				const chosenRel = t.religionId !== undefined ? t.religionId : 1;
				if (localReligionId !== chosenRel) {
					rarity = 0.0;
				}
			}

			// High flux scaling multiplier (up to 4x)
			const localRarity = rarity * (0.5 + (flux / 100.0) * 3.5);
			totalRarity += localRarity;
		}

		magePop[i] = Math.round(pop * Math.min(0.2, totalRarity));
	}

	return magePop;
}

// Map of standard Good names to their IDs for lookups
const GOODS_NAME_MAP: Record<string, number> = {
	"wood": 1, "stone": 2, "marble": 3, "iron": 4, "copper": 5, "tin": 6, "silver": 7, "gold": 8,
	"grain": 9, "cattle": 10, "fish": 11, "game": 12, "wine": 13, "olives": 14, "honey": 15, "salt": 16,
	"dates": 17, "horses": 18, "elephants": 19, "camels": 20, "hemp": 21, "pearls": 22, "gemstones": 23,
	"dyes": 24, "incense": 25, "silk": 26, "spices": 27, "amber": 28, "furs": 29, "sheep": 30, "slaves": 31,
	"kelp": 9, "seaweed": 9, "coral": 1 // Underwater variants mapped for backwards compatibility
};

// Process daily magic costs sapping and active effects / dangers
export function applyMagicDailyCostsAndEffects(
	magicTypes: MagicTypeConfig[],
	magePopulation: Uint32Array,
	cellStates: Uint8Array | null,
	states: any[],
	burgs: any[],
	markets: any[],
	plants: Float32Array | null,
	magicFlux: Float32Array | null,
): void {
	const stateMap = new Map(states.map((s) => [s.id, s]));
	const burgMap = new Map(burgs.map((b) => [b.cell, b]));
	const marketMap = new Map(markets.map((m) => [m.burgId, m]));

	const pointsN = magePopulation.length;
	const totalRaritySum = magicTypes.reduce((sum, t) => sum + t.rarity, 0) || 0.01;

	for (let i = 0; i < pointsN; i++) {
		const totalMages = magePopulation[i] || 0;
		if (totalMages <= 0) continue;

		const stateId = cellStates ? cellStates[i] : 0;
		const state = stateMap.get(stateId);
		const burg = burgMap.get(i);
		const market = burg ? marketMap.get(burg.id) : null;
		const flux = magicFlux ? magicFlux[i] : 50.0;

		for (const t of magicTypes) {
			// Calculate mages specializing in this magic type in this cell
			const share = t.rarity / totalRaritySum;
			const typeMages = Math.round(totalMages * share);
			if (typeMages <= 0) continue;

			// Scope validation
			if (t.scope === "ley_line" && flux < 30.0) continue;
			if (t.scope === "zone" && flux < 15.0) continue;

			// 1. SAPPING COSTS
			const costType = (t.costType || "wealth").toLowerCase();
			if (costType === "wealth") {
				if (state) {
					state.treasury = Math.max(0, state.treasury - Math.round(t.cost * typeMages * 0.01));
				}
			} else if (costType === "life") {
				if (burg) {
					burg.population = Math.max(10, burg.population - Math.round(t.cost * typeMages * 0.1));
				}
			} else if (costType === "ecology") {
				if (plants) {
					plants[i] = Math.max(0, plants[i] - t.cost * typeMages * 0.02);
				}
			} else {
				// Good sapping from market supply
				if (market && market.supply) {
					const goodId = GOODS_NAME_MAP[costType] || 1; // Default to Wood/Coral if unknown
					market.supply[goodId] = Math.max(0, (market.supply[goodId] || 0) - t.cost * typeMages * 0.005);
				}
			}

			// 2. APPLYING EFFECTS & CRIME-SCALED DANGER
			const effect = t.effect || "strength";
			const localCrime = burg ? (burg.crime || 15) : 15; // default 15% crime rate
			
			// Danger opposite effect scales up with local crime
			const dangerRate = (t.dangerFactor || 0.1) * (1.0 + localCrime / 100);
			const boostRate = typeMages * 0.02;
			const netModifier = boostRate - dangerRate;

			if (effect === "strength") {
				if (state) {
					state.militaryPower = Math.max(0, Math.round(state.militaryPower * (1.0 + netModifier * 0.05)));
				}
			} else if (effect === "wealth") {
				if (state) {
					state.treasury = Math.max(0, Math.round(state.treasury * (1.0 + netModifier * 0.03)));
				}
			} else if (effect === "population") {
				if (burg) {
					burg.population = Math.max(10, Math.round(burg.population * (1.0 + netModifier * 0.02)));
				}
			} else if (effect === "happiness") {
				if (burg) {
					burg.growthRate = Math.max(-0.1, Math.min(0.1, burg.growthRate + netModifier * 0.01));
				}
			} else if (effect === "defense") {
				if (burg) {
					burg.defensiveRating = Math.max(0, burg.defensiveRating + netModifier * 0.5);
				}
			} else if (effect === "diplomacy") {
				if (state) {
					state.expansionism = Math.max(0, Math.min(2.0, state.expansionism + netModifier * 0.1));
				}
			}
		}
	}
}

// Apply dynamic magical vector modifiers to economics, military, growth, and taxation
export function applyMagicGeopoliticalVectors(
	states: any[],
	updatedBurgs: any[],
	cellStates: Uint8Array,
	magicFlux: Float32Array,
	magePopulation: Uint32Array,
	magicTypes: MagicTypeConfig[],
): void {
	const stateMap = new Map(states.map((s) => [s.id, s]));

	// Calculate total population per state
	const statePop = new Map<number, number>();
	const stateMages = new Map<number, number>();

	for (let i = 0; i < cellStates.length; i++) {
		const sId = cellStates[i];
		if (sId === 0) continue;

		statePop.set(sId, (statePop.get(sId) || 0) + magePopulation[i] * 100); // proxy total pop
		stateMages.set(sId, (stateMages.get(sId) || 0) + magePopulation[i]);
	}

	for (const state of states) {
		const magesCount = stateMages.get(state.id) || 0;
		const totalPop = statePop.get(state.id) || 1000;
		const mageRatio = magesCount / Math.max(1, totalPop);

		// Apply combined weights of all magic configs scaled by mage ratio
		let prodMult = 1.0;
		let milMult = 1.0;
		let taxMult = 1.0;

		for (const config of magicTypes) {
			// Leverage modifier represents how strongly mages skew the results
			const leverage = mageRatio * 5.0;
			prodMult += (config.weights.production - 1.0) * leverage;
			milMult += (config.weights.military - 1.0) * leverage;
			taxMult += (config.weights.taxation - 1.0) * leverage;
		}

		state.treasury = Math.round(state.treasury * Math.max(0.5, taxMult));
		state.militaryPower = Math.round(
			state.militaryPower * Math.max(0.5, milMult),
		);
	}
}

// Perform daily volatility rolls checks (accidents, mutated biomes)
export function runMagicVolatilityChecks(
	biomes: Uint8Array,
	magicFlux: Float32Array,
	magicTypes: MagicTypeConfig[],
): Uint8Array {
	const pointsN = biomes.length;
	const nextBiomes = new Uint8Array(biomes);

	// Aggregate volatilities
	const baseAccident = magicTypes.reduce(
		(maxVal, t) => Math.max(maxVal, t.volatility.accidents),
		0,
	);
	const baseInstability = magicTypes.reduce(
		(maxVal, t) => Math.max(maxVal, t.volatility.instability),
		0,
	);

	for (let i = 0; i < pointsN; i++) {
		const flux = magicFlux[i];
		if (flux < 55.0) continue; // High flux threshold

		// Magical Instability converts biomes randomly to Oasis (biome 4) or magical mutations
		const instChance = baseInstability * (flux / 100.0) * 0.05; // scaled daily probability
		if (Math.random() < instChance) {
			// Mutate to Sand Desert (biome 3) or Oasis (biome 4)
			nextBiomes[i] = Math.random() > 0.5 ? 3 : 4;
		}
	}

	return nextBiomes;
}
