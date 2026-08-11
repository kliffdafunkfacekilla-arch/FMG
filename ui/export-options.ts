import { AppState } from "../state/store";

export function mountExportOptions(containerId: string, canvas: HTMLCanvasElement) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const btnStyle =
    "background: #3b82f6; border: none; padding: 0.45rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.8rem;";

  container.innerHTML = `
    <button id="openExportModalBtn" style="width: 100%; ${btnStyle}">🗂️ Export &amp; Files</button>

    <!-- Export & Files Popup Modal -->
    <div id="exportPopupModal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: rgba(20, 20, 25, 0.98); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 1.2rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 280px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); flex-direction: column; gap: 0.8rem; pointer-events: auto;">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem;">
        <span>Export &amp; Files</span>
        <span id="closeExportModalBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.2rem;">&times;</span>
      </h3>

      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <span style="color: #94a3b8; font-size: 0.75rem;">Save / Load Map</span>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;">
          <button id="fileSaveJsonBtn" style="${btnStyle}">💾 Save .json</button>
          <button id="fileLoadJsonBtn" style="${btnStyle}">📂 Load .json</button>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <span style="color: #94a3b8; font-size: 0.75rem;">Export Image</span>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;">
          <button id="exportPngBtn" style="${btnStyle}">🖼️ Export PNG</button>
          <button id="exportSvgBtn" style="${btnStyle}">📐 Export SVG</button>
        </div>
      </div>
    </div>
  `;

  const openBtn = document.getElementById("openExportModalBtn") as HTMLButtonElement;
  const modal = document.getElementById("exportPopupModal") as HTMLDivElement;
  const closeBtn = document.getElementById("closeExportModalBtn") as HTMLSpanElement;
  const pngBtn = document.getElementById("exportPngBtn") as HTMLButtonElement;
  const svgBtn = document.getElementById("exportSvgBtn") as HTMLButtonElement;
  const saveJsonBtn = document.getElementById("fileSaveJsonBtn") as HTMLButtonElement;
  const loadJsonBtn = document.getElementById("fileLoadJsonBtn") as HTMLButtonElement;

  if (openBtn && modal) openBtn.addEventListener("click", () => { modal.style.display = "flex"; });
  if (closeBtn && modal) closeBtn.addEventListener("click", () => { modal.style.display = "none"; });

  // Reuse the top HUD Save/Load JSON actions
  if (saveJsonBtn) saveJsonBtn.addEventListener("click", () => {
    (document.getElementById("saveBtn") as HTMLButtonElement | null)?.click();
  });
  if (loadJsonBtn) loadJsonBtn.addEventListener("click", () => {
    (document.getElementById("loadBtn") as HTMLButtonElement | null)?.click();
  });

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
        const pts = vertices.map((v: number) => state.grid.vertices.p[v]).filter(Boolean);
        if (pts.length === 0) continue;

        const pathPoints = pts.map((p: number[]) => `${p[0]},${p[1]}`).join(" ");
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
