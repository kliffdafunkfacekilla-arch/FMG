import { generateJitteredGrid } from "../../simulation/grid/grid-generator";
import { HeightmapGenerator } from "../../simulation/heightmap/heightmap-generator";
import { generateClimate } from "../../simulation/climate/climate-generator";
import { generateHydrology } from "../../simulation/hydrology/hydrology-generator";
import { generateBiomes } from "../../simulation/biomes/biomes-generator";
import { generateCultures } from "../../simulation/civilization/culture-generator";
import { generateBurgs } from "../../simulation/civilization/burg-generator";
import { generateStates } from "../../simulation/civilization/state-generator";
import { generateRoutes } from "../../simulation/civilization/route-generator";
import { generateProvinces } from "../../simulation/civilization/province-generator";
import { generateMilitary } from "../../simulation/civilization/military-generator";
import { generateReligions } from "../../simulation/civilization/religions-generator";
import { generateZones } from "../../simulation/civilization/zones-generator";
import { generateMarkers } from "../../simulation/civilization/markers-generator";
import { bakeErosion } from "../../simulation/heightmap/erosion-bake";
import { generateGoods } from "../../simulation/civilization/goods-generator";
import { generateMarkets } from "../../simulation/civilization/markets-generator";
import { runProductionCycles } from "../../simulation/civilization/production-generator";
import { serializeMapState, deserializeMapState } from "../../core/serialization";
import { store } from "../../state/store";
import { renderMap } from "../../renderer/canvas-renderer";
import { drawMinimap } from "../../renderer/minimap-renderer";
import { ThreeRenderer } from "../../renderer/three-renderer";
import { mountBurgEditor } from "../../ui/burg-editor";
import { mountStateEditor } from "../../ui/state-editor";
import { mountConfigurator, SetupConfig } from "../../ui/configurator-dialogs";
import { mountStyleAndBiomeEditor } from "../../ui/dialogs-sections";
import { mountHeightBrush } from "../../ui/heightmap-brush";
import { mountImageImporter } from "../../ui/image-importer";
import { mountLabelEditor } from "../../ui/label-editor";
import { mountExportOptions } from "../../ui/export-options";
import { mountLanguageEditor } from "../../ui/language-editor";
import { mountBurgTypeEditor } from "../../ui/burg-type-editor";
import { mountMilitaryUnitEditor } from "../../ui/military-unit-editor";
import { mountRouteEditor } from "../../ui/route-editor";
import { SimulationLoop } from "../../simulation/time/simulation-loop";
import { mountCalendarEditor } from "../../ui/calendar-editor";


console.log("FMG Full-Stack Rebuild Frontend Initialized.");

const app = document.getElementById("app");
let currentLayer: "heightmap" | "biomes" | "temp" | "prec" | "cultures" | "states" | "provinces" | "religions" | "goods" = "states";
let socket: WebSocket | null = null;
let currentSessionId = "session-" + Math.floor(Math.random() * 100000);
let is3DMode = false;
let threeRenderer: ThreeRenderer | null = null;

