import {
	deserializeMapState,
	serializeMapState,
} from "../../core/serialization";
import { renderMap } from "../../renderer/canvas-renderer";
import { drawScalebarOverlay, drawCurvedStateLabels } from "../../renderer/scalebar-renderer";
import { drawMinimap } from "../../renderer/minimap-renderer";
import { ThreeRenderer } from "../../renderer/three-renderer";
import { generateBiomes } from "../../simulation/biomes/biomes-generator";
import { generateBurgs } from "../../simulation/civilization/burg-generator";
import { generateCultures } from "../../simulation/civilization/culture-generator";
import { generateDiplomacy } from "../../simulation/civilization/diplomacy-generator";
import { generateGoods } from "../../simulation/civilization/goods-generator";
import { generateMarkers } from "../../simulation/civilization/markers-generator";
import { generateParagons } from "../../simulation/civilization/paragons-generator";
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
import { projectZoomState } from "../../simulation/grid/zoom-projector";
import { bakeErosion } from "../../simulation/heightmap/erosion-bake";
import { HeightmapGenerator } from "../../simulation/heightmap/heightmap-generator";
import { generateHydrology } from "../../simulation/hydrology/hydrology-generator";
import { SimulationLoop } from "../../simulation/time/simulation-loop";
import { TickSystem } from "../../simulation/time/tick-system";
import { store } from "../../state/store";
import { mountBiomesEditor } from "../../ui/biomes-editor";
import { mountBurgEditor } from "../../ui/burg-editor";
import { mountCalendarEditor } from "../../ui/calendar-editor";
import {
	mountConfigurator,
	type SetupConfig,
} from "../../ui/configurator-dialogs";
import { mountStyleAndBiomeEditor } from "../../ui/dialogs-sections";
import { mountDiplomacyEditor } from "../../ui/diplomacy-editor";
import { mountEcologyEditor } from "../../ui/ecology-editor";
import { mountExportOptions } from "../../ui/export-options";
import { mountFringeEditor } from "../../ui/fringe-editor";
import { mountHeightmapEditor } from "../../ui/heightmap-editor";
import { mountLabelEditor } from "../../ui/label-editor";
import { mountLanguageEditor } from "../../ui/language-editor";
import { mountMagicEditor } from "../../ui/magic-editor";
import { mountMarkersEditor } from "../../ui/markers-editor";
import { mountMilitaryUnitEditor } from "../../ui/military-unit-editor";
import { mountReligionsEditor } from "../../ui/religions-editor";
import { mountRouteEditor } from "../../ui/route-editor";
import { mountStateEditor } from "../../ui/state-editor";
import { mountStyleEditor } from "../../ui/style-editor";
import { mountDashboard } from "../../ui/data-dashboard";
import { mountCustomResourceEditor } from "../../ui/custom-resource-editor";
import { mountSpeciesEditor } from "../../ui/species-editor";
import { mountParagonsEditor } from "../../ui/paragons-editor";
import { mountMemoryViewer, openMemoryViewer } from "../../ui/memory-viewer";

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
const currentSessionId = "session-" + Math.floor(Math.random() * 100000);
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
          <button id="optionsTab" class="tablinks active" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #e2e8f0; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid #3b82f6;">Options</button>
          <button id="layersTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid transparent;">Layers</button>
          <button id="toolsTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.1rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.8rem; border-bottom: 2px solid transparent;">Tools</button>
        </div>

        <!-- Options Tab Content -->
        <div id="optionsContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
          <h4 style="margin: 0; color: #fbbf24; font-size: 0.95rem;">World Setup</h4>
          <div id="configuratorMount"></div>
          <div id="importerMount"></div>
          <div id="calendarMount"></div>

          <h4 style="margin: 0.5rem 0 0 0; color: #fbbf24; font-size: 0.95rem;">Time Controls</h4>
          <div style="display: flex; gap: 0.4rem; margin-bottom: 0.5rem;">
            <button id="tickDayBtn" style="flex: 1; padding: 0.35rem; background: #3b82f6; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Day</button>
            <button id="tickMonthBtn" style="flex: 1; padding: 0.35rem; background: #3b82f6; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Month</button>
            <button id="tickYearBtn" style="flex: 1; padding: 0.35rem; background: #3b82f6; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Year</button>
          </div>

          <h4 style="margin: 0.5rem 0 0 0; color: #fbbf24; font-size: 0.95rem;">File &amp; Export</h4>
          <div id="exporterMount"></div>
        </div>

        <!-- Layers Content -->
        <div id="layersContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem; box-sizing: border-box;">
          <!-- List of toggles with Eye icons -->
          <h4 style="margin: 0.4rem 0 0 0; color: #3b82f6; font-size: 0.9rem;">Layers (Drag to Reorder)</h4>
          <div id="layersList" style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.4rem; color: #cbd5e1; width: 100%;">
          </div>
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
            <button id="btnOpenLanguages" style="background: #6366f1; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🗣️ Cultures</button>
            <button id="btnOpenBiomes" style="background: #14b8a6; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🍃 Biomes</button>
            <button id="btnOpenMarkers" style="background: #f43f5e; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">📍 Markers</button>
            <button id="btnOpenMagic" style="background: #8b5cf6; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🔮 Magic</button>
            <button id="btnOpenEcology" style="background: #22c55e; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🦊 Ecology</button>
            <button id="btnOpenBurgs" style="background: #ec4899; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🏰 Burgs</button>
            <button id="btnOpenMilitary" style="background: #64748b; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">⚔️ Military</button>
            <button id="btnOpenReligions" style="background: #f43f5e; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">⛪ Religions</button>
            <button id="btnOpenSpecies" style="background: #10b981; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🌿 Flora & Fauna</button>
            <button id="btnOpenFringe" style="background: #e11d48; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">🏴‍☠️ Fringe</button>
            <button id="btnOpenParagons" style="background: #f59e0b; color: white; border: none; padding: 0.35rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">✨ Paragons</button>
            <button id="btnOpenDashboard" style="grid-column: span 2; background: #9333ea; color: white; border: none; padding: 0.45rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; margin-top: 0.2rem;">📊 Analytics Dashboard</button>
          </div>

          <!-- Nested LOD & Event Logs Panel -->
          <h4 style="margin: 0.8rem 0 0 0; color: #60a5fa; font-size: 0.95rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.8rem;">Nested LOD & Events Log</h4>
          <div id="lodPanelMount" style="display: flex; flex-direction: column; gap: 0.6rem; color: #cbd5e1; font-size: 0.8rem; width: 100%;"></div>
        </div>
      </div>
    </div>

    <!-- Floating Tool Windows (escaped from the sidebar container to pop up in their own window) -->
    <div id="heightmapEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="burgEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="stateEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="diplomacyEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="biomesEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="markersEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="magicEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="ecologyEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="fringeEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="routeEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="labelMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="languageMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="militaryUnitMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="religionsEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="speciesEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="paragonsEditorMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 380px; max-height: 90vh; pointer-events: auto;"></div>
    <div id="dashboardMount" style="position: fixed; top: 10px; left: 340px; z-index: 1000; width: 580px; max-height: 90vh; pointer-events: auto;"></div>

    <!-- Floating Interactive 10-Square Grid Minimap (Live Canvas + Grid overlay) -->
    <div id="interactiveMinimap" style="position: absolute; bottom: 20px; right: 20px; z-index: 10; background: rgba(15, 15, 20, 0.88); backdrop-filter: blur(12px); padding: 0.5rem; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); font-family: 'Outfit', sans-serif; width: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 0.5rem; pointer-events: auto; user-select: none;">
      <div style="position: relative; width: 220px; height: 143px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15);">
        <canvas id="minimapCanvas" width="220" height="143" style="display: block; width: 100%; height: 100%; pointer-events: none;"></canvas>
        <div id="minimapGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(2, 1fr); gap: 0.25rem; width: 100%; height: 100%; position: absolute; inset: 0; padding: 0.25rem; box-sizing: border-box; pointer-events: auto;"></div>
      </div>
      <div style="display: flex; gap: 0.35rem; width: 100%; pointer-events: auto;">
        <button id="minimapZoomGlobal" style="flex: 1; padding: 0.35rem 0; background: rgba(255,255,255,0.06); color: #cbd5e1; font-weight: bold; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; font-size: 0.65rem; transition: all 0.15s; outline: none;">Global</button>
        <button id="minimapZoomRegion" style="flex: 1; padding: 0.35rem 0; background: rgba(255,255,255,0.06); color: #cbd5e1; font-weight: bold; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; font-size: 0.65rem; transition: all 0.15s; outline: none;">Region</button>
        <button id="minimapZoomLocal" style="flex: 1; padding: 0.35rem 0; background: rgba(255,255,255,0.06); color: #cbd5e1; font-weight: bold; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; font-size: 0.65rem; transition: all 0.15s; outline: none;">Local</button>
      </div>

      <!-- Simulation Controls Panel -->
      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.4rem; display: flex; flex-direction: column; gap: 0.35rem; width: 100%;">
        <div style="font-size: 0.65rem; font-weight: 600; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; padding: 0 0.1rem;">
          <span>⚙️ Simulation Time (Step Control)</span>
        </div>
        <div style="display: flex; gap: 0.25rem; align-items: center; width: 100%;">
          <!-- Step 1 Day -->
          <button id="simStep1Btn" style="flex: 1; padding: 0.35rem 0; background: #10b981; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.65rem; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 0.1rem; transition: all 0.15s;" title="Advance +1 Day">
            <span>📅</span> <span>+1 Day</span>
          </button>

          <!-- Step 5 Days -->
          <button id="simStep5Btn" style="flex: 1; padding: 0.35rem 0; background: #3b82f6; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.65rem; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 0.1rem; transition: all 0.15s;" title="Advance +5 Days">
            <span>📅</span> <span>+5 Days</span>
          </button>

          <!-- Step 30 Days -->
          <button id="simStep30Btn" style="flex: 1; padding: 0.35rem 0; background: #a855f7; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.65rem; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 0.1rem; transition: all 0.15s;" title="Advance +30 Days">
            <span>📅</span> <span>+30 Days</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom HUD Stats -->
     <div style="position: absolute; bottom: 20px; left: 20px; z-index: 10; background: rgba(30, 30, 38, 0.85); padding: 0.4rem 1.2rem; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.8rem; color: #94a3b8; display: flex; gap: 1.2rem; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); max-width: calc(100vw - 300px); overflow-x: auto; white-space: nowrap;">
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

	// Mount Export Options FIRST so that saveBtn, loadBtn, toggle3DBtn exist in the DOM before we query them
	mountExportOptions("exporterMount", canvas);

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

	(window as any).triggerLayerSelect = (selectedPreset: string) => {
		currentLayer = selectedPreset as any;

		// Initialize all background layers to false first
		const backgroundLayerUpdates = {
			showHeightmap: false,
			showBiomes: false,
			showTemp: false,
			showPrec: false,
			showCultures: false,
			showStates: false,
			showProvinces: false,
			showReligions: false,
			showGoods: false,
		};

		// Set the chosen preset background layer to true
		const targetKey = `show${selectedPreset.charAt(0).toUpperCase() + selectedPreset.slice(1)}`;
		(backgroundLayerUpdates as any)[targetKey] = true;

		// Also show heightmap underneath some overlays for an organic textured look
		if (
			selectedPreset === "states" ||
			selectedPreset === "cultures" ||
			selectedPreset === "provinces" ||
			selectedPreset === "religions"
		) {
			backgroundLayerUpdates.showHeightmap = true;
		}

		// Automatically update overlays depending on the preset chosen
		if (
			selectedPreset === "states" ||
			selectedPreset === "provinces" ||
			selectedPreset === "cultures"
		) {
			store.updateState({
				...backgroundLayerUpdates,
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
				...backgroundLayerUpdates,
				showRivers: true,
				showBurgs: false,
				showRoutes: false,
				showGrid: false,
				showMilitary: false,
			});
		} else if (selectedPreset === "biomes") {
			store.updateState({
				...backgroundLayerUpdates,
				showRivers: true,
				showBurgs: false,
				showRoutes: false,
				showGrid: false,
				showMilitary: false,
			});
		} else if (selectedPreset === "goods") {
			store.updateState({
				...backgroundLayerUpdates,
				showRoutes: true,
				showBurgs: true,
				showRivers: false,
				showGrid: false,
				showMilitary: false,
			});
		} else {
			store.updateState(backgroundLayerUpdates);
		}

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

	mountStyleAndBiomeEditor("styleBiomesMount", () => renderCurrentLayer());
	mountStyleEditor("styleEditorMount", () => renderCurrentLayer());

	const militaryUnitMount = document.getElementById("militaryUnitMount");
	if (militaryUnitMount) mountMilitaryUnitEditor("militaryUnitMount");

	const religionsEditorMount = document.getElementById("religionsEditorMount");
	if (religionsEditorMount) mountReligionsEditor("religionsEditorMount");

	const speciesEditorMount = document.getElementById("speciesEditorMount");
	if (speciesEditorMount) mountSpeciesEditor("speciesEditorMount");
    
    mountParagonsEditor("paragonsEditorMount", () => renderCurrentLayer());

	const labelMount = document.getElementById("labelMount");
	mountLanguageEditor("languageMount", () => renderCurrentLayer());
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
	mountFringeEditor("fringeEditorMount", () => {
		renderCurrentLayer();
	});
	mountDashboard("dashboardMount");
	mountCustomResourceEditor("app");
	
	// Create mount point for memory viewer and mount it
	const memoryMount = document.createElement("div");
	memoryMount.id = "memoryViewerMount";
	document.body.appendChild(memoryMount);
	mountMemoryViewer("memoryViewerMount");

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
	const btnOpenBurgs = document.getElementById("btnOpenBurgs");
	const btnOpenMilitary = document.getElementById("btnOpenMilitary");
	const btnOpenReligions = document.getElementById("btnOpenReligions");
	const btnOpenFringe = document.getElementById("btnOpenFringe");
	const btnOpenSpecies = document.getElementById("btnOpenSpecies");
	const btnOpenParagons = document.getElementById("btnOpenParagons");
	const btnOpenDashboard = document.getElementById("btnOpenDashboard");

	// Helper to dynamically position floating editor panels adjacent to their toolbar triggers
	const positionPanelFromButton = (btnId: string, mountId: string) => {
		const btn = document.getElementById(btnId);
		const mount = document.getElementById(mountId);
		if (btn && mount) {
			const rect = btn.getBoundingClientRect();
			// Align the top of the floating editor to the toolbar button, keeping within viewport boundaries
			const computedTop = Math.max(
				10,
				Math.min(rect.top - 5, window.innerHeight - 450),
			);
			mount.style.top = `${computedTop}px`;
			mount.style.left = `${rect.right + 15}px`;
		}
	};

	// Helper to make popups draggable and resizable, ensuring consistent behavior and cleaner layout.
	const makeElementDraggableAndResizable = (mountId: string) => {
		const mount = document.getElementById(mountId);
		if (!mount) return;

		// Styling the container to support dragging, resizing, and flex column layout
		mount.style.position = "fixed";
		mount.style.display = "none"; // start closed
		mount.style.boxSizing = "border-box";
		mount.style.minWidth = "280px";
		mount.style.minHeight = "150px";

		const initDragResize = () => {
			const panel = mount.firstElementChild as HTMLElement;
			if (!panel) {
				// Retry in a short bit if not mounted yet
				setTimeout(initDragResize, 50);
				return;
			}

			// Ensure panel has rounded corners, overflow hidden, and fills mount
			panel.style.width = "100%";
			panel.style.height = "100%";
			panel.style.boxSizing = "border-box";
			panel.style.display = "flex";
			panel.style.flexDirection = "column";

			// Find a drag handle (e.g. h3, h2, h4 or first child header)
			const header = panel.querySelector("h3, h2, h4") as HTMLElement;
			if (header) {
				header.style.cursor = "move";
				header.style.userSelect = "none";

				let isDragging = false;
				let startX = 0,
					startY = 0;
				let initialLeft = 0,
					initialTop = 0;

				const onMouseDown = (e: MouseEvent) => {
					// Don't drag if clicking close button
					if (
						((e.target as HTMLElement).id &&
							(e.target as HTMLElement).id.includes("close")) ||
						(e.target as HTMLElement).innerText === "×"
					)
						return;

					isDragging = true;
					startX = e.clientX;
					startY = e.clientY;
					const rect = mount.getBoundingClientRect();
					initialLeft = rect.left;
					initialTop = rect.top;

					// Bring window to front
					const mounts = document.querySelectorAll(
						'[id$="Mount"], [id$="Panel"]',
					);
					mounts.forEach((m) => {
						const htmlM = m as HTMLElement;
						if (htmlM.style.zIndex && parseInt(htmlM.style.zIndex) >= 1000) {
							htmlM.style.zIndex = "1000";
						}
					});
					mount.style.zIndex = "1010";

					document.addEventListener("mousemove", onMouseMove);
					document.addEventListener("mouseup", onMouseUp);
					e.preventDefault();
				};

				const onMouseMove = (e: MouseEvent) => {
					if (!isDragging) return;
					const dx = e.clientX - startX;
					const dy = e.clientY - startY;
					mount.style.left = `${initialLeft + dx}px`;
					mount.style.top = `${initialTop + dy}px`;
				};

				const onMouseUp = () => {
					isDragging = false;
					document.removeEventListener("mousemove", onMouseMove);
					document.removeEventListener("mouseup", onMouseUp);
				};

				header.addEventListener("mousedown", onMouseDown);
			}

			// Add dynamic resize handle in the bottom-right corner
			let resizeHandle = panel.querySelector(
				".fmg-resize-handle",
			) as HTMLElement;
			if (!resizeHandle) {
				resizeHandle = document.createElement("div");
				resizeHandle.className = "fmg-resize-handle";
				resizeHandle.setAttribute(
					"style",
					`
					position: absolute;
					bottom: 4px;
					right: 4px;
					width: 14px;
					height: 14px;
					cursor: se-resize;
					z-index: 10001;
					border-right: 2px solid rgba(255, 255, 255, 0.4);
					border-bottom: 2px solid rgba(255, 255, 255, 0.4);
					border-radius: 0 0 4px 0;
					background: transparent;
				`,
				);
				const line = document.createElement("div");
				line.setAttribute(
					"style",
					`
					position: absolute;
					right: 2px;
					bottom: 2px;
					width: 6px;
					height: 6px;
					border-right: 1.5px solid rgba(255, 255, 255, 0.4);
					border-bottom: 1.5px solid rgba(255, 255, 255, 0.4);
				`,
				);
				resizeHandle.appendChild(line);
				panel.appendChild(resizeHandle);
			}

			let isResizing = false;
			let startWidth = 0,
				startHeight = 0;
			let startX = 0,
				startY = 0;

			const onResizeMouseDown = (e: MouseEvent) => {
				isResizing = true;
				startX = e.clientX;
				startY = e.clientY;
				const rect = mount.getBoundingClientRect();
				startWidth = rect.width;
				startHeight = rect.height;

				document.addEventListener("mousemove", onResizeMouseMove);
				document.addEventListener("mouseup", onResizeMouseUp);
				e.preventDefault();
				e.stopPropagation();
			};

			const onResizeMouseMove = (e: MouseEvent) => {
				if (!isResizing) return;
				const newWidth = Math.max(280, startWidth + (e.clientX - startX));
				const newHeight = Math.max(150, startHeight + (e.clientY - startY));
				mount.style.width = `${newWidth}px`;
				mount.style.height = `${newHeight}px`;

				panel.style.height = "100%";
				const scrollContainer = panel.querySelector(
					"div[style*='overflow-y: auto']",
				) as HTMLElement;
				if (scrollContainer) {
					const headerHeight =
						(panel.querySelector("h3, h2, h4") as HTMLElement)?.offsetHeight ||
						40;
					const footerHeight =
						(
							panel.querySelector(
								"div[style*='display: flex; gap:']",
							) as HTMLElement
						)?.offsetHeight || 50;
					const restHeight = newHeight - headerHeight - footerHeight - 35;
					scrollContainer.style.maxHeight = `${Math.max(100, restHeight)}px`;
				}
			};

			const onResizeMouseUp = () => {
				isResizing = false;
				document.removeEventListener("mousemove", onResizeMouseMove);
				document.removeEventListener("mouseup", onResizeMouseUp);
			};

			resizeHandle.addEventListener("mousedown", onResizeMouseDown);

			// Sync the outer mount container's display with the inner panel's display.
			// Since editors only toggle their own panel display, this observer automatically
			// shows or hides the parent draggable window mount accordingly!
			const observer = new MutationObserver(() => {
				if (panel.style.display === "none") {
					mount.style.display = "none";
				} else {
					mount.style.display = "block";
				}
			});
			observer.observe(panel, { attributes: true, attributeFilter: ["style"] });
		};

		initDragResize();
	};

	const mountKeys = [
		"heightmapEditorMount",
		"burgEditorMount",
		"stateEditorMount",
		"diplomacyEditorMount",
		"biomesEditorMount",
		"markersEditorMount",
		"magicEditorMount",
		"ecologyEditorMount",
		"routeEditorMount",
		"labelMount",
		"languageMount",
		"militaryUnitMount",
		"religionsEditorMount",
		"dashboardMount",
		"paragonsEditorMount",
	];
	mountKeys.forEach(makeElementDraggableAndResizable);

	// CENTRALIZED TOOL PANEL MANAGER
	// Maps each tool to its containing mount element, actual panel DOM ID, preferred display style, and startup hooks.
	interface ToolPanelConfig {
		mountId: string;
		panelId: string;
		displayStyle: "block" | "flex";
		openFn?: string;
		layerSelect?: string;
	}

	const toolPanels: Record<string, ToolPanelConfig> = {
		heightmap: {
			mountId: "heightmapEditorMount",
			panelId: "heightmapEditorPanel",
			displayStyle: "flex",
			layerSelect: "heightmap",
		},
		states: {
			mountId: "stateEditorMount",
			panelId: "stateEditorPanel",
			displayStyle: "block",
			openFn: "openStatesList",
		},
		diplomacy: {
			mountId: "diplomacyEditorMount",
			panelId: "diplomacyEditorPanel",
			displayStyle: "block",
			openFn: "openDiplomacyEditor",
		},
		routes: {
			mountId: "routeEditorMount",
			panelId: "routeEditorPanel",
			displayStyle: "block",
			layerSelect: "states",
		},
		labels: {
			mountId: "labelMount",
			panelId: "labelEditorPanel",
			displayStyle: "flex",
			layerSelect: "states",
		},
		languages: {
			mountId: "languageMount",
			panelId: "languageEditorPanel",
			displayStyle: "flex",
		},
		biomes: {
			mountId: "biomesEditorMount",
			panelId: "biomesEditorPanel",
			displayStyle: "block",
			openFn: "openBiomesEditor",
		},
		markers: {
			mountId: "markersEditorMount",
			panelId: "markersEditorPanel",
			displayStyle: "block",
			openFn: "openMarkersEditor",
		},
		magic: {
			mountId: "magicEditorMount",
			panelId: "magicEditorPanel",
			displayStyle: "block",
			openFn: "openMagicEditor",
		},
		ecology: {
			mountId: "ecologyEditorMount",
			panelId: "ecologyEditorPanel",
			displayStyle: "block",
			openFn: "openEcologyEditor",
		},
		burgs: {
			mountId: "burgEditorMount",
			panelId: "burgEditorPanel",
			displayStyle: "block",
			openFn: "openBurgEditor",
		},
		military: {
			mountId: "militaryUnitMount",
			panelId: "militaryUnitPanel",
			displayStyle: "flex",
		},
		religions: {
			mountId: "religionsEditorMount",
			panelId: "religionsEditorPanel",
			displayStyle: "block",
			openFn: "openReligionEditor",
		},
		fringe: {
			mountId: "fringeEditorMount",
			panelId: "fringeEditorPanel",
			displayStyle: "block",
			openFn: "openFringeEditor",
		},
		dashboard: {
			mountId: "dashboardMount",
			panelId: "dashboardPanel",
			displayStyle: "flex",
			openFn: "openDashboard",
		},
		paragons: {
			mountId: "paragonsEditorMount",
			panelId: "paragonsEditorPanel",
			displayStyle: "flex",
			openFn: "openParagonsEditor",
		},
	};

	const toggleToolPanel = (toolKey: string, btnId: string) => {
		const config = toolPanels[toolKey];
		if (!config) return;

		const panelEl = document.getElementById(config.panelId);
		const mountEl = document.getElementById(config.mountId);

		// Check if it's currently open
		const isOpen =
			panelEl &&
			(panelEl.style.display === "block" || panelEl.style.display === "flex");

		// Hide ALL other tool panels first to maintain a clean screen
		for (const key of Object.keys(toolPanels)) {
			const c = toolPanels[key];
			const el = document.getElementById(c.panelId);
			const mEl = document.getElementById(c.mountId);
			if (el) {
				el.style.display = "none";
			}
			if (mEl) {
				mEl.style.display = "none";
			}
		}

		if (isOpen) {
			// It was open, now we close it (already hidden by the loop above)
			return;
		}

		// Position the panel next to its triggering button
		positionPanelFromButton(btnId, config.mountId);

		// Show the mount element wrapper so it is interactive and visible
		if (mountEl) {
			mountEl.style.display = "block";
		}

		const win = window as any;
		if (config.layerSelect && win.triggerLayerSelect) {
			win.triggerLayerSelect(config.layerSelect);
		}

		if (config.openFn && typeof win[config.openFn] === "function") {
			win[config.openFn]();
		} else if (panelEl) {
			panelEl.style.display = config.displayStyle;
		}
	};

	if (btnOpenHeightmap) {
		btnOpenHeightmap.addEventListener("click", () => {
			toggleToolPanel("heightmap", "btnOpenHeightmap");
		});
	}

	if (btnOpenStates) {
		btnOpenStates.addEventListener("click", () => {
			toggleToolPanel("states", "btnOpenStates");
		});
	}

	if (btnOpenDiplomacy) {
		btnOpenDiplomacy.addEventListener("click", () => {
			toggleToolPanel("diplomacy", "btnOpenDiplomacy");
		});
	}

	if (btnOpenRoutes) {
		btnOpenRoutes.addEventListener("click", () => {
			toggleToolPanel("routes", "btnOpenRoutes");
		});
	}

	if (btnOpenLabels) {
		btnOpenLabels.addEventListener("click", () => {
			toggleToolPanel("labels", "btnOpenLabels");
		});
	}

	if (btnOpenLanguages) {
		btnOpenLanguages.addEventListener("click", () => {
			toggleToolPanel("languages", "btnOpenLanguages");
		});
	}

	if (btnOpenBiomes) {
		btnOpenBiomes.addEventListener("click", () => {
			toggleToolPanel("biomes", "btnOpenBiomes");
		});
	}

	if (btnOpenMarkers) {
		btnOpenMarkers.addEventListener("click", () => {
			toggleToolPanel("markers", "btnOpenMarkers");
		});
	}

	if (btnOpenMagic) {
		btnOpenMagic.addEventListener("click", () => {
			toggleToolPanel("magic", "btnOpenMagic");
		});
	}

	if (btnOpenEcology) {
		btnOpenEcology.addEventListener("click", () => {
			toggleToolPanel("ecology", "btnOpenEcology");
		});
	}

	if (btnOpenBurgs) {
		btnOpenBurgs.addEventListener("click", () => {
			toggleToolPanel("burgs", "btnOpenBurgs");
		});
	}

	if (btnOpenMilitary) {
		btnOpenMilitary.addEventListener("click", () => {
			toggleToolPanel("military", "btnOpenMilitary");
		});
	}

	if (btnOpenReligions) {
		btnOpenReligions.addEventListener("click", () => {
			toggleToolPanel("religions", "btnOpenReligions");
		});
	}

	if (btnOpenSpecies) {
		btnOpenSpecies.addEventListener("click", () => {
			if ((window as any).openSpeciesEditor) {
				(window as any).openSpeciesEditor();
			}
		});
	}

	if (btnOpenFringe) {
		btnOpenFringe.addEventListener("click", () => {
			toggleToolPanel("fringe", "btnOpenFringe");
		});
	}

	if (btnOpenParagons) {
		btnOpenParagons.addEventListener("click", () => {
			toggleToolPanel("paragons", "btnOpenParagons");
		});
	}

	if (btnOpenDashboard) {
		btnOpenDashboard.addEventListener("click", () => {
			toggleToolPanel("dashboard", "btnOpenDashboard");
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
		(window as any).triggerLayerSelect("states");
		if (originalOpenBurgEditor) originalOpenBurgEditor(burg);
	};

	const originalOpenStateEditor = (window as any).openStateEditor;
	(window as any).openStateEditor = (state: any) => {
		(window as any).triggerLayerSelect("states");
		if (originalOpenStateEditor) originalOpenStateEditor(state);
	};

	const originalOpenRouteEditor = (window as any).openRouteEditor;
	(window as any).openRouteEditor = (route: any) => {
		(window as any).triggerLayerSelect("states");
		if (originalOpenRouteEditor) originalOpenRouteEditor(route);
	};

	const originalOpenLabelEditor = (window as any).openLabelEditor;
	if (originalOpenLabelEditor) {
		(window as any).openLabelEditor = (label: any) => {
			(window as any).triggerLayerSelect("states");
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
	// (Calendar editor button now lives inside the Configure World modal.)
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

	// Wire Simulation Controls (under the minimap)
	const simStep1Btn = document.getElementById("simStep1Btn");
	const simStep5Btn = document.getElementById("simStep5Btn");
	const simStep30Btn = document.getElementById("simStep30Btn");

	if (simStep1Btn) {
		simStep1Btn.addEventListener("click", () => {
			handleTimeTick(24); // Advance +1 Day
			if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
		});
	}

	if (simStep5Btn) {
		simStep5Btn.addEventListener("click", () => {
			handleTimeTick(120); // Advance +5 Days
			if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
		});
	}

	if (simStep30Btn) {
		simStep30Btn.addEventListener("click", () => {
			handleTimeTick(720); // Advance +30 Days
			if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
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
		optionsTrigger.addEventListener("click", () => {
			optionsPanel.style.display = "flex";
			collapsibleWrap.style.display = "none";
		});
		optionsHide.addEventListener("click", () => {
			optionsPanel.style.display = "none";
			collapsibleWrap.style.display = "block";
		});
	}

	// Wire up Tab switching
	const tabs = ["optionsTab", "layersTab", "toolsTab"];
	const contents = ["optionsContent", "layersContent", "toolsContent"];

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

				let templateStr = "";
				if (config.heightmapType === "Volcano") {
					templateStr = `
						Hill 1 95-100 50-50 45-55
						Pit 1 80-95 50-50 45-55
						Hill 4 10-20 20-80 20-80
						Smooth 5
					`;
				} else if (config.heightmapType === "High Island") {
					templateStr = `
						Hill 1 90-100 45-55 45-55
						Hill 3 40-60 30-70 30-70
						Range 1 50-70 20-80 30-70
						Smooth 4
						Mask 5
					`;
				} else if (config.heightmapType === "Low Island") {
					templateStr = `
						Hill 4 20-35 30-70 30-70
						Multiply 0.4
						Smooth 5
						Mask 4
					`;
				} else if (config.heightmapType === "Archipelago") {
					templateStr = `
						Hill 18 10-30 10-90 10-90
						Multiply 0.65
						Smooth 2
						Mask 3
					`;
				} else if (config.heightmapType === "Atoll") {
					templateStr = `
						Hill 1 60-70 50-50 50-50
						Add 25 all 0 0
						Pit 1 80-90 45-55 45-55
						Smooth 3
						Mask 3
					`;
				} else if (config.heightmapType === "Mediterranean") {
					templateStr = `
						Hill 1 40-50 50-50 50-50
						Add 45 all 0 0
						Pit 1 80-95 40-60 40-60
						Range 3 35-55 10-90 10-90
						Smooth 4
						Mask 1
					`;
				} else if (config.heightmapType === "Pangaea") {
					templateStr = `
						Hill 1 85-95 45-55 45-55
						Hill 6 25-45 20-80 20-80
						Range 2 40-60 15-85 15-85
						Smooth 3
						Mask 6
					`;
				} else if (config.heightmapType === "Fjordland") {
					templateStr = `
						Hill 12 30-50 10-90 10-90
						Range 4 35-55 10-90 10-90
						Trough 3 15-25 10-90 10-90
						Multiply 0.7
						Smooth 2
						Mask 2
					`;
				} else if (config.heightmapType === "Canyon") {
					templateStr = `
						Hill 1 80-90 50-50 50-50
						Add 45 all 0 0
						Trough 1 35-45 45-55 5-95
						Smooth 3
						Mask 2
					`;
				} else if (config.heightmapType === "East vs West") {
					templateStr = `
						Hill 1 80-85 20-35 40-60
						Hill 1 80-85 65-80 40-60
						Hill 5 15-30 10-90 10-90
						Strait 1 vertical
						Smooth 3
						Mask 3
					`;
				} else {
					templateStr = `
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
				}

				const rawHeights = hg.executeTemplate(templateStr);

				const climateOpts = {
					temperatureEquator: config.tempEquator,
					temperatureNorthPole: -30,
					temperatureSouthPole: -15,
					winds: [config.windsAngle, 45, 225, 315, 135, 315],
					precInput: config.precipitationInput,
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
					undefined,
					config.enableUnderwater ? config.underwaterCount : 0,
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
				
				const burgCells = burgs.map((b: any) => b.cell);
				let markerTypes = store.getState().markerTypes || [];
				if (markerTypes.length === 0) {
					// Seed default marker types if none exist
					markerTypes = [
						{ id: "volcano", name: "Volcano", type: "landmark", rarity: 5, allowedBiomes: [], forbiddenBiomes: [0, 1, 2, 11, 13, 14, 15, 16, 17], minTemp: -50, maxTemp: 100, frequentedByNPCs: false, effect: "danger", nearbyReq: "none" },
						{ id: "ruins", name: "Ancient Ruins", type: "dungeon", rarity: 3, allowedBiomes: [6, 8], forbiddenBiomes: [0, 1, 2], minTemp: 5, maxTemp: 30, frequentedByNPCs: false, effect: "wealth", nearbyReq: "none" },
						{ id: "monument", name: "Monument", type: "holy_place", rarity: 2, allowedBiomes: [], forbiddenBiomes: [0, 1, 2], minTemp: -50, maxTemp: 100, frequentedByNPCs: true, effect: "happiness", nearbyReq: "burg" },
						{ id: "spring", name: "Holy Spring", type: "holy_place", rarity: 4, allowedBiomes: [4, 7, 8, 9], forbiddenBiomes: [0, 1, 2], minTemp: 0, maxTemp: 40, frequentedByNPCs: true, effect: "health", nearbyReq: "none" },
					];
					store.updateState({ markerTypes });
				}
				const markers = generateMarkers(grid, heights, temp, prec, biomes, seed, markerTypes, burgCells);
				const paragons = generateParagons(states, burgs, religions, seed);
				const relations = generateDiplomacy(states, seed);

				const cellGoods = generateGoods(grid, heights, biomes);
				const markets = generateMarkets(grid, burgs, cellGoods);
				const production = runProductionCycles(markets, paragons);

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
					cultures,
					states,
					provinces,
					routes,
					military,
					religions,
					zones,
					markers,
					relations,
					paragons,
					markets,
					production,
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

	(window as any).runClimateRegen = (opts: {
		equatorTemp: number;
		polesTemp: number;
		latN: number;
		latT: number;
		precInput: number;
		winds: number[];
	}) => {
		const state = store.getState() as any;
		if (!state.grid || !state.heights) return;

		const climateOpts = {
			temperatureEquator: opts.equatorTemp,
			temperatureNorthPole: opts.polesTemp,
			temperatureSouthPole: opts.polesTemp,
			winds:
				opts.winds && opts.winds.length === 6
					? opts.winds
					: [225, 45, 225, 315, 135, 315],
			precInput: opts.precInput,
			latN: opts.latN,
			latT: opts.latT,
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
		const state = store.getState();
		renderMap(canvas, state, currentLayer);
		// Scalebar/legend drawn in screen-space after the main scene transform
		drawScalebarOverlay(canvas, state);
		// Curved state labels drawn in world-space (inside transform)
		const ctx = canvas.getContext("2d");
		if (ctx && state.states && state.burgs && state.showLabels) {
			ctx.save();
			ctx.translate(state.offsetX || 0, state.offsetY || 0);
			ctx.scale(state.zoom || 1.0, state.zoom || 1.0);
			drawCurvedStateLabels(ctx, state.states, state.burgs, state.zoom || 1.0, state.layerStyles);
			ctx.restore();
		}
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
	let startX = 0;
	let startY = 0;

	let isPaintingBrush = false;
	let lastPaintedCellId: number | null = null;

	let draggedRegionId: number | null = null;
	let draggedLocalZoneId: number | null = null;

	const getCellsInRadius = (
		centerId: number,
		radius: number,
		cellsAdjacency: number[][],
	): Set<number> => {
		const result = new Set<number>([centerId]);
		if (radius <= 0) return result;

		let currentQueue = [centerId];
		for (let r = 0; r < radius; r++) {
			const nextQueue: number[] = [];
			for (const cell of currentQueue) {
				const neighbors = cellsAdjacency[cell] || [];
				for (const n of neighbors) {
					if (!result.has(n)) {
						result.add(n);
						nextQueue.push(n);
					}
				}
			}
			currentQueue = nextQueue;
			if (currentQueue.length === 0) break;
		}
		return result;
	};

	const applyBrushPaint = (cellId: number): boolean => {
		const state = store.getState() as any;
		if (!state.grid || !state.heights) return false;

		// 1. Heightmap Paint Brush
		const hmBrush = (window as any).getCurrentHeightmapBrushConfig
			? (window as any).getCurrentHeightmapBrushConfig()
			: null;
		if (hmBrush && hmBrush.active) {
			const size = hmBrush.size ?? 2;
			const strength = hmBrush.strength ?? 15;
			const type = hmBrush.type ?? "hill_up";

			const cellsToPaint = getCellsInRadius(cellId, size, state.grid.cells.c);
			const updatedHeights = new Uint8Array(state.heights);

			if (type === "smooth") {
				for (const cid of cellsToPaint) {
					const neighbors = state.grid.cells.c[cid] || [];
					const sum = neighbors.reduce(
						(acc: number, n: number) => acc + state.heights[n],
						state.heights[cid],
					);
					updatedHeights[cid] = Math.round(sum / (neighbors.length + 1));
				}
			} else {
				// BFS hops map to compute distance for smooth falloffs
				const hopsMap = new Map<number, number>();
				hopsMap.set(cellId, 0);
				const queue = [cellId];
				while (queue.length > 0) {
					const curr = queue.shift()!;
					const currHops = hopsMap.get(curr)!;
					if (currHops < size) {
						const neighbors = state.grid.cells.c[curr] || [];
						for (const n of neighbors) {
							if (!hopsMap.has(n)) {
								hopsMap.set(n, currHops + 1);
								queue.push(n);
							}
						}
					}
				}

				for (const cid of cellsToPaint) {
					const h = state.heights[cid];
					const d = hopsMap.get(cid) ?? 0;
					const ratio = size > 0 ? 1 - d / (size + 1) : 1;
					const delta = Math.round(strength * ratio);

					if (type === "sharp_up") {
						updatedHeights[cid] = Math.min(100, h + strength);
					} else if (type === "sharp_down") {
						updatedHeights[cid] = Math.max(0, h - strength);
					} else if (type === "hill_up") {
						updatedHeights[cid] = Math.min(100, h + delta);
					} else if (type === "hill_down") {
						updatedHeights[cid] = Math.max(0, h - delta);
					} else if (type === "noise") {
						const noiseDelta = Math.round((Math.random() - 0.5) * 2 * strength);
						updatedHeights[cid] = Math.min(100, Math.max(0, h + noiseDelta));
					}
				}
			}

			store.updateState({ heights: updatedHeights });
			renderCurrentLayer();
			if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());

			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(
					JSON.stringify({
						op: "MUTATE_CELL",
						cellId,
						changes: { heights: Array.from(updatedHeights) },
					}),
				);
			}
			return true;
		}

		// 2. Biomes Paint Brush
		const biomeBrush = (window as any).getCurrentBiomeBrushConfig
			? (window as any).getCurrentBiomeBrushConfig()
			: null;
		if (biomeBrush && biomeBrush.active) {
			const size = biomeBrush.size ?? 2;
			const targetBiome = biomeBrush.targetBiome;
			if (targetBiome !== undefined && targetBiome >= 0) {
				const cellsToPaint = getCellsInRadius(cellId, size, state.grid.cells.c);
				const updatedBiomes = state.biomes
					? new Uint8Array(state.biomes)
					: new Uint8Array(state.heights.length).fill(3);

				for (const cid of cellsToPaint) {
					updatedBiomes[cid] = targetBiome;
				}

				store.updateState({ biomes: updatedBiomes } as any);
				renderCurrentLayer();
				if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
				return true;
			}
		}

		// 3. Religions Paint Brush
		const religionBrush = (window as any).getCurrentReligionBrushConfig
			? (window as any).getCurrentReligionBrushConfig()
			: null;
		if (religionBrush && religionBrush.active) {
			const size = religionBrush.size ?? 2;
			const targetReligion = religionBrush.targetReligion;
			if (targetReligion !== undefined && targetReligion >= 0) {
				const cellsToPaint = getCellsInRadius(cellId, size, state.grid.cells.c);
				const updatedReligions = state.cellReligions
					? new Uint16Array(state.cellReligions)
					: new Uint16Array(state.heights.length).fill(0);

				for (const cid of cellsToPaint) {
					updatedReligions[cid] = targetReligion;
				}

				store.updateState({ cellReligions: updatedReligions } as any);
				renderCurrentLayer();
				if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
				return true;
			}
		}

		return false;
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

		// Check if we click a region anchor or a local zone anchor for dragging
		const zoom = state.zoom || 1.0;
		if (state.regions) {
			if (zoom < 3.0) {
				// Global view: Try to drag a region
				for (const r of state.regions) {
					const dist = Math.hypot(r.centerX - mapX, r.centerY - mapY);
					if (dist < 22 / zoom) {
						draggedRegionId = r.id;
						return;
					}
				}
			} else {
				// Regional or Local view: Try to drag a local zone within active region
				const activeReg =
					state.regions.find((x: any) => x.id === state.activeRegionId) ||
					state.regions[0];
				if (activeReg) {
					for (const lz of activeReg.localZones) {
						const dist = Math.hypot(lz.centerX - mapX, lz.centerY - mapY);
						if (dist < 22 / zoom) {
							draggedLocalZoneId = lz.id;
							return;
						}
					}
				}
			}
		}

		const cellId = findClosestCellIndex(mapX, mapY, state.grid.points);

		// Try to apply paint brush first before other click interactions!
		if (applyBrushPaint(cellId)) {
			isPaintingBrush = true;
			lastPaintedCellId = cellId;
			return;
		}

		if ((window as any).handleLabelMapClick) {
			if ((window as any).handleLabelMapClick(mapX, mapY)) return;
		}

		if ((window as any).handleRouteMapClick) {
			if ((window as any).handleRouteMapClick(cellId)) return;
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

		// Intercept simulation manual placement clicks!
		if ((window as any).isSimulationManualPlacementActive) {
			const clickedCellId = cellId;
			const ptsN = state.heights ? state.heights.length : 0;

			// Initialize ecology/magic arrays if they aren't already
			const plants = state.plants
				? new Float32Array(state.plants)
				: new Float32Array(ptsN).fill(100.0);
			const herbivores = state.herbivores
				? new Float32Array(state.herbivores)
				: new Float32Array(ptsN).fill(20.0);
			const magicFlux = state.magicFlux
				? new Float32Array(state.magicFlux)
				: new Float32Array(ptsN).fill(0.0);

			// Bloom wildlife and magic in clicked cell & its direct neighbors!
			plants[clickedCellId] = Math.min(800.0, plants[clickedCellId] + 300.0);
			herbivores[clickedCellId] = Math.min(
				300.0,
				herbivores[clickedCellId] + 50.0,
			);
			magicFlux[clickedCellId] = Math.min(
				100.0,
				magicFlux[clickedCellId] + 25.0,
			);

			const neighbors = state.grid.cells.c[clickedCellId] || [];
			for (const n of neighbors) {
				plants[n] = Math.min(800.0, plants[n] + 150.0);
				herbivores[n] = Math.min(300.0, herbivores[n] + 25.0);
				magicFlux[n] = Math.min(100.0, magicFlux[n] + 12.5);
			}

			store.updateState({
				plants,
				herbivores,
				magicFlux,
			} as any);

			renderCurrentLayer();

			// Briefly show notification of bloom!
			const feedbackEl = document.createElement("div");
			feedbackEl.innerText = "🌸 Ecological bloom & Magic anomaly seeded!";
			feedbackEl.setAttribute(
				"style",
				`
				position: fixed;
				left: ${e.clientX}px;
				top: ${e.clientY - 20}px;
				background: rgba(16, 185, 129, 0.95);
				color: white;
				padding: 0.3rem 0.6rem;
				border-radius: 4px;
				font-size: 0.75rem;
				font-weight: bold;
				z-index: 10000;
				pointer-events: none;
				transition: transform 0.8s ease-out, opacity 0.8s ease-out;
			`,
			);
			document.body.appendChild(feedbackEl);
			setTimeout(() => {
				feedbackEl.style.transform = "translateY(-40px)";
				feedbackEl.style.opacity = "0";
			}, 50);
			setTimeout(() => feedbackEl.remove(), 900);
			return;
		}

		// Check if we click a route
		if (state.routes) {
			for (const r of state.routes) {
				if (r.path && r.path.includes(cellId)) {
					ensureToolsTabVisible();
					(window as any).openRouteEditor(r);
					return;
				}
			}
		}

		// Check if we click a state
		const sId = state.cellStates ? state.cellStates[cellId] : 0;
		const hmBrush = (window as any).getCurrentHeightmapBrushConfig
			? (window as any).getCurrentHeightmapBrushConfig()
			: null;
		const bioBrush = (window as any).getCurrentBiomeBrushConfig
			? (window as any).getCurrentBiomeBrushConfig()
			: null;
		const relBrush = (window as any).getCurrentReligionBrushConfig
			? (window as any).getCurrentReligionBrushConfig()
			: null;
		const isBrushActive =
			(hmBrush && hmBrush.active) ||
			(bioBrush && bioBrush.active) ||
			(relBrush && relBrush.active);

		if (sId > 0 && state.states && !isBrushActive) {
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
		if (draggedRegionId !== null) {
			const rect = canvas.getBoundingClientRect();
			const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
			const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;
			const state = store.getState() as any;
			const mapX = (clickX - state.offsetX) / state.zoom;
			const mapY = (clickY - state.offsetY) / state.zoom;

			const updatedRegions = state.regions.map((r: any) => {
				if (r.id === draggedRegionId) {
					const dx = mapX - r.centerX;
					const dy = mapY - r.centerY;
					const updatedLocalZones = r.localZones.map((lz: any) => {
						const updatedUnits = lz.units.map((u: any) => ({
							...u,
							x: u.x + dx,
							y: u.y + dy,
						}));
						return {
							...lz,
							centerX: lz.centerX + dx,
							centerY: lz.centerY + dy,
							units: updatedUnits,
						};
					});
					const updatedUnits = r.units.map((u: any) => ({
						...u,
						x: u.x + dx,
						y: u.y + dy,
					}));
					return {
						...r,
						centerX: mapX,
						centerY: mapY,
						localZones: updatedLocalZones,
						units: updatedUnits,
					};
				}
				return r;
			});
			store.updateState({ regions: updatedRegions });
			renderCurrentLayer();
			return;
		}

		if (draggedLocalZoneId !== null) {
			const rect = canvas.getBoundingClientRect();
			const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
			const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;
			const state = store.getState() as any;
			const mapX = (clickX - state.offsetX) / state.zoom;
			const mapY = (clickY - state.offsetY) / state.zoom;

			const activeRegId = state.activeRegionId ?? 0;
			const updatedRegions = state.regions.map((r: any) => {
				if (r.id === activeRegId) {
					const updatedLocalZones = r.localZones.map((lz: any) => {
						if (lz.id === draggedLocalZoneId) {
							const dx = mapX - lz.centerX;
							const dy = mapY - lz.centerY;
							const updatedUnits = lz.units.map((u: any) => ({
								...u,
								x: u.x + dx,
								y: u.y + dy,
							}));
							return {
								...lz,
								centerX: mapX,
								centerY: mapY,
								units: updatedUnits,
							};
						}
						return lz;
					});
					return { ...r, localZones: updatedLocalZones };
				}
				return r;
			});
			store.updateState({ regions: updatedRegions });
			renderCurrentLayer();
			return;
		}

		if (isPaintingBrush) {
			const rect = canvas.getBoundingClientRect();
			const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
			const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;
			const state = store.getState() as any;
			const mapX = (clickX - state.offsetX) / state.zoom;
			const mapY = (clickY - state.offsetY) / state.zoom;
			const cellId = findClosestCellIndex(mapX, mapY, state.grid.points);
			if (cellId !== lastPaintedCellId) {
				applyBrushPaint(cellId);
				lastPaintedCellId = cellId;
			}
			return;
		}

		if (isPanning) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			startX = e.clientX;
			startY = e.clientY;

			const state = store.getState() as any;
			store.updateState({
				offsetX: state.offsetX + dx,
				offsetY: state.offsetY + dy,
			});
			renderCurrentLayer();
		}
	});

	window.addEventListener("mouseup", () => {
		isPanning = false;
		isPaintingBrush = false;
		lastPaintedCellId = null;
		draggedRegionId = null;
		draggedLocalZoneId = null;
	});

	canvas.addEventListener("wheel", (e) => {
		if (is3DMode) return;
		e.preventDefault();

		const state = store.getState() as any;
		if (!state.regions || state.regions.length === 0) return;

		const rect = canvas.getBoundingClientRect();
		const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
		const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

		const mapX = (mouseX - state.offsetX) / state.zoom;
		const mapY = (mouseY - state.offsetY) / state.zoom;

		const isScrollUp = e.deltaY < 0;

		if (isScrollUp) {
			if (state.zoomTier === "global" || !state.zoomTier) {
				// Zoom in from Global View to Regional View (zoom = 4.5)
				let closestRegion: any = null;
				let minRegionDist = Infinity;
				for (const r of state.regions) {
					const d = Math.hypot(r.centerX - mapX, r.centerY - mapY);
					if (d < minRegionDist) {
						minRegionDist = d;
						closestRegion = r;
					}
				}
				if (closestRegion) {
					const radius = closestRegion.radius || 165;
					const bounds = {
						minX: Math.max(0, closestRegion.centerX - radius),
						minY: Math.max(0, closestRegion.centerY - radius),
						maxX: Math.min(state.width, closestRegion.centerX + radius),
						maxY: Math.min(state.height, closestRegion.centerY + radius),
					};
					const subState = projectZoomState(state, bounds, "regional");
					store.updateState({
						...subState,
						zoom: 1.0,
						offsetX: 0,
						offsetY: 0,
						activeRegionId: closestRegion.id,
					});
					renderCurrentLayer();
				}
			} else if (state.zoomTier === "regional") {
				// Zoom in from Regional View to Local View (zoom = 12.0)
				const activeReg =
					state.regions.find((x: any) => x.id === state.activeRegionId) ||
					state.regions[0];
				if (
					activeReg &&
					activeReg.localZones &&
					activeReg.localZones.length > 0
				) {
					let closestLz: any = null;
					let minLzDist = Infinity;
					for (const lz of activeReg.localZones) {
						const d = Math.hypot(lz.centerX - mapX, lz.centerY - mapY);
						if (d < minLzDist) {
							minLzDist = d;
							closestLz = lz;
						}
					}
					if (closestLz) {
						const radius = closestLz.radius || 65;
						const bounds = {
							minX: Math.max(0, closestLz.centerX - radius),
							minY: Math.max(0, closestLz.centerY - radius),
							maxX: Math.min(state.width, closestLz.centerX + radius),
							maxY: Math.min(state.height, closestLz.centerY + radius),
						};
						const subState = projectZoomState(state, bounds, "local");
						store.updateState({
							...subState,
							zoom: 1.0,
							offsetX: 0,
							offsetY: 0,
							activeLocalId: closestLz.id,
						});
						renderCurrentLayer();
					}
				}
			}
		} else {
			// Scroll Down (Zoom out)
			if (state.zoomTier === "local") {
				// Zoom out from Local View to Regional View (zoom = 4.5)
				if (state.parentStates && state.parentStates.length > 0) {
					const parent = state.parentStates[state.parentStates.length - 1];
					store.updateState({
						...parent,
						zoomTier: "regional",
						activeLocalId: null,
						parentStates: state.parentStates.slice(0, -1),
					});
					renderCurrentLayer();
				}
			} else if (state.zoomTier === "regional") {
				// Zoom out from Regional View to Global View (zoom = 1.0, reset offset)
				if (state.parentStates && state.parentStates.length > 0) {
					const parent = state.parentStates[state.parentStates.length - 1];
					store.updateState({
						...parent,
						zoomTier: "global",
						activeRegionId: null,
						activeLocalId: null,
						parentStates: state.parentStates.slice(0, -1),
					});
					renderCurrentLayer();
				}
			}
		}
	});

	const renderLayersChecklist = () => {
		const listEl = document.getElementById("layersList");
		if (!listEl) return;

		const state = store.getState() as any;
		const order = state.layerOrder || [
			"heightmap",
			"biomes",
			"temp",
			"prec",
			"cultures",
			"states",
			"provinces",
			"religions",
			"goods",
			"grid",
			"rivers",
			"zones",
			"routes",
			"markers",
			"burgs",
			"military",
			"labels",
		];

		const layerMeta: Record<string, { name: string; toggleId: string }> = {
			heightmap: { name: "⛰️ Heightmap", toggleId: "showHeightmap" },
			biomes: { name: "🍃 Biomes Terrain", toggleId: "showBiomes" },
			temp: { name: "🌡️ Temperature Map", toggleId: "showTemp" },
			prec: { name: "🌧️ Precipitation Map", toggleId: "showPrec" },
			cultures: { name: "🗣️ Cultures Map", toggleId: "showCultures" },
			states: { name: "👑 States Map", toggleId: "showStates" },
			provinces: { name: "🏰 Provinces Map", toggleId: "showProvinces" },
			religions: { name: "⛪ Religions Map", toggleId: "showReligions" },
			goods: { name: "🪙 Goods Map", toggleId: "showGoods" },
			grid: { name: "🌐 Grid Cells", toggleId: "showGrid" },
			rivers: { name: "💧 Rivers", toggleId: "showRivers" },
			zones: { name: "🗺️ Special Zones", toggleId: "showZones" },
			routes: { name: "🛣️ Routes & Roads", toggleId: "showRoutes" },
			markers: { name: "📍 Markers & Icons", toggleId: "showMarkers" },
			burgs: { name: "🏰 Burgs & Cities", toggleId: "showBurgs" },
			military: { name: "⚔️ Military Units", toggleId: "showMilitary" },
			labels: { name: "🏷️ Text Labels", toggleId: "showLabels" },
		};

		// 1. Identify Core Base Layers to drag/sort/opacity
		const coreKeys = [
			"cultures",
			"religions",
			"states",
			"provinces",
			"heightmap",
			"biomes",
		];
		const activeCoreOrder = order.filter((k: string) => coreKeys.includes(k));

		// 2. Identify Overlay Layers to toggle simply at the bottom
		const overlayKeys = [
			"burgs",
			"labels",
			"military",
			"zones",
			"markers",
			"goods",
			"rivers",
			"grid",
			"routes",
			"temp",
			"prec",
		];

		// Build Core Base Layers Section HTML
		let html = `
			<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
				<div style="font-size: 0.75rem; font-weight: 600; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.2rem 0 0.1rem 0;">
					Core Map Layers (Drag & Blend)
				</div>
				<div class="core-layers-drag-container" style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%;">
		`;

		activeCoreOrder.forEach((layerId: string, idx: number) => {
			const meta = layerMeta[layerId];
			if (!meta) return;
			const isVisible = state[meta.toggleId] ?? false;
			const eyeIcon = isVisible ? "👁️" : "🙈";
			const iconColor = isVisible ? "#3b82f6" : "#475569";
			const rowBackground = isVisible
				? "rgba(59, 130, 246, 0.08)"
				: "rgba(255, 255, 255, 0.01)";
			const styles = state.layerStyles || {};
			const layerStyle = styles[layerId] || { opacity: 1.0 };
			const opacityVal = layerStyle.opacity ?? 1.0;

			html += `
				<div class="draggable-layer-row" draggable="true" data-index="${idx}" data-layer-id="${layerId}" style="display: flex; flex-direction: column; padding: 0.5rem; border-radius: 6px; background: ${rowBackground}; border: 1px solid rgba(255,255,255,0.08); cursor: grab; user-select: none; gap: 0.3rem; transition: background 0.15s ease;">
					<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
						<span style="font-weight: ${isVisible ? "600" : "400"}; color: ${isVisible ? "#f1f5f9" : "#cbd5e1"}; font-size: 0.8rem; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
							⋮⋮ ${meta.name}
						</span>
						<button class="layer-toggle-btn" data-id="${layerId}" data-toggle-id="${meta.toggleId}" style="background: transparent; border: none; font-size: 0.95rem; cursor: pointer; color: ${iconColor}; padding: 0 0.2rem; outline: none; transition: transform 0.1s ease;">
							${eyeIcon}
						</button>
					</div>
					<div class="opacity-slider-container" style="display: flex; align-items: center; gap: 0.4rem; width: 100%; margin-top: 0.1rem;" onclick="event.stopPropagation();">
						<span style="font-size: 0.65rem; color: #64748b; width: 45px; pointer-events: none;">Opacity:</span>
						<input class="layer-opacity-slider" type="range" min="0" max="1" step="0.05" value="${opacityVal}" data-layer-id="${layerId}" style="flex: 1; height: 3px; border-radius: 2px; cursor: pointer; accent-color: #3b82f6; background: rgba(255,255,255,0.15); border: none; outline: none;">
						<span style="font-size: 0.65rem; color: #cbd5e1; font-weight: 500; min-width: 28px; text-align: right; pointer-events: none;">${Math.round(opacityVal * 100)}%</span>
					</div>
				</div>
			`;
		});

		html += `
				</div>
			</div>
		`;

		// Build Overlay & Feature Toggles Section HTML
		html += `
			<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.8rem;">
				<div style="font-size: 0.75rem; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem;">
					Map Features &amp; Overlays
				</div>
				<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; width: 100%;">
		`;

		overlayKeys.forEach((layerId) => {
			const meta = layerMeta[layerId];
			if (!meta) return;
			const isVisible = state[meta.toggleId] ?? false;
			const tileBg = isVisible
				? "rgba(16, 185, 129, 0.12)"
				: "rgba(255, 255, 255, 0.02)";
			const tileBorder = isVisible
				? "rgba(16, 185, 129, 0.25)"
				: "rgba(255, 255, 255, 0.06)";
			const tileColor = isVisible ? "#34d399" : "#94a3b8";

			html += `
				<button class="overlay-toggle-tile" data-toggle-id="${meta.toggleId}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.5rem; border-radius: 6px; background: ${tileBg}; border: 1px solid ${tileBorder}; color: ${tileColor}; cursor: pointer; font-size: 0.72rem; text-align: left; transition: all 0.15s ease; outline: none; box-sizing: border-box; width: 100%;">
					<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; font-weight: ${isVisible ? "600" : "400"}; pointer-events: none;">${meta.name}</span>
					<span style="font-size: 0.8rem; pointer-events: none;">${isVisible ? "👁️" : "🙈"}</span>
				</button>
			`;
		});

		html += `
				</div>
			</div>
		`;

		listEl.innerHTML = html;

		// Bind eye button visibility toggles for Core Layers
		const toggles = listEl.querySelectorAll(".layer-toggle-btn");
		toggles.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				const toggleId = btn.getAttribute("data-toggle-id")!;
				const propName = toggleId as keyof AppState;
				const currentVal = state[propName];
				store.updateState({ [propName]: !currentVal });
				renderLayersChecklist();
				renderCurrentLayer();
			});
		});

		// Bind overlay tile toggles at the bottom
		const overlayTiles = listEl.querySelectorAll(".overlay-toggle-tile");
		overlayTiles.forEach((tile) => {
			tile.addEventListener("click", (e) => {
				e.preventDefault();
				const toggleId = tile.getAttribute("data-toggle-id")!;
				const propName = toggleId as keyof AppState;
				const currentVal = state[propName];
				store.updateState({ [propName]: !currentVal });
				renderLayersChecklist();
				renderCurrentLayer();
			});
		});

		// Bind Opacity Sliders
		const sliders = listEl.querySelectorAll(".layer-opacity-slider");
		sliders.forEach((slider) => {
			// Prevent dragging row when sliding opacity!
			slider.addEventListener("mousedown", (e) => {
				e.stopPropagation();
			});
			slider.addEventListener("click", (e) => {
				e.stopPropagation();
			});

			slider.addEventListener("input", (e) => {
				const layerId = slider.getAttribute("data-layer-id")!;
				const val = parseFloat((e.target as HTMLInputElement).value);
				const nextStyles = { ...state.layerStyles };
				nextStyles[layerId] = {
					...(nextStyles[layerId] || { color: "#ffffff", size: 1.0 }),
					opacity: val,
				};
				store.updateState({ layerStyles: nextStyles });

				// Update percentage display next to it instantly!
				const percentLabel = slider.nextElementSibling;
				if (percentLabel) {
					percentLabel.textContent = `${Math.round(val * 100)}%`;
				}

				renderCurrentLayer();
			});
		});

		// Bind HTML5 drag-and-drop events for Core Base Layers
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
					const nextCoreOrder = [...activeCoreOrder];
					const [dragged] = nextCoreOrder.splice(dragSrcIndex, 1);
					nextCoreOrder.splice(targetIndex, 0, dragged);

					// Reconstruct full master layerOrder
					const resultOrder: string[] = [];
					let coreIdx = 0;
					for (const item of order) {
						if (coreKeys.includes(item)) {
							resultOrder.push(nextCoreOrder[coreIdx++]);
						} else {
							resultOrder.push(item);
						}
					}

					store.updateState({ layerOrder: resultOrder });
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
				nextStyles.heightmap = { ...nextStyles.heightmap, opacity: 1.0 };
				nextStyles.states = { ...nextStyles.states, opacity: 0.0 };
				nextStyles.cultures = { ...nextStyles.cultures, opacity: 0.0 };
			} else if (val === "clean") {
				currentLayer = "states";
				store.updateState({
					showRoutes: false,
					showGrid: false,
					showMilitary: false,
				});
				nextStyles.states = { ...nextStyles.states, opacity: 0.9 };
			} else {
				currentLayer = "states";
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
			} else {
				canvas.style.display = "block";
				threeContainer.style.display = "none";
				if (threeRenderer) {
					threeRenderer.stopAnimation();
				}
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

	// Variable to store active log tab state
	let activeLogTab: "global" | "regional" | "local" = "global";

	// Subscribe to store updates to automatically render the canvas layer
	store.subscribe((state) => {
		if (canvas) {
			renderMap(canvas, state, currentLayer);
			drawScalebarOverlay(canvas, state);
			// Curved state labels
			const ctx = canvas.getContext("2d");
			if (ctx && state.states && state.burgs && state.showLabels) {
				ctx.save();
				ctx.translate(state.offsetX || 0, state.offsetY || 0);
				ctx.scale(state.zoom || 1.0, state.zoom || 1.0);
				drawCurvedStateLabels(ctx, state.states, state.burgs, state.zoom || 1.0, state.layerStyles);
				ctx.restore();
			}
		}
		renderLODPanel(state);
		renderInteractiveMinimap(state);
	});

	function renderInteractiveMinimap(state: any) {
		const gridContainer = document.getElementById("minimapGrid");
		if (!gridContainer || !state.regions) return;

		const activeRegion =
			state.regions.find((r: any) => r.id === state.activeRegionId) ||
			state.regions[0];

		// Draw the minimap terrain once on store update
		const mCanvas = document.getElementById(
			"minimapCanvas",
		) as HTMLCanvasElement;
		if (mCanvas) {
			drawMinimap(mCanvas, state);
		}

		const isZoomedIn = state.zoom >= 3.0;

		if (!isZoomedIn) {
			// At Global View: Render 10 Regions (R1 to R10)
			gridContainer.innerHTML = state.regions
				.map((r: any, idx: number) => {
					const borderStyle =
						"border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(0, 0, 0, 0.25); color: rgba(255, 255, 255, 0.65);";
					return `
					<div 
						id="minimap-sq-${r.id}"
						title="${r.name} (Click to zoom to Region)" 
						style="display: flex; align-items: center; justify-content: center; font-size: 0.65rem; border-radius: 4px; cursor: pointer; transition: all 0.15s ease-in-out; text-shadow: 0 1px 2px rgba(0,0,0,0.8); ${borderStyle}"
					>
						R${idx + 1}
					</div>
				`;
				})
				.join("");

			// Bind Region click and hover events
			state.regions.forEach((r: any) => {
				const sq = document.getElementById(`minimap-sq-${r.id}`);
				if (sq) {
					sq.addEventListener("mouseover", () => {
						sq.style.transform = "scale(1.04)";
						sq.style.borderColor = "#fbbf24";
						sq.style.color = "#ffffff";
						sq.style.background = "rgba(251, 191, 36, 0.15)";
					});
					sq.addEventListener("mouseout", () => {
						sq.style.transform = "scale(1.0)";
						sq.style.borderColor = "rgba(255, 255, 255, 0.12)";
						sq.style.color = "rgba(255, 255, 255, 0.65)";
						sq.style.background = "rgba(0, 0, 0, 0.25)";
					});
					sq.addEventListener("click", () => {
						const radius = r.radius || 165;
						const bounds = {
							minX: Math.max(0, r.centerX - radius),
							minY: Math.max(0, r.centerY - radius),
							maxX: Math.min(state.width, r.centerX + radius),
							maxY: Math.min(state.height, r.centerY + radius),
						};
						const subState = projectZoomState(state, bounds, "regional");
						store.updateState({
							...subState,
							zoom: 1.0,
							offsetX: 0,
							offsetY: 0,
							activeRegionId: r.id,
						});
						renderCurrentLayer();
					});
				}
			});
		} else {
			// At Zoomed View (Region or Local): Render 10 Local Zones (L1 to L10) of the active region
			const localZones = activeRegion.localZones || [];
			gridContainer.innerHTML = localZones
				.map((lz: any, idx: number) => {
					const isLzActive = state.zoom >= 8.0 && state.activeLocalId === lz.id;
					const borderStyle = isLzActive
						? "border: 2px solid #fbbf24; background: rgba(251, 191, 36, 0.25); color: #fbbf24; font-weight: 800; box-shadow: inset 0 0 8px rgba(251, 191, 36, 0.4);"
						: "border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(0, 0, 0, 0.25); color: rgba(255, 255, 255, 0.65);";

					return `
					<div 
						id="minimap-sq-local-${lz.id}"
						title="${lz.name} (Click to zoom to Local level)" 
						style="display: flex; align-items: center; justify-content: center; font-size: 0.65rem; border-radius: 4px; cursor: pointer; transition: all 0.15s ease-in-out; text-shadow: 0 1px 2px rgba(0,0,0,0.8); ${borderStyle}"
					>
						L${idx + 1}
					</div>
				`;
				})
				.join("");

			// Bind Local Zone click and hover events
			localZones.forEach((lz: any) => {
				const sq = document.getElementById(`minimap-sq-local-${lz.id}`);
				if (sq) {
					const isLzActive = state.zoom >= 8.0 && state.activeLocalId === lz.id;

					sq.addEventListener("mouseover", () => {
						sq.style.transform = "scale(1.04)";
						if (!isLzActive) {
							sq.style.borderColor = "#60a5fa";
							sq.style.color = "#ffffff";
							sq.style.background = "rgba(96, 165, 250, 0.15)";
						}
					});
					sq.addEventListener("mouseout", () => {
						sq.style.transform = "scale(1.0)";
						if (!isLzActive) {
							sq.style.borderColor = "rgba(255, 255, 255, 0.12)";
							sq.style.color = "rgba(255, 255, 255, 0.65)";
							sq.style.background = "rgba(0, 0, 0, 0.25)";
						}
					});
					sq.addEventListener("click", () => {
						const radius = lz.radius || 65;
						const bounds = {
							minX: Math.max(0, lz.centerX - radius),
							minY: Math.max(0, lz.centerY - radius),
							maxX: Math.min(state.width, lz.centerX + radius),
							maxY: Math.min(state.height, lz.centerY + radius),
						};
						const subState = projectZoomState(state, bounds, "local");
						store.updateState({
							...subState,
							zoom: 1.0,
							offsetX: 0,
							offsetY: 0,
							activeLocalId: lz.id,
						});
						renderCurrentLayer();
					});
				}
			});
		}

		// Dynamic Styling and Event Listeners for Bottom Level Control Buttons (Zoom Preset Indicators)
		const btnGlobal = document.getElementById(
			"minimapZoomGlobal",
		) as HTMLButtonElement;
		const btnRegion = document.getElementById(
			"minimapZoomRegion",
		) as HTMLButtonElement;
		const btnLocal = document.getElementById(
			"minimapZoomLocal",
		) as HTMLButtonElement;

		if (btnGlobal) {
			const isGlobal = state.zoom < 3.0;
			btnGlobal.style.background = isGlobal
				? "#3b82f6"
				: "rgba(255, 255, 255, 0.06)";
			btnGlobal.style.color = isGlobal ? "#ffffff" : "#cbd5e1";
			btnGlobal.style.borderColor = isGlobal
				? "#3b82f6"
				: "rgba(255, 255, 255, 0.1)";
			btnGlobal.style.fontWeight = isGlobal ? "bold" : "normal";

			btnGlobal.onclick = () => {
				store.updateState({
					zoom: 1.0,
					offsetX: 0,
					offsetY: 0,
				});
				renderCurrentLayer();
			};
		}

		if (btnRegion) {
			const isRegion = state.zoom >= 3.0 && state.zoom < 8.0;
			btnRegion.style.background = isRegion
				? "#fbbf24"
				: "rgba(255, 255, 255, 0.06)";
			btnRegion.style.color = isRegion ? "#000000" : "#cbd5e1";
			btnRegion.style.borderColor = isRegion
				? "#fbbf24"
				: "rgba(255, 255, 255, 0.1)";
			btnRegion.style.fontWeight = isRegion ? "bold" : "normal";

			btnRegion.onclick = () => {
				const activeReg =
					state.regions.find((x: any) => x.id === state.activeRegionId) ||
					state.regions[0];
				if (activeReg) {
					const nextZoom = 4.5;
					store.updateState({
						zoom: nextZoom,
						offsetX: canvas.width / 2 - activeReg.centerX * nextZoom,
						offsetY: canvas.height / 2 - activeReg.centerY * nextZoom,
						activeRegionId: activeReg.id,
					});
					renderCurrentLayer();
				}
			};
		}

		if (btnLocal) {
			const isLocal = state.zoom >= 8.0;
			btnLocal.style.background = isLocal
				? "#60a5fa"
				: "rgba(255, 255, 255, 0.06)";
			btnLocal.style.color = isLocal ? "#000000" : "#cbd5e1";
			btnLocal.style.borderColor = isLocal
				? "#60a5fa"
				: "rgba(255, 255, 255, 0.1)";
			btnLocal.style.fontWeight = isLocal ? "bold" : "normal";

			btnLocal.onclick = () => {
				const activeReg =
					state.regions.find((x: any) => x.id === state.activeRegionId) ||
					state.regions[0];
				if (activeReg) {
					const lz = activeReg.localZones?.[0] || {
						centerX: activeReg.centerX,
						centerY: activeReg.centerY,
						id: 0,
					};
					const nextZoom = 12.0;
					store.updateState({
						zoom: nextZoom,
						offsetX: canvas.width / 2 - lz.centerX * nextZoom,
						offsetY: canvas.height / 2 - lz.centerY * nextZoom,
						activeLocalId: lz.id,
					});
					renderCurrentLayer();
				}
			};
		}
	}

	function renderLODPanel(state: any) {
		const mount = document.getElementById("lodPanelMount");
		if (!mount) return;

		const zoom = state.zoom || 1.0;
		let lodName = "Global Overlook";
		let lodBadgeColor = "#f59e0b"; // Gold
		let lodBadgeBg = "rgba(245, 158, 11, 0.15)";
		if (zoom >= 8.0) {
			lodName = "Local Micro-Grid";
			lodBadgeColor = "#38bdf8"; // Sky Blue
			lodBadgeBg = "rgba(56, 189, 248, 0.15)";
		} else if (zoom >= 3.0) {
			lodName = "Regional Province";
			lodBadgeColor = "#10b981"; // Green
			lodBadgeBg = "rgba(16, 185, 129, 0.15)";
		}

		// Calculate active region and local
		const activeRegion =
			state.regions?.find((r: any) => r.id === state.activeRegionId) ||
			state.regions?.[0];
		const activeLocal =
			activeRegion?.localZones?.find(
				(l: any) => l.id === state.activeLocalId,
			) || activeRegion?.localZones?.[0];

		// Get logs list depending on active log tab
		let activeLogs: any[] = [];
		if (activeLogTab === "global") {
			activeLogs = state.globalLogs || [];
		} else if (activeLogTab === "regional") {
			activeLogs = state.regionalLogs?.[activeRegion?.id] || [];
		} else if (activeLogTab === "local") {
			const key = `${activeRegion?.id || 0}-${activeLocal?.id || 0}`;
			activeLogs = state.localLogs?.[key] || [];
		}

		// Compile the HTML template
		mount.innerHTML = `
			<!-- LOD Status Badge -->
			<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
				<span style="font-weight: 600; color: #94a3b8; font-size: 0.75rem;">Current Simulation LOD:</span>
				<span style="font-size: 0.75rem; font-weight: bold; color: ${lodBadgeColor}; background: ${lodBadgeBg}; padding: 0.2rem 0.5rem; border-radius: 20px; border: 1px solid ${lodBadgeColor}30;">
					${lodName} (${zoom.toFixed(1)}x)
				</span>
			</div>

			<!-- Focus Fly Navigation -->
			<div style="background: rgba(255,255,255,0.02); padding: 0.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.3rem;">
				<div style="font-weight: bold; color: #fbbf24; font-size: 0.75rem;">✈️ Level Focus Navigation</div>
				
				<!-- Region Select -->
				<div style="display: flex; gap: 0.4rem; align-items: center;">
					<label style="font-size: 0.7rem; color: #94a3b8; width: 45px;">Region:</label>
					<select id="lodRegionSelect" style="flex: 1; padding: 0.25rem; background: #1e1e24; color: white; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.75rem; outline: none;">
						${state.regions
							?.map(
								(r: any) => `
							<option value="${r.id}" ${r.id === activeRegion?.id ? "selected" : ""}>🏰 ${r.name}</option>
						`,
							)
							.join("")}
					</select>
					<button id="lodFlyRegionBtn" style="padding: 0.25rem 0.5rem; background: #fbbf24; color: black; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">Fly</button>
				</div>

				<!-- Region Rename Input -->
				<div style="display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.2rem;">
					<label style="font-size: 0.65rem; color: #64748b; width: 45px;">Rename:</label>
					<input id="lodRegionNameInput" type="text" value="${activeRegion?.name || ""}" placeholder="Enter new region name" style="flex: 1; padding: 0.2rem 0.3rem; background: #15151a; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; font-size: 0.7rem; outline: none;" />
				</div>

				<!-- Local Zone Select -->
				<div style="display: flex; gap: 0.4rem; align-items: center;">
					<label style="font-size: 0.7rem; color: #94a3b8; width: 45px;">Zone:</label>
					<select id="lodLocalSelect" style="flex: 1; padding: 0.25rem; background: #1e1e24; color: white; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.75rem; outline: none;">
						${activeRegion?.localZones
							?.map(
								(lz: any) => `
							<option value="${lz.id}" ${lz.id === activeLocal?.id ? "selected" : ""}>🏡 ${lz.name}</option>
						`,
							)
							.join("")}
					</select>
					<button id="lodFlyLocalBtn" style="padding: 0.25rem 0.5rem; background: #60a5fa; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">Fly</button>
				</div>

				<!-- Local Zone Rename Input -->
				<div style="display: flex; gap: 0.4rem; align-items: center;">
					<label style="font-size: 0.65rem; color: #64748b; width: 45px;">Rename:</label>
					<input id="lodLocalNameInput" type="text" value="${activeLocal?.name || ""}" placeholder="Enter new zone name" style="flex: 1; padding: 0.2rem 0.3rem; background: #15151a; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; font-size: 0.7rem; outline: none;" />
				</div>
			</div>

			<!-- 3-Tier Logs Panel -->
			<div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
				<!-- Log tabs -->
				<div style="display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); gap: 0.2rem;">
					<button id="lodTabGlobal" style="flex: 1; padding: 0.35rem 0.1rem; background: ${activeLogTab === "global" ? "rgba(255,255,255,0.05)" : "transparent"}; color: ${activeLogTab === "global" ? "#fbbf24" : "#94a3b8"}; border: none; border-bottom: 2px solid ${activeLogTab === "global" ? "#fbbf24" : "transparent"}; cursor: pointer; font-size: 0.7rem; font-weight: bold; outline: none; border-top-left-radius: 4px; border-top-right-radius: 4px;">🌍 Global</button>
					<button id="lodTabRegional" style="flex: 1; padding: 0.35rem 0.1rem; background: ${activeLogTab === "regional" ? "rgba(255,255,255,0.05)" : "transparent"}; color: ${activeLogTab === "regional" ? "#10b981" : "#94a3b8"}; border: none; border-bottom: 2px solid ${activeLogTab === "regional" ? "#10b981" : "transparent"}; cursor: pointer; font-size: 0.7rem; font-weight: bold; outline: none; border-top-left-radius: 4px; border-top-right-radius: 4px;">🏰 Regional</button>
					<button id="lodTabLocal" style="flex: 1; padding: 0.35rem 0.1rem; background: ${activeLogTab === "local" ? "rgba(255,255,255,0.05)" : "transparent"}; color: ${activeLogTab === "local" ? "#38bdf8" : "#94a3b8"}; border: none; border-bottom: 2px solid ${activeLogTab === "local" ? "#38bdf8" : "transparent"}; cursor: pointer; font-size: 0.7rem; font-weight: bold; outline: none; border-top-left-radius: 4px; border-top-right-radius: 4px;">🏡 Local</button>
				</div>

				<!-- Active level description -->
				<div style="font-size: 0.65rem; color: #94a3b8; padding: 0 0.2rem; font-style: italic;">
					${activeLogTab === "global" ? "🌍 Showing global events and world milestones." : ""}
					${activeLogTab === "regional" ? `🏰 Showing logs inside region: <strong>${activeRegion?.name || "None"}</strong>.` : ""}
					${activeLogTab === "local" ? `🏡 Showing local logs inside zone: <strong>${activeLocal?.name || "None"}</strong>.` : ""}
				</div>

				<!-- Log Messages Viewer -->
				<div id="lodLogsContainer" style="height: 140px; overflow-y: auto; background: #111115; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 0.4rem; display: flex; flex-direction: column; gap: 0.35rem; box-sizing: border-box;">
					${
						activeLogs.length === 0
							? `
						<div style="color: #475569; text-align: center; margin-top: 2rem; font-style: italic; font-size: 0.7rem;">No logs recorded at this level yet. Advance ticks to trigger events!</div>
					`
							: activeLogs
									.map(
										(log: any) => `
						<div style="border-bottom: 1px dashed rgba(255,255,255,0.03); padding-bottom: 0.3rem; font-size: 0.7rem; line-height: 1.3;">
							<div style="display: flex; justify-content: space-between; font-weight: bold; color: #94a3b8; font-size: 0.62rem; margin-bottom: 0.1rem;">
								<span>${log.time}</span>
							</div>
							<div style="color: #cbd5e1;">${log.msg}</div>
						</div>
					`,
									)
									.join("")
					}
				</div>
			</div>

			<!-- Travel Cost Reference Box -->
			<div style="background: rgba(56, 189, 248, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.15); font-size: 0.7rem; color: #93c5fd; margin-top: 0.4rem; line-height: 1.35;">
				<strong style="color: #38bdf8;">🥾 Local Travel Cost Guide:</strong><br/>
				• Local Cell Area: <strong>~510 km²</strong> (A day's travel)<br/>
				• 🛣️ With Road: <strong>0.5 Days Travel</strong> per cell<br/>
				• 🌲 No Road (Wild): <strong>1.0 Day Travel</strong> per cell
			</div>
		`;

		// ------------------ EVENT LISTENERS ------------------

		// Tab selections
		document.getElementById("lodTabGlobal")?.addEventListener("click", () => {
			activeLogTab = "global";
			renderLODPanel(store.getState());
		});
		document.getElementById("lodTabRegional")?.addEventListener("click", () => {
			activeLogTab = "regional";
			renderLODPanel(store.getState());
		});
		document.getElementById("lodTabLocal")?.addEventListener("click", () => {
			activeLogTab = "local";
			renderLODPanel(store.getState());
		});

		// Region selection dropdown change
		const regionSelect = document.getElementById(
			"lodRegionSelect",
		) as HTMLSelectElement;
		regionSelect?.addEventListener("change", (e: any) => {
			const id = parseInt(e.target.value);
			store.updateState({ activeRegionId: id });
		});

		// Local selection dropdown change
		const localSelect = document.getElementById(
			"lodLocalSelect",
		) as HTMLSelectElement;
		localSelect?.addEventListener("change", (e: any) => {
			const id = parseInt(e.target.value);
			store.updateState({ activeLocalId: id });
		});

		// Region Rename Input Listener
		const regionNameInput = document.getElementById(
			"lodRegionNameInput",
		) as HTMLInputElement;
		const handleRegionRename = () => {
			const newName = regionNameInput.value.trim();
			if (!newName) return;
			const s = store.getState() as any;
			const updatedRegions = s.regions.map((r: any) => {
				if (r.id === activeRegion?.id) {
					return { ...r, name: newName };
				}
				return r;
			});
			store.updateState({ regions: updatedRegions });
			renderCurrentLayer();
		};
		regionNameInput?.addEventListener("change", handleRegionRename);
		regionNameInput?.addEventListener("blur", handleRegionRename);
		regionNameInput?.addEventListener("keyup", (e) => {
			if (e.key === "Enter") handleRegionRename();
		});

		// Local Zone Rename Input Listener
		const localNameInput = document.getElementById(
			"lodLocalNameInput",
		) as HTMLInputElement;
		const handleLocalRename = () => {
			const newName = localNameInput.value.trim();
			if (!newName) return;
			const s = store.getState() as any;
			const updatedRegions = s.regions.map((r: any) => {
				if (r.id === activeRegion?.id) {
					const updatedLocalZones = r.localZones.map((lz: any) => {
						if (lz.id === activeLocal?.id) {
							return { ...lz, name: newName };
						}
						return lz;
					});
					return { ...r, localZones: updatedLocalZones };
				}
				return r;
			});
			store.updateState({ regions: updatedRegions });
			renderCurrentLayer();
		};
		localNameInput?.addEventListener("change", handleLocalRename);
		localNameInput?.addEventListener("blur", handleLocalRename);
		localNameInput?.addEventListener("keyup", (e) => {
			if (e.key === "Enter") handleLocalRename();
		});

		// Fly to Region button click
		document
			.getElementById("lodFlyRegionBtn")
			?.addEventListener("click", () => {
				const s = store.getState();
				const r = s.regions?.find(
					(x: any) => x.id === parseInt(regionSelect.value),
				);
				if (r) {
					const nextZoom = 4.5;
					store.updateState({
						zoom: nextZoom,
						offsetX: canvas.width / 2 - r.centerX * nextZoom,
						offsetY: canvas.height / 2 - r.centerY * nextZoom,
						activeRegionId: r.id,
					});
					renderCurrentLayer();
				}
			});

		// Fly to Local Zone button click
		document.getElementById("lodFlyLocalBtn")?.addEventListener("click", () => {
			const s = store.getState();
			const r = s.regions?.find(
				(x: any) => x.id === parseInt(regionSelect.value),
			);
			if (r) {
				const lz = r.localZones?.find(
					(x: any) => x.id === parseInt(localSelect.value),
				);
				if (lz) {
					const nextZoom = 12.0;
					store.updateState({
						zoom: nextZoom,
						offsetX: canvas.width / 2 - lz.centerX * nextZoom,
						offsetY: canvas.height / 2 - lz.centerY * nextZoom,
						activeRegionId: r.id,
						activeLocalId: lz.id,
					});
					renderCurrentLayer();
				}
			}
		});
	}

	updateCanvasSize();
	if ((window as any).getCurrentSetupConfig) {
		runSimulation((window as any).getCurrentSetupConfig());
	}

	window.addEventListener("resize", () => {
		updateCanvasSize();
		renderCurrentLayer();
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "c" && e.ctrlKey) {
			openConfigurator();
		} else if (e.key === "z" && e.ctrlKey) {
			restoreSnapshot();
		} else if (e.key === "m" && e.ctrlKey) {
			openMemoryViewer();
		}
	});
}
