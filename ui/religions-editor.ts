<<<<<<< HEAD
import { store } from "../state/store";

interface Religion {
	id: number;
	name: string;
	color: string;
	center: number;
	habitat?: "land" | "ocean" | "amphibious";
	influenceFactor?: "happiness" | "wealth" | "population" | "unrest" | "magic" | "none";
	isCult?: boolean;
	effectVariable?: "wealth" | "happiness" | "populationGrowth" | "security" | "none";
}

export function mountReligionsEditor(
	containerId: string,
	onUpdate?: () => void,
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="religionsEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #f43f5e; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span id="religionEditorTitle">Religions Overview</span>
        <span id="closeReligionBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>
      
      <!-- 1. Religions List Sub-panel -->
      <div id="religionListSubPanel" style="display: block;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem;">
          <button id="createReligionBtn" style="background: #10b981; border: none; padding: 0.3rem 0.6rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.2rem;">
            <span>➕</span> Create Religion
          </button>
        </div>
        <div style="max-height: 200px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.4rem;">Color</th>
                <th style="padding: 0.4rem;">Religion</th>
                <th style="padding: 0.4rem;">Habitat</th>
                <th style="padding: 0.4rem; text-align: center;">Edit</th>
              </tr>
            </thead>
            <tbody id="religionTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>

        <!-- Paint Brush Section -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 0.8rem; padding-top: 0.8rem;">
          <button id="religionPaintToggleBtn" style="width: 100%; background: #4b5563; border: 1px solid rgba(255,255,255,0.2); padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
            <span>🎨</span> <span id="religionPaintToggleText">Religion Paintbrush Off</span>
          </button>
          
          <div id="religionBrushSettingsPanel" style="display: none; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.7rem; color: #94a3b8;">Brush Size:</span>
              <span id="religionBrushSizeVal" style="font-weight: bold; color: #10b981;">2</span>
            </div>
            <input id="religionBrushSizeSlider" type="range" min="0" max="8" value="2" style="width: 100%; accent-color: #10b981;" />
            
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.2rem;">Select Religion to Paint:</div>
            <div id="religionPaintGrid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem; max-height: 100px; overflow-y: auto;"></div>
          </div>
        </div>
      </div>

      <!-- 2. Religion Edit Sub-panel -->
      <div id="religionDetailSubPanel" style="display: none; flex-direction: column; gap: 0.6rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.75rem;">Religion Name:</label>
          <input id="editReligionName" type="text" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.75rem;">Habitat Type:</label>
          <select id="editReligionHabitat" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="land">Land Only</option>
            <option value="ocean">Oceanic / Aquatic</option>
            <option value="amphibious">Amphibious</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.75rem;">Religion Color:</label>
          <input id="editReligionColor" type="color" style="width: 100%; height: 35px; border: none; background: transparent; cursor: pointer;" />
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.75rem;">Influence Growth Multiplier:</label>
          <select id="editReligionInfluenceFactor" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="none" selected>None (Base Spread)</option>
            <option value="happiness">Happiness (High citizen happiness boosts spread)</option>
            <option value="wealth">Wealth (High state treasury boosts spread)</option>
            <option value="population">Population (High urban population boosts spread)</option>
            <option value="unrest">Unrest (High crime / instability boosts spread)</option>
            <option value="magic">Magic (High magical cell density boosts spread)</option>
          </select>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 0.5rem; background: rgba(239, 68, 68, 0.08); padding: 0.5rem; border-radius: 6px; border: 1px dashed rgba(239, 68, 68, 0.25); margin-top: 0.2rem;">
          <input id="editReligionIsCult" type="checkbox" style="cursor: pointer; width: 16px; height: 16px; margin-top: 0.15rem; accent-color: #ef4444;" />
          <label for="editReligionIsCult" style="color: #cbd5e1; font-size: 0.75rem; cursor: pointer; user-select: none; line-height: 1.3;">
            <strong style="color: #ef4444;">Cult Status (Secret Society)</strong><br/>
            <span style="color: #94a3b8; font-size: 0.65rem;">Increases crime and unrest where followed. Suppresses non-cult religions, and vice versa.</span>
          </label>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.75rem;">Divine Blessing (Follower Effect):</label>
          <select id="editReligionEffectVariable" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="none" selected>None (Standard Worship)</option>
            <option value="wealth">Wealth (+Tax revenue to state treasury)</option>
            <option value="happiness">Happiness (+Citizen contentment & morale)</option>
            <option value="populationGrowth">Population Growth (+Faster settlement expansion)</option>
            <option value="security">Security (+Guard coordination and order)</option>
          </select>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveReligionBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="deleteReligionBtn" style="flex: 1; background: #ef4444; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Delete</button>
          <button id="backToReligionListBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Back</button>
        </div>
      </div>

    </div>
  `;

	const panel = document.getElementById(
		"religionsEditorPanel",
	) as HTMLDivElement;
	const listSubPanel = document.getElementById(
		"religionListSubPanel",
	) as HTMLDivElement;
	const detailSubPanel = document.getElementById(
		"religionDetailSubPanel",
	) as HTMLDivElement;
	const titleText = document.getElementById(
		"religionEditorTitle",
	) as HTMLElement;
	const tableBody = document.getElementById(
		"religionTableBody",
	) as HTMLTableSectionElement;
	const closeBtn = document.getElementById(
		"closeReligionBtn",
	) as HTMLSpanElement;

	const editNameInput = document.getElementById(
		"editReligionName",
	) as HTMLInputElement;
	const editHabitatSelect = document.getElementById(
		"editReligionHabitat",
	) as HTMLSelectElement;
	const editColorInput = document.getElementById(
		"editReligionColor",
	) as HTMLInputElement;

	const editInfluenceFactorSelect = document.getElementById(
		"editReligionInfluenceFactor",
	) as HTMLSelectElement;
	const editIsCultCheckbox = document.getElementById(
		"editReligionIsCult",
	) as HTMLInputElement;
	const editEffectVariableSelect = document.getElementById(
		"editReligionEffectVariable",
	) as HTMLSelectElement;

	const saveBtn = document.getElementById(
		"saveReligionBtn",
	) as HTMLButtonElement;
	const backBtn = document.getElementById(
		"backToReligionListBtn",
	) as HTMLButtonElement;

	let activeReligion: Religion | null = null;

	const closePanel = () => {
		if (panel) panel.style.display = "none";
	};

	if (closeBtn) closeBtn.addEventListener("click", closePanel);

	const showList = () => {
		titleText.innerText = "Religions Overview";
		listSubPanel.style.display = "block";
		detailSubPanel.style.display = "none";
		renderReligionsList();
	};

	backBtn.addEventListener("click", showList);

	const renderReligionsList = () => {
		const stateData = store.getState() as any;
		const religions = stateData.religions || [];
		tableBody.innerHTML = "";

		religions.forEach((r: Religion) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.4rem;"><div style="width: 14px; height: 14px; background: ${r.color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;"></div></td>
        <td style="padding: 0.4rem; font-weight: bold; color: #fff;">${r.name}</td>
        <td style="padding: 0.4rem; color: #94a3b8; text-transform: capitalize;">${r.habitat || "land"}</td>
        <td style="padding: 0.4rem; text-align: center;">
          <button class="editSingleReligionBtn" data-id="${r.id}" style="background: #f43f5e; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
        </td>
      `;
			tableBody.appendChild(tr);
		});

		const editBtns = tableBody.querySelectorAll(".editSingleReligionBtn");
		editBtns.forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = parseInt(btn.getAttribute("data-id") || "0", 10);
				const targetReligion = religions.find((r: Religion) => r.id === id);
				if (targetReligion) {
					openReligionEditor(targetReligion);
				}
			});
		});

		renderReligionPaintGrid();
	};

	let isReligionBrushActive = false;
	let selectedReligionToPaint = 1; // Default to first religion
	let religionBrushSize = 2;

	const paintToggleBtn = document.getElementById(
		"religionPaintToggleBtn",
	) as HTMLButtonElement;
	const paintToggleText = document.getElementById(
		"religionPaintToggleText",
	) as HTMLSpanElement;
	const brushSettingsPanel = document.getElementById(
		"religionBrushSettingsPanel",
	) as HTMLDivElement;
	const brushSizeSlider = document.getElementById(
		"religionBrushSizeSlider",
	) as HTMLInputElement;
	const brushSizeValLabel = document.getElementById(
		"religionBrushSizeVal",
	) as HTMLSpanElement;
	const religionPaintGrid = document.getElementById(
		"religionPaintGrid",
	) as HTMLDivElement;

	const renderReligionPaintGrid = () => {
		if (!religionPaintGrid) return;
		const stateData = store.getState() as any;
		const religions = stateData.religions || [];
		religionPaintGrid.innerHTML = "";

		religions.forEach((r: Religion) => {
			const btn = document.createElement("button");
			const isSelected = selectedReligionToPaint === r.id;
			btn.style.cssText = `
				display: flex;
				align-items: center;
				gap: 0.3rem;
				padding: 0.25rem;
				background: ${isSelected ? "rgba(244, 63, 94, 0.2)" : "rgba(255,255,255,0.04)"};
				border: 1px solid ${isSelected ? "#f43f5e" : "rgba(255,255,255,0.1)"};
				color: ${isSelected ? "#ffffff" : "#94a3b8"};
				font-size: 0.7rem;
				border-radius: 4px;
				cursor: pointer;
				text-align: left;
				transition: all 0.1s;
			`;

			btn.innerHTML = `
				<span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${r.color};"></span>
				<span style="font-weight: ${isSelected ? "bold" : "normal"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${r.name}</span>
			`;

			btn.addEventListener("click", () => {
				selectedReligionToPaint = r.id;
				renderReligionPaintGrid();
			});

			religionPaintGrid.appendChild(btn);
		});
	};

	if (brushSizeSlider) {
		brushSizeSlider.addEventListener("input", () => {
			if (brushSizeValLabel)
				brushSizeValLabel.innerText = brushSizeSlider.value;
			religionBrushSize = parseInt(brushSizeSlider.value);
		});
	}

	if (paintToggleBtn) {
		paintToggleBtn.addEventListener("click", () => {
			isReligionBrushActive = !isReligionBrushActive;
			if (isReligionBrushActive) {
				paintToggleBtn.style.background = "#f43f5e"; // Rose 500
				paintToggleBtn.style.border = "1px solid white";
				if (paintToggleText) paintToggleText.innerText = "Religion Brush ON";
				if (brushSettingsPanel) brushSettingsPanel.style.display = "flex";
				renderReligionPaintGrid();

				// Auto shift to religions view layer
				const win = window as any;
				if (win.triggerLayerSelect) {
					win.triggerLayerSelect("religions");
				}

				// Turn off other manual seeding brushes to avoid conflicts
				(window as any).isSimulationManualPlacementActive = false;
				const manualPlacementBtn =
					document.getElementById("manualPlacementBtn");
				if (manualPlacementBtn) {
					manualPlacementBtn.textContent = "Manual Placement";
					manualPlacementBtn.style.background = "#f59e0b";
					manualPlacementBtn.style.border = "none";
				}
				// Turn off biome brush
				const biomeBrushBtn = document.getElementById("biomePaintToggleBtn");
				if (biomeBrushBtn) {
					const bioConf = win.getCurrentBiomeBrushConfig?.();
					if (bioConf) bioConf.active = false;
					const biomePaintText = document.getElementById(
						"biomePaintToggleText",
					);
					const biomeBrushPanel = document.getElementById(
						"biomeBrushSettingsPanel",
					);
					if (biomePaintText && biomeBrushPanel) {
						biomeBrushBtn.style.background = "#4b5563";
						biomeBrushBtn.style.border = "1px solid rgba(255,255,255,0.2)";
						biomePaintText.innerText = "Brush Off";
						biomeBrushPanel.style.display = "none";
					}
				}
			} else {
				paintToggleBtn.style.background = "#4b5563";
				paintToggleBtn.style.border = "1px solid rgba(255,255,255,0.2)";
				if (paintToggleText) paintToggleText.innerText = "Religion Brush Off";
				if (brushSettingsPanel) brushSettingsPanel.style.display = "none";
			}
		});
	}

	// Expose current config
	(window as any).getCurrentReligionBrushConfig = () => {
		return {
			active: isReligionBrushActive,
			targetReligion: selectedReligionToPaint,
			size: religionBrushSize,
		};
	};

	const openReligionEditor = (religion: Religion) => {
		activeReligion = religion;
		titleText.innerText = `Edit: ${religion.name}`;
		listSubPanel.style.display = "none";
		detailSubPanel.style.display = "flex";

		editNameInput.value = religion.name;
		editHabitatSelect.value = religion.habitat || "land";
		editColorInput.value = religion.color;

		if (editInfluenceFactorSelect) {
			editInfluenceFactorSelect.value = religion.influenceFactor || "none";
		}
		if (editIsCultCheckbox) {
			editIsCultCheckbox.checked = !!religion.isCult;
		}
		if (editEffectVariableSelect) {
			editEffectVariableSelect.value = religion.effectVariable || "none";
		}
	};

	saveBtn.addEventListener("click", () => {
		if (activeReligion) {
			activeReligion.name = editNameInput.value;
			activeReligion.color = editColorInput.value;
			activeReligion.habitat = editHabitatSelect.value as any;

			if (editInfluenceFactorSelect) {
				activeReligion.influenceFactor = editInfluenceFactorSelect.value as any;
			}
			if (editIsCultCheckbox) {
				activeReligion.isCult = editIsCultCheckbox.checked;
			}
			if (editEffectVariableSelect) {
				activeReligion.effectVariable = editEffectVariableSelect.value as any;
			}

			const stateData = store.getState() as any;
			if (stateData.religions) {
				const updated = stateData.religions.map((r: Religion) =>
					r.id === activeReligion!.id ? { ...activeReligion } : r,
				);
				store.updateState({ religions: updated });
			}

			if (onUpdate) onUpdate();
			showList();
		}
	});

	// Create Religion Handler
	const createBtn = document.getElementById(
		"createReligionBtn",
	) as HTMLButtonElement;
	if (createBtn) {
		createBtn.addEventListener("click", () => {
			const stateData = store.getState() as any;
			const religions = [...(stateData.religions || [])];
			const nextId = religions.reduce((max, r) => Math.max(max, r.id), 0) + 1;

			const colors = [
				"#f43f5e",
				"#ec4899",
				"#d946ef",
				"#a855f7",
				"#3b82f6",
				"#14b8a6",
				"#10b981",
				"#eab308",
			];
			const randColor = colors[Math.floor(Math.random() * colors.length)];

			const newReligion: Religion = {
				id: nextId,
				name: `Religion ${nextId}`,
				color: randColor,
				center: Math.floor(Math.random() * (stateData.heights?.length || 1000)),
				habitat: "land",
			};

			religions.push(newReligion);
			store.updateState({ religions });
			renderReligionsList();
			if (onUpdate) onUpdate();

			// Immediately edit the newly created religion
			openReligionEditor(newReligion);
		});
	}

	// Delete Religion Handler
	const deleteBtn = document.getElementById(
		"deleteReligionBtn",
	) as HTMLButtonElement;
	if (deleteBtn) {
		deleteBtn.addEventListener("click", () => {
			if (activeReligion) {
				const stateData = store.getState() as any;
				const religions = (stateData.religions || []).filter(
					(r: Religion) => r.id !== activeReligion!.id,
				);
				store.updateState({ religions });
				activeReligion = null;
				if (onUpdate) onUpdate();
				showList();
			}
		});
	}

	// Register window hook for easy integration
	(window as any).openReligionEditor = (religion?: Religion) => {
		if (panel) {
			panel.style.display = "block";
			if (religion) {
				openReligionEditor(religion);
			} else {
				showList();
			}
		}
	};

	// Perform initial load
	renderReligionsList();
=======
export function mountReligionsEditor() {
	console.log("Mounted " + ed);
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
}
