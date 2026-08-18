import { BIOME_COLORS } from "../simulation/biomes/biomes-generator";
import {
	GOODS,
	getGoodColorForCell,
	getGoodNameForCell,
} from "../simulation/civilization/goods-generator";
import { type AppState, store } from "../state/store";
import { meander } from "./meander";

const STATE_COLORS = [
	"#2563eb",
	"#16a34a",
	"#ca8a04",
	"#d97706",
	"#dc2626",
	"#7c3aed",
	"#0891b2",
	"#db2777",
	"#4f46e5",
	"#0d9488",
];

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

const PROVINCE_COLORS = [
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#06b6d4",
	"#ec4899",
	"#6366f1",
	"#14b8a6",
	"#f43f5e",
];

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

function getReligionColor(relId: number, state: AppState): string {
	const rel = state.religions?.find((r: any) => r.id === relId);
	return rel?.color || RELIGION_COLORS[(relId - 1) % RELIGION_COLORS.length] || "#555";
}

function getHeightColor(h: number): string {
	if (h < 20) {
		const ratio = h / 20;
		const blue = Math.round(50 + ratio * 150);
		return `rgb(20, 40, ${blue})`;
	} else {
		const ratio = (h - 20) / 80;
		if (ratio < 0.4) {
			const green = Math.round(120 + ratio * 100);
			const red = Math.round(60 + ratio * 80);
			return `rgb(${red}, ${green}, 40)`;
		} else if (ratio < 0.8) {
			const red = Math.round(140 + (ratio - 0.4) * 80);
			const green = Math.round(120 + (ratio - 0.4) * 80);
			return `rgb(${red}, ${green}, 80)`;
		} else {
			const val = Math.round(200 + (ratio - 0.8) * 275);
			const clamped = Math.min(val, 255);
			return `rgb(${clamped}, ${clamped}, ${clamped})`;
		}
	}
}

function getTempColor(t: number): string {
	const norm = (t + 15) / 45;
	const r = Math.round(minmax(norm * 255, 0, 255));
	const b = Math.round(minmax((1 - norm) * 255, 0, 255));
	return `rgb(${r}, 80, ${b})`;
}

// Convert Celsius temperature to Fahrenheit for original scale displays
export function celsiusToFahrenheit(c: number): number {
	return Number((c * 1.8 + 32).toFixed(1));
}

function getPrecColor(p: number): string {
	if (p === 0) return "#fbe79f";
	const norm = Math.min(p / 120, 1.0);
	const val = Math.round(250 - norm * 200);
	return `rgb(${val}, ${val}, 255)`;
}

