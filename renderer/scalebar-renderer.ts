import { type AppState, store } from "../state/store";
import { BIOME_COLORS } from "../simulation/biomes/biomes-generator";
import { GOODS } from "../simulation/civilization/goods-generator";

/** Draws the map scale bar and optional legend onto the canvas AFTER ctx.restore() so it's in screen space. */
export function drawScalebarOverlay(canvas: HTMLCanvasElement, state: AppState) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const zoom = state.zoom || 1.0;
	const dpr = window.devicePixelRatio || 1;
	const W = canvas.width;
	const H = canvas.height;

	// ─── SCALEBAR ───────────────────────────────────────────────────────────
	if (state.showScalebar) {
		const style = state.layerStyles?.scalebar || { opacity: 0.85, color: "#ffffff", size: 1.0 };
		ctx.save();
		ctx.globalAlpha = style.opacity;

		// km per canvas pixel at current zoom
		const kmPerMapUnit = (state.worldSizeKm || 10000) / (state.width || 1000);
		const kmPerPixel = kmPerMapUnit / zoom;

		// Pick a nice round bar length (in km)
		const targetBarPx = 120; // desired pixel width of bar
		const rawKm = kmPerPixel * targetBarPx;
		const magnitude = Math.pow(10, Math.floor(Math.log10(rawKm)));
		const niceKm = Math.round(rawKm / magnitude) * magnitude;
		const barPx = niceKm / kmPerPixel;

		const bx = 20;
		const by = H - 28;
		const bh = 8;

		// Background pill
		ctx.fillStyle = "rgba(0,0,0,0.5)";
		ctx.beginPath();
		ctx.roundRect(bx - 6, by - 14, barPx + 12, bh + 20, 4);
		ctx.fill();

		// Scale bar ticks
		ctx.fillStyle = style.color;
		ctx.strokeStyle = style.color;
		ctx.lineWidth = 1.5 * style.size;

		ctx.beginPath();
		ctx.moveTo(bx, by + bh / 2);
		ctx.lineTo(bx, by);
		ctx.lineTo(bx + barPx, by);
		ctx.lineTo(bx + barPx, by + bh / 2);
		ctx.stroke();

		ctx.font = `bold ${11 * style.size}px 'Outfit', 'Inter', sans-serif`;
		ctx.textAlign = "left";
		ctx.fillText("0", bx, by - 3);
		ctx.textAlign = "right";
		ctx.fillText(`${niceKm >= 1000 ? `${niceKm / 1000}k` : niceKm} km`, bx + barPx, by - 3);

		ctx.restore();
	}

	// ─── LEGEND ─────────────────────────────────────────────────────────────
	if (state.showLegend) {
		ctx.save();
		ctx.globalAlpha = 0.9;

		// Determine what thematic layer is active and build legend entries
		const entries: { color: string; label: string }[] = [];

		const activeLayer = state.layerOrder?.find((l: string) => {
			const key = `show${l.charAt(0).toUpperCase() + l.slice(1)}`;
			return (state as any)[key] === true && ["heightmap", "biomes", "cultures", "states", "provinces", "religions", "goods"].includes(l);
		});

		if (activeLayer === "biomes") {
			const biomeNames = ["Ocean", "Desert", "Arid", "Savanna", "Grassland", "Tropical Forest", "Temperate Deciduous", "Temperate Rainforest", "Tropical Rainforest", "Taiga", "Tundra", "Arctic", "Mountain", "Reef", "Kelp Forest", "Abyssal Plain", "Hydrothermal Vent", "Deep Trench"];
			Object.entries(BIOME_COLORS).forEach(([id, color]) => {
				const name = biomeNames[parseInt(id)] || `Biome ${id}`;
				entries.push({ color: color as string, label: name });
			});
		} else if (activeLayer === "states" && state.states) {
			const STATE_COLORS = ["#2563eb", "#16a34a", "#ca8a04", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4f46e5", "#0d9488"];
			(state.states as any[]).forEach((s: any, i: number) => {
				entries.push({ color: STATE_COLORS[i % STATE_COLORS.length], label: s.name || `State ${i + 1}` });
			});
		} else if (activeLayer === "goods") {
			const seen = new Set<number>();
			if (state.grid) {
				// Just show top 10 most common goods
				Object.values(GOODS).slice(0, 10).forEach((g: any) => {
					if (!seen.has(g.i)) {
						seen.add(g.i);
						entries.push({ color: g.color, label: g.name });
					}
				});
			}
		}

		if (entries.length > 0) {
			const rowH = 18;
			const lx = W - 160;
			const ly = H - entries.length * rowH - 20;
			const panelH = entries.length * rowH + 12;

			// Background
			ctx.fillStyle = "rgba(0,0,0,0.6)";
			ctx.beginPath();
			ctx.roundRect(lx - 8, ly - 4, 165, panelH, 6);
			ctx.fill();

			entries.forEach(({ color, label }, i) => {
				const ey = ly + i * rowH;
				ctx.fillStyle = color;
				ctx.fillRect(lx, ey, 14, 12);
				ctx.strokeStyle = "rgba(255,255,255,0.3)";
				ctx.lineWidth = 0.5;
				ctx.strokeRect(lx, ey, 14, 12);

				ctx.fillStyle = "#e2e8f0";
				ctx.font = "10px 'Outfit', 'Inter', sans-serif";
				ctx.textAlign = "left";
				ctx.fillText(label.length > 16 ? label.slice(0, 15) + "…" : label, lx + 18, ey + 10);
			});
		}

		ctx.restore();
	}
}

/** Draws arc-curved state territory labels using character-by-character rotation */
export function drawCurvedStateLabels(
	ctx: CanvasRenderingContext2D,
	states: any[],
	burgs: any[],
	zoom: number,
	layerStyles: Record<string, { opacity: number; color: string; size: number }>,
) {
	if (!states || !burgs) return;
	const style = layerStyles?.labels || { opacity: 1.0, color: "#ffffff", size: 11.0 };
	ctx.save();
	ctx.globalAlpha = style.opacity;

	for (const state of states) {
		const capital = burgs.find((b: any) => b.stateId === state.id && b.isCapital);
		if (!capital) continue;

		const text = (state.name || `State ${state.id}`).toUpperCase();
		const cx = capital.x;
		const cy = capital.y;
		const arcRadius = (60 * style.size) / (11.0 * Math.sqrt(zoom));
		const fontSize = Math.max(7, (13 * style.size) / (11.0 * Math.sqrt(zoom)));

		ctx.font = `bold ${fontSize}px 'Outfit', 'Inter', sans-serif`;
		ctx.textAlign = "center";

		// Measure total text width to center the arc
		const totalW = ctx.measureText(text).width;
		const angleSpan = totalW / arcRadius; // total arc angle in radians

		ctx.save();
		ctx.translate(cx, cy);

		// For each character, compute angular position and rotate
		let charX = -totalW / 2;
		for (let i = 0; i < text.length; i++) {
			const charW = ctx.measureText(text[i]).width;
			const charAngle = (charX + charW / 2) / arcRadius - Math.PI / 2;
			ctx.save();
			ctx.rotate(charAngle + Math.PI / 2);
			ctx.fillStyle = "rgba(0,0,0,0.7)";
			ctx.fillText(text[i], 0, -arcRadius - 1);
			ctx.fillStyle = "#ffffff";
			ctx.fillText(text[i], 0, -arcRadius);
			ctx.restore();
			charX += charW;
		}

		ctx.restore();
	}

	ctx.restore();
}
