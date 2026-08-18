import { createPRNG } from "../../core/random";
import type { Grid } from "../../core/types";
import type { MarkerType } from "../../state/store";

export interface Marker {
	id: number;
	type: string; // References MarkerType.id or built-in string
	name: string;
	cell: number;
	x: number;
	y: number;
	localMapData?: string; // TTRPG layout data
}

export function generateMarkers(
	grid: Grid,
	heights: Uint8Array,
	temp: Float32Array,
	prec: Uint8Array,
	biomes: Uint8Array,
	seed: string,
	markerTypes: MarkerType[] = [],
	burgCells: number[] = [],
): Marker[] {
	const markers: Marker[] = [];
	const pointsN = heights.length;
	const rng = createPRNG(seed);
	let nextId = 1;

	// O(1) burg lookup
	const burgSet = new Set(burgCells);

	for (let i = 0; i < pointsN; i++) {
		const h = heights[i];
		const t = temp[i];
		const b = biomes[i];

		const roll = rng();

		for (const mType of markerTypes) {
			// Base rarity check
			if (roll * 100 > mType.rarity) continue;

			// Biome checks
			if (mType.allowedBiomes.length > 0 && !mType.allowedBiomes.includes(b)) continue;
			if (mType.forbiddenBiomes.includes(b)) continue;

			// Temp checks
			if (t < mType.minTemp || t > mType.maxTemp) continue;

			// Nearby requirements
			if (mType.nearbyReq === "water") {
				if (h >= 20) {
					// Must be near water
					let nearWater = false;
					const neighbors = grid.cells.c[i] || [];
					for (const n of neighbors) {
						if (heights[n] < 20) {
							nearWater = true;
							break;
						}
					}
					if (!nearWater) continue;
				}
			} else if (mType.nearbyReq === "burg") {
				let nearBurg = false;
				const neighbors = grid.cells.c[i] || [];
				for (const n of neighbors) {
					if (burgSet.has(n)) {
						nearBurg = true;
						break;
					}
				}
				if (!nearBurg && !burgSet.has(i)) continue;
			}

			// Success! Spawn the marker
			const [x, y] = grid.points[i];
			markers.push({
				id: nextId++,
				type: mType.id,
				name: `The ${mType.name}`,
				cell: i,
				x,
				y,
			});
			break; // only spawn 1 marker per cell
		}
	}

	return markers;
}
