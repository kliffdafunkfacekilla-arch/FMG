import { store } from "../state/store";

export function initBiomeConfig() {
	const win = window as any;
	if (win.customBiomeConfig) return win.customBiomeConfig;

	const biomeNames = [
		"Marine",
		"Hot desert",
		"Cold desert",
		"Savanna",
		"Grassland",
		"Tropical seasonal forest",
		"Temperate deciduous forest",
		"Tropical rainforest",
		"Temperate rainforest",
		"Taiga",
		"Tundra",
		"Glacier",
		"Wetland",
		"Shallow Reef",
		"Kelp Forest",
		"Pelagic Zone",
		"Abyssal Plain",
		"Oceanic Trench",
		"Chaos Land",
		"Chaos Water",
	];

	const defaultColors = [
		"#0077be", "#e6c280", "#b3d1ff", "#c2d68f", "#9bbb59",
		"#4f81bd", "#8064a2", "#31859c", "#4bacc6", "#2c5234",
		"#7f7f7f", "#ffffff", "#76b5c5", "#15b8a6", "#22c55e",
		"#1d4ed8", "#172554", "#030712", "#ec4899", "#8b5cf6"
	];

	const defaultTemps = [
		15, 38, -5, 26, 18, 22, 12, 28, 14, 2, -8, -15, 16, 20, 14, 15, 4, 2, 25, 25
	];

	const defaultMoistures = [
		90, 10, 5, 35, 45, 60, 55, 85, 75, 40, 15, 2, 80, 95, 90, 85, 50, 45, 50, 50
	];

	const defaultPreyRates = [
		80, 40, 30, 110, 130, 120, 100, 140, 110, 80, 50, 10, 120, 95, 110, 85, 40, 20, 100, 100
	];

	const defaultPredRates = [
		90, 50, 30, 120, 110, 100, 100, 130, 110, 90, 60, 5, 100, 90, 100, 80, 35, 15, 100, 100
	];

	const defaultPlants = [
		10, 5, 2, 40, 75, 80, 70, 95, 85, 50, 20, 1, 90, 45, 80, 30, 5, 1, 50, 50
	];

	const defaultResources = [
		35, 45, 55, 50, 60, 70, 65, 80, 75, 60, 40, 15, 60, 75, 70, 50, 30, 10, 50, 50
	];

	const defaultHarvests = [
		20, 10, 5, 30, 45, 50, 40, 60, 50, 35, 15, 2, 30, 40, 45, 25, 10, 2, 40, 40
	];

	const defaultGoods = [
		"Fish", "Salt", "Iron", "Game", "Grain", "Wood", "Wood", "Spices", "Wood", "Furs",
		"Furs", "Amber", "Hemp", "Pearls", "Hemp", "Fish", "Gemstones", "Gold", "Dyes", "Dyes"
	];

	const config: any[] = [];
	for (let i = 0; i < biomeNames.length; i++) {
		config.push({
			id: i,
			name: biomeNames[i],
			color: defaultColors[i] || "#ffffff",
			temp: defaultTemps[i] ?? 15,
			moisture: defaultMoistures[i] ?? 50,
			preyRate: defaultPreyRates[i] ?? 100,
			predRate: defaultPredRates[i] ?? 100,
			magicSens: 1.0,
			plantDensity: defaultPlants[i] ?? 50,
			resourceDensity: defaultResources[i] ?? 50,
			humanHarvestFactor: defaultHarvests[i] ?? 30,
			harvestGoods: defaultGoods[i] ?? "Wood"
		});
	}

	win.customBiomeConfig = config;
	return config;
}

