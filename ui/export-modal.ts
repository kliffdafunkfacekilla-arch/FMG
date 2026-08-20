import { store } from "../state/store";
import { renderMap } from "../renderer/canvas-renderer";

export class ExportModal {
    private static wrapper: HTMLElement | null = null;

    public static open(canvas: HTMLCanvasElement) {
        if (this.wrapper) this.wrapper.remove();

        const html = `
            <div id="exportModalWrapper" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 200000; display: flex; justify-content: center; align-items: center; font-family: system-ui, sans-serif; backdrop-filter: blur(5px);">
                <div style="background: #1e293b; padding: 2rem; border-radius: 12px; width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid #334155; color: #f8fafc;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h2 style="margin: 0; color: #38bdf8; font-size: 1.5rem;">High-Res Export</h2>
                        <button id="closeExportModal" style="background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <label style="font-weight: bold; font-size: 0.9rem; color: #cbd5e1; display: block; margin-bottom: 0.5rem;">Resolution Scale</label>
                            <select id="exportScaleSelect" style="width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
                                <option value="1">1x (Current)</option>
                                <option value="2" selected>2x (High)</option>
                                <option value="4">4x (Ultra)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label style="font-weight: bold; font-size: 0.9rem; color: #cbd5e1; display: block; margin-bottom: 0.5rem;">Label Font</label>
                            <select id="exportFontSelect" style="width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
                                <option value="'Palatino Linotype', 'Book Antiqua', Palatino, serif">Classic Serif (Default)</option>
                                <option value="'Cinzel', serif">Cinzel (Fantasy)</option>
                                <option value="'MedievalSharp', cursive">MedievalSharp</option>
                                <option value="'Outfit', sans-serif">Outfit (Clean)</option>
                            </select>
                        </div>

                        <div style="background: #0f172a; padding: 1rem; border-radius: 6px; border: 1px solid #334155;">
                            <label style="font-weight: bold; font-size: 0.9rem; color: #cbd5e1; display: block; margin-bottom: 0.5rem;">Visibility Toggles</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
                                <label><input type="checkbox" id="expToggleLabels" checked> Map Labels</label>
                                <label><input type="checkbox" id="expToggleBorders" checked> Borders</label>
                                <label><input type="checkbox" id="expToggleRoutes" checked> Routes</label>
                                <label><input type="checkbox" id="expToggleGrid"> Grid</label>
                            </div>
                        </div>

                        <button id="exportPerformBtn" style="margin-top: 1rem; padding: 0.8rem; background: #3b82f6; color: white; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; font-size: 1.1rem; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4); transition: transform 0.1s;">
                            📸 Generate PNG
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
        this.wrapper = document.getElementById("exportModalWrapper");

        document.getElementById("closeExportModal")!.onclick = () => this.close();

        document.getElementById("exportPerformBtn")!.onclick = () => {
            const scale = parseInt((document.getElementById("exportScaleSelect") as HTMLSelectElement).value, 10) || 1;
            const font = (document.getElementById("exportFontSelect") as HTMLSelectElement).value;
            const showLabels = (document.getElementById("expToggleLabels") as HTMLInputElement).checked;
            const showBorders = (document.getElementById("expToggleBorders") as HTMLInputElement).checked;
            const showRoutes = (document.getElementById("expToggleRoutes") as HTMLInputElement).checked;
            const showGrid = (document.getElementById("expToggleGrid") as HTMLInputElement).checked;

            this.performExport(canvas, scale, font, { showLabels, showBorders, showRoutes, showGrid });
        };
    }

    private static close() {
        if (this.wrapper) {
            this.wrapper.remove();
            this.wrapper = null;
        }
    }

    private static performExport(originalCanvas: HTMLCanvasElement, scale: number, font: string, toggles: any) {
        const btn = document.getElementById("exportPerformBtn") as HTMLButtonElement;
        btn.innerText = "⏳ Rendering High-Res...";
        btn.disabled = true;

        setTimeout(() => {
            try {
                // 1. Create a high-res offscreen canvas
                const exportCanvas = document.createElement("canvas");
                exportCanvas.width = originalCanvas.width * scale;
                exportCanvas.height = originalCanvas.height * scale;
                const ctx = exportCanvas.getContext("2d");
                if (!ctx) throw new Error("Failed to get context");

                // 2. Clone state and modify for export
                const currentState = store.getState() as any;
                
                // Save original layer styles to restore later if modified
                const originalLayerStyles = JSON.parse(JSON.stringify(currentState.layerStyles || {}));
                
                const exportState = {
                    ...currentState,
                    zoom: (currentState.zoom || 1.0) * scale,
                    offsetX: (currentState.offsetX || 0) * scale,
                    offsetY: (currentState.offsetY || 0) * scale,
                    showLabels: toggles.showLabels,
                    showBorders: toggles.showBorders,
                    showRoutes: toggles.showRoutes,
                    showGrid: toggles.showGrid,
                    // Inject temporary font override into layerStyles
                    layerStyles: {
                        ...originalLayerStyles,
                        labels: {
                            ...(originalLayerStyles.labels || {}),
                            fontOverride: font
                        }
                    }
                };

                // 3. Render
                renderMap(exportCanvas, exportState, "heightmap");

                // 4. Download
                const url = exportCanvas.toDataURL("image/png");
                const a = document.createElement("a");
                a.href = url;
                a.download = `fantasy-map-${scale}x.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

            } catch (err) {
                console.error("Export failed", err);
                alert("Failed to export image.");
            } finally {
                this.close();
            }
        }, 50); // Small timeout to allow UI update
    }
}
