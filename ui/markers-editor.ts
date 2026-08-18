import { generateMarkers } from "../simulation/civilization/markers-generator";
import { store, type MarkerType } from "../state/store";

export function mountMarkersEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="markersEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Markers & Lore Locations</span>
        <span id="closeMarkersBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <div style="display: flex; gap: 0.3rem; margin-bottom: 0.8rem; border-bottom: 1px solid #333; padding-bottom: 0.4rem;">
        <button id="tabMarkerTypes" style="flex: 1; background: #eab308; border: none; padding: 0.25rem; color: black; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Marker Types (Rules)</button>
        <button id="tabSpawnedMarkers" style="flex: 1; background: #4b5563; border: none; padding: 0.25rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Map Instances</button>
      </div>

      <!-- Tab 1: Marker Types (Rules) -->
      <div id="secMarkerTypes" style="display: block;">
        <div style="max-height: 120px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.6rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.35rem;">Name</th>
                <th style="padding: 0.35rem;">Type</th>
                <th style="padding: 0.35rem; text-align: center;">Rarity</th>
                <th style="padding: 0.35rem; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody id="markerTypesTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>

        <div style="background: #1a1a24; padding: 0.5rem; border-radius: 6px; border: 1px solid #333; display: flex; flex-direction: column; gap: 0.4rem;">
          <h4 style="margin: 0; color: #fbbf24; font-size: 0.75rem;" id="mtypeEditorTitle">Create New Marker Type</h4>
          <input type="hidden" id="mtypeId" value="" />
          
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Name:</label>
              <input id="mtypeName" type="text" placeholder="e.g. Bandit Camp" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Type:</label>
              <select id="mtypeCategory" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
                <option value="landmark">Landmark</option>
                <option value="dungeon">Dungeon</option>
                <option value="lair">Lair</option>
                <option value="holy_place">Holy Place</option>
                <option value="secret">Secret</option>
                <option value="camp">Camp</option>
                <option value="habitat">Habitat</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <div style="flex: 1;">
              <label style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8;">
                <span>Rarity (Chance %):</span>
                <span id="mtypeRarityVal" style="color: #fbbf24;">10</span>
              </label>
              <input id="mtypeRarity" type="range" min="0" max="100" value="10" style="width: 100%;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Nearby Req:</label>
              <select id="mtypeNearby" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
                <option value="none">None</option>
                <option value="water">Water</option>
                <option value="burg">Burg / Settlement</option>
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Allowed Biomes (CSV 0-17):</label>
              <input id="mtypeAllowed" type="text" placeholder="e.g. 6,8" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" title="Leave blank for all" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Forbidden Biomes (CSV 0-17):</label>
              <input id="mtypeForbidden" type="text" placeholder="e.g. 0,1,2" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Temp Range (°C):</label>
              <div style="display: flex; gap: 0.2rem;">
                <input id="mtypeMinTemp" type="number" value="-50" style="width: 50%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                <input id="mtypeMaxTemp" type="number" value="100" style="width: 50%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
              </div>
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-size: 0.7rem; color: #94a3b8;">Local Area Effect:</label>
              <input id="mtypeEffect" type="text" placeholder="e.g. danger, wealth" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #cbd5e1; margin-top: 0.2rem;">
            <input type="checkbox" id="mtypeNPCs" checked />
            Frequented by NPCs (Visible to commoners)
          </label>

          <button id="saveMTypeBtn" style="background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.78rem;">
            💾 Save Marker Type
          </button>
        </div>
      </div>

      <!-- Tab 2: Map Instances -->
      <div id="secSpawnedMarkers" style="display: none; flex-direction: column; gap: 0.5rem;">
        <div style="max-height: 200px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.6rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.35rem;">Name</th>
                <th style="padding: 0.35rem; text-align: center;">Cell</th>
                <th style="padding: 0.35rem; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody id="spawnedMarkersBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>
        <button id="regenWorldMarkersBtn" style="width: 100%; background: #eab308; border: none; padding: 0.35rem; color: black; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
          🔄 Regenerate Map Instances from Rules
        </button>
      </div>

    </div>
  `;

	const panel = document.getElementById("markersEditorPanel") as HTMLDivElement;
	const closeBtn = document.getElementById("closeMarkersBtn") as HTMLSpanElement;

	// Tabs
	const tabMarkerTypes = document.getElementById("tabMarkerTypes") as HTMLButtonElement;
	const tabSpawned = document.getElementById("tabSpawnedMarkers") as HTMLButtonElement;
	const secMarkerTypes = document.getElementById("secMarkerTypes") as HTMLDivElement;
	const secSpawned = document.getElementById("secSpawnedMarkers") as HTMLDivElement;

	// Marker Type Editor
	const mtypeId = document.getElementById("mtypeId") as HTMLInputElement;
	const mtypeName = document.getElementById("mtypeName") as HTMLInputElement;
	const mtypeCategory = document.getElementById("mtypeCategory") as HTMLSelectElement;
	const mtypeRarity = document.getElementById("mtypeRarity") as HTMLInputElement;
	const mtypeRarityVal = document.getElementById("mtypeRarityVal") as HTMLSpanElement;
	const mtypeNearby = document.getElementById("mtypeNearby") as HTMLSelectElement;
	const mtypeAllowed = document.getElementById("mtypeAllowed") as HTMLInputElement;
	const mtypeForbidden = document.getElementById("mtypeForbidden") as HTMLInputElement;
	const mtypeMinTemp = document.getElementById("mtypeMinTemp") as HTMLInputElement;
	const mtypeMaxTemp = document.getElementById("mtypeMaxTemp") as HTMLInputElement;
	const mtypeEffect = document.getElementById("mtypeEffect") as HTMLInputElement;
	const mtypeNPCs = document.getElementById("mtypeNPCs") as HTMLInputElement;
	
	const mtypesTableBody = document.getElementById("markerTypesTableBody") as HTMLTableSectionElement;
	const spawnedTableBody = document.getElementById("spawnedMarkersBody") as HTMLTableSectionElement;
	
	const saveMTypeBtn = document.getElementById("saveMTypeBtn") as HTMLButtonElement;
	const regenWorldBtn = document.getElementById("regenWorldMarkersBtn") as HTMLButtonElement;

	// Listeners
	mtypeRarity.addEventListener("input", () => {
		mtypeRarityVal.innerText = mtypeRarity.value;
	});

	const activateTab = (activeBtn: HTMLButtonElement, activeSec: HTMLDivElement) => {
		[tabMarkerTypes, tabSpawned].forEach(b => {
			b.style.background = "#4b5563";
			b.style.color = "white";
		});
		activeBtn.style.background = "#eab308";
		activeBtn.style.color = "black";

		[secMarkerTypes, secSpawned].forEach(s => s.style.display = "none");
		activeSec.style.display = "flex";
		activeSec.style.flexDirection = "column";
	};

	tabMarkerTypes.addEventListener("click", () => activateTab(tabMarkerTypes, secMarkerTypes));
	tabSpawned.addEventListener("click", () => activateTab(tabSpawned, secSpawned));

	const parseCsvInts = (csv: string) => {
		if (!csv.trim()) return [];
		return csv.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
	};

	const renderTypesTable = () => {
		mtypesTableBody.innerHTML = "";
		const state = store.getState() as any;
		const types = state.markerTypes || [];

		if (types.length === 0) {
			mtypesTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:0.6rem; color:#94a3b8;">No marker types defined</td></tr>`;
			return;
		}

		types.forEach((mt: MarkerType) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.35rem; color: #fff; font-weight: bold;">${mt.name}</td>
        <td style="padding: 0.35rem; color: #94a3b8;">${mt.type}</td>
        <td style="padding: 0.35rem; text-align: center; color: #fbbf24;">${mt.rarity}%</td>
        <td style="padding: 0.35rem; text-align: center;">
          <button class="editMTypeBtn" data-id="${mt.id}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.35rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem; margin-right: 0.2rem;">Edit</button>
          <button class="delMTypeBtn" data-id="${mt.id}" style="background: #ef4444; border: none; color: white; padding: 0.15rem 0.35rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Del</button>
        </td>
      `;
			mtypesTableBody.appendChild(tr);
		});

		mtypesTableBody.querySelectorAll(".editMTypeBtn").forEach(btn => {
			btn.addEventListener("click", (e) => {
				const id = (e.currentTarget as HTMLElement).getAttribute("data-id");
				const mt = types.find((t: MarkerType) => t.id === id);
				if (mt) {
					mtypeId.value = mt.id;
					mtypeName.value = mt.name;
					mtypeCategory.value = mt.type;
					mtypeRarity.value = String(mt.rarity);
					mtypeRarityVal.innerText = String(mt.rarity);
					mtypeNearby.value = mt.nearbyReq;
					mtypeAllowed.value = mt.allowedBiomes.join(",");
					mtypeForbidden.value = mt.forbiddenBiomes.join(",");
					mtypeMinTemp.value = String(mt.minTemp);
					mtypeMaxTemp.value = String(mt.maxTemp);
					mtypeEffect.value = mt.effect;
					mtypeNPCs.checked = mt.frequentedByNPCs;
					document.getElementById("mtypeEditorTitle")!.innerText = "Edit Marker Type";
				}
			});
		});

		mtypesTableBody.querySelectorAll(".delMTypeBtn").forEach(btn => {
			btn.addEventListener("click", (e) => {
				const id = (e.currentTarget as HTMLElement).getAttribute("data-id");
				const newTypes = types.filter((t: MarkerType) => t.id !== id);
				store.updateState({ markerTypes: newTypes });
				renderTypesTable();
				onUpdate();
			});
		});
	};

	const renderInstancesTable = () => {
		spawnedTableBody.innerHTML = "";
		const state = store.getState() as any;
		const markers = state.markers || [];

		if (markers.length === 0) {
			spawnedTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:0.6rem; color:#94a3b8;">No markers on map</td></tr>`;
			return;
		}

		markers.forEach((m: any) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.35rem; color: #fff; font-weight: bold;">${m.name}</td>
        <td style="padding: 0.35rem; text-align: center; color: #94a3b8;">${m.cell}</td>
        <td style="padding: 0.35rem; text-align: center;">
          <button class="delInstanceBtn" data-id="${m.id}" style="background: #ef4444; border: none; color: white; padding: 0.15rem 0.35rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Del</button>
        </td>
      `;
			spawnedTableBody.appendChild(tr);
		});

		spawnedTableBody.querySelectorAll(".delInstanceBtn").forEach(btn => {
			btn.addEventListener("click", (e) => {
				const id = parseInt((e.currentTarget as HTMLElement).getAttribute("data-id") || "0");
				const newMarkers = markers.filter((m: any) => m.id !== id);
				store.updateState({ markers: newMarkers });
				renderInstancesTable();
				onUpdate();
			});
		});
	};

	saveMTypeBtn.addEventListener("click", () => {
		const state = store.getState() as any;
		const types = [...(state.markerTypes || [])];
		
		const id = mtypeId.value || `mt_${Date.now()}`;
		const newType: MarkerType = {
			id,
			name: mtypeName.value.trim() || "Unknown",
			type: mtypeCategory.value as any,
			rarity: parseInt(mtypeRarity.value) || 0,
			allowedBiomes: parseCsvInts(mtypeAllowed.value),
			forbiddenBiomes: parseCsvInts(mtypeForbidden.value),
			minTemp: parseInt(mtypeMinTemp.value) || -100,
			maxTemp: parseInt(mtypeMaxTemp.value) || 100,
			effect: mtypeEffect.value.trim(),
			frequentedByNPCs: mtypeNPCs.checked,
			nearbyReq: mtypeNearby.value as any
		};

		const idx = types.findIndex(t => t.id === id);
		if (idx >= 0) {
			types[idx] = newType;
		} else {
			types.push(newType);
		}

		store.updateState({ markerTypes: types });
		
		// Reset form
		mtypeId.value = "";
		mtypeName.value = "";
		document.getElementById("mtypeEditorTitle")!.innerText = "Create New Marker Type";
		
		renderTypesTable();
		onUpdate();
	});

	regenWorldBtn.addEventListener("click", () => {
		const state = store.getState() as any;
		if (!state.grid || !state.heights || !state.biomes) return;

		const burgCells = (state.burgs || []).map((b: any) => b.cell);
		const newMarkers = generateMarkers(
			state.grid,
			state.heights,
			state.temp || new Float32Array(state.heights.length),
			state.prec || new Uint8Array(state.heights.length),
			state.biomes,
			state.seed || "regen-seed",
			state.markerTypes,
			burgCells
		);

		store.updateState({ markers: newMarkers });
		renderInstancesTable();
		onUpdate();
	});

	closeBtn.addEventListener("click", () => {
		panel.style.display = "none";
	});

	(window as any).openMarkersEditor = () => {
		activateTab(tabMarkerTypes, secMarkerTypes);
		renderTypesTable();
		renderInstancesTable();
		panel.style.display = "block";
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("markers");
		}
	};
}
