import { AppState } from "../state/store";

export function mountExportOptions(
	containerId: string,
	canvas: HTMLCanvasElement,
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const btnStyle =
		"border: none; padding: 0.45rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.3rem;";

	container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; box-sizing: border-box;">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;">
        <button id="saveBtn" style="background: #10b981; ${btnStyle}">💾 Save JSON</button>
        <button id="loadBtn" style="background: #eab308; ${btnStyle}">📂 Load JSON</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;">
        <button id="exportPngBtn" style="background: #3b82f6; ${btnStyle}">🖼️ Export PNG</button>
        <button id="exportSvgBtn" style="background: #3b82f6; ${btnStyle}">📐 Export SVG</button>
      </div>
      <button id="toggle3DBtn" style="background: #8b5cf6; ${btnStyle} width: 100%;">🌐 Toggle 3D View</button>
      <input id="fileInput" type="file" accept=".json" style="display: none;" />
    </div>
  `;

	const pngBtn = document.getElementById("exportPngBtn") as HTMLButtonElement;
	const svgBtn = document.getElementById("exportSvgBtn") as HTMLButtonElement;

	pngBtn.addEventListener("click", () => {
		const url = canvas.toDataURL("image/png");
		const a = document.createElement("a");
		a.href = url;
		a.download = "fantasy-map.png";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	});

	svgBtn.addEventListener("click", () => {
		// Generate a simple vector representation of the map layers
		const state = (window as any).store.getState();
		const width = state.width || 800;
		const height = state.height || 600;

		let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

		// A. Draw heights grayscale cells if grid present
		if (state.grid && state.heights) {
			for (let i = 0; i < state.grid.points.length; i++) {
				const vertices = state.grid.cells.v[i];
				if (!vertices) continue;
				const pts = vertices
					.map((v: number) => state.grid.vertices.p[v])
					.filter(Boolean);
				if (pts.length === 0) continue;

				const pathPoints = pts
					.map((p: number[]) => `${p[0]},${p[1]}`)
					.join(" ");
				const h = state.heights[i];
				const val = Math.round(50 + (h / 100) * 180);
				const fill = `rgb(${val}, ${val}, ${val})`;

				svgContent += `<polygon points="${pathPoints}" fill="${fill}" stroke="none" />`;
			}
		}

		svgContent += `</svg>`;

		const blob = new Blob([svgContent], { type: "image/svg+xml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "fantasy-map.svg";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	});
}
