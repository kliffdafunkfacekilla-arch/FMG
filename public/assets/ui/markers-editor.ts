import { generateMarkers } from "../simulation/civilization/markers-generator";
import { store } from "../state/store";

export function mountMarkersEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Establish default spawn configurations if not already defined
	const win = window as any;
	if (!win.markerSpawnConfig) {
		win.markerSpawnConfig = {
			volcanoChance: 5,   // 5% default
			ruinsChance: 3,     // 3% default
			monumentChance: 2,  // 2% default
			springChance: 4,    // 4% default
		};
	}

	container.innerHTML = `
    <div id="markersEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Markers & Spawns Editor</span>
        <span id="closeMarkersBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <!-- Tabs or Sections: 1. Active Markers, 2. Place Custom, 3. Spawn Rates -->
      <div style="display: flex; gap: 0.3rem; margin-bottom: 0.8rem; border-bottom: 1px solid #333; padding-bottom: 0.4rem;">
        <button id="tabActiveMarkers" style="flex: 1; background: #eab308; border: none; padding: 0.25rem; color: black; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Active</button>
        <button id="tabPlaceCustom" style="flex: 1; background: #3b82f6; border: none; padding: 0.25rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Place New</button>
        <button id="tabSpawnRates" style="flex: 1; background: #4b5563; border: none; padding: 0.25rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Spawn Criteria</button>
      </div>

      <!-- Section 1: Active Markers List -->
      <div id="secActiveMarkers" style="display: block;">
        <div style="max-height: 160px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.6rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.35rem;">Icon</th>
                <th style="padding: 0.35rem;">Marker Name</th>
                <th style="padding: 0.35rem; text-align: center;">Cell</th>
                <th style="padding: 0.35rem; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody id="markersTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>
        <button id="regenAllMarkersBtn" style="width: 100%; background: #eab308; border: none; padding: 0.35rem; color: black; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
          🔄 Regenerate Markers with Spawn Weights
        </button>
      </div>

      <!-- Section 2: Place Custom Form -->
      <div id="secPlaceCustom" style="display: none; flex-direction: column; gap: 0.5rem;">
        <h4 style="margin: 0; color: #fbbf24; font-size: 0.8rem;">Create Custom Marker Location</h4>
        <div>
          <label style="display: block; font-size: 0.72rem; color: #94a3b8; margin-bottom: 0.15rem;">Marker Name:</label>
          <input id="newMarkerName" type="text" placeholder="e.g. Mt. Doom" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 0.72rem; color: #94a3b8; margin-bottom: 0.15rem;">Type:</label>
            <select id="newMarkerType" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
              <option value="volcano">🏔️ Volcano</option>
              <option value="ruins">遺跡 Ruins</option>
              <option value="monument" selected>🗿 Monument</option>
              <option value="spring">💧 Holy Spring</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 0.72rem; color: #94a3b8; margin-bottom: 0.15rem;">Cell Index:</label>
            <input id="newMarkerCell" type="number" value="1200" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
        </div>
        <button id="addMarkerBtn" style="background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.78rem; margin-top: 0.2rem;">
          ➕ Place Marker on Map
        </button>
      </div>

      <!-- Section 3: Spawn Criteria / Sliders -->
      <div id="secSpawnRates" style="display: none; flex-direction: column; gap: 0.6rem;">
        <h4 style="margin: 0; color: #fbbf24; font-size: 0.8rem;">Automated Spawn Percentages</h4>
        <div>
          <label style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #cbd5e1;">
            <span>Volcano spawn rate in mountains:</span>
            <span id="lblVolcanoRate" style="color: #fbbf24; font-weight: bold;">5%</span>
          </label>
          <input id="slideVolcanoRate" type="range" min="0" max="50" value="5" style="width: 100%; cursor: pointer;" />
        </div>
        <div>
          <label style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #cbd5e1;">
            <span>Ruins spawn rate in forests:</span>
            <span id="lblRuinsRate" style="color: #fbbf24; font-weight: bold;">3%</span>
          </label>
          <input id="slideRuinsRate" type="range" min="0" max="50" value="3" style="width: 100%; cursor: pointer;" />
        </div>
        <div>
          <label style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #cbd5e1;">
            <span>Monument spawn rate on land:</span>
            <span id="lblMonumentRate" style="color: #fbbf24; font-weight: bold;">2%</span>
          </label>
          <input id="slideMonumentRate" type="range" min="0" max="50" value="2" style="width: 100%; cursor: pointer;" />
        </div>
        <div>
          <label style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #cbd5e1;">
            <span>Spring spawn rate in wetlands:</span>
            <span id="lblSpringRate" style="color: #fbbf24; font-weight: bold;">4%</span>
          </label>
          <input id="slideSpringRate" type="range" min="0" max="50" value="4" style="width: 100%; cursor: pointer;" />
        </div>
      </div>
    </div>
  `;

	const panel = document.getElementById("markersEditorPanel") as HTMLDivElement;
	const tableBody = document.getElementById(
		"markersTableBody",
	) as HTMLTableSectionElement;
	const closeBtn = document.getElementById(
		"closeMarkersBtn",
	) as HTMLSpanElement;

	const regenBtn = document.getElementById(
		"regenAllMarkersBtn",
	) as HTMLButtonElement;

	// Tabs
	const tabActive = document.getElementById("tabActiveMarkers") as HTMLButtonElement;
	const tabPlace = document.getElementById("tabPlaceCustom") as HTMLButtonElement;
	const tabSpawn = document.getElementById("tabSpawnRates") as HTMLButtonElement;

	// Sections
	const secActive = document.getElementById("secActiveMarkers") as HTMLDivElement;
	const secPlace = document.getElementById("secPlaceCustom") as HTMLDivElement;
	const secSpawn = document.getElementById("secSpawnRates") as HTMLDivElement;

	// Place Custom elements
	const markerNameInput = document.getElementById("newMarkerName") as HTMLInputElement;
	const markerTypeSelect = document.getElementById("newMarkerType") as HTMLSelectElement;
	const markerCellInput = document.getElementById("newMarkerCell") as HTMLInputElement;
	const addMarkerBtn = document.getElementById("addMarkerBtn") as HTMLButtonElement;

	// Spawn rate sliders
	const slideVolcano = document.getElementById("slideVolcanoRate") as HTMLInputElement;
	const lblVolcano = document.getElementById("lblVolcanoRate") as HTMLSpanElement;
	const slideRuins = document.getElementById("slideRuinsRate") as HTMLInputElement;
	const lblRuins = document.getElementById("lblRuinsRate") as HTMLSpanElement;
	const slideMonument = document.getElementById("slideMonumentRate") as HTMLInputElement;
	const lblMonument = document.getElementById("lblMonumentRate") as HTMLSpanElement;
	const slideSpring = document.getElementById("slideSpringRate") as HTMLInputElement;
	const lblSpring = document.getElementById("lblSpringRate") as HTMLSpanElement;

	// Setup spawn sliders live updates
	slideVolcano.addEventListener("input", () => {
		lblVolcano.innerText = slideVolcano.value + "%";
		win.markerSpawnConfig.volcanoChance = parseInt(slideVolcano.value, 10);
	});
	slideRuins.addEventListener("input", () => {
		lblRuins.innerText = slideRuins.value + "%";
		win.markerSpawnConfig.ruinsChance = parseInt(slideRuins.value, 10);
	});
	slideMonument.addEventListener("input", () => {
		lblMonument.innerText = slideMonument.value + "%";
		win.markerSpawnConfig.monumentChance = parseInt(slideMonument.value, 10);
	});
	slideSpring.addEventListener("input", () => {
		lblSpring.innerText = slideSpring.value + "%";
		win.markerSpawnConfig.springChance = parseInt(slideSpring.value, 10);
	});

	// Sync Sliders on mount
	slideVolcano.value = String(win.markerSpawnConfig.volcanoChance);
	lblVolcano.innerText = win.markerSpawnConfig.volcanoChance + "%";
	slideRuins.value = String(win.markerSpawnConfig.ruinsChance);
	lblRuins.innerText = win.markerSpawnConfig.ruinsChance + "%";
	slideMonument.value = String(win.markerSpawnConfig.monumentChance);
	lblMonument.innerText = win.markerSpawnConfig.monumentChance + "%";
	slideSpring.value = String(win.markerSpawnConfig.springChance);
	lblSpring.innerText = win.markerSpawnConfig.springChance + "%";

	const closePanel = () => {
		panel.style.display = "none";
	};
	closeBtn.addEventListener("click", closePanel);

	// Tab activation helper
	const activateTab = (activeBtn: HTMLButtonElement, activeSec: HTMLDivElement) => {
		[tabActive, tabPlace, tabSpawn].forEach(b => {
			b.style.background = "#4b5563";
			b.style.color = "white";
		});
		activeBtn.style.background = "#eab308";
		activeBtn.style.color = "black";

		[secActive, secPlace, secSpawn].forEach(s => s.style.display = "none");
		activeSec.style.display = activeSec === secPlace ? "flex" : "block";
	};

	tabActive.addEventListener("click", () => activateTab(tabActive, secActive));
	tabPlace.addEventListener("click", () => activateTab(tabPlace, secPlace));
	tabSpawn.addEventListener("click", () => activateTab(tabSpawn, secSpawn));

	const getMarkerIcon = (type: string): string => {
		if (type === "volcano") return "🏔️";
		if (type === "ruins") return "遺跡";
		if (type === "monument") return "🗿";
		return "💧";
	};

	const renderMarkersTable = () => {
		tableBody.innerHTML = "";
		const state = store.getState() as any;
		const markers = state.markers || [];

		if (markers.length === 0) {
			tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:0.6rem; color:#94a3b8;">No active markers</td></tr>`;
			return;
		}

		markers.forEach((m: any) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.35rem; font-size: 1rem; text-align: center;">${getMarkerIcon(m.type)}</td>
        <td style="padding: 0.35rem; color: #fff; font-weight: bold;">${m.name}</td>
        <td style="padding: 0.35rem; text-align: center; color: #94a3b8;">${m.cell}</td>
        <td style="padding: 0.35rem; text-align: center;">
          <button class="delMarkerRowBtn" data-id="${m.id}" style="background: #ef4444; border: none; color: white; font-weight: bold; padding: 0.15rem 0.35rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">Delete</button>
        </td>
      `;
			tableBody.appendChild(tr);
		});

		// Attach delete listeners
		const delButtons = tableBody.querySelectorAll(".delMarkerRowBtn");
		delButtons.forEach(btn => {
			btn.addEventListener("click", (e) => {
				const id = parseInt((e.currentTarget as HTMLButtonElement).getAttribute("data-id") || "0", 10);
				const updatedMarkers = markers.filter((m: any) => m.id !== id);
				store.updateState({ markers: updatedMarkers });
				renderMarkersTable();
				onUpdate();
			});
		});
	};

	// Placing custom marker logic
	addMarkerBtn.addEventListener("click", () => {
		const state = store.getState() as any;
		if (!state.grid) return;

		const name = markerNameInput.value.trim() || `Placed Marker ${Date.now() % 1000}`;
		const type = markerTypeSelect.value as any;
		const cell = parseInt(markerCellInput.value, 10) || 0;

		// Calculate coordinates
		let x = 500, y = 500;
		if (state.grid.points && state.grid.points[cell]) {
			[x, y] = state.grid.points[cell];
		}

		const markers = [...(state.markers || [])];
		const nextId = markers.reduce((max, m) => Math.max(max, m.id), 0) + 1;

		markers.push({
			id: nextId,
			type,
			name,
			cell,
			x,
			y
		});

		store.updateState({ markers });
		markerNameInput.value = ""; // Clear
		activateTab(tabActive, secActive);
		renderMarkersTable();
		onUpdate();
	});

	regenBtn.addEventListener("click", () => {
		const state = store.getState() as any;
		if (!state.grid || !state.heights || !state.biomes) return;

		// Adjust default spawning in markers-generator dynamically by injecting spawn configuration limits
		const rawMarkers = generateMarkers(
			state.grid,
			state.heights,
			state.biomes,
			state.seed || "regen-seed",
		);

		// Apply the sliders spawn percentage modifications to the auto list
		const rollToChance = (type: string) => {
			if (type === "volcano") return win.markerSpawnConfig.volcanoChance / 100;
			if (type === "ruins") return win.markerSpawnConfig.ruinsChance / 100;
			if (type === "monument") return win.markerSpawnConfig.monumentChance / 100;
			return win.markerSpawnConfig.springChance / 100;
		};

		// Filter markers randomly based on target spawn limits
		const finalMarkers = rawMarkers.filter(m => Math.random() < (rollToChance(m.type) / 0.05));

		store.updateState({ markers: finalMarkers });
		renderMarkersTable();
		onUpdate();
	});

	(window as any).openMarkersEditor = () => {
		renderMarkersTable();
		panel.style.display = "block";
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("markers"); // Auto switch map view to Markers
		}
	};
}
