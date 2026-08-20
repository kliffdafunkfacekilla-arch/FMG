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
    <div id="heightmapEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; flex-direction: column; gap: 0.6rem; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Heightmap Editor</span>
        <span id="closeHeightmapBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>
      
      <!-- Sub-tabs navigation -->
      <div style="display: flex; gap: 0.2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; margin-bottom: 0.2rem;">
        <button id="hmPaintTab" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Paint</button>
        <button id="hmTemplateTab" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; background: transparent; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Templates</button>
        <button id="hmImportTab" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; background: transparent; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Import</button>
      </div>

      <!-- Paint section -->
      <div id="hmPaintSection" style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); padding: 0.5rem; border-radius: 8px;">
          <span style="font-weight: bold; color: #fbbf24;">Heightmap Paint:</span>
          <button id="hmPaintToggleBtn" style="background: #4b5563; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 0.3rem; transition: all 0.2s;">
            <span>🖌️</span> <span id="hmPaintToggleText">Brush Off</span>
          </button>
        </div>

        <!-- Brush settings panel (only shown if paint mode is active) -->
        <div id="hmBrushSettingsPanel" style="display: none; flex-direction: column; gap: 0.6rem; background: rgba(0, 0, 0, 0.25); padding: 0.6rem; border-radius: 8px; margin-top: 0.4rem; border: 1px solid rgba(255,255,255,0.05);">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.2rem;">
              <span>Brush Size (Radius):</span>
              <span id="hmBrushSizeVal">2</span>
            </div>
            <input id="hmBrushSize" type="range" min="0" max="10" value="2" style="width: 100%; cursor: pointer;" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.2rem;">
              <span>Brush Strength:</span>
              <span id="hmBrushStrengthVal">15</span>
            </div>
            <input id="hmBrushStrength" type="range" min="1" max="50" value="15" style="width: 100%; cursor: pointer;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.3rem;">Brush Action:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;">
              <button class="hmBrushTypeBtn active" data-type="hill_up" style="padding: 0.3rem; font-size: 0.72rem; border: 1px solid #2563eb; background: #1e3a8a; color: white; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 0.4rem;">⛰️ Hill Up</button>
              <button class="hmBrushTypeBtn" data-type="hill_down" style="padding: 0.3rem; font-size: 0.72rem; border: 1px solid #444; background: #1a1a24; color: #cbd5e1; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 0.4rem;">🕳️ Hill Down</button>
              <button class="hmBrushTypeBtn" data-type="smooth" style="padding: 0.3rem; font-size: 0.72rem; border: 1px solid #444; background: #1a1a24; color: #cbd5e1; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 0.4rem;">🌊 Smooth</button>
              <button class="hmBrushTypeBtn" data-type="noise" style="padding: 0.3rem; font-size: 0.72rem; border: 1px solid #444; background: #1a1a24; color: #cbd5e1; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 0.4rem;">🎲 Noise</button>
              <button class="hmBrushTypeBtn" data-type="sharp_up" style="padding: 0.3rem; font-size: 0.72rem; border: 1px solid #444; background: #1a1a24; color: #cbd5e1; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 0.4rem;">🧱 Sharp Up</button>
              <button class="hmBrushTypeBtn" data-type="sharp_down" style="padding: 0.3rem; font-size: 0.72rem; border: 1px solid #444; background: #1a1a24; color: #cbd5e1; border-radius: 4px; cursor: pointer; text-align: left; padding-left: 0.4rem;">🪵 Sharp Down</button>
            </div>
          </div>
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

	const closeBtn = document.getElementById("closeHeightmapBtn");
	const panel = document.getElementById("heightmapEditorPanel");
	if (closeBtn && panel) {
		closeBtn.addEventListener("click", () => {
			panel.style.display = "none";
		});
	}

	// Brush controls implementation
	let isPaintBrushActive = false;
	let activeBrushType = "hill_up"; // default brush

	const paintToggleBtn = document.getElementById("hmPaintToggleBtn") as HTMLButtonElement;
	const paintToggleText = document.getElementById("hmPaintToggleText") as HTMLSpanElement;
	const brushSettingsPanel = document.getElementById("hmBrushSettingsPanel") as HTMLDivElement;

	const brushSizeSlider = document.getElementById("hmBrushSize") as HTMLInputElement;
	const brushSizeValLabel = document.getElementById("hmBrushSizeVal") as HTMLSpanElement;

	const brushStrengthSlider = document.getElementById("hmBrushStrength") as HTMLInputElement;
	const brushStrengthValLabel = document.getElementById("hmBrushStrengthVal") as HTMLSpanElement;

	const brushTypeButtons = document.querySelectorAll(".hmBrushTypeBtn");

	// Size slider dynamic feedback
	brushSizeSlider.addEventListener("input", () => {
		brushSizeValLabel.innerText = brushSizeSlider.value;
	});

	// Strength slider dynamic feedback
	brushStrengthSlider.addEventListener("input", () => {
		brushStrengthValLabel.innerText = brushStrengthSlider.value;
	});

	// Toggle active paint mode
	paintToggleBtn.addEventListener("click", () => {
		isPaintBrushActive = !isPaintBrushActive;
		if (isPaintBrushActive) {
			paintToggleBtn.style.background = "#10b981"; // Active green
			paintToggleBtn.style.border = "1px solid white";
			paintToggleText.innerText = "Brush ON";
			brushSettingsPanel.style.display = "flex";

			// Auto shift to heightmap view layer
			const win = window as any;
			if (win.triggerLayerSelect) {
				win.triggerLayerSelect("heightmap");
			}
			// Turn off other manual seeding brushes to avoid conflicts
			(window as any).isSimulationManualPlacementActive = false;
			const manualPlacementBtn = document.getElementById("manualPlacementBtn");
			if (manualPlacementBtn) {
				manualPlacementBtn.textContent = "Manual Placement";
				manualPlacementBtn.style.background = "#f59e0b";
				manualPlacementBtn.style.border = "none";
			}
			// Deactivate Biomes Paintbrush too
			const biomesBtn = document.getElementById("biomePaintToggleBtn") as HTMLButtonElement;
			if (biomesBtn) {
				const biomesText = document.getElementById("biomePaintToggleText") as HTMLSpanElement;
				const biomesSettings = document.getElementById("biomeBrushSettingsPanel") as HTMLDivElement;
				if (biomesText && biomesSettings) {
					biomesBtn.style.background = "#4b5563";
					biomesBtn.style.border = "1px solid rgba(255,255,255,0.2)";
					biomesText.innerText = "Brush Off";
					biomesSettings.style.display = "none";
					(window as any).isBiomeBrushActive = false;
				}
			}
		} else {
			paintToggleBtn.style.background = "#4b5563"; // Deactive neutral
			paintToggleBtn.style.border = "1px solid rgba(255,255,255,0.2)";
			paintToggleText.innerText = "Brush Off";
			brushSettingsPanel.style.display = "none";
		}
	});

	// Brush action selector buttons
	brushTypeButtons.forEach((btn) => {
		btn.addEventListener("click", (e) => {
			brushTypeButtons.forEach((b) => {
				b.classList.remove("active");
				(b as HTMLButtonElement).style.background = "#1a1a24";
				(b as HTMLButtonElement).style.border = "1px solid #444";
				(b as HTMLButtonElement).style.color = "#cbd5e1";
			});

			const target = e.currentTarget as HTMLButtonElement;
			target.classList.add("active");
			target.style.background = "#1e3a8a";
			target.style.border = "1px solid #2563eb";
			target.style.color = "white";

			activeBrushType = target.getAttribute("data-type") || "hill_up";
		});
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

	// Export heightmap brush config globally
	(window as any).getCurrentHeightmapBrushConfig = () => {
		return {
			active: isPaintBrushActive,
			size: parseInt(brushSizeSlider.value, 10),
			strength: parseInt(brushStrengthSlider.value, 10),
			type: activeBrushType,
		};
	};

	// Export legacy brush retrieval hook for backwards compatibility/safety
	(window as any).getCurrentBrushConfig = () => {
		return {
			mode: isPaintBrushActive ? "paint" : "none",
			value: 50,
		};
	};
}
