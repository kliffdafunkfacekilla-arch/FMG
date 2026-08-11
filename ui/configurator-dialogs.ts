import { store } from "../state/store";

export interface SetupConfig {
  canvasWidth: number;
  canvasHeight: number;
  seed: string;
  cellsCount: number;
  mapName: string;
  year: number;
  era: string;
  heightmapType: string;
  culturesCount: number;
  statesCount: number;
  provincesRatio: number;
  sizeVariety: number;
  growthRate: number;
  townsCount: number;
  religionsCount: number;
  tempEquator: number;
  windsAngle: number;
  precipitationInput: number;
  distanceUnit: string;
}

export function mountConfigurator(containerId: string, onConfigChange: (config: SetupConfig) => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="configPanel" style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 0.8rem; border-radius: 12px; font-size: 0.82rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.6rem;">
      
      <!-- 1. MAP SETTINGS -->
      <details open style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
        <summary style="font-weight: bold; color: #fbbf24; cursor: pointer; user-select: none; font-size: 0.88rem;">1. Map Settings</summary>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.4rem;">
          
          <!-- Canvas Size -->
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Canvas Width:</label>
              <input id="canvasWidth" type="number" value="1000" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Canvas Height:</label>
              <input id="canvasHeight" type="number" value="650" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <!-- Seed & Cells -->
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <div style="flex: 1; display: flex; flex-direction: column;">
              <label style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.75rem;">
                <span>Map Seed:</span>
                <button id="seedHistoryBtn" style="background: none; border: none; color: #a855f7; cursor: pointer; font-size: 0.75rem; padding: 0;">History 🕒</button>
              </label>
              <input id="mapSeed" type="text" value="seed-12345" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.75rem;">
                <span>Points:</span>
                <span id="lblPointsCount" style="color: #fbbf24;">10000</span>
              </label>
              <input id="pointsCountSlider" type="range" min="1000" max="100000" step="1000" value="10000" style="width: 100%; cursor: pointer;" />
            </div>
          </div>

          <!-- Name & Date -->
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 2;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Map Name:</label>
              <input id="mapName" type="text" value="New World" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Year:</label>
              <input id="mapYear" type="number" value="100" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <!-- Era & Heightmap Types -->
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Era label:</label>
              <input id="mapEra" type="text" value="Common Era" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Heightmap Type:</label>
              <select id="heightmapType" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
                <option value="Continents" selected>Continents</option>
                <option value="High Island">High Island</option>
                <option value="Low Island">Low Island</option>
                <option value="Archipelago">Archipelago</option>
                <option value="Atoll">Atoll</option>
                <option value="Volcano">Volcano</option>
              </select>
            </div>
          </div>

          <!-- Cultures & States -->
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Cultures Count:</label>
              <input id="numCultures" type="number" min="1" max="100" value="6" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">States Count:</label>
              <input id="numStates" type="number" min="0" max="100" value="8" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <!-- Provinces Ratio, Size Variety & Growth -->
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Provinces Ratio:</label>
              <input id="numProvinces" type="number" min="0" max="100" value="30" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Size Variety:</label>
              <input id="sizeVariety" type="number" step="0.1" min="0.1" max="10" value="1.5" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Growth Rate:</label>
              <input id="growthRate" type="number" step="0.1" min="0.1" max="2" value="1.0" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Towns Count:</label>
              <input id="townsCount" type="number" min="0" max="999" value="30" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
          </div>

          <!-- Religions -->
          <div>
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Religions Count (0-50):</label>
            <input id="numReligions" type="number" min="0" max="50" value="5" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>

          <button id="regenNewMapBtn" style="background: #3b82f6; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem; width: 100%; margin-top: 0.2rem;">
            🎲 Generate New Map
          </button>
        </div>
      </details>

      <!-- 2. CONFIGURE WORLD (CLIMATE / UNITS / CALENDAR POPUP TRIGGER) -->
      <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
        <label style="font-weight: bold; color: #fbbf24; font-size: 0.88rem;">2. Configure World</label>
        <button id="openClimateBtn" style="width: 100%; text-align: left; background: #3b82f6; border: none; color: white; padding: 0.35rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 4px;">🌍 Configure World</button>
      </div>

      <!-- Climate Popup Modal -->
      <div id="climatePopupModal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: rgba(20, 20, 25, 0.98); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 1.2rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 300px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); flex-direction: column; gap: 0.8rem; pointer-events: auto;">
        <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem;">
          <span>Configure World</span>
          <span id="closeClimateModalBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.2rem;">&times;</span>
        </h3>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label style="color: #cbd5e1; font-size: 0.75rem;">Distance Unit:</label>
          <select id="distanceUnit" style="padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
            <option value="miles">Miles</option>
            <option value="kms" selected>Kilometers</option>
            <option value="leagues">Leagues</option>
          </select>
        </div>
        
        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Globe Position (Latitudes):</span>
            <span id="lblLatitudes" style="font-weight: bold; color: #a855f7;">0° - 100°</span>
          </label>
          <div style="display: flex; gap: 0.2rem;">
            <input id="slideLatNorth" type="range" min="-90" max="90" value="90" style="width: 50%; cursor: pointer;" />
            <input id="slideLatSouth" type="range" min="-90" max="90" value="-10" style="width: 50%; cursor: pointer;" />
          </div>
        </div>

        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Equator Temperature (°C):</span>
            <span id="lblTemp" style="font-weight: bold; color: #a855f7;">28</span>
          </label>
          <input id="slideTemp" type="range" min="15" max="40" value="28" style="width: 100%; cursor: pointer;" />
        </div>

        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Wind Angle (Direction °):</span>
            <span id="lblWind" style="font-weight: bold; color: #a855f7;">225</span>
          </label>
          <input id="slideWind" type="range" min="0" max="360" value="225" style="width: 100%; cursor: pointer;" />
        </div>

        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Precipitation (0-200%):</span>
            <span id="lblPrec" style="font-weight: bold; color: #a855f7;">100%</span>
          </label>
          <input id="slidePrec" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
        </div>

        <button id="openCalendarEditorBtn" style="width: 100%; text-align: left; background: #3b82f6; border: none; color: white; padding: 0.5rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 6px;">📅 Config Custom Calendar</button>

        <button id="updateClimateBtn" style="background: #3b82f6; border: none; padding: 0.5rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.8rem; width: 100%; margin-top: 0.2rem;">
          🔄 Update Map Climate
        </button>
      </div>

    </div>
  `;

  // Get inputs
  const canvasWidth = document.getElementById("canvasWidth") as HTMLInputElement;
  const canvasHeight = document.getElementById("canvasHeight") as HTMLInputElement;
  const mapSeed = document.getElementById("mapSeed") as HTMLInputElement;
  const pointsCountSlider = document.getElementById("pointsCountSlider") as HTMLInputElement;
  const lblPointsCount = document.getElementById("lblPointsCount") as HTMLSpanElement;
  const mapName = document.getElementById("mapName") as HTMLInputElement;
  const mapYear = document.getElementById("mapYear") as HTMLInputElement;
  const mapEra = document.getElementById("mapEra") as HTMLInputElement;
  const heightmapType = document.getElementById("heightmapType") as HTMLSelectElement;
  const numCultures = document.getElementById("numCultures") as HTMLInputElement;
  const numStates = document.getElementById("numStates") as HTMLInputElement;
  const numProvinces = document.getElementById("numProvinces") as HTMLInputElement;
  const sizeVariety = document.getElementById("sizeVariety") as HTMLInputElement;
  const growthRate = document.getElementById("growthRate") as HTMLInputElement;
  const townsCount = document.getElementById("townsCount") as HTMLInputElement;
  const numReligions = document.getElementById("numReligions") as HTMLInputElement;
  const distanceUnit = document.getElementById("distanceUnit") as HTMLSelectElement;

  const slideLatNorth = document.getElementById("slideLatNorth") as HTMLInputElement;
  const slideLatSouth = document.getElementById("slideLatSouth") as HTMLInputElement;
  const lblLatitudes = document.getElementById("lblLatitudes") as HTMLSpanElement;
  const slideTemp = document.getElementById("slideTemp") as HTMLInputElement;
  const lblTemp = document.getElementById("lblTemp") as HTMLSpanElement;
  const slideWind = document.getElementById("slideWind") as HTMLInputElement;
  const lblWind = document.getElementById("lblWind") as HTMLSpanElement;
  const slidePrec = document.getElementById("slidePrec") as HTMLInputElement;
  const lblPrec = document.getElementById("lblPrec") as HTMLSpanElement;

  const regenBtn = document.getElementById("regenNewMapBtn") as HTMLButtonElement;
  const updateClimateBtn = document.getElementById("updateClimateBtn") as HTMLButtonElement;
  const seedHistoryBtn = document.getElementById("seedHistoryBtn") as HTMLButtonElement;

  // Sliders display updating
  if(pointsCountSlider) pointsCountSlider.addEventListener("input", () => { lblPointsCount.innerText = pointsCountSlider.value; });
  const updateLatitudesLabel = () => { if(lblLatitudes) lblLatitudes.innerText = `${slideLatNorth.value}° - ${slideLatSouth.value}°`; };
  if(slideLatNorth) slideLatNorth.addEventListener("input", updateLatitudesLabel);
  if(slideLatSouth) slideLatSouth.addEventListener("input", updateLatitudesLabel);
  slideTemp.addEventListener("input", () => { lblTemp.innerText = slideTemp.value; });
  slideWind.addEventListener("input", () => { lblWind.innerText = slideWind.value; });
  slidePrec.addEventListener("input", () => { lblPrec.innerText = slidePrec.value + "%"; });

  // Generate unique seed helper
  const rollSeed = () => "map-" + Math.floor(Math.random() * 1000000);
  mapSeed.value = rollSeed();

  const getConfig = (): SetupConfig => ({
    canvasWidth: parseInt(canvasWidth.value, 10) || window.innerWidth,
    canvasHeight: parseInt(canvasHeight.value, 10) || window.innerHeight,
    seed: mapSeed.value || rollSeed(),
    cellsCount: parseInt(pointsCountSlider?.value, 10) || 10000,
    mapName: mapName.value || "New World",
    year: parseInt(mapYear.value, 10) || 100,
    era: mapEra.value || "Common Era",
    heightmapType: heightmapType.value,
    culturesCount: parseInt(numCultures.value, 10) || 6,
    statesCount: parseInt(numStates.value, 10) || 8,
    provincesRatio: parseInt(numProvinces.value, 10) || 30,
    sizeVariety: parseFloat(sizeVariety.value) || 1.5,
    growthRate: parseFloat(growthRate.value) || 1.0,
    townsCount: parseInt(townsCount.value, 10) || 30,
    religionsCount: parseInt(numReligions.value, 10) || 5,
    tempEquator: parseInt(slideTemp.value, 10),
    windsAngle: parseInt(slideWind.value, 10),
    precipitationInput: parseInt(slidePrec.value, 10),
    distanceUnit: distanceUnit?.value || "kms"
  });

  // Action listeners
  const openClimateBtn = document.getElementById("openClimateBtn") as HTMLButtonElement;
  const climatePopup = document.getElementById("climatePopupModal") as HTMLDivElement;
  const closeClimateBtn = document.getElementById("closeClimateModalBtn") as HTMLSpanElement;

  if (openClimateBtn && climatePopup) {
    openClimateBtn.addEventListener("click", () => {
      climatePopup.style.display = "flex";
    });
  }

  if (closeClimateBtn && climatePopup) {
    closeClimateBtn.addEventListener("click", () => {
      climatePopup.style.display = "none";
    });
  }

  regenBtn.addEventListener("click", () => {
    onConfigChange(getConfig());
  });

  updateClimateBtn.addEventListener("click", () => {
    const win = window as any;
    if (win.runClimateRegen) {
      win.runClimateRegen(parseInt(slideTemp.value, 10), parseInt(slideWind.value, 10), parseInt(slidePrec.value, 10));
    }
    if (climatePopup) {
      climatePopup.style.display = "none";
    }
  });

  if(seedHistoryBtn) {
    seedHistoryBtn.addEventListener("click", () => {
      alert("Seed History functionality would open here.");
    });
  }

  // Calendar editor now lives inside the Configure World modal
  const openCalendarEditorBtn = document.getElementById("openCalendarEditorBtn") as HTMLButtonElement;
  if (openCalendarEditorBtn) {
    openCalendarEditorBtn.addEventListener("click", () => {
      if ((window as any).openCalendarEditor) {
        (window as any).openCalendarEditor();
      }
    });
  }

  (window as any).getCurrentSetupConfig = getConfig;
}
