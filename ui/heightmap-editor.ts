import { bakeErosion } from "../simulation/heightmap/erosion-bake";
import { HeightmapGenerator } from "../simulation/heightmap/heightmap-generator";
import { generateHydrology } from "../simulation/hydrology/hydrology-generator";
import { store } from "../state/store";

export interface BrushConfig {
	mode: "none" | "add" | "sub" | "set" | "smooth";
	value: number;
}

export function mountHeightmapEditor(
	containerId: string,
	onUpdate: () => void,
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.6rem;">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; font-size: 0.95rem;">Heightmap Editor</h3>
      
      <!-- Sub-tabs navigation -->
      <div style="display: flex; gap: 0.2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; margin-bottom: 0.2rem;">
        <button id="hmPaintTab" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Paint</button>
        <button id="hmTemplateTab" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; background: transparent; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Templates</button>
        <button id="hmImportTab" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; background: transparent; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Import</button>
      </div>

      <!-- Paint section -->
      <div id="hmPaintSection" style="display: flex; flex-direction: column; gap: 0.4rem;">
        <label style="color: #94a3b8;">Brush Mode:</label>
        <select id="brushMode" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="none" selected>Brush Off</option>
          <option value="add">Add Height (+15)</option>
          <option value="sub">Lower Height (-15)</option>
          <option value="set">Set to Value</option>
          <option value="smooth">Smooth/Average</option>
        </select>
        <div id="setHeightWrap" style="display: none; margin-top: 0.2rem;">
          <label style="color: #94a3b8;">Target Height (0-100):</label>
          <input id="setHeightVal" type="number" min="0" max="100" value="50" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
      </div>

      <!-- Templates section -->
      <div id="hmTemplateSection" style="display: none; flex-direction: column; gap: 0.4rem;">
        <label style="color: #94a3b8; display: block;">Template Rules (Hill, Strait, Smooth):</label>
        <textarea id="hmTemplateText" style="width: 100%; height: 75px; font-family: monospace; background: #0f0f12; border: 1px solid #444; color: #4ade80; border-radius: 4px; padding: 0.25rem; font-size: 0.75rem; box-sizing: border-box;" placeholder="Hill 3 15-35 20-80&#10;Smooth 2"></textarea>
        <button id="hmRunTemplateBtn" style="background: #10b981; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
          Execute Template
        </button>
      </div>

      <!-- Import section -->
      <div id="hmImportSection" style="display: none; flex-direction: column; gap: 0.4rem;">
        <p style="margin: 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.3;">Upload grayscale heightmap image:</p>
        <input id="imageFileInput" type="file" accept="image/*" style="display: none;" />
        <button id="uploadImgBtn" style="background: #7c3aed; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; width: 100%;">
          Select Grayscale Image
        </button>
      </div>
    </div>
  `;

	const paintTab = document.getElementById("hmPaintTab") as HTMLButtonElement;
	const templateTab = document.getElementById(
		"hmTemplateTab",
	) as HTMLButtonElement;
	const importTab = document.getElementById("hmImportTab") as HTMLButtonElement;

	const paintSec = document.getElementById("hmPaintSection") as HTMLDivElement;
	const tempSec = document.getElementById(
		"hmTemplateSection",
	) as HTMLDivElement;
	const impSec = document.getElementById("hmImportSection") as HTMLDivElement;

	const modeSelect = document.getElementById("brushMode") as HTMLSelectElement;
	const setWrap = document.getElementById("setHeightWrap") as HTMLDivElement;
	const setVal = document.getElementById("setHeightVal") as HTMLInputElement;

	const templateText = document.getElementById(
		"hmTemplateText",
	) as HTMLTextAreaElement;
	const runTemplateBtn = document.getElementById(
		"hmRunTemplateBtn",
	) as HTMLButtonElement;

	const fileInput = document.getElementById(
		"imageFileInput",
	) as HTMLInputElement;
	const btn = document.getElementById("uploadImgBtn") as HTMLButtonElement;

	// Tab switching click listeners
	const switchTab = (
		activeTab: HTMLButtonElement,
		activeSec: HTMLDivElement,
	) => {
		[paintTab, templateTab, importTab].forEach((t) => {
			t.style.background = "transparent";
			t.style.color = "#94a3b8";
		});
		[paintSec, tempSec, impSec].forEach((s) => {
			s.style.display = "none";
		});

		activeTab.style.background = "#2563eb";
		activeTab.style.color = "white";
		activeSec.style.display = "flex";

		// Auto-switch visual layer to heightmap when using the editor
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("heightmap");
		}
	};

	paintTab.addEventListener("click", () => switchTab(paintTab, paintSec));
	templateTab.addEventListener("click", () => switchTab(templateTab, tempSec));
	importTab.addEventListener("click", () => switchTab(importTab, impSec));

	// Brush controls
	modeSelect.addEventListener("change", () => {
		if (modeSelect.value === "set") {
			setWrap.style.display = "block";
		} else {
			setWrap.style.display = "none";
		}
		const win = window as any;
		if (win.triggerLayerSelect && modeSelect.value !== "none") {
			win.triggerLayerSelect("heightmap");
		}
	});

	// Template execution
	runTemplateBtn.addEventListener("click", () => {
		const rules = templateText.value.trim();
		if (!rules) return;

		const state = store.getState() as any;
		if (!state.grid || !state.heights) return;

		const generator = new HeightmapGenerator(
			state.grid,
			state.width,
			state.height,
			state.seed || "map-seed",
		);
		// Run template calculations
		const nextHeights = generator.executeTemplate(rules);

		// Re-run hydrology simulation based on new heights
		const hydro = generateHydrology(
			state.grid,
			nextHeights,
			state.prec || new Uint8Array(state.heights.length).fill(10),
		);
		const baked = bakeErosion(
			state.grid,
			hydro.heights,
			hydro.flowDirections,
			2,
		);

		store.updateState({
			heights: baked,
			flowDirections: hydro.flowDirections,
			flux: hydro.flux,
			rivers: hydro.rivers,
		});

		onUpdate();
	});

	// Image import
	btn.addEventListener("click", () => {
		fileInput.click();
	});

	fileInput.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const img = new Image();
		img.src = URL.createObjectURL(file);
		img.onload = () => {
			const state = store.getState() as any;
			if (!state.grid || !state.heights) return;

			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = state.width;
			tempCanvas.height = state.height;
			const tempCtx = tempCanvas.getContext("2d");
			if (!tempCtx) return;

			tempCtx.drawImage(img, 0, 0, state.width, state.height);
			const imgData = tempCtx.getImageData(0, 0, state.width, state.height);

			const heights = new Uint8Array(state.heights.length);
			const points = state.grid.points;

			for (let i = 0; i < points.length; i++) {
				const [px, py] = points[i];
				const cx = Math.min(Math.max(Math.round(px), 0), state.width - 1);
				const cy = Math.min(Math.max(Math.round(py), 0), state.height - 1);

				const idx = (cy * state.width + cx) * 4;
				const r = imgData.data[idx];
				const g = imgData.data[idx + 1];
				const b = imgData.data[idx + 2];

				const val = Math.round((r + g + b) / 3);
				heights[i] = Math.round((val / 255) * 100);
			}

			store.updateState({ heights });
			onUpdate();
			URL.revokeObjectURL(img.src);
		};
	});

	// Export brush retrieval hook globally
	(window as any).getCurrentBrushConfig = (): BrushConfig => ({
		mode: modeSelect.value as any,
		value: parseInt(setVal.value, 10) || 50,
	});
}
