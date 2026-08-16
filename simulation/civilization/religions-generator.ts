import { createPRNG, PRNG } from "../../core/random";
import type { Grid } from "../../core/types";

export interface Religion {
	id: number;
	name: string;
	color: string;
	center: number; // cell ID
<<<<<<< HEAD
	habitat?: "land" | "ocean" | "amphibious";
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
}

const RELIGION_COLORS = [
	"#f43f5e",
	"#06b6d4",
	"#eab308",
	"#a855f7",
	"#10b981",
	"#f97316",
	"#3b82f6",
	"#64748b",
	"#ec4899",
	"#14b8a6",
];

const RELIGION_NAMES = [
	"Monotheism",
	"Polytheism",
	"Animism",
	"Shamanism",
	"Ancestrism",
	"Cult of Light",
	"Order of Void",
	"Nature Worship",
];

export function generateReligions(
	grid: Grid,
	heights: Uint8Array,
	cellCultures: Uint8Array,
	count = 5,
	seed: string,
<<<<<<< HEAD
	existingReligions?: Religion[],
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
): { religions: Religion[]; cellReligions: Uint8Array } {
	const pointsN = heights.length;
	const cellReligions = new Uint8Array(pointsN).fill(0); // 0 = No Religion / Folk Beliefs
	const religions: Religion[] = [];
	const rng = createPRNG(seed);

<<<<<<< HEAD
	// Seed placement candidates (any cells with active cultures/settlements, regardless of land/water)
	const candidates: number[] = [];
	for (let i = 0; i < pointsN; i++) {
		if (cellCultures[i] > 0) {
=======
	// Seed placement candidates (land cells with cultures)
	const candidates: number[] = [];
	for (let i = 0; i < pointsN; i++) {
		if (heights[i] >= 20 && cellCultures[i] > 0) {
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
			candidates.push(i);
		}
	}

	if (candidates.length === 0) {
<<<<<<< HEAD
		// Fallback to land cells if no culture exists yet
		for (let i = 0; i < pointsN; i++) {
			if (heights[i] >= 20) {
				candidates.push(i);
			}
		}
	}

	if (candidates.length === 0) {
		return { religions, cellReligions };
	}

	candidates.sort(() => rng() - 0.5);

	const actualCount = Math.min(count, candidates.length);
	const centers = candidates.slice(0, actualCount);

	const queue: { cellId: number; cost: number; religionId: number }[] = [];
	const minCost = new Float32Array(pointsN).fill(Infinity);

	for (let i = 0; i < actualCount; i++) {
		const rId = i + 1;
		const center = centers[i];
		const existing = existingReligions?.find((r) => r.id === rId);

		const habitat = existing ? existing.habitat || "land" : "land";

		religions.push({
			id: rId,
			name: existing?.name || `${RELIGION_NAMES[i % RELIGION_NAMES.length]}`,
			color: existing?.color || RELIGION_COLORS[i % RELIGION_COLORS.length],
			center,
			habitat,
		});

		cellReligions[center] = rId;
		minCost[center] = 0;
		queue.push({ cellId: center, cost: 0, religionId: rId });
	}

	// Dijkstra expansion
	while (queue.length > 0) {
		queue.sort((a, b) => a.cost - b.cost);
		const curr = queue.shift()!;

		if (curr.cost > minCost[curr.cellId]) continue;

		const rHabitat = religions.find((r) => r.id === curr.religionId)?.habitat || "land";

		const neighbors = grid.cells.c[curr.cellId] || [];
		for (const n of neighbors) {
			const hTo = heights[n];
			let cost = 1.0;

			// Base sea crossing penalty for non-aquatics
			if (hTo < 20) {
				cost = 30.0;
			} else {
				// Spreads easier within the same culture
				if (cellCultures[curr.cellId] !== cellCultures[n]) {
					cost += 2.0;
				}
				cost += Math.abs(hTo - heights[curr.cellId]) * 0.4;
			}

			// Apply habitability restrictions based on religion's chosen habitat
			let habitatCost = 0;
			if (rHabitat === "land" && hTo < 20) habitatCost += 3000;
			if (rHabitat === "ocean" && hTo >= 20) habitatCost += 3000;
			if (rHabitat === "amphibious") habitatCost = 0;

			const nextCost = curr.cost + cost + habitatCost;
			if (nextCost < 100.0 && nextCost < minCost[n]) {
				minCost[n] = nextCost;
				cellReligions[n] = curr.religionId;
				queue.push({ cellId: n, cost: nextCost, religionId: curr.religionId });
			}
		}
	}

=======
		return { religions, cellReligions };
	}

	candidates.sort(() => rng() - 0.5);

	const actualCount = Math.min(count, candidates.length);
	const centers = candidates.slice(0, actualCount);

	const queue: { cellId: number; cost: number; religionId: number }[] = [];
	const minCost = new Float32Array(pointsN).fill(Infinity);

	for (let i = 0; i < actualCount; i++) {
		const rId = i + 1;
		const center = centers[i];

		religions.push({
			id: rId,
			name: `${RELIGION_NAMES[i % RELIGION_NAMES.length]}`,
			color: RELIGION_COLORS[i % RELIGION_COLORS.length],
			center,
		});

		cellReligions[center] = rId;
		minCost[center] = 0;
		queue.push({ cellId: center, cost: 0, religionId: rId });
	}

	// Dijkstra expansion
	while (queue.length > 0) {
		queue.sort((a, b) => a.cost - b.cost);
		const curr = queue.shift()!;

		if (curr.cost > minCost[curr.cellId]) continue;

		const neighbors = grid.cells.c[curr.cellId] || [];
		for (const n of neighbors) {
			const hTo = heights[n];
			let cost = 1.0;

			if (hTo < 20) {
				cost = 30.0; // Sea crossing is moderately hard for beliefs
			} else {
				// Spreads easier within the same culture
				if (cellCultures[curr.cellId] !== cellCultures[n]) {
					cost += 2.0;
				}
				cost += Math.abs(hTo - heights[curr.cellId]) * 0.4;
			}

			const nextCost = curr.cost + cost;
			if (nextCost < 100.0 && nextCost < minCost[n]) {
				minCost[n] = nextCost;
				cellReligions[n] = curr.religionId;
				queue.push({ cellId: n, cost: nextCost, religionId: curr.religionId });
			}
		}
	}

>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
	return { religions, cellReligions };
}