(window as any).triggerLayerSelect = (layer: any) => {
  currentLayer = layer;
  const btns = document.querySelectorAll(".layerBtn");
  btns.forEach(b => {
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

function findClosestCellIndex(x: number, y: number, points: [number, number][]): number {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[i];
    const dist = Math.pow(x - px, 2) + Math.pow(y - py, 2);
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
      <div id="options" style="display: none; flex-direction: column; background: rgba(30, 30, 38, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; pointer-events: auto; max-height: 80vh; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Tabs headers -->
        <div class="tab" style="display: flex; background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
          <button id="optionsHide" class="options" style="background: transparent; color: #ef4444; border: none; padding: 0.8rem; font-weight: bold; cursor: pointer; font-size: 1.1rem;">◄</button>
          <button id="layersTab" class="tablinks active" style="flex: 1; padding: 0.8rem 0.2rem; background: transparent; border: none; color: #e2e8f0; font-weight: 600; cursor: pointer; font-size: 0.85rem; border-bottom: 2px solid transparent;">Layers</button>
          <button id="toolsTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.2rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.85rem; border-bottom: 2px solid transparent;">Tools</button>
          <button id="configTab" class="tablinks" style="flex: 1; padding: 0.8rem 0.2rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.85rem; border-bottom: 2px solid transparent;">Config</button>
        </div>

        <!-- Layers Content -->
        <div id="layersContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.8rem;">
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

          <!-- Checkboxes Layer Selector -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.6rem; color: #cbd5e1;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="chkStates" checked /> Political Borders
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="chkBurgs" checked /> Burgs & Cities
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="chkRoutes" checked /> Routes & Roads
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="chkReligions" /> Religions
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="chkBiomes" /> Biomes
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="chkHeightmap" /> Heightmap
            </label>
          </div>

          <div id="styleBiomesMount"></div>

          <!-- Radar Minimap inside Layers Tab -->
          <div style="background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.08); padding: 0.8rem; border-radius: 8px; display: flex; flex-direction: column; align-items: center; margin-top: 0.5rem;">
            <h5 style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: #94a3b8;">Radar Minimap</h5>
            <canvas id="minimapCanvas" width="180" height="120" style="background: #08080a; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; display: block;"></canvas>
          </div>
        </div>

        <!-- Tools Tab Content -->
        <div id="toolsContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem;">
          <h4 style="margin: 0; color: #10b981; font-size: 0.95rem;">Brushes & Editors</h4>
          <div id="brushMount"></div>
          <div id="burgEditorMount"></div>
          <div id="stateEditorMount"></div>
          <div id="routeEditorMount"></div>
          <div id="labelMount"></div>
        </div>

        <!-- Config Tab Content -->
        <div id="configContent" class="tabcontent" style="padding: 1rem; overflow-y: auto; display: none; flex-direction: column; gap: 0.8rem;">
          <h4 style="margin: 0; color: #fbbf24; font-size: 0.95rem;">World Setup</h4>
          <div id="configuratorMount"></div>
          <div id="importerMount"></div>
          <div id="languageMount"></div>
          <div id="exporterMount"></div>
          <div id="burgTypeMount"></div>
          <div id="militaryUnitMount"></div>
           
           <h4 style="margin: 0.8rem 0 0.4rem 0; color: #fbbf24; font-size: 0.95rem;">Calendar & Celestial Options</h4>
           <button id="openCalendarEditorBtn" style="width: 100%; text-align: left; background: #2563eb; border: none; color: white; padding: 0.35rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 4px; margin-bottom: 0.8rem;">📅 Config Custom Calendar</button>
           <div id="calendarMount"></div>

           <h4 style="margin: 0.5rem 0 0.4rem 0; color: #fbbf24; font-size: 0.95rem;">Time Controls</h4>
           <div style="display: flex; gap: 0.4rem; margin-bottom: 0.8rem;">
             <button id="tickDayBtn" style="flex: 1; padding: 0.35rem; background: #eab308; color: black; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Day</button>
             <button id="tickMonthBtn" style="flex: 1; padding: 0.35rem; background: #3b82f6; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Month</button>
             <button id="tickYearBtn" style="flex: 1; padding: 0.35rem; background: #10b981; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">+1 Year</button>
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
  const minimapCanvas = document.getElementById("minimapCanvas") as HTMLCanvasElement;
  const threeContainer = document.getElementById("threeContainer") as HTMLDivElement;
  const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;
  const toggle3DBtn = document.getElementById("toggle3DBtn") as HTMLButtonElement;
  const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
  const loadBtn = document.getElementById("loadBtn") as HTMLButtonElement;
  const fileInput = document.getElementById("fileInput") as HTMLInputElement;
  const statsEl = document.getElementById("stats") as HTMLDivElement;
  const statusEl = document.getElementById("connectionStatus") as HTMLSpanElement;

  // Mount Editors & Panels
  mountBurgEditor("burgEditorMount", () => renderCurrentLayer());
  mountStateEditor("stateEditorMount", () => {
    renderCurrentLayer();
    if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
  });

  mountHeightBrush("brushMount");
  mountImageImporter("importerMount", () => {
    renderCurrentLayer();
    if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());
  });

  mountLabelEditor("labelMount", () => renderCurrentLayer());
  mountExportOptions("exporterMount", canvas);

  mountStyleAndBiomeEditor("styleBiomesMount", () => renderCurrentLayer());

  mountLanguageEditor("languageMount");
  mountBurgTypeEditor("burgTypeMount");
  mountMilitaryUnitEditor("militaryUnitMount");
  mountRouteEditor("routeEditorMount", () => {
    renderCurrentLayer();
  });

  // Mount Custom Calendar Editor
  mountCalendarEditor("calendarMount", () => {
    if ((window as any).simulationLoop) {
      // Re-get calendar state and push update to display
      const currentCal = (window as any).simulationLoop.getCalendar();
      store.updateState({ calendar: currentCal });
      updateCalendarText();
    }
  });

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
    const monthName = currentMonth ? currentMonth.name : `Month ${calendar.month + 1}`;
    
    // Moon phase displays
    const moonsStr = calendar.moonPhases.map(m => `🌙 ${m.moonName}: ${m.phaseName} (${m.modifier.toFixed(1)}x)`).join(", ");
    
    // Mods preview
    const activeMods = calendar.activeModifiers;
    const modsStr = activeMods ? `<span style="color: #60a5fa; margin-left: 10px;">[Temp: ${activeMods.tempMod >= 0 ? "+" : ""}${activeMods.tempMod}°C, Growth: ${activeMods.popMod}x, Prod: ${activeMods.prodMod.toFixed(1)}x]</span>` : "";

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
      const totalDays = state.months.reduce((sum, m) => sum + m.weekCount * weekdaysLength, 0) || 360;
      handleTimeTick(totalDays * 24);
    });
  }
  if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());

  // Wire up collapsible trigger logic
  const optionsTrigger = document.getElementById("optionsTrigger") as HTMLButtonElement;
  const optionsHide = document.getElementById("optionsHide") as HTMLButtonElement;
  const optionsPanel = document.getElementById("options") as HTMLDivElement;
  const collapsibleWrap = document.getElementById("collapsible") as HTMLDivElement;

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
  const tabs = ["layersTab", "toolsTab", "configTab"];
  const contents = ["layersContent", "toolsContent", "configContent"];

  tabs.forEach((tabId, idx) => {
    const tabBtn = document.getElementById(tabId) as HTMLButtonElement;
    if (tabBtn) {
      tabBtn.addEventListener("click", () => {
        tabs.forEach(tId => {
          const btn = document.getElementById(tId) as HTMLButtonElement;
          if (btn) {
            btn.classList.remove("active");
            btn.style.color = "#94a3b8";
            btn.style.borderBottomColor = "transparent";
          }
        });
        contents.forEach(cId => {
          const div = document.getElementById(cId) as HTMLDivElement;
          if (div) div.style.display = "none";
        });

        tabBtn.classList.add("active");
        tabBtn.style.color = "#e2e8f0";
        tabBtn.style.borderBottomColor = "#3b82f6";
        const targetContent = document.getElementById(contents[idx]) as HTMLDivElement;
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
              state.heights[cellId] = Math.min(Math.max(Math.round(changes.height * 100), 0), 100);
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

    setTimeout(() => {
      try {
        const t0 = performance.now();
        const width = canvas.width;
        const height = canvas.height;
        const seed = "map-" + Math.floor(Math.random() * 1000000);

        const grid = generateJitteredGrid(width, height, config.cellsCount, seed);
        const hg = new HeightmapGenerator(grid, width, height, seed);
        let rawHeights = hg.executeTemplate(`
          Hill 1 80-85 60-80 40-60
          Hill 1 80-85 20-30 40-60
          Hill 6-7 15-30 25-75 15-85
          Multiply 0.6 land 0 0
          Hill 8-10 5-10 15-85 20-80
          Range 1-2 35-55 5-95 20-80
          Strait 1 vertical 0 0
          Smooth 3 0 0 0
          Mask 3 0 0 0
        `);

        const climateOpts = {
          temperatureEquator: config.tempEquator,
          temperatureNorthPole: -30,
          temperatureSouthPole: -15,
          winds: [config.windsAngle, 45, 225, 315, 135, 315],
          precInput: config.precipitationInput
        };
        const { temp, prec } = generateClimate(grid, rawHeights, width, height, climateOpts);
        const hydro = generateHydrology(grid, rawHeights, prec);
        const heights = bakeErosion(grid, hydro.heights, hydro.flowDirections, 3);
        const biomes = generateBiomes(grid, heights, temp, prec, hydro.rivers);
        const { cultures, cellCultures } = generateCultures(grid, heights, biomes, 6, seed, hydro.flux, hydro.rivers);
        const burgs = generateBurgs(grid, heights, biomes, hydro.rivers, hydro.flux, config.burgsCount, cellCultures, cultures);
        const { states, cellStates } = generateStates(grid, heights, cellCultures, burgs, config.statesCount, biomes, hydro.rivers, hydro.flux, undefined, cultures);
        const routes = generateRoutes(grid, heights, burgs);
        const { provinces, cellProvinces } = generateProvinces(grid, heights, cellStates, burgs, states);
        const military = generateMilitary(grid, heights, cellStates, states, burgs);
        const { religions, cellReligions } = generateReligions(grid, heights, cellCultures, config.religionsCount, seed);
        const zones = generateZones(grid, heights, seed);
        const markers = generateMarkers(grid, heights, biomes, seed);

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
          labels: []
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

  const renderCurrentLayer = () => {
    if (!canvas || is3DMode) return;
    renderMap(canvas, store.getState(), currentLayer);
  };

  const ensureToolsTabVisible = () => {
    const optionsPanel = document.getElementById("options") as HTMLDivElement;
    const collapsibleWrap = document.getElementById("collapsible") as HTMLDivElement;
    if (optionsPanel && collapsibleWrap) {
      optionsPanel.style.display = "flex";
      collapsibleWrap.style.display = "none";
    }
    const toolsTabBtn = document.getElementById("toolsTab") as HTMLButtonElement;
    if (toolsTabBtn) {
      toolsTabBtn.click();
    }
  };

  canvas.addEventListener("mousedown", (e) => {
    if (is3DMode) return;
    const state = store.getState() as any;
    if (!state.grid || !state.heights) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (state.burgs) {
      for (const b of state.burgs) {
        const dist = Math.hypot(b.x - clickX, b.y - clickY);
        if (dist < 12) {
          ensureToolsTabVisible();
          (window as any).openBurgEditor(b);
          return;
        }
      }
    }

    const cellId = findClosestCellIndex(clickX, clickY, state.grid.points);

    if (state.routes) {
      for (const r of state.routes) {
        if (r.path && r.path.includes(cellId)) {
          ensureToolsTabVisible();
          (window as any).openRouteEditor(r);
          return;
        }
      }
    }
    const sId = state.cellStates ? state.cellStates[cellId] : 0;
    if (sId > 0 && state.states) {
      const activeState = state.states.find((s: any) => s.id === sId);
      if (activeState) {
        ensureToolsTabVisible();
        (window as any).openStateEditor(activeState);
        return;
      }
    }

    const brush = (window as any).getCurrentBrushConfig();
    const originalHeight = state.heights[cellId];
    let newHeight = originalHeight;

    if (brush.mode === "add") {
      newHeight = Math.min(originalHeight + 15, 100);
    } else if (brush.mode === "sub") {
      newHeight = Math.max(originalHeight - 15, 0);
    } else if (brush.mode === "set") {
      newHeight = brush.value;
    } else if (brush.mode === "smooth") {
      const neighbors = state.grid.cells.c[cellId] || [];
      const sum = neighbors.reduce((acc: number, n: number) => acc + state.heights[n], originalHeight);
      newHeight = Math.round(sum / (neighbors.length + 1));
    }

    state.heights[cellId] = newHeight;
    renderCurrentLayer();
    if (minimapCanvas) drawMinimap(minimapCanvas, store.getState());

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        op: "MUTATE_CELL",
        cellId,
        changes: { height: newHeight / 100.0 }
      }));
    }
  });

  const layersPresetSelect = document.getElementById("layersPreset") as HTMLSelectElement;
  if (layersPresetSelect) {
    layersPresetSelect.addEventListener("change", () => {
      const selectedLayer = layersPresetSelect.value as any;
      currentLayer = selectedLayer;
      
      const chkStates = document.getElementById("chkStates") as HTMLInputElement;
      const chkBiomes = document.getElementById("chkBiomes") as HTMLInputElement;
      const chkHeightmap = document.getElementById("chkHeightmap") as HTMLInputElement;
      const chkReligions = document.getElementById("chkReligions") as HTMLInputElement;

      if (chkStates) chkStates.checked = selectedLayer === "states" || selectedLayer === "provinces" || selectedLayer === "cultures";
      if (chkBiomes) chkBiomes.checked = selectedLayer === "biomes";
      if (chkHeightmap) chkHeightmap.checked = selectedLayer === "heightmap" || selectedLayer === "temp" || selectedLayer === "prec";
      if (chkReligions) chkReligions.checked = selectedLayer === "religions";

      renderCurrentLayer();
    });
  }

  const checkboxes = ["chkStates", "chkBurgs", "chkRoutes", "chkReligions", "chkBiomes", "chkHeightmap"];
  checkboxes.forEach(id => {
    const chk = document.getElementById(id) as HTMLInputElement;
    if (chk) {
      chk.addEventListener("change", () => {
        if (id === "chkHeightmap" && chk.checked) {
          currentLayer = "heightmap";
          if (layersPresetSelect) layersPresetSelect.value = "heightmap";
        } else if (id === "chkBiomes" && chk.checked) {
          currentLayer = "biomes";
          if (layersPresetSelect) layersPresetSelect.value = "biomes";
        } else if (id === "chkStates" && chk.checked) {
          currentLayer = "states";
          if (layersPresetSelect) layersPresetSelect.value = "states";
        } else if (id === "chkReligions" && chk.checked) {
          currentLayer = "religions";
          if (layersPresetSelect) layersPresetSelect.value = "religions";
        }
        renderCurrentLayer();
      });
    }
  });

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

export {};
