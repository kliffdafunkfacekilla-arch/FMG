import type { AppState } from "../state/store";

export function drawMinimap(canvas: HTMLCanvasElement, state: AppState) {
	const ctx = canvas.getContext("2d");
	if (!ctx || !state.grid || !state.heights || !state.regions) return;

	const { grid, heights, regions } = state;
	const pointsN = grid.points.length;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Determine crop bounds depending on current zoom levels
	let minX = 0;
	let maxX = state.width;
	let minY = 0;
	let maxY = state.height;

	const isLocal = state.zoom >= 8.0;
	const isRegion = state.zoom >= 3.0 && state.zoom < 8.0;

	if (isRegion || isLocal) {
		const activeReg = regions.find((r: any) => r.id === state.activeRegionId) || regions[0];
		if (activeReg) {
			if (isLocal) {
				// Zoom in tightly around the active local zone if defined
				const activeLocal = activeReg.localZones?.find((lz: any) => lz.id === state.activeLocalId) || activeReg.localZones?.[0];
				if (activeLocal) {
					minX = activeLocal.centerX - 80;
					maxX = activeLocal.centerX + 80;
					minY = activeLocal.centerY - 52;
					maxY = activeLocal.centerY + 52;
				} else {
					minX = activeReg.centerX - 200;
					maxX = activeReg.centerX + 200;
					minY = activeReg.centerY - 130;
					maxY = activeReg.centerY + 130;
				}
			} else {
				// Zoom in around the regional center
				minX = activeReg.centerX - 200;
				maxX = activeReg.centerX + 200;
				minY = activeReg.centerY - 130;
				maxY = activeReg.centerY + 130;
			}
		}
	}

	const viewWidth = maxX - minX;
	const viewHeight = maxY - minY;
	const scaleX = canvas.width / viewWidth;
	const scaleY = canvas.height / viewHeight;

	// Use full density when zoomed in, skipped density for global performance
	const step = (isLocal || isRegion) ? 1 : 3;

	for (let i = 0; i < pointsN; i += step) {
		const [x, y] = grid.points[i];
		if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
			const h = heights[i];
			const dx = x - minX;
			const dy = y - minY;

			let color = "#1a1a24";
			if (h < 20) {
				const depth = Math.max(0, Math.min(1, h / 20));
				const r = Math.round(15 + depth * 15);
				const g = Math.round(35 + depth * 35);
				const b = Math.round(75 + depth * 50);
				color = `rgb(${r}, ${g}, ${b})`;
			} else {
				const alt = Math.max(0, Math.min(1, (h - 20) / 80));
				const r = Math.round(50 + alt * 130);
				const g = Math.round(100 + alt * 110);
				const b = Math.round(60 + alt * 60);
				color = `rgb(${r}, ${g}, ${b})`;
			}

			ctx.fillStyle = color;
			const ptSize = isLocal ? 9 : (isRegion ? 5 : 2);
			ctx.fillRect(dx * scaleX - ptSize / 2, dy * scaleY - ptSize / 2, ptSize, ptSize);
		}
	}
}

