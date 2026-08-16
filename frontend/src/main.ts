import {
	deserializeMapState,
	serializeMapState,
} from "../../core/serialization";
import { renderMap } from "../../renderer/canvas-renderer";
import { drawMinimap } from "../../renderer/minimap-renderer";
import { ThreeRenderer } from "../../renderer/three-renderer";
import { generateBiomes } from "../../simulation/biomes/biomes-generator";
import { generateBurgs } from "../../simulation/civilization/burg-generator";
import { generateCultures } from "../../simulation/civilization/culture-generator";
import { generateDiplomacy } from "../../simulation/civilization/diplomacy-generator";
import { generateGoods } from "../../simulation/civilization/goods-generator";
import { generateMarkers } from "../../simulation/civilization/markers-generator";
import { generateMarkets } from "../../simulation/civilization/markets-generator";
import { generateMilitary } from "../../simulation/civilization/military-generator";
import { runProductionCycles } from "../../simulation/civilization/production-generator";
import { generateProvinces } from "../../simulation/civilization/province-generator";
import { generateReligions } from "../../simulation/civilization/religions-generator";
import { generateRoutes } from "../../simulation/civilization/route-generator";
import { generateStates } from "../../simulation/civilization/state-generator";
import { generateZones } from "../../simulation/civilization/zones-generator";
import { generateClimate } from "../../simulation/climate/climate-generator";
import { generateJitteredGrid } from "../../simulation/grid/grid-generator";
import { bakeErosion } from "../../simulation/heightmap/erosion-bake";
import { HeightmapGenerator } from "../../simulation/heightmap/heightmap-generator";
import { generateHydrology } from "../../simulation/hydrology/hydrology-generator";
import { SimulationLoop } from "../../simulation/time/simulation-loop";
import { store } from "../../state/store";
import { mountBiomesEditor } from "../../ui/biomes-editor";
import { mountBurgEditor } from "../../ui/burg-editor";
import { mountBurgTypeEditor } from "../../ui/burg-type-editor";
import { mountCalendarEditor } from "../../ui/calendar-editor";
import {
	mountConfigurator,
	type SetupConfig,
} from "../../ui/configurator-dialogs";
import { mountStyleAndBiomeEditor } from "../../ui/dialogs-sections";
import { mountDiplomacyEditor } from "../../ui/diplomacy-editor";
import { mountEcologyEditor } from "../../ui/ecology-editor";
import { mountExportOptions } from "../../ui/export-options";
import { mountHeightmapEditor } from "../../ui/heightmap-editor";
import { mountLabelEditor } from "../../ui/label-editor";
import { mountLanguageEditor } from "../../ui/language-editor";
import { mountMagicEditor } from "../../ui/magic-editor";
import { mountMarkersEditor } from "../../ui/markers-editor";
import { mountMilitaryUnitEditor } from "../../ui/military-unit-editor";
import { mountRouteEditor } from "../../ui/route-editor";
import { mountStateEditor } from "../../ui/state-editor";
import { mountStyleEditor } from "../../ui/style-editor";

console.log("FMG Full-Stack Rebuild Frontend Initialized.");

const app = document.getElementById("app");
let currentLayer:
	| "heightmap"
	| "biomes"
	| "temp"
	| "prec"
	| "cultures"
	| "states"
	| "provinces"
	| "religions"
	| "goods" = "states";
let socket: WebSocket | null = null;
const currentSessionId = `session-${Math.floor(Math.random() * 100000)}`;
let is3DMode = false;
let threeRenderer: ThreeRenderer | null = null;

(window as any).triggerLayerSelect = (layer: any) => {
	currentLayer = layer;
	const btns = document.querySelectorAll(".layerBtn");
	btns.forEach((b) => {
		const button = b as HTMLButtonElement;
		if (button.getAttribute("data-layer") === layer) {
			button.style.background = "#4f46e5";
			button.style.borderColor = "#4f46e5";
			button.style.color = "white";
		} else {
			button.style.background = "transparent";
			button.style.borderColor = "rgba(255, 255, 255, 0.15)";
			button.style.color = "#94a3b8";
		}
	});
};

(window as any).store = store;

function findClosestCellIndex(
	x: number,
	y: number,
	points: [number, number][],
): number {
	let minDist = Infinity;
	let closestIdx = 0;
	for (let i = 0; i < points.length; i++) {
		const [px, py] = points[i];
		const dist = (x - px) ** 2 + (y - py) ** 2;
		if (dist < minDist) {
			minDist = dist;
			closestIdx = i;
		}
	}
	return closestIdx;
}