export function mountBiomesEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Init shared biome config first
	const configList = initBiomeConfig();

	container.innerHTML = `
    <div id="biomesEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Biomes Editor</span>
        <span id="closeBiomesBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <!-- Paint Tool Toggle -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 8px; margin-bottom: 0.6rem;">
        <span style="font-weight: bold; color: #10b981;">Biome Painter:</span>
        <button id="biomePaintToggleBtn" style="background: #4b5563; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 0.3rem; transition: all 0.2s;">
          <span>🖌️</span> <span id="biomePaintToggleText">Brush Off</span>
        </button>
      </div>

      <!-- Biome brush settings panel -->
      <div id="biomeBrushSettingsPanel" style="display: none; flex-direction: column; gap: 0.6rem; background: rgba(0, 0, 0, 0.25); padding: 0.6rem; border-radius: 8px; margin-bottom: 0.8rem; border: 1px solid rgba(255,255,255,0.05);">
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.2rem;">
            <span>Brush Size (Radius):</span>
            <span id="biomeBrushSizeVal">2</span>
          </div>
          <input id="biomeBrushSize" type="range" min="0" max="10" value="2" style="width: 100%; cursor: pointer;" />
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.4rem;">Select Biome to Paint:</label>
          <div id="biomePaintGrid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem; max-height: 125px; overflow-y: auto; padding-right: 0.2rem;">
            <!-- Biome buttons dynamically populated -->
          </div>
        </div>
      </div>

      <div style="max-height: 180px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
              <th style="padding: 0.4rem;">Color</th>
              <th style="padding: 0.4rem;">Biome Name</th>
              <th style="padding: 0.4rem; text-align: center;">Temp / Moist</th>
              <th style="padding: 0.4rem; text-align: center;">Edit</th>
            </tr>
          </thead>
          <tbody id="biomesTableBody" style="color: #cbd5e1;"></tbody>
        </table>
      </div>

      <div id="biomeEditForm" style="display: none; flex-direction: column; gap: 0.6rem; border-top: 1px solid #333; padding-top: 0.6rem;">
        <h4 style="margin: 0; color: #fbbf24; font-size: 0.85rem;" id="biomeEditTitle">Edit Biome Parameters</h4>
        
        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Color (Hex):</label>
            <input id="editBiomeColor" type="color" style="width: 100%; height: 30px; border: none; background: transparent; cursor: pointer;" />
          </div>
          <div style="flex: 2;">
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Target Temp (°C):</label>
            <input id="editBiomeTemp" type="number" min="-30" max="50" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
        </div>

        <div>
          <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Target Moisture (0-100%):</label>
          <input id="editBiomeMoisture" type="range" min="0" max="100" style="width: 100%; cursor: pointer;" />
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
          <button id="saveBiomeBtn" style="flex: 1; background: #10b981; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="cancelBiomeBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

	const panel = document.getElementById("biomesEditorPanel") as HTMLDivElement;
	const tableBody = document.getElementById(
		"biomesTableBody",
	) as HTMLTableSectionElement;
	const closeBtn = document.getElementById("closeBiomesBtn") as HTMLSpanElement;

	const editForm = document.getElementById("biomeEditForm") as HTMLDivElement;
	const editTitle = document.getElementById("biomeEditTitle") as HTMLElement;

	const colorInput = document.getElementById(
		"editBiomeColor",
	) as HTMLInputElement;
	const tempInput = document.getElementById(
		"editBiomeTemp",
	) as HTMLInputElement;
	const moistInput = document.getElementById(
		"editBiomeMoisture",
	) as HTMLInputElement;

	const saveBtn = document.getElementById("saveBiomeBtn") as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelBiomeBtn",
	) as HTMLButtonElement;

	let activeBiomeId: number | null = null;

	// Painting State
	let isBiomeBrushActive = false;
	let selectedBiomeToPaint = 3; // Default Savanna

	const paintToggleBtn = document.getElementById(
		"biomePaintToggleBtn",
	) as HTMLButtonElement;
	const paintToggleText = document.getElementById(
		"biomePaintToggleText",
	) as HTMLSpanElement;
	const brushSettingsPanel = document.getElementById(
		"biomeBrushSettingsPanel",
	) as HTMLDivElement;
	const brushSizeSlider = document.getElementById(
		"biomeBrushSize",
	) as HTMLInputElement;
	const brushSizeValLabel = document.getElementById(
		"biomeBrushSizeVal",
	) as HTMLSpanElement;
	const biomePaintGrid = document.getElementById(
		"biomePaintGrid",
	) as HTMLDivElement;

	// Populate biome selection grid
	const renderBiomePaintGrid = () => {
		if (!biomePaintGrid) return;
		biomePaintGrid.innerHTML = "";
		const currentList = (window as any).customBiomeConfig || configList;
		currentList.forEach((b: any, idx: number) => {
			const color = b.color || "#ffffff";
			const isSelected = idx === selectedBiomeToPaint;
			const btn = document.createElement("button");
			btn.className = `biome-pill-btn ${isSelected ? "active" : ""}`;
			btn.setAttribute("data-id", idx.toString());
			btn.setAttribute(
				"style",
				`
				padding: 0.25rem 0.4rem;
				font-size: 0.72rem;
				background: ${isSelected ? "#111827" : "#1e1e2d"};
				color: white;
				border: 1px solid ${isSelected ? "#10b981" : "rgba(255,255,255,0.1)"};
				border-radius: 4px;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				text-align: left;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			`,
			);

			btn.innerHTML = `
				<span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
				<span style="font-weight: ${isSelected ? "bold" : "normal"};">${b.name}</span>
			`;

			btn.addEventListener("click", () => {
				selectedBiomeToPaint = idx;
				renderBiomePaintGrid();
			});

			biomePaintGrid.appendChild(btn);
		});
	};

	brushSizeSlider.addEventListener("input", () => {
		brushSizeValLabel.innerText = brushSizeSlider.value;
	});

	paintToggleBtn.addEventListener("click", () => {
		isBiomeBrushActive = !isBiomeBrushActive;
		if (isBiomeBrushActive) {
			paintToggleBtn.style.background = "#10b981"; // Emerald green
			paintToggleBtn.style.border = "1px solid white";
			paintToggleText.innerText = "Brush ON";
			brushSettingsPanel.style.display = "flex";
			renderBiomePaintGrid();

			// Auto shift to biomes view layer
			const win = window as any;
			if (win.triggerLayerSelect) {
				win.triggerLayerSelect("biomes");
			}
			// Turn off other manual seeding brushes to avoid conflicts
			(window as any).isSimulationManualPlacementActive = false;
			const manualPlacementBtn = document.getElementById("manualPlacementBtn");
			if (manualPlacementBtn) {
				manualPlacementBtn.textContent = "Manual Placement";
				manualPlacementBtn.style.background = "#f59e0b";
				manualPlacementBtn.style.border = "none";
			}
			// Deactivate Heightmap Paintbrush too
			const hmBtn = document.getElementById(
				"hmPaintToggleBtn",
			) as HTMLButtonElement;
			if (hmBtn) {
				const hmText = document.getElementById(
					"hmPaintToggleText",
				) as HTMLSpanElement;
				const hmSettings = document.getElementById(
					"hmBrushSettingsPanel",
				) as HTMLDivElement;
				if (hmText && hmSettings) {
					hmBtn.style.background = "#4b5563";
					hmBtn.style.border = "1px solid rgba(255,255,255,0.2)";
					hmText.innerText = "Brush Off";
					hmSettings.style.display = "none";
					const hmWin = window as any;
					if (hmWin.getCurrentHeightmapBrushConfig) {
						const hmConf = hmWin.getCurrentHeightmapBrushConfig();
						if (hmConf) hmConf.active = false;
					}
				}
			}
		} else {
			paintToggleBtn.style.background = "#4b5563";
			paintToggleBtn.style.border = "1px solid rgba(255,255,255,0.2)";
			paintToggleText.innerText = "Brush Off";
			brushSettingsPanel.style.display = "none";
		}
	});

	const closePanel = () => {
		panel.style.display = "none";
	};
	closeBtn.addEventListener("click", closePanel);

	const renderBiomesTable = () => {
		tableBody.innerHTML = "";
		const currentList = (window as any).customBiomeConfig || configList;
		currentList.forEach((b: any, idx: number) => {
			const color = b.color || "#ffffff";
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.4rem;">
          <div style="width: 14px; height: 14px; background: ${color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;"></div>
        </td>
        <td style="padding: 0.4rem; color: #fff; font-weight: bold;">${b.name}</td>
        <td style="padding: 0.4rem; color: #94a3b8; text-align: center; font-family: monospace;">${b.temp}°C / ${b.moisture}%</td>
        <td style="padding: 0.4rem; text-align: center;">
          <button class="editSingleBiomeBtn" data-id="${idx}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
        </td>
      `;
			tableBody.appendChild(tr);
		});

		const editBtns = tableBody.querySelectorAll(".editSingleBiomeBtn");
		editBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const id = parseInt(
					(e.currentTarget as HTMLButtonElement).getAttribute("data-id") || "0",
					10,
				);
				activeBiomeId = id;
				const currentList = (window as any).customBiomeConfig || configList;
				const b = currentList[id];

				editTitle.innerText = `Edit: ${b.name}`;
				colorInput.value = b.color || "#ffffff";
				tempInput.value = String(b.temp ?? 15);
				moistInput.value = String(b.moisture ?? 50);
				editForm.style.display = "flex";
			});
		});
	};

	saveBtn.addEventListener("click", () => {
		if (activeBiomeId !== null) {
			const currentList = (window as any).customBiomeConfig || configList;
			const b = currentList[activeBiomeId];
			if (b) {
				b.color = colorInput.value;
				b.temp = parseInt(tempInput.value, 10);
				b.moisture = parseInt(moistInput.value, 10);
			}
			editForm.style.display = "none";
			renderBiomesTable();
			onUpdate();
		}
	});

	cancelBtn.addEventListener("click", () => {
		editForm.style.display = "none";
	});

	// Export biome brush config globally
	(window as any).getCurrentBiomeBrushConfig = () => {
		return {
			active: isBiomeBrushActive,
			size: parseInt(brushSizeSlider.value, 10),
			targetBiome: selectedBiomeToPaint,
		};
	};

	// For legacy safety compatibility
	(window as any).getCurrentBiomePaintValue = (): number => {
		return isBiomeBrushActive ? selectedBiomeToPaint : -1;
	};

	(window as any).openBiomesEditor = () => {
		renderBiomesTable();
		panel.style.display = "block";
		renderBiomePaintGrid();
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("biomes"); // Auto shift map view to Biomes
		}
	};
}
