import { store } from "../state/store";

export function mountBiomesEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Use the exact FMG styling for table header, table row, footer, and bottom actions
	container.innerHTML = `
    <div id="biomesEditorPanel" style="display: none; background: #2a2a35; border: 1px solid #5e4fa2; padding: 0.8rem; border-radius: 6px; font-size: 0.82rem; color: #cbd5e1; width: 100%; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: monospace;">
      <h3 style="margin-top: 0; color: white; border-bottom: 1px solid #5e4fa2; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: bold;">
        <span>Biomes Editor</span>
        <span id="closeBiomesBtn" style="cursor: pointer; color: #f87171; font-size: 1.1rem; font-weight: bold;">&times;</span>
      </h3>

      <!-- Paint Tool Selector -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); padding: 0.4rem; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
        <span style="font-weight: bold; color: #10b981;">Paint Biome:</span>
        <select id="biomePaintSelect" style="padding: 0.15rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.75rem;">
          <option value="-1">Paint Tool Off</option>
          <option value="0">Marine</option>
          <option value="1">Hot desert</option>
          <option value="2">Cold desert</option>
          <option value="3">Savanna</option>
          <option value="4">Grassland</option>
          <option value="5">Tropical seasonal forest</option>
          <option value="6">Temperate deciduous forest</option>
          <option value="7">Tropical rainforest</option>
          <option value="8">Temperate rainforest</option>
          <option value="9">Taiga</option>
          <option value="10">Tundra</option>
          <option value="11">Glacier</option>
          <option value="12">Wetland</option>
          <option value="13">Shallow Reef</option>
          <option value="14">Kelp Forest</option>
        </select>
      </div>

      <div id="biomesHeader" style="display: grid; grid-template-columns: 2rem 8rem 4rem 4rem 4rem; font-weight: bold; color: #94a3b8; border-bottom: 1px solid #444; padding-bottom: 0.2rem; font-size: 0.75rem; text-align: left;">
        <div>Clr</div>
        <div>Biome Name</div>
        <div>Hab %</div>
        <div>Cells</div>
        <div>Area</div>
      </div>

      <div id="biomesBody" class="table" style="max-height: 220px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 4px; margin-bottom: 0.5rem; margin-top: 0.2rem; display: flex; flex-direction: column;">
        <!-- Rows will be injected here -->
      </div>

      <div id="biomesFooter" class="totalLine" style="display: flex; gap: 0.8rem; font-size: 0.72rem; color: #94a3b8; border-top: 1px solid #444; padding-top: 0.3rem; margin-bottom: 0.5rem; font-style: italic;">
        <div>Biomes: <span id="biomesFooterBiomes" style="color: #cbd5e1; font-weight: bold;">15</span></div>
        <div>Cells: <span id="biomesFooterCells" style="color: #cbd5e1; font-weight: bold;">0</span></div>
        <div>Area: <span id="biomesFooterArea" style="color: #cbd5e1; font-weight: bold;">0</span></div>
      </div>

      <!-- Footer Buttons -->
      <div id="biomesBottom" style="display: flex; gap: 0.3rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem;">
        <button id="biomesEditorRefresh" class="icon-cw" style="flex: 1; padding: 0.25rem; background: #4b5563; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Refresh statistical counts"></button>
        <button id="biomesPercentage" class="icon-percent" style="flex: 1; padding: 0.25rem; background: #4b5563; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Toggle absolute/percentage numbers"></button>
        <button id="biomesAdd" class="icon-plus" style="flex: 1; padding: 0.25rem; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Add a custom biome"></button>
        <button id="biomesExport" class="icon-download" style="flex: 1; padding: 0.25rem; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Export biomes report as CSV"></button>
      </div>

      <!-- Biome Editor details form -->
      <div id="biomeEditForm" style="display: none; flex-direction: column; gap: 0.4rem; border-top: 1px solid #444; padding-top: 0.5rem; margin-top: 0.5rem;">
        <h4 style="margin: 0; color: #fbbf24; font-size: 0.8rem;" id="biomeEditTitle">Edit Biome</h4>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <input id="editBiomeColor" type="color" style="width: 2rem; height: 1.5rem; border: none; background: transparent; cursor: pointer; padding: 0;" />
          <input id="editBiomeName" type="text" style="flex: 2; padding: 0.15rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.75rem;" />
          <input id="editBiomeHab" type="number" min="0" max="100" style="width: 3rem; padding: 0.15rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.75rem;" />
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <button id="saveBiomeBtn" style="flex: 1; background: #10b981; border: none; padding: 0.2rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Save</button>
          <button id="cancelBiomeBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.2rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Cancel</button>
        </div>
      </div>
    </div>
  `;

	const panel = document.getElementById("biomesEditorPanel") as HTMLDivElement;
	const body = document.getElementById("biomesBody") as HTMLDivElement;
	const closeBtn = document.getElementById("closeBiomesBtn") as HTMLSpanElement;

	const paintSelect = document.getElementById(
		"biomePaintSelect",
	) as HTMLSelectElement;
	const editForm = document.getElementById("biomeEditForm") as HTMLDivElement;
	const editTitle = document.getElementById("biomeEditTitle") as HTMLElement;

	const colorInput = document.getElementById(
		"editBiomeColor",
	) as HTMLInputElement;
	const nameInput = document.getElementById(
		"editBiomeName",
	) as HTMLInputElement;
	const habInput = document.getElementById("editBiomeHab") as HTMLInputElement;

	const saveBtn = document.getElementById("saveBiomeBtn") as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelBiomeBtn",
	) as HTMLButtonElement;

	const refreshBtn = document.getElementById(
		"biomesEditorRefresh",
	) as HTMLButtonElement;
	const percentBtn = document.getElementById(
		"biomesPercentage",
	) as HTMLButtonElement;
	const addBtn = document.getElementById("biomesAdd") as HTMLButtonElement;
	const exportBtn = document.getElementById(
		"biomesExport",
	) as HTMLButtonElement;

	const footerBiomes = document.getElementById(
		"biomesFooterBiomes",
	) as HTMLSpanElement;
	const footerCells = document.getElementById(
		"biomesFooterCells",
	) as HTMLSpanElement;
	const footerArea = document.getElementById(
		"biomesFooterArea",
	) as HTMLSpanElement;

	let activeBiomeId: number | null = null;
	let isPercentageMode = false;

	// The 15 default biomes matching original FMG
	const biomeDefs = [
		{ id: 0, name: "Marine", color: "#466eab", habitability: 0 },
		{ id: 1, name: "Hot desert", color: "#fbe79f", habitability: 4 },
		{ id: 2, name: "Cold desert", color: "#b5b887", habitability: 10 },
		{ id: 3, name: "Savanna", color: "#d2d082", habitability: 40 },
		{ id: 4, name: "Grassland", color: "#c8d68f", habitability: 80 },
		{
			id: 5,
			name: "Tropical seasonal forest",
			color: "#b6d95d",
			habitability: 90,
		},
		{
			id: 6,
			name: "Temperate deciduous forest",
			color: "#29bc56",
			habitability: 100,
		},
		{ id: 7, name: "Tropical rainforest", color: "#7dcb35", habitability: 70 },
		{ id: 8, name: "Temperate rainforest", color: "#409c43", habitability: 80 },
		{ id: 9, name: "Taiga", color: "#4b6b32", habitability: 10 },
		{ id: 10, name: "Tundra", color: "#96784b", habitability: 2 },
		{ id: 11, name: "Glacier", color: "#d5e7eb", habitability: 0 },
		{ id: 12, name: "Wetland", color: "#0b9131", habitability: 30 },
		{ id: 13, name: "Shallow Reef", color: "#006994", habitability: 0 },
		{ id: 14, name: "Kelp Forest", color: "#004B49", habitability: 0 },
	];

	const closePanel = () => {
		panel.style.display = "none";
	};
	closeBtn.addEventListener("click", closePanel);

	const calculateStatistics = () => {
		const state = store.getState() as any;
		const cellBiomes = state.biomes || new Uint8Array();
		const heights = state.heights || new Uint8Array();
		const cellCount = heights.length;

		const stats = biomeDefs.map(() => ({ cells: 0, area: 0 }));

		for (let i = 0; i < cellCount; i++) {
			const bId = cellBiomes[i];
			if (bId < stats.length) {
				stats[bId].cells++;
				stats[bId].area += 1; // standard area weight unit
			}
		}

		return stats;
	};

	const renderBiomesTable = () => {
		body.innerHTML = "";
		const stats = calculateStatistics();
		const state = store.getState() as any;
		const totalLandCells =
			(state.heights || []).filter((h: number) => h >= 20).length || 1;

		let displayBiomesCount = 0;
		let totalCells = 0;
		let totalArea = 0;

		biomeDefs.forEach((biome) => {
			const bStat = stats[biome.id] || { cells: 0, area: 0 };
			displayBiomesCount++;
			totalCells += bStat.cells;
			totalArea += bStat.area;

			const row = document.createElement("div");
			row.style.display = "grid";
			row.style.gridTemplateColumns = "2rem 8rem 4rem 4rem 4rem";
			row.style.alignItems = "center";
			row.style.padding = "0.2rem 0";
			row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
			row.style.cursor = "pointer";

			// Percentage or absolute strings
			const cellStr = isPercentageMode
				? `${rn((bStat.cells / totalLandCells) * 100, 1)}%`
				: String(bStat.cells);
			const areaStr = isPercentageMode
				? `${rn((bStat.area / totalLandCells) * 100, 1)}%`
				: String(bStat.area);

			row.innerHTML = `
        <div style="width: 12px; height: 12px; background: ${biome.color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 2px; margin-left: 0.4rem;"></div>
        <div style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${biome.name}</div>
        <div>${biome.habitability}%</div>
        <div>${cellStr}</div>
        <div>${areaStr}</div>
      `;

			row.addEventListener("click", () => {
				activeBiomeId = biome.id;
				editTitle.innerText = `Edit: ${biome.name}`;
				colorInput.value = biome.color;
				nameInput.value = biome.name;
				habInput.value = String(biome.habitability);
				editForm.style.display = "flex";
			});

			body.appendChild(row);
		});

		footerBiomes.innerText = String(displayBiomesCount);
		footerCells.innerText = isPercentageMode ? "100%" : String(totalCells);
		footerArea.innerText = isPercentageMode ? "100%" : String(totalArea);
	};

	saveBtn.addEventListener("click", () => {
		if (activeBiomeId !== null) {
			const b = biomeDefs.find((x) => x.id === activeBiomeId);
			if (b) {
				b.color = colorInput.value;
				b.name = nameInput.value;
				b.habitability = parseInt(habInput.value, 10) || 0;
			}
			editForm.style.display = "none";
			renderBiomesTable();
			onUpdate();
		}
	});

	cancelBtn.addEventListener("click", () => {
		editForm.style.display = "none";
	});

	refreshBtn.addEventListener("click", renderBiomesTable);

	percentBtn.addEventListener("click", () => {
		isPercentageMode = !isPercentageMode;
		renderBiomesTable();
	});

	addBtn.addEventListener("click", () => {
		const nextId = biomeDefs.length;
		biomeDefs.push({
			id: nextId,
			name: "Custom Biome",
			color: "#ec4899",
			habitability: 50,
		});
		// Add to paint select options
		const opt = document.createElement("option");
		opt.value = String(nextId);
		opt.innerText = "Custom Biome";
		paintSelect.appendChild(opt);

		renderBiomesTable();
	});

	exportBtn.addEventListener("click", () => {
		const stats = calculateStatistics();
		let csv = "Id,Biome,Color,Habitability,Cells,Area\n";
		biomeDefs.forEach((b) => {
			const bStat = stats[b.id] || { cells: 0, area: 0 };
			csv += `${b.id},${b.name},${b.color},${b.habitability}%,${bStat.cells},${bStat.area}\n`;
		});
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "biomes_statistics.csv";
		link.click();
		URL.revokeObjectURL(url);
	});

	// Export paint configuration values globally
	(window as any).getCurrentBiomePaintValue = (): number => {
		return parseInt(paintSelect.value, 10);
	};

	(window as any).openBiomesEditor = () => {
		renderBiomesTable();
		panel.style.display = "block";
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("biomes"); // auto show biomes layer
		}
	};
}