if (app) {
	app.innerHTML = `
    <!-- Map Viewport -->
    <canvas id="mapCanvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; z-index: 1; cursor: crosshair;"></canvas>
    <div id="threeContainer" style="position: absolute; inset: 0; display: none; z-index: 2;"></div>
    <div id="loadingOverlay" style="position: absolute; inset: 0; background: rgba(8, 8, 10, 0.85); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600; color: #94a3b8; z-index: 100; display: none;">
      Generating Map Simulation...
    </div>

    <!-- Collapsible Options & Tools Menu Overlay -->
    <div id="optionsContainer" style="position: absolute; top: 10px; left: 10px; z-index: 10; display: flex; flex-direction: column; width: 320px; max-height: 90vh; pointer-events: none; font-family: 'Outfit', 'Inter', sans-serif;">
      
      <!-- Collapsible trigger -->
      <div id="collapsible" style="pointer-events: auto;">
        <button id="optionsTrigger" class="options glow" style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: #3b82f6; color: white; font-weight: 600; cursor: pointer;">► Menu</button>
      </div>

      <!-- Menu panel -->
      <div id="options" style="display: none; flex-direction: column; background: rgba(30, 30, 38, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; pointer-events: auto; max-height: 85vh; box-shadow: 0 10px 30px rgba(0,0,0,0.5); min-width: 280px; max-width: 340px;">
        
        <!-- Tabs headers -->
        <div class="tab" style="display: flex; background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
          <button id="optionsHide" class="options" style="background: transparent; color: #ef4444; border: none; padding: 0.8rem; font-weight: bold; cursor: pointer; font-size: 1.1rem;">◄</button>
          <button id="layersTab" class="tablinks active" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #e2e8f0; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid #3b82f6;">Layers</button>
          <button id="styleTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid transparent;">Style</button>
          <button id="optionsTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid transparent;">Options</button>
          <button id="toolsTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid transparent;">Tools</button>
          <button id="aboutTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid transparent;">About</button>
        </div>

        <!-- Options Tab Content -->
        <div id="optionsContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
          <h4 style="margin: 0; color: #fbbf24; font-size: 0.95rem;">World Setup</h4>
          <div id="configuratorMount"></div>
          <div id="importerMount"></div>
          <div id="exporterMount"></div>
          
          <h4 style="margin: 0.5rem 0 0 0; color: #fbbf24; font-size: 0.95rem;">Calendar Options</h4>
          <button id="openCalendarEditorBtn" style="width: 100%; text-align: left; background: #2563eb; border: none; color: white; padding: 0.35rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 4px;">📅 Config Custom Calendar</button>
          <div id="calendarMount"></div>

          <h4 style="margin: 0.5rem 0 0 0; color: #fbbf24; font-size: 0.95rem;">Time Controls</h4>
          <div style="display: flex; gap: 0.4rem; margin-bottom: 0.5rem;">
            <button id="tickDayBtn" style="flex: 1; padding: 0.35rem; background: #eab308; color: black; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Day</button>
            <button id="tickMonthBtn" style="flex: 1; padding: 0.35rem; background: #3b82f6; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Month</button>
            <button id="tickYearBtn" style="flex: 1; padding: 0.35rem; background: #10b981; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Year</button>
          </div>

          <h4 style="margin: 0.5rem 0 0 0; color: #fbbf24; font-size: 0.95rem;">File Actions</h4>
          <div style="display: flex; gap: 0.4rem; margin-bottom: 0.5rem;">
            <button id="optsSaveBtn" style="flex: 1; padding: 0.35rem; background: #10b981; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Save JSON</button>
            <button id="optsLoadBtn" style="flex: 1; padding: 0.35rem; background: #eab308; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Load JSON</button>
          </div>
        </div>

        <!-- Layers Content -->
        <div id="layersContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
          <h4 style="margin: 0; color: #3b82f6; font-size: 0.95rem;">Layers Preset</h4>
          <select id="layersPreset" style="width: 100%; padding: 0.4rem; background: #0f0f12; border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 6px; cursor: pointer;">
            <option value="states" selected>Political Map</option>
            <option value="provinces">Provinces Map</option>
            <option value="cultures">Cultural Map</option>
            <option value="religions">Religions Map</option>
            <option value="goods">Goods Map</option>
            <option value="biomes">Biomes Map</option>
            <option value="heightmap">Heightmap</option>
            <option value="temp">Temperature Map</option>
            <option value="prec">Precipitation Map</option>
          </select>

          <!-- List of toggles with Eye icons -->
          <h4 style="margin: 0.4rem 0 0 0; color: #3b82f6; font-size: 0.9rem;">Layers (Drag to Reorder)</h4>
          <div id="layersList" style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.4rem; color: #cbd5e1; width: 100%;">
          </div>
        </div>

        <!-- Style Content -->
        <div id="styleContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
            <div id="styleEditorMount"></div>
        </div>

        <!-- Tools Tab Content -->
        <div id="toolsContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
          <h4 style="margin: 0; color: #10b981; font-size: 0.95rem;">Interactive Editors</h4>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; margin-bottom: 0.4rem;">
            <button id="btnOpenHeightmap" style="background: #eab308; color: black; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">⛰️ Heightmap</button>
            <button id="btnOpenStates" style="background: #3b82f6; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">👑 States</button>
            <button id="btnOpenDiplomacy" style="background: #a855f7; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🤝 Diplomacy</button>
            <button id="btnOpenRoutes" style="background: #f97316; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🛤️ Routes</button>
            <button id="btnOpenLabels" style="background: #10b981; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🏷️ Labels</button>
            <button id="btnOpenLanguages" style="background: #6366f1; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🗣️ Languages</button>
            <button id="btnOpenBiomes" style="background: #14b8a6; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🍃 Biomes</button>
            <button id="btnOpenMarkers" style="background: #f43f5e; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">📍 Markers</button>
            <button id="btnOpenMagic" style="background: #8b5cf6; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🔮 Magic</button>
            <button id="btnOpenEcology" style="background: #22c55e; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🦊 Ecology</button>
          </div>

          <!-- Popup Mounts (Hidden by default; popped up on button click) -->
          <div id="heightmapEditorMount"></div>
          <div id="burgEditorMount"></div>
          <div id="stateEditorMount"></div>
          <div id="diplomacyEditorMount"></div>
          <div id="biomesEditorMount"></div>
          <div id="markersEditorMount"></div>
          <div id="magicEditorMount"></div>
          <div id="ecologyEditorMount"></div>
          <div id="routeEditorMount"></div>
          <div id="labelMount"></div>
          <div id="languageMount"></div>
          <div id="burgTypeMount"></div>
          <div id="militaryUnitMount"></div>
        </div>

        <!-- About Tab Content -->
        <div id="aboutContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
          <h4 style="margin: 0; color: #a855f7; font-size: 0.95rem;">About Generator</h4>
          <p style="font-size: 0.75rem; line-height: 1.4; color: #cbd5e1; margin: 0;">
            Fantasy Map Simulator is a rebuilt, highly responsive replication of Azgaar's original Fantasy Map Generator, designed for premium performance, smooth vector drawing, and automated climate/civilization simulation loops.
          </p>
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 0.5rem; font-size: 0.7rem; color: #94a3b8;">
            Version 1.0.0 (Rebuild Edition)<br />
            100% Client-Side Simulation.
          </div>
        </div>
      </div>
    </div>
      </div>
    </div>

    <!-- Right HUD File Actions -->
    <div style="position: absolute; top: 10px; right: 10px; z-index: 10; display: flex; gap: 0.5rem; align-items: center; background: rgba(30, 30, 38, 0.85); padding: 0.5rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
      <button id="saveBtn" style="background: #10b981; border: none; color: white; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Save JSON</button>
      <button id="loadBtn" style="background: #eab308; border: none; color: white; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Load JSON</button>
      <input id="fileInput" type="file" accept=".json" style="display: none;" />
      <button id="toggle3DBtn" style="background: #3b82f6; border: none; color: white; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer;">3D View</button>
    </div>

    <!-- Bottom HUD Stats -->
     <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 10; background: rgba(30, 30, 38, 0.85); padding: 0.4rem 1.2rem; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.8rem; color: #94a3b8; display: flex; gap: 1.2rem; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); max-width: 90vw; overflow-x: auto; white-space: nowrap;">
       <span id="connectionStatus" style="color: #f87171; font-weight: 600;">Disconnected</span>
       <span id="stats">No cells loaded</span>
       <span id="calendarStatus" style="color: #fbbf24; font-weight: bold; margin-left: 10px;"></span>
     </div>
  `;

	const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement;
	const minimapCanvas = document.getElementById(
		"minimapCanvas",
	) as HTMLCanvasElement;
	const threeContainer = document.getElementById(
		"threeContainer",
	) as HTMLDivElement;
	const loadingOverlay = document.getElementById(
		"loadingOverlay",
	) as HTMLDivElement;
	const toggle3DBtn = document.getElementById(
		"toggle3DBtn",
	) as HTMLButtonElement;
	const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
	const loadBtn = document.getElementById("loadBtn") as HTMLButtonElement;
	const fileInput = document.getElementById("fileInput") as HTMLInputElement;
	const statsEl = document.getElementById("stats") as HTMLDivElement;
	const statusEl = document.getElementById(
		"connectionStatus",
	) as HTMLSpanElement;
	const layersPresetSelect = document.getElementById(
		"layersPreset",
	) as HTMLSelectElement;

	(window as any).triggerLayerSelect = (layerName: string) => {
		currentLayer = layerName as any;
		if (layersPresetSelect) layersPresetSelect.value = layerName;
		renderLayersChecklist();
		renderCurrentLayer();
	};

	// Mount Editors & Panels
	mountBurgEditor("burgEditorMount", () => renderCurrentLayer());
	mountStateEditor("stateEditorMount", () => {
		renderCurrentLayer();
		if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
	});

	mountHeightmapEditor("heightmapEditorMount", () => {
		renderCurrentLayer();
		if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
	});

	mountLabelEditor("labelMount", () => renderCurrentLayer());
	mountExportOptions("exporterMount", canvas);

	mountStyleAndBiomeEditor("styleBiomesMount", () => renderCurrentLayer());
	mountStyleEditor("styleEditorMount", () => renderCurrentLayer());

	mountLanguageEditor("languageMount");
	mountBurgTypeEditor("burgTypeMount");
	mountMilitaryUnitEditor("militaryUnitMount");
	mountRouteEditor("routeEditorMount", () => {
		renderCurrentLayer();
	});
	mountDiplomacyEditor("diplomacyEditorMount", () => {
		renderCurrentLayer();
	});
	mountBiomesEditor("biomesEditorMount", () => {
		renderCurrentLayer();
	});
	mountMarkersEditor("markersEditorMount", () => {
		renderCurrentLayer();
	});
	mountMagicEditor("magicEditorMount", () => {
		renderCurrentLayer();
	});
	mountEcologyEditor("ecologyEditorMount", () => {
		renderCurrentLayer();
	});

	// Bind Interactive Editors button group click listeners
	const btnOpenHeightmap = document.getElementById("btnOpenHeightmap");
	const btnOpenStates = document.getElementById("btnOpenStates");
	const btnOpenDiplomacy = document.getElementById("btnOpenDiplomacy");
	const btnOpenRoutes = document.getElementById("btnOpenRoutes");
	const btnOpenLabels = document.getElementById("btnOpenLabels");
	const btnOpenLanguages = document.getElementById("btnOpenLanguages");
	const btnOpenBiomes = document.getElementById("btnOpenBiomes");
	const btnOpenMarkers = document.getElementById("btnOpenMarkers");
	const btnOpenMagic = document.getElementById("btnOpenMagic");
	const btnOpenEcology = document.getElementById("btnOpenEcology");

	if (btnOpenHeightmap) {
		btnOpenHeightmap.addEventListener("click", () => {
			const win = window as any;
			if (win.triggerLayerSelect) win.triggerLayerSelect("heightmap");
			const editorPanel =
				document.getElementById("hmPaintSection")?.parentElement;
			if (editorPanel) editorPanel.style.display = "flex";
		});
	}

	if (btnOpenStates) {
		btnOpenStates.addEventListener("click", () => {
			const win = window as any;
			if (win.openStatesList) win.openStatesList();
		});
	}

	if (btnOpenDiplomacy) {
		btnOpenDiplomacy.addEventListener("click", () => {
			const win = window as any;
			if (win.openDiplomacyEditor) win.openDiplomacyEditor();
		});
	}

	if (btnOpenRoutes) {
		btnOpenRoutes.addEventListener("click", () => {
			const win = window as any;
			if (win.triggerLayerSelect) win.triggerLayerSelect("states");
			const editorPanel = document.getElementById("routeEditorPanel");
			if (editorPanel) editorPanel.style.display = "block";
		});
	}

	if (btnOpenLabels) {
		btnOpenLabels.addEventListener("click", () => {
			const win = window as any;
			if (win.triggerLayerSelect) win.triggerLayerSelect("states");
			const editorPanel = document.getElementById("labelEditorPanel");
			if (editorPanel) editorPanel.style.display = "block";
		});
	}

	if (btnOpenLanguages) {
		btnOpenLanguages.addEventListener("click", () => {
			const editorPanel = document.getElementById("languageEditorPanel");
			if (editorPanel) editorPanel.style.display = "block";
		});
	}

	if (btnOpenBiomes) {
		btnOpenBiomes.addEventListener("click", () => {
			const win = window as any;
			if (win.openBiomesEditor) win.openBiomesEditor();
		});
	}

	if (btnOpenMarkers) {
		btnOpenMarkers.addEventListener("click", () => {
			const win = window as any;
			if (win.openMarkersEditor) win.openMarkersEditor();
		});
	}

	if (btnOpenMagic) {
		btnOpenMagic.addEventListener("click", () => {
			const win = window as any;
			if (win.openMagicEditor) win.openMagicEditor();
		});
	}

	if (btnOpenEcology) {
		btnOpenEcology.addEventListener("click", () => {
			const win = window as any;
			if (win.openEcologyEditor) win.openEcologyEditor();
		});
	}

	// Mount Custom Calendar Editor
	mountCalendarEditor("calendarMount", () => {
		if ((window as any).simulationLoop) {
			// Re-get calendar state and push update to display
			const currentCal = (window as any).simulationLoop.getCalendar();
			store.updateState({ calendar: currentCal });
			updateCalendarText();
		}
	});

	// Intercept editor openings and brush actions to automatically switch active layers matching FMG workflow
	const originalOpenBurgEditor = (window as any).openBurgEditor;
	(window as any).openBurgEditor = (burg: any) => {
		currentLayer = "states";
		if (layersPresetSelect) layersPresetSelect.value = "states";
		renderLayersChecklist();
		renderCurrentLayer();
		if (originalOpenBurgEditor) originalOpenBurgEditor(burg);
	};

	const originalOpenStateEditor = (window as any).openStateEditor;
	(window as any).openStateEditor = (state: any) => {
		currentLayer = "states";
		if (layersPresetSelect) layersPresetSelect.value = "states";
		renderLayersChecklist();
		renderCurrentLayer();
		if (originalOpenStateEditor) originalOpenStateEditor(state);
	};

	const originalOpenRouteEditor = (window as any).openRouteEditor;
	(window as any).openRouteEditor = (route: any) => {
		currentLayer = "states";
		if (layersPresetSelect) layersPresetSelect.value = "states";
		renderLayersChecklist();
		renderCurrentLayer();
		if (originalOpenRouteEditor) originalOpenRouteEditor(route);
	};

	const originalOpenLabelEditor = (window as any).openLabelEditor;
	if (originalOpenLabelEditor) {
		(window as any).openLabelEditor = (label: any) => {
			currentLayer = "states";
			if (layersPresetSelect) layersPresetSelect.value = "states";
			renderLayersChecklist();
			renderCurrentLayer();
			originalOpenLabelEditor(label);
		};
	}

	const updateCalendarText = () => {
		const calendarEl = document.getElementById("calendarStatus");
		if (!calendarEl) return;
		const state = store.getState();
		const calendar = state.calendar;
		if (!calendar) {
			calendarEl.innerHTML = "Day 1";
			return;
		}

		const currentMonth = state.months[calendar.month];
		const monthName = currentMonth
			? currentMonth.name
			: `Month ${calendar.month + 1}`;

		// Moon phase displays
		const moonsStr = calendar.moonPhases
			.map(
				(m) => `🌙 ${m.moonName}: ${m.phaseName} (${m.modifier.toFixed(1)}x)`,
			)
			.join(", ");

		// Mods preview
		const activeMods = calendar.activeModifiers;
		const modsStr = activeMods
			? `<span style="color: #60a5fa; margin-left: 10px;">[Temp: ${activeMods.tempMod >= 0 ? "+" : ""}${activeMods.tempMod}°C, Growth: ${activeMods.popMod}x, Prod: ${activeMods.prodMod.toFixed(1)}x]</span>`
			: "";

		calendarEl.innerHTML = `📅 ${calendar.weekday}, ${calendar.day + 1} ${monthName} Year ${calendar.year + 1} (${calendar.seasonName}) ${moonsStr} ${modsStr}`;
	};

	// Wire Time Control Buttons
	const openCalendarBtn = document.getElementById("openCalendarEditorBtn");
	if (openCalendarBtn) {
		openCalendarBtn.addEventListener("click", () => {
			if ((window as any).openCalendarEditor) {
				(window as any).openCalendarEditor();
			}
		});
	}

	const tickDayBtn = document.getElementById("tickDayBtn");
	const tickMonthBtn = document.getElementById("tickMonthBtn");
	const tickYearBtn = document.getElementById("tickYearBtn");

	const handleTimeTick = (ticks: number) => {
		if ((window as any).simulationLoop) {
			(window as any).simulationLoop.advanceTick(ticks);

			// Pull latest reports if needed, and update production modifiers dynamically
			const currentState = store.getState();
			if (currentState.markets && currentState.calendar?.activeModifiers) {
				const prodReport = runProductionCycles(currentState.markets);
				store.updateState({ production: prodReport });
			}

			updateCalendarText();
		}
	};

	if (tickDayBtn) {
		tickDayBtn.addEventListener("click", () => handleTimeTick(24)); // 24 ticks = 1 day
	}
	if (tickMonthBtn) {
		tickMonthBtn.addEventListener("click", () => {
			const state = store.getState();
			const weekdaysLength = state.weekdays.length || 7;
			const calendar = state.calendar;
			if (calendar) {
				const currentMonthWeeks = state.months[calendar.month]?.weekCount || 4;
				const daysInMonth = currentMonthWeeks * weekdaysLength;
				handleTimeTick(daysInMonth * 24);
			}
		});
	}
	if (tickYearBtn) {
		tickYearBtn.addEventListener("click", () => {
			const state = store.getState();
			const weekdaysLength = state.weekdays.length || 7;
			const totalDays =
				state.months.reduce(
					(sum, m) => sum + m.weekCount * weekdaysLength,
					0,
				) || 360;
			handleTimeTick(totalDays * 24);
		});
	}
	if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());

	// Wire up collapsible trigger logic
	const optionsTrigger = document.getElementById(
		"optionsTrigger",
	) as HTMLButtonElement;
	const optionsHide = document.getElementById(
		"optionsHide",
	) as HTMLButtonElement;
	const optionsPanel = document.getElementById("options") as HTMLDivElement;
	const collapsibleWrap = document.getElementById(
		"collapsible",
	) as HTMLDivElement;

	if (optionsTrigger && optionsHide && optionsPanel && collapsibleWrap) {
		// Open menu
		optionsTrigger.addEventListener("click", () => {
			optionsPanel.style.display = "flex";
			collapsibleWrap.style.display = "none";
		});

		// Close menu
		optionsHide.addEventListener("click", () => {
			optionsPanel.style.display = "none";
			collapsibleWrap.style.display = "block";
		});

		// Auto‑open the menu on app start
		optionsTrigger.click();
	}

	// Wire up Tab switching
	const tabs = ["layersTab", "styleTab", "optionsTab", "toolsTab", "aboutTab"];
	const contents = [
		"layersContent",
		"styleContent",
		"optionsContent",
		"toolsContent",
		"aboutContent",
	];

	tabs.forEach((tabId, idx) => {
		const tabBtn = document.getElementById(tabId) as HTMLButtonElement;
		if (tabBtn) {
			tabBtn.addEventListener("click", () => {
				tabs.forEach((tId) => {
					const btn = document.getElementById(tId) as HTMLButtonElement;
					if (btn) {
						btn.classList.remove("active");
						btn.style.color = "#94a3b8";
						btn.style.borderBottomColor = "transparent";
					}
				});
				contents.forEach((cId) => {
					const div = document.getElementById(cId) as HTMLDivElement;
					if (div) div.style.display = "none";
				});

				tabBtn.classList.add("active");
				tabBtn.style.color = "#e2e8f0";
				tabBtn.style.borderBottomColor = "#3b82f6";
				const targetContent = document.getElementById(
					contents[idx],
				) as HTMLDivElement;
				if (targetContent) targetContent.style.display = "flex";
			});
		}
	});

	const updateCanvasSize = () => {
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		if (threeRenderer) {
			threeRenderer.resize(window.innerWidth, window.innerHeight);
		}
	};

	const connectWebSocket = () => {
		if (socket) {
			socket.close();
		}
		socket = new WebSocket(`ws://localhost:8000/ws/map/${currentSessionId}`);
		socket.onopen = () => {
			if (statusEl) {
				statusEl.innerHTML = "● Connected to Collaborative Server";
				statusEl.style.color = "#4ade80";
			}
		};
		socket.onclose = () => {
			if (statusEl) {
				statusEl.innerHTML = "Disconnected from Multiplayer";
				statusEl.style.color = "#f87171";
			}
		};
		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.op === "CELL_MUTATED") {
					const { cellId, changes } = data;
					const state = store.getState();
					if (state.heights && state.grid) {
						if (changes.height !== undefined) {
							state.heights[cellId] = Math.min(
								Math.max(Math.round(changes.height * 100), 0),
								100,
							);
						}
						renderCurrentLayer();
						if (threeRenderer && is3DMode) {
							threeRenderer.updateTerrain(store.getState());
						}
					}
				}
			} catch (err) {
				console.error("WS parse error:", err);
			}
		};
	};

	const runSimulation = (config: SetupConfig) => {
		if (!canvas || !loadingOverlay) return;
		loadingOverlay.style.display = "flex";

		// Set canvas dimensions based on config
		canvas.width = config.canvasWidth;
		canvas.height = config.canvasHeight;
		if (threeRenderer) {
			threeRenderer.resize(config.canvasWidth, config.canvasHeight);
		}

		setTimeout(() => {
			try {
				const t0 = performance.now();
				const width = config.canvasWidth;
				const height = config.canvasHeight;
				const seed = config.seed;

				const grid = generateJitteredGrid(
					width,
					height,
					config.cellsCount,
					seed,
				);
				const hg = new HeightmapGenerator(grid, width, height, seed);

				let templateStr = `
          Hill 1 80-85 60-80 40-60
          Hill 1 80-85 20-30 40-60
          Hill 6-7 15-30 25-75 15-85
          Multiply 0.6 land 0 0
          Hill 8-10 5-10 15-85 20-80
          Range 1-2 35-55 5-95 20-80
          Strait 1 vertical 0 0
          Smooth 3 0 0 0
          Mask 3 0 0 0
        `;
				if (config.heightmapType === "Volcano") {
					templateStr = `
            Hill 1 90-95 50-50 20-30
            Hill 4 10-20 20-80 20-80
            Multiply 0.8
            Smooth 5
          `;
				} else if (
					config.heightmapType === "High Island" ||
					config.heightmapType === "Low Island"
				) {
					templateStr = `
            Hill 2 70-80 40-60 30-50
            Smooth 4
          `;
				} else if (
					config.heightmapType === "Archipelago" ||
					config.heightmapType === "Atoll"
				) {
					templateStr = `
            Hill 10 5-15 10-90 10-90
            Multiply 0.5
            Smooth 3
          `;
				}

				const rawHeights = hg.executeTemplate(templateStr);

				const win = window as any;
				const options = win.options || {
					temperatureEquator: config.tempEquator,
					temperatureNorthPole: -30,
					temperatureSouthPole: -15,
					winds: [config.windsAngle, 45, 225, 315, 135, 315],
					prec: config.precipitationInput,
				};

				const climateOpts = {
					temperatureEquator: options.temperatureEquator,
					temperatureNorthPole: options.temperatureNorthPole,
					temperatureSouthPole: options.temperatureSouthPole,
					winds: options.winds,
					precInput: options.prec,
				};
				const { temp, prec } = generateClimate(
					grid,
					rawHeights,
					width,
					height,
					climateOpts,
				);
				const hydro = generateHydrology(grid, rawHeights, prec);
				const heights = bakeErosion(
					grid,
					hydro.heights,
					hydro.flowDirections,
					3,
				);
				const biomes = generateBiomes(grid, heights, temp, prec, hydro.rivers);
				const { cultures, cellCultures } = generateCultures(
					grid,
					heights,
					biomes,
					config.culturesCount,
					seed,
					hydro.flux,
					hydro.rivers,
				);
				const burgs = generateBurgs(
					grid,
					heights,
					biomes,
					hydro.rivers,
					hydro.flux,
					config.townsCount,
					cellCultures,
					cultures,
				);
				const { states, cellStates } = generateStates(
					grid,
					heights,
					cellCultures,
					burgs,
					config.statesCount,
					biomes,
					hydro.rivers,
					hydro.flux,
					undefined,
					cultures,
				);
				const routes = generateRoutes(grid, heights, burgs);
				const { provinces, cellProvinces } = generateProvinces(
					grid,
					heights,
					cellStates,
					burgs,
					states,
				);
				const military = generateMilitary(
					grid,
					heights,
					cellStates,
					states,
					burgs,
				);
				const { religions, cellReligions } = generateReligions(
					grid,
					heights,
					cellCultures,
					config.religionsCount,
					seed,
				);
				const zones = generateZones(grid, heights, seed);
				const markers = generateMarkers(grid, heights, biomes, seed);
				const relations = generateDiplomacy(states, seed);

				const cellGoods = generateGoods(grid, heights, biomes);
				const markets = generateMarkets(grid, burgs, cellGoods);
				const production = runProductionCycles(markets);

				const t1 = performance.now();

				store.updateState({
					width,
					height,
					seed,
					grid,
					heights,
					temp,
					prec,
					flowDirections: hydro.flowDirections,
					flux: hydro.flux,
					rivers: hydro.rivers,
					biomes,
					cellCultures,
					cellStates,
					cellProvinces,
					cellReligions,
					cellGoods,
					burgs,
					routes,
					provinces,
					military,
					religions,
					zones,
					markers,
					markets,
					production,
					states,
					relations,
					cultures,
					labels: [],
				} as any);

				if (statsEl) {
					statsEl.innerHTML = `Generated ${grid.points.length} cells in <strong style="color: #fbbf24;">${(t1 - t0).toFixed(1)}ms</strong>`;
				}

				connectWebSocket();

				// Initialize simulation loop with custom options
				(window as any).simulationLoop = new SimulationLoop(climateOpts);

				// Push initial calendar state to store
				const initialCalendar = (window as any).simulationLoop.getCalendar();
				store.updateState({ calendar: initialCalendar });
				updateCalendarText();

				renderCurrentLayer();
				if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());

				if ((window as any).refreshBiomesList) {
					(window as any).refreshBiomesList();
				}

				if (threeRenderer) {
					threeRenderer.updateTerrain(store.getState());
				}
			} catch (err: any) {
				console.error("Simulation error:", err);
			} finally {
				loadingOverlay.style.display = "none";
			}
		}, 50);
	};

	mountConfigurator("configuratorMount", (config) => runSimulation(config));

	(window as any).runSimulationGlobal = () => {
		const getConfig = (window as any).getCurrentSetupConfig;
		if (getConfig) {
			runSimulation(getConfig());
		}
	};

	(window as any).runClimateRegen = (
		tempEquator: number,
		windsAngle: number,
		precInput: number,
	) => {
		const state = store.getState() as any;
		if (!state.grid || !state.heights) return;

		const climateOpts = {
			temperatureEquator: tempEquator,
			temperatureNorthPole: -30,
			temperatureSouthPole: -15,
			winds: [windsAngle, 45, 225, 315, 135, 315],
			precInput: precInput,
		};

		const { temp, prec } = generateClimate(
			state.grid,
			state.heights,
			state.width,
			state.height,
			climateOpts,
		);
		const biomes = generateBiomes(
			state.grid,
			state.heights,
			temp,
			prec,
			state.rivers || new Uint8Array(state.heights.length),
		);

		store.updateState({
			temp,
			prec,
			biomes,
		});

		renderCurrentLayer();
		if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
	};

	const renderCurrentLayer = () => {
		if (!canvas || is3DMode) return;
		renderMap(canvas, store.getState(), currentLayer);
	};

	const ensureToolsTabVisible = () => {
		const optionsPanel = document.getElementById("options") as HTMLDivElement;
		const collapsibleWrap = document.getElementById(
			"collapsible",
		) as HTMLDivElement;
		if (optionsPanel && collapsibleWrap) {
			optionsPanel.style.display = "flex";
			collapsibleWrap.style.display = "none";
		}
		const toolsTabBtn = document.getElementById(
			"toolsTab",
		) as HTMLButtonElement;
		if (toolsTabBtn) {
			toolsTabBtn.click();
		}
	};

	let isPanning = false;
	let isPainting = false;
	let startX = 0;
	let startY = 0;

	const paintCellAt = (mapX: number, mapY: number) => {
		const state = store.getState() as any;
		if (!state.grid || !state.heights) return;

		const cellId = findClosestCellIndex(mapX, mapY, state.grid.points);

		// 1. Check if biome paint tool is active
		const biomePaintId = (window as any).getCurrentBiomePaintValue
			? (window as any).getCurrentBiomePaintValue()
			: -1;
		if (biomePaintId !== -1) {
			if (state.heights[cellId] < 20) {
				return; // do not paint water cells
			}
			const updatedBiomes = new Uint8Array(state.biomes);
			if (updatedBiomes[cellId] !== biomePaintId) {
				updatedBiomes[cellId] = biomePaintId;
				store.updateState({ biomes: updatedBiomes });
				renderCurrentLayer();
			}
			return;
		}

		// 2. Check if height brush is active
		const brush = (window as any).getCurrentBrushConfig
			? (window as any).getCurrentBrushConfig()
			: { mode: "none" };
		if (brush.mode !== "none") {
			const originalHeight = state.heights[cellId];
			let newHeight = originalHeight;

			if (brush.mode === "add") {
				newHeight = Math.min(originalHeight + 5, 100);
			} else if (brush.mode === "sub") {
				newHeight = Math.max(originalHeight - 5, 0);
			} else if (brush.mode === "set") {
				newHeight = brush.value;
			} else if (brush.mode === "smooth") {
				const neighbors = state.grid.cells.c[cellId] || [];
				const sum = neighbors.reduce(
					(acc: number, n: number) => acc + state.heights[n],
					originalHeight,
				);
				newHeight = Math.round(sum / (neighbors.length + 1));
			}

			if (newHeight !== originalHeight) {
				const updatedHeights = new Uint8Array(state.heights);
				updatedHeights[cellId] = newHeight;
				store.updateState({ heights: updatedHeights });
				renderCurrentLayer();
				if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
			}
			return;
		}
	};

	canvas.addEventListener("mousedown", (e) => {
		if (is3DMode) return;
		const state = store.getState() as any;
		if (!state.grid || !state.heights) return;

		const rect = canvas.getBoundingClientRect();
		const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
		const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

		// Apply transform inverse mapping to hit-test in map space
		const mapX = (clickX - state.offsetX) / state.zoom;
		const mapY = (clickY - state.offsetY) / state.zoom;

		// If brush or biome paint is active, enter paint mode
		const biomePaintId = (window as any).getCurrentBiomePaintValue
			? (window as any).getCurrentBiomePaintValue()
			: -1;
		const brush = (window as any).getCurrentBrushConfig
			? (window as any).getCurrentBrushConfig()
			: { mode: "none" };
		if (biomePaintId !== -1 || brush.mode !== "none") {
			isPainting = true;
			paintCellAt(mapX, mapY);
			return;
		}

		// Check if we click a burg
		if (state.burgs) {
			for (const b of state.burgs) {
				const dist = Math.hypot(b.x - mapX, b.y - mapY);
				if (dist < 12) {
					ensureToolsTabVisible();
					(window as any).openBurgEditor(b);
					return;
				}
			}
		}

		const cellId = findClosestCellIndex(mapX, mapY, state.grid.points);

		// Check if we click a route
		if (state.routes) {
			for (const r of state.routes) {
				if (r.path?.includes(cellId)) {
					ensureToolsTabVisible();
					(window as any).openRouteEditor(r);
					return;
				}
			}
		}

		// Check if we click a state
		const sId = state.cellStates ? state.cellStates[cellId] : 0;
		if (sId > 0 && state.states) {
			const activeState = state.states.find((s: any) => s.id === sId);
			if (activeState) {
				ensureToolsTabVisible();
				(window as any).openStateEditor(activeState);
				return;
			}
		}

		// Otherwise, start panning!
		isPanning = true;
		startX = e.clientX;
		startY = e.clientY;
	});

	canvas.addEventListener("mousemove", (e) => {
		const rect = canvas.getBoundingClientRect();
		const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
		const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;
		const state = store.getState() as any;
		const mapX = (clickX - state.offsetX) / state.zoom;
		const mapY = (clickY - state.offsetY) / state.zoom;

		if (isPainting) {
			paintCellAt(mapX, mapY);
			return;
		}

		if (isPanning) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			startX = e.clientX;
			startY = e.clientY;

			store.updateState({
				offsetX: state.offsetX + dx,
				offsetY: state.offsetY + dy,
			});
			renderCurrentLayer();
		}
	});

	window.addEventListener("mouseup", () => {
		isPanning = false;
		isPainting = false;
	});

	canvas.addEventListener("wheel", (e) => {
		if (is3DMode) return;
		e.preventDefault();

		const state = store.getState() as any;
		const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
		const nextZoom = Math.min(Math.max(state.zoom * zoomFactor, 1.0), 8.0);

		const rect = canvas.getBoundingClientRect();
		const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
		const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

		const mapX = (mouseX - state.offsetX) / state.zoom;
		const mapY = (mouseY - state.offsetY) / state.zoom;

		store.updateState({
			zoom: nextZoom,
			offsetX: mouseX - mapX * nextZoom,
			offsetY: mouseY - mapY * nextZoom,
		});
		renderCurrentLayer();
	});

	const renderLayersChecklist = () => {
		const listEl = document.getElementById("layersList");
		if (!listEl) return;

		const state = store.getState() as any;
		const order = state.layerOrder || [
			"primary",
			"grid",
			"rivers",
			"zones",
			"routes",
			"markers",
			"burgs",
			"military",
			"labels",
		];

		// Mapping layer order items to display properties
		const layerMeta: Record<
			string,
			{ name: string; isPrimary: boolean; toggleId?: string }
		> = {
			primary: {
				name: `Primary Layer (${currentLayer.toUpperCase()})`,
				isPrimary: true,
			},
			grid: { name: "Grid Cells", isPrimary: false, toggleId: "showGrid" },
			rivers: { name: "Rivers", isPrimary: false, toggleId: "showRivers" },
			zones: { name: "Special Zones", isPrimary: false, toggleId: "showZones" },
			routes: {
				name: "Routes & Roads",
				isPrimary: false,
				toggleId: "showRoutes",
			},
			markers: {
				name: "Markers & Icons",
				isPrimary: false,
				toggleId: "showMarkers",
			},
			burgs: {
				name: "Burgs & Cities",
				isPrimary: false,
				toggleId: "showBurgs",
			},
			military: {
				name: "Military Units",
				isPrimary: false,
				toggleId: "showMilitary",
			},
			labels: { name: "Text Labels", isPrimary: false, toggleId: "showLabels" },
		};

		listEl.innerHTML = order
			.map((layerId, idx) => {
				const meta = layerMeta[layerId] || { name: layerId, isPrimary: false };
				const isVisible = meta.isPrimary
					? true
					: (state[meta.toggleId!] ?? false);
				const eyeIcon = isVisible ? "👁️" : "🙈";
				const iconColor = isVisible ? "#3b82f6" : "#475569";
				const rowBackground = meta.isPrimary
					? "rgba(59, 130, 246, 0.15)"
					: "transparent";

				return `
        <div class="draggable-layer-row" draggable="true" data-index="${idx}" data-layer-id="${layerId}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.3rem 0.5rem; border-radius: 4px; background: ${rowBackground}; width: 100%; box-sizing: border-box; gap: 0.5rem; cursor: grab; border: 1px solid rgba(255,255,255,0.05); user-select: none;">
          <span style="font-weight: ${meta.isPrimary ? "bold" : "normal"}; color: ${meta.isPrimary ? "#f1f5f9" : "#cbd5e1"}; font-size: 0.8rem; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
            ⋮⋮ ${meta.name}
          </span>
          <button class="layer-toggle-btn" data-id="${layerId}" data-toggle-id="${meta.toggleId || ""}" style="background: transparent; border: none; font-size: 0.95rem; cursor: pointer; color: ${iconColor}; padding: 0 0.2rem; outline: none;">
            ${eyeIcon}
          </button>
        </div>
      `;
			})
			.join("");

		// Bind eye button visibility toggles
		const toggles = listEl.querySelectorAll(".layer-toggle-btn");
		toggles.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const id = btn.getAttribute("data-id")!;
				const toggleId = btn.getAttribute("data-toggle-id")!;

				if (id !== "primary") {
					const propName = toggleId as keyof AppState;
					const currentVal = state[propName];
					store.updateState({ [propName]: !currentVal });
				}

				renderLayersChecklist();
				renderCurrentLayer();
			});
		});

		// Bind HTML5 drag-and-drop events
		let dragSrcIndex: number | null = null;
		const rows = listEl.querySelectorAll(".draggable-layer-row");

		rows.forEach((row) => {
			row.addEventListener("dragstart", (e: any) => {
				dragSrcIndex = parseInt(row.getAttribute("data-index")!, 10);
				row.style.opacity = "0.4";
				e.dataTransfer.effectAllowed = "move";
			});

			row.addEventListener("dragover", (e: any) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
			});

			row.addEventListener("dragend", () => {
				row.style.opacity = "1";
			});

			row.addEventListener("drop", (e: any) => {
				e.preventDefault();
				const targetIndex = parseInt(row.getAttribute("data-index")!, 10);
				if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
					const nextOrder = [...order];
					const [dragged] = nextOrder.splice(dragSrcIndex, 1);
					nextOrder.splice(targetIndex, 0, dragged);

					store.updateState({ layerOrder: nextOrder });
					renderLayersChecklist();
					renderCurrentLayer();
				}
			});
		});
	};

	// Wire up the Layer Style controls
	const styleLayerSelect = document.getElementById(
		"styleLayerSelect",
	) as HTMLSelectElement;
	const styleControls = document.getElementById(
		"styleControls",
	) as HTMLDivElement;

	const renderStyleControls = () => {
		if (!styleLayerSelect || !styleControls) return;
		const selectedLayer = styleLayerSelect.value;
		const state = store.getState() as any;
		const styles = state.layerStyles || {};
		const style = styles[selectedLayer] || {
			opacity: 1.0,
			color: "#ffffff",
			size: 1.0,
		};

		// Determine custom controls based on selected layer type
		const showColor = ["grid", "rivers", "routes", "burgs", "markers"].includes(
			selectedLayer,
		);
		const showSize = [
			"grid",
			"rivers",
			"routes",
			"burgs",
			"military",
			"markers",
			"labels",
		].includes(selectedLayer);

		let html = `
      <div style="display: flex; flex-direction: column; gap: 0.3rem;">
        <div style="display: flex; justify-content: space-between;">
          <span>Opacity:</span>
          <span id="opacityVal" style="font-weight: bold; color: #10b981;">${Math.round(style.opacity * 100)}%</span>
        </div>
        <input type="range" id="layerOpacitySlider" min="0" max="1" step="0.05" value="${style.opacity}" style="width: 100%; cursor: pointer;" />
      </div>
    `;

		if (showColor) {
			html += `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.3rem;">
          <span>Outline Color:</span>
          <input type="color" id="layerColorPicker" value="${style.color.startsWith("rgba") ? "#ffffff" : style.color}" style="background: transparent; border: none; cursor: pointer; width: 40px; height: 25px;" />
        </div>
      `;
		}

		if (showSize) {
			const minSize = selectedLayer === "labels" ? 5 : 0.2;
			const maxSize = selectedLayer === "labels" ? 36 : 10;
			html += `
        <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.3rem;">
          <div style="display: flex; justify-content: space-between;">
            <span>Line/Size scale:</span>
            <span id="sizeVal" style="font-weight: bold; color: #10b981;">${style.size.toFixed(1)}</span>
          </div>
          <input type="range" id="layerSizeSlider" min="${minSize}" max="${maxSize}" step="0.1" value="${style.size}" style="width: 100%; cursor: pointer;" />
        </div>
      `;
		}

		styleControls.innerHTML = html;

		// Add listeners to update styles in real-time
		const opacitySlider = document.getElementById(
			"layerOpacitySlider",
		) as HTMLInputElement;
		opacitySlider.addEventListener("input", () => {
			const nextOpacity = parseFloat(opacitySlider.value);
			const opacityVal = document.getElementById("opacityVal");
			if (opacityVal)
				opacityVal.innerText = `${Math.round(nextOpacity * 100)}%`;

			const nextStyles = { ...state.layerStyles };
			nextStyles[selectedLayer] = {
				...nextStyles[selectedLayer],
				opacity: nextOpacity,
			};
			store.updateState({ layerStyles: nextStyles });
			renderCurrentLayer();
		});

		if (showColor) {
			const colorPicker = document.getElementById(
				"layerColorPicker",
			) as HTMLInputElement;
			colorPicker.addEventListener("input", () => {
				const nextStyles = { ...state.layerStyles };
				nextStyles[selectedLayer] = {
					...nextStyles[selectedLayer],
					color: colorPicker.value,
				};
				store.updateState({ layerStyles: nextStyles });
				renderCurrentLayer();
			});
		}

		if (showSize) {
			const sizeSlider = document.getElementById(
				"layerSizeSlider",
			) as HTMLInputElement;
			sizeSlider.addEventListener("input", () => {
				const nextSize = parseFloat(sizeSlider.value);
				const sizeVal = document.getElementById("sizeVal");
				if (sizeVal) sizeVal.innerText = nextSize.toFixed(1);

				const nextStyles = { ...state.layerStyles };
				nextStyles[selectedLayer] = {
					...nextStyles[selectedLayer],
					size: nextSize,
				};
				store.updateState({ layerStyles: nextStyles });
				renderCurrentLayer();
			});
		}
	};

	if (styleLayerSelect) {
		styleLayerSelect.addEventListener("change", renderStyleControls);
	}

	if (layersPresetSelect) {
		layersPresetSelect.addEventListener("change", () => {
			const selectedPreset = layersPresetSelect.value as any;
			currentLayer = selectedPreset;

			// Automatically update overlays depending on the preset chosen
			if (
				selectedPreset === "states" ||
				selectedPreset === "provinces" ||
				selectedPreset === "cultures"
			) {
				store.updateState({
					showBurgs: true,
					showRoutes: true,
					showRivers: false,
					showGrid: false,
					showMilitary: false,
				});
			} else if (
				selectedPreset === "heightmap" ||
				selectedPreset === "temp" ||
				selectedPreset === "prec"
			) {
				store.updateState({
					showRivers: true,
					showBurgs: false,
					showRoutes: false,
					showGrid: false,
					showMilitary: false,
				});
			} else if (selectedPreset === "biomes") {
				store.updateState({
					showRivers: true,
					showBurgs: false,
					showRoutes: false,
					showGrid: false,
					showMilitary: false,
				});
			} else if (selectedPreset === "goods") {
				store.updateState({
					showRoutes: true,
					showBurgs: true,
					showRivers: false,
					showGrid: false,
					showMilitary: false,
				});
			}

			renderLayersChecklist();
			renderCurrentLayer();
		});
	}

	// Wire up Options tab Save/Load button redirects
	const optsSaveBtn = document.getElementById("optsSaveBtn");
	const optsLoadBtn = document.getElementById("optsLoadBtn");
	if (optsSaveBtn) {
		optsSaveBtn.addEventListener("click", () => {
			saveBtn?.click();
		});
	}
	if (optsLoadBtn) {
		optsLoadBtn.addEventListener("click", () => {
			loadBtn?.click();
		});
	}

	// Wire up stylePreset theme selector
	const stylePresetSelect = document.getElementById(
		"stylePreset",
	) as HTMLSelectElement;
	if (stylePresetSelect) {
		stylePresetSelect.addEventListener("change", () => {
			const val = stylePresetSelect.value;
			const state = store.getState() as any;
			const nextStyles = { ...state.layerStyles };

			if (val === "monochrome") {
				currentLayer = "heightmap";
				if (layersPresetSelect) layersPresetSelect.value = "heightmap";
				nextStyles.heightmap = { ...nextStyles.heightmap, opacity: 1.0 };
				nextStyles.states = { ...nextStyles.states, opacity: 0.0 };
				nextStyles.cultures = { ...nextStyles.cultures, opacity: 0.0 };
			} else if (val === "clean") {
				currentLayer = "states";
				if (layersPresetSelect) layersPresetSelect.value = "states";
				store.updateState({
					showRoutes: false,
					showGrid: false,
					showMilitary: false,
				});
				nextStyles.states = { ...nextStyles.states, opacity: 0.9 };
			} else {
				currentLayer = "states";
				if (layersPresetSelect) layersPresetSelect.value = "states";
				store.updateState({
					showRoutes: true,
					showGrid: false,
					showBurgs: true,
					showRivers: true,
					showLabels: true,
				});
				nextStyles.states = { ...nextStyles.states, opacity: 0.85 };
				nextStyles.heightmap = { ...nextStyles.heightmap, opacity: 1.0 };
			}

			store.updateState({ layerStyles: nextStyles });
			renderLayersChecklist();
			renderStyleControls();
			renderCurrentLayer();
		});
	}

	// Trigger initial lists render
	setTimeout(() => {
		renderLayersChecklist();
		renderStyleControls();
	}, 100);

	if (toggle3DBtn && threeContainer) {
		toggle3DBtn.addEventListener("click", () => {
			is3DMode = !is3DMode;
			if (is3DMode) {
				canvas.style.display = "none";
				threeContainer.style.display = "block";
				if (!threeRenderer) {
					threeRenderer = new ThreeRenderer(threeContainer);
				}
				threeRenderer.updateTerrain(store.getState());
				threeRenderer.startAnimation();
				if (layersPresetSelect) layersPresetSelect.disabled = true;
			} else {
				canvas.style.display = "block";
				threeContainer.style.display = "none";
				if (threeRenderer) {
					threeRenderer.stopAnimation();
				}
				if (layersPresetSelect) layersPresetSelect.disabled = false;
				renderCurrentLayer();
			}
		});
	}

	if (saveBtn) {
		saveBtn.addEventListener("click", () => {
			const state = store.getState();
			const serialized = serializeMapState(state);
			const blob = new Blob([serialized], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${state.seed || "map"}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		});
	}

	if (loadBtn && fileInput) {
		loadBtn.addEventListener("click", () => {
			fileInput.click();
		});
		fileInput.addEventListener("change", (e) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const contents = event.target?.result as string;
					const reloadedState = deserializeMapState(contents);
					store.updateState(reloadedState);
					renderCurrentLayer();
					if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
					if (threeRenderer && is3DMode) {
						threeRenderer.updateTerrain(store.getState());
					}
				} catch (err) {
					alert("Error parsing loaded map file.");
					console.error(err);
				}
			};
			reader.readAsText(file);
		});
	}

	// Subscribe to store updates to automatically render the canvas layer
	store.subscribe((state) => {
		if (canvas) {
			renderMap(canvas, state, currentLayer);
		}
	});

	updateCanvasSize();
	if ((window as any).getCurrentSetupConfig) {
		runSimulation((window as any).getCurrentSetupConfig());
	}

	window.addEventListener("resize", () => {
		updateCanvasSize();
		renderCurrentLayer();
	});
}