function minmax(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

export function renderMap(
	canvas: HTMLCanvasElement,
	state: AppState & any,
	layerType:
		| "heightmap"
		| "biomes"
		| "temp"
		| "prec"
		| "cultures"
		| "states"
		| "provinces"
		| "religions"
		| "goods",
) {
	const ctx = canvas.getContext("2d");
	if (!ctx || !state.grid) return;

	const {
		grid,
		heights,
		biomes,
		temp,
		prec,
		flowDirections,
		rivers,
		cellCultures,
		cellStates,
		cellProvinces,
		cellReligions,
		cellGoods,
		burgs,
		routes,
		military,
		zones,
		markers,
		labels,
	} = state;
	const pointsN = grid.points.length;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	ctx.save();
	ctx.translate(state.offsetX || 0, state.offsetY || 0);
	ctx.scale(state.zoom || 1.0, state.zoom || 1.0);

	// 1. Draw helper definitions
	const drawThematicLayer = (type: string) => {
		const layerType = type;
		ctx.save();
		const style = state.layerStyles?.[layerType] || { opacity: 1.0 };
		ctx.globalAlpha = style.opacity;

		const zoom = state.zoom || 1.0;

		// Viewport bounds in map coordinates for smart frustum culling of subdivided cells
		const minX = -state.offsetX / zoom;
		const minY = -state.offsetY / zoom;
		const maxX = (canvas.width - state.offsetX) / zoom;
		const maxY = (canvas.height - state.offsetY) / zoom;

		// Dynamic interpolation helper to get the precise color at any sub-point [x, y] inside a cell
		const getColorAtPoint = (pt: [number, number], cellId: number): string => {
			// Perturb coordinates with multi-frequency sine waves to create organic, wavy cell boundaries
			const px =
				pt[0] + Math.sin(pt[1] * 0.12) * 2.5 + Math.cos(pt[0] * 0.18) * 1.2;
			const py =
				pt[1] + Math.cos(pt[0] * 0.12) * 2.5 + Math.sin(pt[1] * 0.18) * 1.2;

			// Find which cell among cellId and its neighbors is closest to the perturbed coordinates
			let nearestCellId = cellId;
			let minDistSqr = Infinity;

			// Evaluate active cell first
			const cx0 = grid.points[cellId];
			if (cx0) {
				const dx = px - cx0[0];
				const dy = py - cx0[1];
				minDistSqr = dx * dx + dy * dy;
			}

			// Evaluate neighbors
			const neighbors = grid.cells.c[cellId];
			if (neighbors) {
				for (let idx = 0; idx < neighbors.length; idx++) {
					const c = neighbors[idx];
					const center = grid.points[c];
					if (!center) continue;
					const dx = px - center[0];
					const dy = py - center[1];
					const distSqr = dx * dx + dy * dy;
					if (distSqr < minDistSqr) {
						minDistSqr = distSqr;
						nearestCellId = c;
					}
				}
			}

			// Rest of the function uses these single candidates and uniform weights for 100% crisp lookups
			const candidates = [nearestCellId];
			const weights = [1.0];
			const sumWeights = 1.0;

			// Heightmap Layer
			if (layerType === "heightmap" && heights) {
				let sumHeight = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumHeight += (heights[candidates[idx]] || 0) * weights[idx];
				}
				return getHeightColor(sumHeight / sumWeights);
			}

			// Biomes Layer
			if (layerType === "biomes" && biomes) {
				const biomeWeights: Record<number, number> = {};
				for (let idx = 0; idx < candidates.length; idx++) {
					const b = biomes[candidates[idx]];
					biomeWeights[b] = (biomeWeights[b] || 0) + weights[idx];
				}
				let maxW = -1;
				let winner = 0;
				for (const bStr in biomeWeights) {
					const bNum = parseInt(bStr);
					if (biomeWeights[bNum] > maxW) {
						maxW = biomeWeights[bNum];
						winner = bNum;
					}
				}
				return BIOME_COLORS[winner] || "#333";
			}

			// Temp Layer
			if (layerType === "temp" && temp) {
				let sumTemp = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumTemp += (temp[candidates[idx]] || 0) * weights[idx];
				}
				return getTempColor(sumTemp / sumWeights);
			}

			// Prec Layer
			if (layerType === "prec" && prec) {
				let sumPrec = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumPrec += (prec[candidates[idx]] || 0) * weights[idx];
				}
				return getPrecColor(sumPrec / sumWeights);
			}

			// Cultures Layer
			if (layerType === "cultures" && cellCultures && heights) {
				let sumHeight = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumHeight += (heights[candidates[idx]] || 0) * weights[idx];
				}
				const interpHeight = sumHeight / sumWeights;
				if (interpHeight < 20) {
					return getHeightColor(interpHeight);
				}

				const cultureWeights: Record<number, number> = {};
				for (let idx = 0; idx < candidates.length; idx++) {
					const cultId = cellCultures[candidates[idx]];
					if (cultId > 0) {
						cultureWeights[cultId] =
							(cultureWeights[cultId] || 0) + weights[idx];
					}
				}
				let maxW = -1;
				let winner = 0;
				for (const cStr in cultureWeights) {
					const cNum = parseInt(cStr);
					if (cultureWeights[cNum] > maxW) {
						maxW = cultureWeights[cNum];
						winner = cNum;
					}
				}
				return winner > 0
					? CULTURE_COLORS[(winner - 1) % CULTURE_COLORS.length]
					: "#555";
			}

			// States Layer
			if (layerType === "states" && cellStates && heights) {
				let sumHeight = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumHeight += (heights[candidates[idx]] || 0) * weights[idx];
				}
				const interpHeight = sumHeight / sumWeights;

				const stateWeights: Record<number, number> = {};
				for (let idx = 0; idx < candidates.length; idx++) {
					const stateId = cellStates[candidates[idx]];
					if (stateId > 0) {
						stateWeights[stateId] = (stateWeights[stateId] || 0) + weights[idx];
					}
				}
				let maxW = -1;
				let winner = 0;
				for (const sStr in stateWeights) {
					const sNum = parseInt(sStr);
					if (stateWeights[sNum] > maxW) {
						maxW = stateWeights[sNum];
						winner = sNum;
					}
				}
				if (winner > 0) {
					const baseColor = STATE_COLORS[(winner - 1) % STATE_COLORS.length];
					if (interpHeight < 20) {
						return baseColor + "80"; // 50% opacity for submerged effect
					}
					return baseColor;
				}
				if (interpHeight < 20) {
					return getHeightColor(interpHeight);
				}
				return "#555";
			}

			// Provinces Layer
			if (layerType === "provinces" && cellProvinces && heights) {
				let sumHeight = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumHeight += (heights[candidates[idx]] || 0) * weights[idx];
				}
				const interpHeight = sumHeight / sumWeights;
				if (interpHeight < 20) {
					return getHeightColor(interpHeight);
				}

				const provWeights: Record<number, number> = {};
				for (let idx = 0; idx < candidates.length; idx++) {
					const provId = cellProvinces[candidates[idx]];
					if (provId > 0) {
						provWeights[provId] = (provWeights[provId] || 0) + weights[idx];
					}
				}
				let maxW = -1;
				let winner = 0;
				for (const pStr in provWeights) {
					const pNum = parseInt(pStr);
					if (provWeights[pNum] > maxW) {
						maxW = provWeights[pNum];
						winner = pNum;
					}
				}
				return winner > 0
					? PROVINCE_COLORS[(winner - 1) % PROVINCE_COLORS.length]
					: "#555";
			}

			// Religions Layer
			if (layerType === "religions" && cellReligions && heights) {
				let sumHeight = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumHeight += (heights[candidates[idx]] || 0) * weights[idx];
				}
				const interpHeight = sumHeight / sumWeights;
				if (interpHeight < 20) {
					return getHeightColor(interpHeight);
				}

				const relWeights: Record<number, number> = {};
				for (let idx = 0; idx < candidates.length; idx++) {
					const relId = cellReligions[candidates[idx]];
					if (relId > 0) {
						relWeights[relId] = (relWeights[relId] || 0) + weights[idx];
					}
				}
				let maxW = -1;
				let winner = 0;
				for (const rStr in relWeights) {
					const rNum = parseInt(rStr);
					if (relWeights[rNum] > maxW) {
						maxW = relWeights[rNum];
						winner = rNum;
					}
				}
				return winner > 0
					? getReligionColor(winner, state)
					: "#555";
			}

			// Goods Layer
			if (layerType === "goods" && cellGoods && heights) {
				let sumHeight = 0;
				for (let idx = 0; idx < candidates.length; idx++) {
					sumHeight += (heights[candidates[idx]] || 0) * weights[idx];
				}
				const interpHeight = sumHeight / sumWeights;
				if (interpHeight < 20) {
					let hasGoods = false;
					for (let idx = 0; idx < candidates.length; idx++) {
						if (cellGoods[candidates[idx]] > 0) {
							hasGoods = true;
							break;
						}
					}
					if (!hasGoods) {
						return getHeightColor(interpHeight);
					}
				}

				const goodsWeights: Record<number, number> = {};
				for (let idx = 0; idx < candidates.length; idx++) {
					const goodId = cellGoods[candidates[idx]];
					if (goodId > 0) {
						goodsWeights[goodId] = (goodsWeights[goodId] || 0) + weights[idx];
					}
				}
				let maxW = -1;
				let winner = 0;
				for (const gStr in goodsWeights) {
					const gNum = parseInt(gStr);
					if (goodsWeights[gNum] > maxW) {
						maxW = goodsWeights[gNum];
						winner = gNum;
					}
				}
				return winner > 0 && GOODS[winner]
					? getGoodColorForCell(winner, cellId, heights)
					: "#555";
			}

			return "#333";
		};

		// Helper to render and subdivide a single triangle of the cell recursively
		const subdivideAndDrawTriangle = (
			p0: [number, number],
			p1: [number, number],
			p2: [number, number],
			depth: number,
			cellId: number,
		) => {
			if (depth === 0) {
				const cx = (p0[0] + p1[0] + p2[0]) / 3;
				const cy = (p0[1] + p1[1] + p2[1]) / 3;
				const fillCol = getColorAtPoint([cx, cy], cellId);

				ctx.beginPath();
				ctx.moveTo(p0[0], p0[1]);
				ctx.lineTo(p1[0], p1[1]);
				ctx.lineTo(p2[0], p2[1]);
				ctx.closePath();
				ctx.fillStyle = fillCol;
				ctx.fill();
			} else {
				const m01: [number, number] = [
					(p0[0] + p1[0]) / 2,
					(p0[1] + p1[1]) / 2,
				];
				const m12: [number, number] = [
					(p1[0] + p2[0]) / 2,
					(p1[1] + p2[1]) / 2,
				];
				const m20: [number, number] = [
					(p2[0] + p0[0]) / 2,
					(p2[1] + p0[1]) / 2,
				];

				subdivideAndDrawTriangle(p0, m01, m20, depth - 1, cellId);
				subdivideAndDrawTriangle(p1, m12, m01, depth - 1, cellId);
				subdivideAndDrawTriangle(p2, m20, m12, depth - 1, cellId);
				subdivideAndDrawTriangle(m01, m12, m20, depth - 1, cellId);
			}
		};

		// Determine subdivision depth based on 3 distinct thresholds
		let subdivisionDepth = 0;
		if (zoom >= 7.0) {
			subdivisionDepth = 3;
		} else if (zoom >= 3.5) {
			subdivisionDepth = 2;
		} else if (zoom >= 1.5) {
			subdivisionDepth = 1;
		}

		// Keep rendering strictly bounded to the cells currently visible on screen
		const margin = 25; // Tight but safe buffer around viewport coordinates
		for (let i = 0; i < pointsN; i++) {
			const pt = grid.points[i];
			if (pt) {
				const [cx, cy] = pt;
				// Fast viewport culling to avoid expensive rendering on off-screen cells
				if (
					cx < minX - margin ||
					cx > maxX + margin ||
					cy < minY - margin ||
					cy > maxY + margin
				) {
					continue;
				}
			}

			const vertices = grid.cells.v[i];
			if (!vertices || vertices.length === 0) continue;

			// If zoomed out, draw the simple Voronoi polygon directly (extremely fast and clean)
			if (subdivisionDepth === 0) {
				ctx.beginPath();
				const firstV = grid.vertices.p[vertices[0]];
				if (!firstV) continue;
				ctx.moveTo(firstV[0], firstV[1]);

				for (let j = 1; j < vertices.length; j++) {
					const v = grid.vertices.p[vertices[j]];
					if (v) ctx.lineTo(v[0], v[1]);
				}
				ctx.closePath();

				let color = "#333";
				if (layerType === "heightmap" && heights) {
					color = getHeightColor(heights[i]);
				} else if (layerType === "biomes" && biomes) {
					color = BIOME_COLORS[biomes[i]] || "#333";
				} else if (layerType === "temp" && temp) {
					color = getTempColor(temp[i]);
				} else if (layerType === "prec" && prec) {
					color = getPrecColor(prec[i]);
				} else if (layerType === "cultures" && cellCultures && heights) {
					const cultId = cellCultures[i];
					color =
						heights[i] < 20
							? getHeightColor(heights[i])
							: cultId > 0
								? CULTURE_COLORS[(cultId - 1) % CULTURE_COLORS.length]
								: "#555";
				} else if (layerType === "states" && cellStates && heights) {
					const stateId = cellStates[i];
					color =
						heights[i] < 20
							? getHeightColor(heights[i])
							: stateId > 0
								? STATE_COLORS[(stateId - 1) % STATE_COLORS.length]
								: "#555";
				} else if (layerType === "provinces" && cellProvinces && heights) {
					const provId = cellProvinces[i];
					color =
						heights[i] < 20
							? getHeightColor(heights[i])
							: provId > 0
								? PROVINCE_COLORS[(provId - 1) % PROVINCE_COLORS.length]
								: "#555";
				} else if (layerType === "religions" && cellReligions && heights) {
					const relId = cellReligions[i];
					color =
						heights[i] < 20
							? getHeightColor(heights[i])
							: relId > 0
								? getReligionColor(relId, state)
								: "#555";
				} else if (layerType === "goods" && cellGoods && heights) {
					const goodId = cellGoods[i];
					color =
						goodId > 0
							? getGoodColorForCell(goodId, i, heights)
							: heights[i] < 20
								? getHeightColor(heights[i])
								: "#555";
				}

				ctx.fillStyle = color;
				ctx.fill();
			} else {
				// Zoomed in: dynamically subdivide the cells into triangles and interpolate colors
				const cellCenter = grid.points[i];
				if (!cellCenter) continue;

				for (let j = 0; j < vertices.length; j++) {
					const vCurrent = grid.vertices.p[vertices[j]];
					const vNext = grid.vertices.p[vertices[(j + 1) % vertices.length]];
					if (!vCurrent || !vNext) continue;

					subdivideAndDrawTriangle(
						cellCenter,
						vCurrent,
						vNext,
						subdivisionDepth,
						i,
					);
				}
			}
		}
		ctx.restore();
	};

	const drawGrid = () => {
		if (!state.showGrid) return;
		ctx.save();
		const style = state.layerStyles?.grid || {
			opacity: 0.5,
			color: "rgba(0,0,0,0.15)",
			size: 0.5,
		};
		ctx.globalAlpha = style.opacity;
		ctx.strokeStyle = style.color;
		ctx.lineWidth = style.size;

		for (let i = 0; i < pointsN; i++) {
			const vertices = grid.cells.v[i];
			if (!vertices || vertices.length === 0) continue;
			ctx.beginPath();
			const firstV = grid.vertices.p[vertices[0]];
			if (!firstV) continue;
			ctx.moveTo(firstV[0], firstV[1]);
			for (let j = 1; j < vertices.length; j++) {
				const v = grid.vertices.p[vertices[j]];
				if (v) ctx.lineTo(v[0], v[1]);
			}
			ctx.closePath();
			ctx.stroke();
		}
		ctx.restore();
	};

	const drawRivers = () => {
		if (!state.showRivers || !rivers || !flowDirections) return;

		ctx.save();
		const style = state.layerStyles?.rivers || {
			opacity: 0.9,
			color: "#466eab",
			size: 1.0,
		};
		ctx.globalAlpha = style.opacity;
		ctx.strokeStyle = style.color;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		const headwaters = new Uint8Array(pointsN).fill(1);
		for (let i = 0; i < pointsN; i++) {
			const next = flowDirections[i];
			if (next !== -1) {
				headwaters[next] = 0;
			}
		}

		const zoom = state.zoom || 1.0;
		// Dynamically compute the required minimum flux for a river segment to be drawn at the current zoom
		const minRequiredFlux = Math.max(12, 280 / (zoom * zoom));

		for (let i = 0; i < pointsN; i++) {
			if (rivers[i] > 0 && headwaters[i] === 1) {
				const chain: [number, number][] = [];
				const cellsInRiver: number[] = [];
				let curr: number = i;
				while (curr !== -1 && rivers[curr] > 0) {
					chain.push(grid.points[curr]);
					cellsInRiver.push(curr);
					curr = flowDirections[curr];
					if (curr !== -1 && heights[curr] < 20) {
						chain.push(grid.points[curr]);
						cellsInRiver.push(curr);
						break;
					}
				}

				if (chain.length >= 2) {
					// Level-of-Detail check: Find maximum flux along this tributary chain
					let maxFluxInChain = 10;
					if (state.flux) {
						for (const cellId of cellsInRiver) {
							if (state.flux[cellId] > maxFluxInChain) {
								maxFluxInChain = state.flux[cellId];
							}
						}
					}
					// If the maximum flux is less than required for the zoom level, skip drawing this river completely
					if (maxFluxInChain < minRequiredFlux) {
						continue;
					}

					const meandered = meander(chain, { meandering: 0.5 });
					const fluxVal = state.flux ? state.flux[i] || 10 : 10;
					ctx.lineWidth = minmax(
						(Math.sqrt(fluxVal) * 0.15 * style.size) / Math.sqrt(zoom),
						0.4 / Math.sqrt(zoom),
						(6.0 * style.size) / Math.sqrt(zoom),
					);
					ctx.beginPath();
					ctx.moveTo(meandered[0][0], meandered[0][1]);
					for (let j = 1; j < meandered.length; j++) {
						ctx.lineTo(meandered[j][0], meandered[j][1]);
					}
					ctx.stroke();
				}
			}
		}
		ctx.restore();
	};

	const drawZones = () => {
		if (!state.showZones || !zones) return;

		ctx.save();
		const style = state.layerStyles?.zones || { opacity: 0.4 };
		ctx.globalAlpha = style.opacity;

		for (const z of zones) {
			ctx.fillStyle = z.color;
			for (const cellId of z.cells) {
				const vertices = grid.cells.v[cellId];
				if (!vertices) continue;
				ctx.beginPath();
				const firstV = grid.vertices.p[vertices[0]];
				if (!firstV) continue;
				ctx.moveTo(firstV[0], firstV[1]);
				for (let j = 1; j < vertices.length; j++) {
					const v = grid.vertices.p[vertices[j]];
					if (v) ctx.lineTo(v[0], v[1]);
				}
				ctx.closePath();
				ctx.fill();
			}
		}
		ctx.restore();
	};

	const drawRoutes = () => {
		if (!state.showRoutes || !routes) return;
		ctx.save();
		const style = state.layerStyles?.routes || {
			opacity: 0.85,
			color: "rgba(141, 110, 99, 0.85)",
			size: 1.8,
		};
		ctx.globalAlpha = style.opacity;
		const zoom = state.zoom || 1.0;

		for (const r of routes) {
			// Skip secondary trails/waterways at low zoom levels to prevent clutter
			if (r.type !== "road" && zoom < 1.8) {
				continue;
			}

			if (r.type === "road") {
				ctx.strokeStyle = style.color || "rgba(141, 110, 99, 0.85)";
				ctx.lineWidth = style.size / Math.sqrt(zoom);
				ctx.setLineDash([]);
			} else {
				ctx.strokeStyle = "rgba(33, 150, 243, 0.6)";
				ctx.lineWidth = (style.size * 0.8) / Math.sqrt(zoom);
				ctx.setLineDash([5 / Math.sqrt(zoom), 5 / Math.sqrt(zoom)]);
			}
			ctx.beginPath();
			const firstPt = grid.points[r.path[0]];
			ctx.moveTo(firstPt[0], firstPt[1]);
			for (let k = 1; k < r.path.length; k++) {
				const pt = grid.points[r.path[k]];
				ctx.lineTo(pt[0], pt[1]);
			}
			ctx.stroke();
		}
		ctx.restore();
	};

	const drawBurgs = () => {
		if (!state.showBurgs || !burgs) return;
		ctx.save();
		const style = state.layerStyles?.burgs || {
			opacity: 1.0,
			color: "#ffffff",
			size: 4.0,
		};
		ctx.globalAlpha = style.opacity;
		const zoom = state.zoom || 1.0;

		for (const b of burgs) {
			// Tiered Visibility of Burgs depending on current zoom levels
			let isVisible = false;
			if (b.isCapital) {
				isVisible = true; // Capital is always visible
			} else if (zoom >= 4.0) {
				isVisible = true; // Show all burgs at close-up
			} else if (zoom >= 2.2) {
				isVisible = b.population >= 50000;
			} else if (zoom >= 1.5) {
				isVisible = b.population >= 100000;
			} else {
				isVisible = b.population >= 200000; // Only massive cities when zoomed out
			}

			if (!isVisible) continue;

			// Inversely scaled radius to keep icons perfectly sized and sharp
			const baseRadius = b.isCapital ? style.size * 1.5 : style.size;
			const radius = baseRadius / Math.sqrt(zoom);

			ctx.fillStyle = b.isCapital ? "#ef4444" : style.color;
			ctx.strokeStyle = "#1e1e24";
			ctx.lineWidth = 1.5 / Math.sqrt(zoom);

			ctx.beginPath();
			ctx.arc(b.x, b.y, radius, 0, 2 * Math.PI);
			ctx.fill();
			ctx.stroke();

			ctx.fillStyle = "#ffffff";
			const baseFontSize = b.isCapital ? 12 : 10;
			const fontSize = baseFontSize / Math.sqrt(zoom);
			ctx.font = `bold ${fontSize}px 'Outfit', 'Inter', sans-serif`;
			ctx.shadowColor = "rgba(0,0,0,0.8)";
			ctx.shadowBlur = 2.0 / Math.sqrt(zoom);
			ctx.fillText(
				b.name,
				b.x + radius + 3 / Math.sqrt(zoom),
				b.y + 3.5 / Math.sqrt(zoom),
			);
		}
		ctx.restore();
	};

	const drawMilitary = () => {
		if (!state.showMilitary || !military) return;
		ctx.save();
		const style = state.layerStyles?.military || { opacity: 1.0, size: 1.5 };
		ctx.globalAlpha = style.opacity;
		const zoom = state.zoom || 1.0;

		for (const m of military) {
			const pt = grid.points[m.cell];
			if (!pt) continue;
			const [mx, my] = pt;
			const shieldColor =
				STATE_COLORS[(m.stateId - 1) % STATE_COLORS.length] || "#888";
			ctx.fillStyle = shieldColor;
			ctx.strokeStyle = "#ffffff";

			const scale = 1.0 / Math.sqrt(zoom);
			const w = 16 * scale;
			const h = 16 * scale;

			ctx.lineWidth = style.size * scale;
			ctx.fillRect(mx - w / 2, my - 24 * scale, w, h);
			ctx.strokeRect(mx - w / 2, my - 24 * scale, w, h);

			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 1.0 * scale;
			ctx.beginPath();
			ctx.moveTo(mx - w / 2, my - 24 * scale);
			ctx.lineTo(mx - w / 2, my - 8 * scale);
			ctx.stroke();

			const letter = m.type[0].toUpperCase();
			ctx.fillStyle = "#ffffff";
			ctx.font = `bold ${9 * scale}px 'Outfit', 'Inter', sans-serif`;
			ctx.fillText(letter, mx - 3 * scale, my - 12 * scale);
		}
		ctx.restore();
	};

	const drawMarkers = () => {
		if (!state.showMarkers || !markers) return;
		ctx.save();
		const style = state.layerStyles?.markers || {
			opacity: 1.0,
			color: "#fbbf24",
			size: 1.0,
		};
		ctx.globalAlpha = style.opacity;
		const zoom = state.zoom || 1.0;

		for (const mk of markers) {
			ctx.strokeStyle = "#000000";
			ctx.lineWidth = 1.0 / Math.sqrt(zoom);
			const markerScale = style.size / Math.sqrt(zoom);

			if (mk.type === "volcano") {
				ctx.fillStyle = "#f87171";
				ctx.beginPath();
				ctx.moveTo(mk.x, mk.y - 7 * markerScale);
				ctx.lineTo(mk.x + 6 * markerScale, mk.y + 5 * markerScale);
				ctx.lineTo(mk.x - 6 * markerScale, mk.y + 5 * markerScale);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
			} else {
				ctx.fillStyle = style.color;
				const w = 10 * markerScale;
				ctx.fillRect(mk.x - w / 2, mk.y - w / 2, w, w);
				ctx.strokeRect(mk.x - w / 2, mk.y - w / 2, w, w);
			}
		}
		ctx.restore();
	};

	const drawLabels = () => {
		if (!state.showLabels || !labels) return;
		ctx.save();
		const style = state.layerStyles?.labels || { opacity: 1.0, size: 11.0 };
		ctx.globalAlpha = style.opacity;
		const zoom = state.zoom || 1.0;

		for (const l of labels) {
			// Skip tiny/secondary territory labels when zoomed out
			if (l.size < 12 && zoom < 1.6) {
				continue;
			}

			ctx.save();
			ctx.translate(l.x, l.y);
			ctx.rotate((l.rotation * Math.PI) / 180);

			ctx.fillStyle = "#ffffff";
			const labelFontSize = (l.size * (style.size / 11.0)) / Math.sqrt(zoom);
			ctx.font = `bold ${labelFontSize}px 'Outfit', 'Inter', sans-serif`;
			ctx.textAlign = "center";

			ctx.shadowColor = "rgba(0,0,0,0.8)";
			ctx.shadowBlur = 4.0 / Math.sqrt(zoom);
			ctx.fillText(l.text, 0, 0);

			ctx.restore();
		}
		ctx.restore();
	};

	// ─── NEW VISUAL LAYERS ─────────────────────────────────────────────────

	const drawBorders = () => {
		if (!state.showBorders) return;
		ctx.save();
		const style = state.layerStyles?.borders || { opacity: 1.0, color: "#1a1a1a", size: 1.5 };
		ctx.globalAlpha = style.opacity;
		const zoom = state.zoom || 1.0;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		const bt = state.borderType || "political";

		for (let i = 0; i < pointsN; i++) {
			const neighbors = grid.cells.c[i];
			if (!neighbors) continue;
			for (let ni = 0; ni < neighbors.length; ni++) {
				const j = neighbors[ni];
				if (j <= i) continue; // avoid drawing each edge twice

				let drawLine = false;
				let lineWidth = 0.8;
				let lineColor = style.color;
				let lineDash: number[] = [];

				// Political (state) borders — thick solid
				if ((bt === "political" || bt === "all") && cellStates) {
					const si = cellStates[i];
					const sj = cellStates[j];
					if (si !== sj && (si > 0 || sj > 0)) {
						drawLine = true;
						lineWidth = (style.size * 2.0) / Math.sqrt(zoom);
						
						// Use the color of the state (prefer si if valid, else sj)
						const stateId = si > 0 ? si : sj;
						const stateObj = state.states?.find((s: any) => s.id === stateId);
						lineColor = stateObj?.color || style.color;
					}
				}
				// Province borders — medium dashed
				if (!drawLine && (bt === "province" || bt === "all") && cellProvinces) {
					const pi = cellProvinces[i];
					const pj = cellProvinces[j];
					if (pi !== pj && (pi > 0 || pj > 0)) {
						drawLine = true;
						lineWidth = (style.size * 1.2) / Math.sqrt(zoom);
						lineColor = "rgba(80, 80, 80, 0.9)";
						lineDash = [4 / zoom, 4 / zoom];
					}
				}
				// Cultural borders — thin dotted
				if (!drawLine && (bt === "culture" || bt === "all") && cellCultures) {
					const ci = cellCultures[i];
					const cj = cellCultures[j];
					if (ci !== cj && (ci > 0 || cj > 0)) {
						drawLine = true;
						lineWidth = (style.size * 0.7) / Math.sqrt(zoom);
						lineColor = "rgba(160, 100, 200, 0.6)";
						lineDash = [2 / zoom, 5 / zoom];
					}
				}

				if (!drawLine) continue;

				// Find the shared Voronoi edge between cells i and j
				const vI = grid.cells.v[i] || [];
				const vJ = grid.cells.v[j] || [];
				const shared: [number, number][] = [];
				const setJ = new Set(vJ);
				for (const vid of vI) {
					if (setJ.has(vid)) {
						const vp = grid.vertices.p[vid];
						if (vp) shared.push(vp as [number, number]);
					}
				}
				if (shared.length < 2) continue;

				ctx.strokeStyle = lineColor;
				ctx.lineWidth = lineWidth;
				ctx.setLineDash(lineDash);
				ctx.beginPath();
				ctx.moveTo(shared[0][0], shared[0][1]);
				ctx.lineTo(shared[1][0], shared[1][1]);
				ctx.stroke();
			}
		}
		ctx.setLineDash([]);
		ctx.restore();
	};

	const drawFractalCoastlines = () => {
		if (!state.showCoastlines || !heights) return;
		const zoom = state.zoom || 1.0;
		if (zoom < 2.5) return;

		ctx.save();
		const style = state.layerStyles?.coastlines || { opacity: 0.6, color: "#1a4a6e", size: 1.0 };
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// 3 rings with decreasing opacity — matches original ocean-layers.ts look
		const rings = [
			{ threshold: 20, alpha: style.opacity, width: (2.0 * style.size) / Math.sqrt(zoom) },
			{ threshold: 15, alpha: style.opacity * 0.6, width: (1.2 * style.size) / Math.sqrt(zoom) },
			{ threshold: 10, alpha: style.opacity * 0.35, width: (0.7 * style.size) / Math.sqrt(zoom) },
		];

		for (const ring of rings) {
			ctx.globalAlpha = ring.alpha;
			ctx.strokeStyle = style.color;
			ctx.lineWidth = ring.width;

			for (let i = 0; i < pointsN; i++) {
				if ((heights[i] || 0) >= ring.threshold) continue; // only ocean cells at this depth

				const neighbors = grid.cells.c[i];
				if (!neighbors) continue;
				for (const j of neighbors) {
					if ((heights[j] || 0) < ring.threshold) continue; // neighbor is also ocean — skip

					// Find shared edge
					const vI = grid.cells.v[i] || [];
					const vJ = grid.cells.v[j] || [];
					const shared: [number, number][] = [];
					const setJ = new Set(vJ);
					for (const vid of vI) {
						if (setJ.has(vid)) {
							const vp = grid.vertices.p[vid];
							if (vp) shared.push(vp as [number, number]);
						}
					}
					if (shared.length < 2) continue;

					// Apply fractal sine-wave offset to midpoint for organic coastlines
					const [ax, ay] = shared[0];
					const [bx, by] = shared[1];
					const mx = (ax + bx) / 2 + Math.sin(ay * 0.08 + ax * 0.05) * (3.5 / zoom);
					const my = (ay + by) / 2 + Math.cos(ax * 0.08 + ay * 0.05) * (3.5 / zoom);

					ctx.beginPath();
					ctx.moveTo(ax, ay);
					ctx.quadraticCurveTo(mx, my, bx, by);
					ctx.stroke();
				}
			}
		}
		ctx.restore();
	};

	const drawReliefIcons = () => {
		if (!state.showReliefIcons || !heights || !biomes) return;
		const zoom = state.zoom || 1.0;
		if (zoom < 3.0) return;

		ctx.save();
		const style = state.layerStyles?.relief || { opacity: 0.85, color: "#5a7a3a", size: 1.0 };
		ctx.globalAlpha = style.opacity;
		const scale = style.size / Math.sqrt(zoom);

		// Stride: show every Nth cell to avoid overwhelming density
		const stride = Math.max(1, Math.floor(4 / zoom));

		for (let i = 0; i < pointsN; i += stride) {
			const pt = grid.points[i];
			if (!pt) continue;
			const [cx, cy] = pt;
			const h = heights[i] || 0;
			const b = biomes[i] || 0;

			// Forest biomes (5-9): draw a tree
			if ((b >= 5 && b <= 9) && h >= 20) {
				const treeH = 9 * scale;
				const treeW = 6 * scale;
				// Trunk
				ctx.fillStyle = "#8B5E3C";
				ctx.fillRect(cx - scale, cy, scale * 2, scale * 3);
				// Canopy (triangle)
				ctx.fillStyle = "#3A7A3A";
				ctx.beginPath();
				ctx.moveTo(cx, cy - treeH);
				ctx.lineTo(cx - treeW / 2, cy);
				ctx.lineTo(cx + treeW / 2, cy);
				ctx.closePath();
				ctx.fill();
			}

			// High elevation: draw mountain
			if (h >= 70) {
				const mH = 12 * scale;
				const mW = 10 * scale;
				// Base mountain
				ctx.fillStyle = "#8a7a6a";
				ctx.beginPath();
				ctx.moveTo(cx, cy - mH);
				ctx.lineTo(cx - mW / 2, cy + scale);
				ctx.lineTo(cx + mW / 2, cy + scale);
				ctx.closePath();
				ctx.fill();
				// Snow cap
				if (h >= 85) {
					ctx.fillStyle = "#eaeaea";
					ctx.beginPath();
					ctx.moveTo(cx, cy - mH);
					ctx.lineTo(cx - mW * 0.25, cy - mH * 0.55);
					ctx.lineTo(cx + mW * 0.25, cy - mH * 0.55);
					ctx.closePath();
					ctx.fill();
				}
			}
		}
		ctx.restore();
	};

	const drawTradeCaravans = () => {
		const caravans = state.tradeCaravans;
		if (!caravans || caravans.length === 0) return;
		if (!routes) return;
		const zoom = state.zoom || 1.0;
		if (zoom < 1.5) return;

		ctx.save();
		const style = state.layerStyles?.caravans || { opacity: 1.0, color: "#f59e0b", size: 1.0 };
		ctx.globalAlpha = style.opacity;
		const iconR = (6 * style.size) / Math.sqrt(zoom);

		for (const caravan of caravans) {
			// Find matching route
			const route = (routes as any[]).find((r: any) => r.id === caravan.routeId || r.routeId === caravan.routeId);
			if (!route || !route.path || route.path.length < 2) continue;

			// Interpolate position along path using progress (0..1)
			const pathLen = route.path.length;
			const rawIdx = caravan.progress * (pathLen - 1);
			const idx0 = Math.floor(rawIdx);
			const idx1 = Math.min(idx0 + 1, pathLen - 1);
			const t = rawIdx - idx0;

			const p0 = grid.points[route.path[idx0]];
			const p1 = grid.points[route.path[idx1]];
			if (!p0 || !p1) continue;

			const cx = p0[0] + (p1[0] - p0[0]) * t;
			const cy = p0[1] + (p1[1] - p0[1]) * t;

			// Draw caravan emoji icon — type derived from route type
			const emoji = route.type === "waterway" ? "⛵" : "🐪";
			const fontSize = Math.max(8, (14 * style.size) / Math.sqrt(zoom));
			ctx.font = `${fontSize}px serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.shadowColor = "rgba(0,0,0,0.7)";
			ctx.shadowBlur = 3 / Math.sqrt(zoom);
			ctx.fillText(emoji, cx, cy);
			ctx.shadowBlur = 0;
		}
		ctx.restore();
	};

	const drawEmblems = () => {
		if (!state.showEmblems || !burgs) return;
		const zoom = state.zoom || 1.0;
		if (zoom < 1.5) return;

		ctx.save();
		const style = state.layerStyles?.emblems || { opacity: 0.9, color: "#ffffff", size: 1.0 };
		ctx.globalAlpha = style.opacity;

		const drawShield = (x: number, y: number, color: string, stateId: number, sc: number) => {
			// Shield outline
			const sw = 14 * sc;
			const sh = 18 * sc;
			ctx.save();
			ctx.translate(x, y);

			// Shield path (pointed bottom)
			ctx.beginPath();
			ctx.moveTo(-sw / 2, -sh / 2);
			ctx.lineTo(sw / 2, -sh / 2);
			ctx.lineTo(sw / 2, sh * 0.2);
			ctx.quadraticCurveTo(sw / 2, sh / 2, 0, sh / 2);
			ctx.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh * 0.2);
			ctx.closePath();

			ctx.fillStyle = color;
			ctx.fill();
			ctx.strokeStyle = "rgba(0,0,0,0.8)";
			ctx.lineWidth = 1.0 * sc;
			ctx.stroke();

			// Procedural charge based on stateId mod 6
			const charge = stateId % 6;
			ctx.fillStyle = "rgba(255,255,255,0.7)";
			if (charge === 0) {
				// Star
				const pts = 5;
				const outer = sw * 0.28;
				const inner = sw * 0.13;
				ctx.beginPath();
				for (let p = 0; p < pts * 2; p++) {
					const r = p % 2 === 0 ? outer : inner;
					const a = (p * Math.PI) / pts - Math.PI / 2;
					p === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
				}
				ctx.closePath();
				ctx.fill();
			} else if (charge === 1) {
				// Cross
				const cw = sw * 0.12;
				const cl = sh * 0.45;
				ctx.fillRect(-cw / 2, -cl / 2, cw, cl);
				ctx.fillRect(-cl / 2, -cw / 2, cl, cw);
			} else if (charge === 2) {
				// Circle
				ctx.beginPath();
				ctx.arc(0, 0, sw * 0.22, 0, Math.PI * 2);
				ctx.fill();
			} else if (charge === 3) {
				// Diamond
				const ds = sw * 0.28;
				ctx.beginPath();
				ctx.moveTo(0, -ds);
				ctx.lineTo(ds, 0);
				ctx.lineTo(0, ds);
				ctx.lineTo(-ds, 0);
				ctx.closePath();
				ctx.fill();
			} else if (charge === 4) {
				// Three horizontal bars (stripes)
				const bh = sh * 0.12;
				for (let b = -1; b <= 1; b++) {
					ctx.fillRect(-sw * 0.35, b * sh * 0.26 - bh / 2, sw * 0.7, bh);
				}
			} else {
				// Triangle (chevron)
				ctx.beginPath();
				ctx.moveTo(0, -sh * 0.28);
				ctx.lineTo(sw * 0.35, sh * 0.15);
				ctx.lineTo(-sw * 0.35, sh * 0.15);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
		};

		for (const b of burgs) {
			if (!b.isCapital) continue;
			const stateId = b.stateId || 1;
			const color = STATE_COLORS[(stateId - 1) % STATE_COLORS.length] || "#555";
			const sc = (style.size * (zoom >= 4.0 ? 1.2 : 0.75)) / Math.sqrt(zoom);
			drawShield(b.x, b.y - 20 / Math.sqrt(zoom), color, stateId, sc);
		}
		ctx.restore();
	};

	// 2. Loop through layerOrder to draw in correct sequence
	const order = state.layerOrder || [
		"heightmap",
		"biomes",
		"temp",
		"prec",
		"cultures",
		"states",
		"provinces",
		"religions",
		"goods",
		"coastlines",
		"borders",
		"grid",
		"rivers",
		"zones",
		"routes",
		"caravans",
		"relief",
		"markers",
		"burgs",
		"emblems",
		"military",
		"labels",
		"scalebar",
	];
	for (const layerId of order) {
		if (
			layerId === "heightmap" ||
			layerId === "biomes" ||
			layerId === "temp" ||
			layerId === "prec" ||
			layerId === "cultures" ||
			layerId === "states" ||
			layerId === "provinces" ||
			layerId === "religions" ||
			layerId === "goods"
		) {
			const showKey = `show${layerId.charAt(0).toUpperCase() + layerId.slice(1)}`;
			if (state[showKey] !== false) {
				drawThematicLayer(layerId);
			}
		} else if (layerId === "grid") drawGrid();
		else if (layerId === "rivers") drawRivers();
		else if (layerId === "zones") drawZones();
		else if (layerId === "routes") drawRoutes();
		else if (layerId === "burgs") drawBurgs();
		else if (layerId === "military") drawMilitary();
		else if (layerId === "markers") drawMarkers();
		else if (layerId === "labels") drawLabels();
		else if (layerId === "borders") drawBorders();
		else if (layerId === "coastlines") drawFractalCoastlines();
		else if (layerId === "relief") drawReliefIcons();
		else if (layerId === "caravans") drawTradeCaravans();
		else if (layerId === "emblems") drawEmblems();
	}

	// 3. Draw Nested LOD system overlay & entities
	drawNestedLODSystem(ctx, canvas, state);

	ctx.restore();
}

function drawNestedLODSystem(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	state: any,
) {
	if (!state.regions) return;

	const zoom = state.zoom || 1.0;
	let lod: "global" | "regional" | "local" = "global";
	if (zoom >= 8.0) {
		lod = "local";
	} else if (zoom >= 3.0) {
		lod = "regional";
	}

	// Calculate center of screen viewport in map coordinates
	const vpCenterX = (canvas.width / 2 - (state.offsetX || 0)) / zoom;
	const vpCenterY = (canvas.height / 2 - (state.offsetY || 0)) / zoom;

	// Find closest region
	let closestRegion = state.regions[0];
	let minRegionDist = Infinity;
	for (const r of state.regions) {
		const dx = r.centerX - vpCenterX;
		const dy = r.centerY - vpCenterY;
		const dist = dx * dx + dy * dy;
		if (dist < minRegionDist) {
			minRegionDist = dist;
			closestRegion = r;
		}
	}

	// Find closest local zone inside closestRegion
	let closestLocal = closestRegion.localZones[0];
	let minLocalDist = Infinity;
	for (const lz of closestRegion.localZones) {
		const dx = lz.centerX - vpCenterX;
		const dy = lz.centerY - vpCenterY;
		const dist = dx * dx + dy * dy;
		if (dist < minLocalDist) {
			minLocalDist = dist;
			closestLocal = lz;
		}
	}

	// Synchronize active IDs with Zustand store safely
	if (
		state.activeRegionId !== closestRegion.id ||
		state.activeLocalId !== closestLocal.id
	) {
		setTimeout(() => {
			store.updateState({
				activeRegionId: closestRegion.id,
				activeLocalId: closestLocal.id,
			});
		}, 0);
	}

	// ------------------ RENDERING LAYERS ------------------

	if (lod === "global") {
		// --- 1. GLOBAL LOD VIEW ---
		// Render region bounds and elegant golden nodes
		for (const r of state.regions) {
			// Golden anchor node
			ctx.save();
			ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
			ctx.shadowBlur = 8 / zoom;
			ctx.fillStyle = "#fbbf24";
			ctx.beginPath();
			ctx.arc(r.centerX, r.centerY, 6 / zoom, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();

			// Region name label
			ctx.save();
			ctx.fillStyle = "#ffffff";
			ctx.strokeStyle = "#000000";
			ctx.lineWidth = 3.0 / zoom;
			ctx.font = `bold ${10.5 / zoom}px 'Outfit', sans-serif`;
			ctx.textAlign = "center";
			ctx.strokeText(`🏰 [Region] ${r.name}`, r.centerX, r.centerY - 10 / zoom);
			ctx.fillText(`🏰 [Region] ${r.name}`, r.centerX, r.centerY - 10 / zoom);
			ctx.restore();
		}
	} else if (lod === "regional") {
		// --- 2. REGIONAL LOD VIEW ---
		// Render procedural trees & terrain detail for active region
		drawProceduralTerrain(
			ctx,
			closestRegion.centerX,
			closestRegion.centerY,
			closestRegion.radius,
			140,
			closestRegion.id * 520,
			zoom,
		);

		// Golden border indicating the active focused region
		ctx.save();
		ctx.strokeStyle = "#fbbf24";
		ctx.lineWidth = 2.5 / Math.sqrt(zoom);
		ctx.setLineDash([5, 5]);
		ctx.beginPath();
		ctx.arc(
			closestRegion.centerX,
			closestRegion.centerY,
			closestRegion.radius,
			0,
			Math.PI * 2,
		);
		ctx.stroke();
		ctx.restore();

		// Draw Region Label floating on top
		ctx.save();
		ctx.fillStyle = "#fbbf24";
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 4.0 / zoom;
		ctx.font = `bold ${16 / zoom}px 'Outfit', sans-serif`;
		ctx.textAlign = "center";
		ctx.strokeText(
			`🏰 Active Region: ${closestRegion.name}`,
			closestRegion.centerX,
			closestRegion.centerY - closestRegion.radius - 8 / zoom,
		);
		ctx.fillText(
			`🏰 Active Region: ${closestRegion.name}`,
			closestRegion.centerX,
			closestRegion.centerY - closestRegion.radius - 8 / zoom,
		);
		ctx.restore();

		// Draw the 10 local zones of the closestRegion
		for (const lz of closestRegion.localZones) {
			// Silver/Blue node at center
			ctx.save();
			ctx.fillStyle = "#60a5fa";
			ctx.beginPath();
			ctx.arc(lz.centerX, lz.centerY, 4 / zoom, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();

			// Local Zone name
			ctx.save();
			ctx.fillStyle = "#e2e8f0";
			ctx.strokeStyle = "#000000";
			ctx.lineWidth = 2.5 / zoom;
			ctx.font = `italic ${9 / zoom}px 'Outfit', sans-serif`;
			ctx.textAlign = "center";
			ctx.strokeText(`🏡 ${lz.name}`, lz.centerX, lz.centerY - 8 / zoom);
			ctx.fillText(`🏡 ${lz.name}`, lz.centerX, lz.centerY - 8 / zoom);
			ctx.restore();
		}

		// Draw Regional Units moving around
		for (const u of closestRegion.units) {
			drawUnit(ctx, u, zoom);
		}
	} else {
		// --- 3. LOCAL LOD VIEW ---
		// Render rich micro-terrain details inside the active Local Zone
		drawProceduralTerrain(
			ctx,
			closestLocal.centerX,
			closestLocal.centerY,
			closestLocal.radius * 1.5,
			240,
			closestLocal.id * 850 + closestRegion.id * 150,
			zoom,
		);

		// Silver/Blue border indicating active local zone
		ctx.save();
		ctx.strokeStyle = "#60a5fa";
		ctx.lineWidth = 3.0 / Math.sqrt(zoom);
		ctx.beginPath();
		ctx.arc(
			closestLocal.centerX,
			closestLocal.centerY,
			closestLocal.radius,
			0,
			Math.PI * 2,
		);
		ctx.stroke();
		ctx.restore();

		// Draw Local Zone Title
		ctx.save();
		ctx.fillStyle = "#60a5fa";
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 4.0 / zoom;
		ctx.font = `bold ${18 / zoom}px 'Outfit', sans-serif`;
		ctx.textAlign = "center";
		ctx.strokeText(
			`🏡 Local Zone: ${closestLocal.name}`,
			closestLocal.centerX,
			closestLocal.centerY - closestLocal.radius - 12 / zoom,
		);
		ctx.fillText(
			`🏡 Local Zone: ${closestLocal.name}`,
			closestLocal.centerX,
			closestLocal.centerY - closestLocal.radius - 12 / zoom,
		);
		ctx.restore();

		// Draw Local Units (Rangers, Wildlife, etc.)
		for (const u of closestLocal.units) {
			drawUnit(ctx, u, zoom);
		}

		// Draw Local Travel Cost Overlay (510 sq kms per cell, 1.0 day travel no road, 0.5 days with road)
		drawLocalTravelGrid(ctx, closestLocal, zoom);
	}
}

function drawProceduralTerrain(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	radius: number,
	count: number,
	seedVal: number,
	zoom: number,
) {
	let s = seedVal;
	const strokeScale = 1.0 / zoom;

	for (let i = 0; i < count; i++) {
		s = (s * 9301 + 49297) % 233280;
		const r = (s / 233280) * radius;
		s = (s * 9301 + 49297) % 233280;
		const theta = (s / 233280) * Math.PI * 2;
		const x = centerX + Math.cos(theta) * r;
		const y = centerY + Math.sin(theta) * r;

		s = (s * 9301 + 49297) % 233280;
		const assetType = s % 4; // 0: deciduous tree, 1: conifer, 2: farm/field, 3: grass

		if (assetType === 0) {
			// Deciduous Tree
			ctx.save();
			ctx.fillStyle = "#78350f"; // Brown trunk
			ctx.fillRect(x - 0.4 / zoom, y, 0.8 / zoom, 3.5 / zoom);
			ctx.fillStyle = "#15803d"; // Green leaf canopy
			ctx.beginPath();
			ctx.arc(x, y - 1.2 / zoom, 2.5 / zoom, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		} else if (assetType === 1) {
			// Conifer Pine Tree
			ctx.save();
			ctx.fillStyle = "#451a03"; // Dark trunk
			ctx.fillRect(x - 0.3 / zoom, y, 0.6 / zoom, 3.0 / zoom);
			ctx.fillStyle = "#14532d"; // Dark green triangle
			ctx.beginPath();
			ctx.moveTo(x, y - 4.5 / zoom);
			ctx.lineTo(x - 2.2 / zoom, y - 0.5 / zoom);
			ctx.lineTo(x + 2.2 / zoom, y - 0.5 / zoom);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		} else if (assetType === 2) {
			// Farm Field Plot
			ctx.save();
			ctx.fillStyle = "rgba(234, 179, 8, 0.45)"; // Golden wheat glow
			ctx.strokeStyle = "rgba(202, 138, 4, 0.7)";
			ctx.lineWidth = strokeScale;
			ctx.beginPath();
			ctx.rect(x - 3.5 / zoom, y - 2.5 / zoom, 7.0 / zoom, 5.0 / zoom);
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		} else {
			// Wild Grass Tuft
			ctx.save();
			ctx.strokeStyle = "#4d7c0f"; // Lime/olive green grass
			ctx.lineWidth = 0.6 / zoom;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x - 1.0 / zoom, y - 2.5 / zoom);
			ctx.moveTo(x, y);
			ctx.lineTo(x, y - 3.0 / zoom);
			ctx.moveTo(x, y);
			ctx.lineTo(x + 1.0 / zoom, y - 2.5 / zoom);
			ctx.stroke();
			ctx.restore();
		}
	}
}

function drawUnit(ctx: CanvasRenderingContext2D, u: any, zoom: number) {
	ctx.save();
	// Pick colors depending on unit type
	let color = "#ef4444"; // default red
	let glyph = "⚔️";
	if (u.type === "patrol" || u.type === "guard") {
		color = "#3b82f6"; // Blue military patrol
		glyph = "🛡️";
	} else if (u.type === "caravan") {
		color = "#a855f7"; // Purple commerce caravan
		glyph = "🐪";
	} else if (u.type === "wildlife") {
		color = "#f97316"; // Orange beast
		glyph = "🐺";
	}

	// Draw outer pulsing background ring
	ctx.save();
	ctx.fillStyle = color;
	ctx.globalAlpha = 0.25;
	ctx.beginPath();
	ctx.arc(
		u.x,
		u.y,
		(8 + Math.sin(Date.now() * 0.005) * 2) / zoom,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	ctx.restore();

	// Draw solid node
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(u.x, u.y, 5 / zoom, 0, Math.PI * 2);
	ctx.fill();

	// Render unit name
	ctx.fillStyle = "#ffffff";
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = 2.5 / zoom;
	ctx.font = `bold ${8.5 / zoom}px 'Outfit', sans-serif`;
	ctx.textAlign = "center";
	ctx.strokeText(`${glyph} ${u.name}`, u.x, u.y - 8 / zoom);
	ctx.fillText(`${glyph} ${u.name}`, u.x, u.y - 8 / zoom);

	ctx.restore();
}

function drawLocalTravelGrid(
	ctx: CanvasRenderingContext2D,
	lz: any,
	zoom: number,
) {
	// Subdivide the local zone into 5 local points representing micro cells
	// We'll place 4 of them around the center.
	const angleOffset = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
	const hasRoad = [true, false, true, false]; // procedurally place roads on 0 & 2

	for (let i = 0; i < 4; i++) {
		const dist = lz.radius * 0.6;
		const px = lz.centerX + Math.cos(angleOffset[i]) * dist;
		const py = lz.centerY + Math.sin(angleOffset[i]) * dist;
		const isRoad = hasRoad[i];

		// Draw micro node
		ctx.save();
		ctx.fillStyle = isRoad ? "#10b981" : "#d97706";
		ctx.beginPath();
		ctx.arc(px, py, 2.5 / zoom, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Draw micro cell boundary (dotted square)
		ctx.save();
		ctx.strokeStyle = isRoad
			? "rgba(16, 185, 129, 0.4)"
			: "rgba(217, 119, 6, 0.4)";
		ctx.lineWidth = 0.5 / zoom;
		ctx.setLineDash([2, 2]);
		ctx.beginPath();
		ctx.rect(px - 10 / zoom, py - 10 / zoom, 20 / zoom, 20 / zoom);
		ctx.stroke();
		ctx.restore();

		// Draw Travel Cost label
		ctx.save();
		ctx.fillStyle = isRoad ? "#a7f3d0" : "#fed7aa";
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 2.0 / zoom;
		ctx.font = `${6.5 / zoom}px 'Space Mono', monospace`;
		ctx.textAlign = "center";
		const labelStr = isRoad ? "🛣️ 0.5d Travel" : "🥾 1.0d Travel";
		ctx.strokeText(labelStr, px, py + 8 / zoom);
		ctx.fillText(labelStr, px, py + 8 / zoom);
		ctx.restore();
	}
}
