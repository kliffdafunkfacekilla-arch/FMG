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
	tempNorthPole: number;
	tempSouthPole: number;
	windsAngle: number;
	precipitationInput: number;
	distanceUnit: string;
	enableUnderwater: boolean;
	underwaterCount: number;
}

// Default winds for the 6 latitude tiers (N pole -> S pole), matching the
// climate generator's expectation.
const DEFAULT_WINDS = [225, 45, 225, 315, 135, 315];

// Base map scale used for the info block. Kilometers covered by a single
// canvas pixel; converted to the selected distance unit at display time.
const KM_PER_PIXEL = 0.61;
const EARTH_MERIDIAN_KM = 20004; // pole-to-pole meridian length

interface DistanceUnitInfo {
	label: string;
	perKm: number;
}
const DISTANCE_UNITS: Record<string, DistanceUnitInfo> = {
	miles: { label: "mi", perKm: 0.621371 },
	kms: { label: "km", perKm: 1 },
	leagues: { label: "lg", perKm: 0.207123 },
};

/** Compute the latitude window (top edge, span, bottom edge) for the globe. */
function computeLatitudeWindow(
	mapSizePercent: number,
	latitudePercent: number,
) {
	const latT = (mapSizePercent / 100) * 180;
	const latN = 90 - (180 - latT) * (latitudePercent / 100);
	const latS = latN - latT;
	return { latN, latT, latS };
}

/** Sea-level temperature (°C) at a given latitude, mirroring the climate model. */
function temperatureAtLatitude(
	lat: number,
	equatorTemp: number,
	northPoleTemp: number,
	southPoleTemp: number,
): number {
	const tropics = [16, -20];
	const tropicalGradient = 0.15;
	const tempNorthTropic = equatorTemp - tropics[0] * tropicalGradient;
	const tempSouthTropic = equatorTemp + tropics[1] * tropicalGradient;
	const northernGradient =
		(tempNorthTropic - northPoleTemp) / (90 - tropics[0]);
	const southernGradient =
		(tempSouthTropic - southPoleTemp) / (90 + tropics[1]);

	if (lat <= 16 && lat >= -20) {
		return equatorTemp - Math.abs(lat) * tropicalGradient;
	}
	return lat > 0
		? tempNorthTropic - (lat - tropics[0]) * northernGradient
		: tempSouthTropic + (lat - tropics[1]) * southernGradient;
}

/** Map a temperature (°C) to a rainbow color (hot = red, cold = violet). */
function temperatureColor(temp: number): string {
	const minT = -25;
	const maxT = 32;
	const norm = Math.min(Math.max((temp - minT) / (maxT - minT), 0), 1);
	const hue = (1 - norm) * 275; // 0 = red (hot), 275 = violet (cold)
	return `hsl(${hue.toFixed(0)}, 78%, 52%)`;
}

export function mountConfigurator(
	containerId: string,
	onConfigChange: (config: SetupConfig) => void,
) {
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
                <button id="seedHistoryBtn" style="background: none; border: none; color: #60a5fa; cursor: pointer; font-size: 0.75rem; padding: 0;">History</button>
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
              <input id="mapEra" type="text" value="Common Era" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Heightmap Type:</label>
              <select id="heightmapType" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; min-width: 110px;">
                <option value="Continents" selected>Continents</option>
                <option value="High Island">High Island</option>
                <option value="Low Island">Low Island</option>
                <option value="Archipelago">Archipelago</option>
                <option value="Atoll">Atoll</option>
                <option value="Volcano">Volcano</option>
                <option value="Mediterranean">Mediterranean</option>
                <option value="Pangaea">Pangaea</option>
                <option value="Fjordland">Fjordland</option>
                <option value="Canyon">Canyon</option>
                <option value="East vs West">East vs West</option>
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

          <!-- Underwater Civilizations -->
          <div style="border: 1px solid rgba(59, 130, 246, 0.2); background: rgba(30, 41, 59, 0.4); border-radius: 6px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <input id="enableUnderwater" type="checkbox" checked style="cursor: pointer;" />
              <label for="enableUnderwater" style="color: #60a5fa; font-weight: bold; font-size: 0.76rem; cursor: pointer;">Enable Underwater Civs</label>
            </div>
            <div id="underwaterCountRow" style="display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;">
              <label style="color: #94a3b8; font-size: 0.74rem;">Underwater Civs Count:</label>
              <input id="underwaterCount" type="number" min="0" max="20" value="2" style="width: 50px; padding: 0.15rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; text-align: center;" />
            </div>
          </div>

          <button id="regenNewMapBtn" style="background: #3b82f6; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem; width: 100%; margin-top: 0.2rem;">
            Generate New Map
          </button>
        </div>
      </details>

      <!-- 2. CONFIGURE WORLD (CLIMATE / UNITS / CALENDAR POPUP TRIGGER) -->
      <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
        <label style="font-weight: bold; color: #fbbf24; font-size: 0.88rem;">2. Configure World</label>
        <button id="openClimateBtn" style="width: 100%; text-align: left; background: #3b82f6; border: none; color: white; padding: 0.35rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 4px;">Configure World</button>
      </div>

      <!-- Configure World Modal -->
      <div id="climatePopupModal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: rgba(20, 20, 25, 0.98); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 1.2rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 660px; max-width: 94vw; max-height: 92vh; overflow-y: auto; box-shadow: 0 15px 40px rgba(0,0,0,0.6); flex-direction: column; gap: 0.8rem; pointer-events: auto;">
        <h3 style="margin: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: center; font-size: 1rem;">
          <span>Configure World</span>
          <span id="closeClimateModalBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.3rem; line-height: 1;">&times;</span>
        </h3>

        <div style="display: flex; gap: 1.2rem; flex-wrap: wrap;">
          <!-- LEFT: CONTROLS -->
          <div style="flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 0.7rem;">

            <div>
              <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.78rem;">
                <span>Equator temperature:</span>
                <span id="lblEquator" style="font-weight: bold; color: #60a5fa;"></span>
              </label>
              <input id="cfgEquator" type="range" min="-5" max="40" value="27" style="width: 100%; cursor: pointer;" />
            </div>

            <div>
              <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.78rem;">
                <span>North pole temperature:</span>
                <span id="lblNorthPole" style="font-weight: bold; color: #60a5fa;"></span>
              </label>
              <input id="cfgNorthPole" type="range" min="-40" max="20" value="-25" style="width: 100%; cursor: pointer;" />
            </div>

            <div>
              <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.78rem;">
                <span>South pole temperature:</span>
                <span id="lblSouthPole" style="font-weight: bold; color: #60a5fa;"></span>
              </label>
              <input id="cfgSouthPole" type="range" min="-40" max="20" value="-25" style="width: 100%; cursor: pointer;" />
            </div>

            <div>
              <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.78rem;">
                <span>Map size:</span>
                <span id="lblMapSize" style="font-weight: bold; color: #60a5fa;"></span>
              </label>
              <input id="cfgMapSize" type="range" min="1" max="100" value="68" style="width: 100%; cursor: pointer;" />
            </div>

            <div>
              <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.78rem;">
                <span>Latitude (N&mdash;S):</span>
                <span id="lblLatitude" style="font-weight: bold; color: #60a5fa;"></span>
              </label>
              <input id="cfgLatitude" type="range" min="0" max="100" value="31" style="width: 100%; cursor: pointer;" />
            </div>

            <div>
              <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.78rem;">
                <span>Precipitation:</span>
                <span id="lblPrec" style="font-weight: bold; color: #60a5fa;"></span>
              </label>
              <input id="cfgPrec" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label style="color: #cbd5e1; font-size: 0.78rem;">Distance unit:</label>
              <select id="distanceUnit" style="padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
                <option value="miles">Miles</option>
                <option value="kms" selected>Kilometers</option>
                <option value="leagues">Leagues</option>
              </select>
            </div>

            <div id="worldInfoBlock" style="border-top: 1px solid #333; padding-top: 0.5rem; color: #94a3b8; font-size: 0.74rem; line-height: 1.5;"></div>
          </div>

          <!-- RIGHT: GLOBE -->
          <div style="flex: 0 0 auto; display: flex; align-items: flex-start; justify-content: center;">
            <svg id="worldGlobe" width="300" height="300" viewBox="0 0 320 300" role="img" aria-label="World climate globe preview"></svg>
          </div>
        </div>

        <!-- PRESET BUTTONS -->
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; border-top: 1px solid #333; padding-top: 0.7rem;">
          <button class="worldPresetBtn" data-preset="whole" style="flex: 1; min-width: 90px; background: #3b82f6; border: none; color: white; padding: 0.4rem; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">Whole World</button>
          <button class="worldPresetBtn" data-preset="northern" style="flex: 1; min-width: 90px; background: #3b82f6; border: none; color: white; padding: 0.4rem; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">Northern</button>
          <button class="worldPresetBtn" data-preset="tropical" style="flex: 1; min-width: 90px; background: #3b82f6; border: none; color: white; padding: 0.4rem; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">Tropical</button>
          <button class="worldPresetBtn" data-preset="southern" style="flex: 1; min-width: 90px; background: #3b82f6; border: none; color: white; padding: 0.4rem; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">Southern</button>
          <button class="worldPresetBtn" data-preset="winds" style="flex: 1; min-width: 90px; background: #3b82f6; border: none; color: white; padding: 0.4rem; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">Restore Winds</button>
        </div>

        <button id="openCalendarEditorBtn" style="width: 100%; text-align: left; background: #3b82f6; border: none; color: white; padding: 0.5rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 6px;">Config Custom Calendar</button>

        <!-- Inline Calendar Editor Container -->
        <div id="inlineCalendarContainer" style="display: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.6rem; background: rgba(15,15,18,0.6); margin-top: 0.4rem;"></div>

        <button id="updateClimateBtn" style="background: #3b82f6; border: none; padding: 0.55rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.82rem; width: 100%;">
          Update Map Climate
        </button>
      </div>

    </div>
  `;

	// --- Map Settings inputs ---
	const canvasWidth = document.getElementById(
		"canvasWidth",
	) as HTMLInputElement;
	const canvasHeight = document.getElementById(
		"canvasHeight",
	) as HTMLInputElement;
	const mapSeed = document.getElementById("mapSeed") as HTMLInputElement;
	const pointsCountSlider = document.getElementById(
		"pointsCountSlider",
	) as HTMLInputElement;
	const lblPointsCount = document.getElementById(
		"lblPointsCount",
	) as HTMLSpanElement;
	const mapName = document.getElementById("mapName") as HTMLInputElement;
	const mapYear = document.getElementById("mapYear") as HTMLInputElement;
	const mapEra = document.getElementById("mapEra") as HTMLInputElement;
	const heightmapType = document.getElementById(
		"heightmapType",
	) as HTMLSelectElement;
	const numCultures = document.getElementById(
		"numCultures",
	) as HTMLInputElement;
	const numStates = document.getElementById("numStates") as HTMLInputElement;
	const numProvinces = document.getElementById(
		"numProvinces",
	) as HTMLInputElement;
	const sizeVariety = document.getElementById(
		"sizeVariety",
	) as HTMLInputElement;
	const growthRate = document.getElementById("growthRate") as HTMLInputElement;
	const townsCount = document.getElementById("townsCount") as HTMLInputElement;
	const numReligions = document.getElementById(
		"numReligions",
	) as HTMLInputElement;
	const distanceUnit = document.getElementById(
		"distanceUnit",
	) as HTMLSelectElement;

	const enableUnderwater = document.getElementById(
		"enableUnderwater",
	) as HTMLInputElement;
	const underwaterCount = document.getElementById(
		"underwaterCount",
	) as HTMLInputElement;
	const underwaterCountRow = document.getElementById(
		"underwaterCountRow",
	) as HTMLDivElement;

	if (enableUnderwater && underwaterCountRow && underwaterCount) {
		enableUnderwater.addEventListener("change", () => {
			underwaterCountRow.style.opacity = enableUnderwater.checked ? "1" : "0.4";
			underwaterCount.disabled = !enableUnderwater.checked;
		});
	}

	// --- Configure World inputs ---
	const cfgEquator = document.getElementById("cfgEquator") as HTMLInputElement;
	const cfgNorthPole = document.getElementById(
		"cfgNorthPole",
	) as HTMLInputElement;
	const cfgSouthPole = document.getElementById(
		"cfgSouthPole",
	) as HTMLInputElement;
	const cfgMapSize = document.getElementById("cfgMapSize") as HTMLInputElement;
	const cfgLatitude = document.getElementById(
		"cfgLatitude",
	) as HTMLInputElement;
	const cfgPrec = document.getElementById("cfgPrec") as HTMLInputElement;
	const lblEquator = document.getElementById("lblEquator") as HTMLSpanElement;
	const lblNorthPole = document.getElementById(
		"lblNorthPole",
	) as HTMLSpanElement;
	const lblSouthPole = document.getElementById(
		"lblSouthPole",
	) as HTMLSpanElement;
	const lblMapSize = document.getElementById("lblMapSize") as HTMLSpanElement;
	const lblLatitude = document.getElementById("lblLatitude") as HTMLSpanElement;
	const lblPrec = document.getElementById("lblPrec") as HTMLSpanElement;
	const worldInfoBlock = document.getElementById(
		"worldInfoBlock",
	) as HTMLDivElement;
	const globeSvg = document.getElementById(
		"worldGlobe",
	) as unknown as SVGSVGElement;

	const regenBtn = document.getElementById(
		"regenNewMapBtn",
	) as HTMLButtonElement;
	const updateClimateBtn = document.getElementById(
		"updateClimateBtn",
	) as HTMLButtonElement;
	const seedHistoryBtn = document.getElementById(
		"seedHistoryBtn",
	) as HTMLButtonElement;

	// Mutable winds state (6 latitude tiers, N pole -> S pole).
	let winds = [...DEFAULT_WINDS];

	// --- Globe + info rendering ---------------------------------------------
	const R = 128;
	const CX = 160;
	const CY = 150;
	const latToY = (lat: number) => CY - R * Math.sin((lat * Math.PI) / 180);

	const renderGlobe = () => {
		if (!globeSvg) return;
		const equatorTemp = parseInt(cfgEquator.value, 10);
		const northPoleTemp = parseInt(cfgNorthPole.value, 10);
		const southPoleTemp = parseInt(cfgSouthPole.value, 10);
		const { latN, latS } = computeLatitudeWindow(
			parseInt(cfgMapSize.value, 10),
			parseInt(cfgLatitude.value, 10),
		);

		const parts: string[] = [];
		parts.push(
			`<defs><clipPath id="globeClip"><circle cx="${CX}" cy="${CY}" r="${R}" /></clipPath></defs>`,
		);

		// Temperature bands (clipped to the globe circle).
		parts.push(`<g clip-path="url(#globeClip)">`);
		const step = 2;
		for (let lat = 90; lat > -90; lat -= step) {
			const y0 = latToY(lat);
			const y1 = latToY(lat - step);
			const midTemp = temperatureAtLatitude(
				lat - step / 2,
				equatorTemp,
				northPoleTemp,
				southPoleTemp,
			);
			parts.push(
				`<rect x="${CX - R}" y="${y0.toFixed(2)}" width="${2 * R}" height="${(y1 - y0 + 0.6).toFixed(2)}" fill="${temperatureColor(midTemp)}" />`,
			);
		}
		// Map latitude window highlight.
		const winTop = latToY(latN);
		const winBottom = latToY(latS);
		parts.push(
			`<rect x="${CX - R}" y="${winTop.toFixed(2)}" width="${2 * R}" height="${(winBottom - winTop).toFixed(2)}" fill="none" stroke="#111" stroke-width="2.5" />`,
		);
		parts.push(`</g>`);

		// Globe outline.
		parts.push(
			`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" />`,
		);

		// Latitude gridlines + labels.
		for (const lat of [90, 60, 30, 0, -30, -60, -90]) {
			const y = latToY(lat);
			const half = R * Math.cos((lat * Math.PI) / 180);
			parts.push(
				`<line x1="${CX - half}" y1="${y.toFixed(2)}" x2="${CX + half}" y2="${y.toFixed(2)}" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="3 3" />`,
			);
			parts.push(
				`<text x="6" y="${(y + 4).toFixed(2)}" fill="#cbd5e1" font-size="11" font-family="sans-serif">${Math.abs(lat)}&#176;</text>`,
			);
		}

		// Wind arrows: 6 tiers centered at 75,45,15,-15,-45,-75.
		const tierCenters = [75, 45, 15, -15, -45, -75];
		const ax = CX + R + 16;
		tierCenters.forEach((lat, tier) => {
			const y = latToY(lat);
			const angle = winds[tier] ?? 0;
			// Draw an arrow pointing toward the wind's heading; rotate around origin.
			parts.push(
				`<g class="windArrow" data-tier="${tier}" transform="rotate(${angle}, ${ax}, ${y.toFixed(2)})" style="cursor: pointer;">
          <line x1="${ax}" y1="${(y + 8).toFixed(2)}" x2="${ax}" y2="${(y - 8).toFixed(2)}" stroke="#f8fafc" stroke-width="2" />
          <path d="M ${ax - 4} ${(y - 3).toFixed(2)} L ${ax} ${(y - 9).toFixed(2)} L ${ax + 4} ${(y - 3).toFixed(2)}" fill="none" stroke="#f8fafc" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        </g>`,
			);
		});
		// "wind" caption top-right.
		parts.push(
			`<text x="${ax - 12}" y="18" fill="#94a3b8" font-size="11" font-style="italic" font-family="sans-serif">wind</text>`,
		);

		globeSvg.innerHTML = parts.join("");

		// Clicking a wind arrow rotates that tier by 45°.
		globeSvg.querySelectorAll(".windArrow").forEach((el) => {
			el.addEventListener("click", () => {
				const tier = parseInt(el.getAttribute("data-tier") || "0", 10);
				winds[tier] = (winds[tier] + 45) % 360;
				renderGlobe();
			});
		});
	};

	const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
	const isImperial = () => distanceUnit.value === "miles";
	const tempLabel = (c: number) =>
		isImperial() ? `${cToF(c)}&#176;F` : `${c}&#176;C`;

	const renderInfo = () => {
		const unit = DISTANCE_UNITS[distanceUnit.value] || DISTANCE_UNITS.kms;
		const w = parseInt(canvasWidth.value, 10) || 1000;
		const h = parseInt(canvasHeight.value, 10) || 650;
		const { latN, latT, latS } = computeLatitudeWindow(
			parseInt(cfgMapSize.value, 10),
			parseInt(cfgLatitude.value, 10),
		);

		const toUnit = (km: number) => Math.round(km * unit.perKm);
		const widthDist = toUnit(w * KM_PER_PIXEL);
		const heightDist = toUnit(h * KM_PER_PIXEL);

		const pxPerDeg = h / Math.max(latT, 0.001);
		const meridianPx = Math.round(pxPerDeg * 180);
		const meridianKm = meridianPx * KM_PER_PIXEL;
		const meridianDist = toUnit(meridianKm);
		const earthPercent = Math.round((meridianKm / EARTH_MERIDIAN_KM) * 100);

		const latLabel = (lat: number) =>
			`${Math.abs(Math.round(lat))}&#176;${lat >= 0 ? "N" : "S"}`;
		const lonHalf = Math.round(((w / h) * latT) / 2);

		worldInfoBlock.innerHTML = `
      <div>Canvas size:<br>${w}x${h} px = ${widthDist}x${heightDist} ${unit.label}</div>
      <div style="margin-top: 0.3rem;">Meridian length:<br>${meridianPx} px = ${meridianDist} ${unit.label} = ${earthPercent}% of Earth</div>
      <div style="margin-top: 0.3rem;">Coords: ${latLabel(latN)} ${lonHalf}&#176;W; ${latLabel(latS)} ${lonHalf}&#176;E</div>
    `;
	};

	const refreshWorld = () => {
		lblEquator.innerHTML = tempLabel(parseInt(cfgEquator.value, 10));
		lblNorthPole.innerHTML = tempLabel(parseInt(cfgNorthPole.value, 10));
		lblSouthPole.innerHTML = tempLabel(parseInt(cfgSouthPole.value, 10));
		lblMapSize.innerHTML = `${cfgMapSize.value}%`;
		lblLatitude.innerHTML = `${cfgLatitude.value}`;
		lblPrec.innerHTML = `${cfgPrec.value}%`;
		renderGlobe();
		renderInfo();
	};

	// --- Slider listeners ---
	if (pointsCountSlider)
		pointsCountSlider.addEventListener("input", () => {
			lblPointsCount.innerText = pointsCountSlider.value;
		});

	[
		cfgEquator,
		cfgNorthPole,
		cfgSouthPole,
		cfgMapSize,
		cfgLatitude,
		cfgPrec,
	].forEach((el) => {
		el.addEventListener("input", refreshWorld);
	});
	distanceUnit.addEventListener("change", refreshWorld);
	canvasWidth.addEventListener("input", renderInfo);
	canvasHeight.addEventListener("input", renderInfo);

	// --- Preset buttons ---
	document
		.querySelectorAll<HTMLButtonElement>(".worldPresetBtn")
		.forEach((btn) => {
			btn.addEventListener("click", () => {
				const preset = btn.getAttribute("data-preset");
				switch (preset) {
					case "whole":
						cfgMapSize.value = "100";
						cfgLatitude.value = "50";
						break;
					case "northern":
						cfgMapSize.value = "50";
						cfgLatitude.value = "0";
						break;
					case "tropical":
						cfgMapSize.value = "34";
						cfgLatitude.value = "50";
						break;
					case "southern":
						cfgMapSize.value = "50";
						cfgLatitude.value = "100";
						break;
					case "winds":
						winds = [...DEFAULT_WINDS];
						break;
				}
				refreshWorld();
			});
		});

	// Generate a unique seed helper.
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
		tempEquator: parseInt(cfgEquator.value, 10),
		tempNorthPole: parseInt(cfgNorthPole.value, 10),
		tempSouthPole: parseInt(cfgSouthPole.value, 10),
		windsAngle: winds[2],
		precipitationInput: parseInt(cfgPrec.value, 10),
		distanceUnit: distanceUnit?.value || "kms",
		enableUnderwater: enableUnderwater ? enableUnderwater.checked : true,
		underwaterCount: underwaterCount ? (parseInt(underwaterCount.value, 10) || 0) : 2,
	});

	// --- Modal open/close ---
	const openClimateBtn = document.getElementById(
		"openClimateBtn",
	) as HTMLButtonElement;
	const climatePopup = document.getElementById(
		"climatePopupModal",
	) as HTMLDivElement;
	const closeClimateBtn = document.getElementById(
		"closeClimateModalBtn",
	) as HTMLSpanElement;

	// Backdrop overlay so the centered modal is clearly readable.
	let climateBackdrop = document.getElementById(
		"climatePopupBackdrop",
	) as HTMLDivElement | null;
	if (!climateBackdrop) {
		climateBackdrop = document.createElement("div");
		climateBackdrop.id = "climatePopupBackdrop";
		climateBackdrop.style.cssText =
			"display: none; position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,0.55);";
		document.body.appendChild(climateBackdrop);
	}

	const closeClimateModal = () => {
		climatePopup.style.display = "none";
		if (climateBackdrop) climateBackdrop.style.display = "none";
	};

	if (openClimateBtn && climatePopup) {
		openClimateBtn.addEventListener("click", () => {
			// Reparent to <body> so position:fixed escapes the config panel's
			// backdrop-filter containing block and centers against the viewport.
			if (climatePopup.parentElement !== document.body) {
				document.body.appendChild(climatePopup);
			}
			if (climateBackdrop) climateBackdrop.style.display = "block";
			climatePopup.style.display = "flex";
			refreshWorld();
		});
	}

	if (closeClimateBtn && climatePopup) {
		closeClimateBtn.addEventListener("click", closeClimateModal);
	}
	if (climateBackdrop) {
		climateBackdrop.addEventListener("click", closeClimateModal);
	}

	// --- Actions ---
	regenBtn.addEventListener("click", () => {
		onConfigChange(getConfig());
	});

	updateClimateBtn.addEventListener("click", () => {
		const win = window as any;
		const { latN, latT } = computeLatitudeWindow(
			parseInt(cfgMapSize.value, 10),
			parseInt(cfgLatitude.value, 10),
		);
		if (win.runClimateRegen) {
			win.runClimateRegen({
				equatorTemp: parseInt(cfgEquator.value, 10),
				northPoleTemp: parseInt(cfgNorthPole.value, 10),
				southPoleTemp: parseInt(cfgSouthPole.value, 10),
				latN,
				latT,
				precInput: parseInt(cfgPrec.value, 10),
				winds: [...winds],
			});
		}
		closeClimateModal();
	});

	if (seedHistoryBtn) {
		seedHistoryBtn.addEventListener("click", () => {
			alert("Seed History functionality would open here.");
		});
	}

	// Calendar editor toggles inline below the Configure World modal.
	const openCalendarEditorBtn = document.getElementById(
		"openCalendarEditorBtn",
	) as HTMLButtonElement;
	const inlineCalendarContainer = document.getElementById(
		"inlineCalendarContainer",
	) as HTMLDivElement;
	let calendarInlineLoaded = false;
	if (openCalendarEditorBtn) {
		openCalendarEditorBtn.addEventListener("click", () => {
			if (!inlineCalendarContainer) return;
			const isShown = inlineCalendarContainer.style.display !== "none";
			if (isShown) {
				inlineCalendarContainer.style.display = "none";
				openCalendarEditorBtn.textContent = "Config Custom Calendar";
				return;
			}
			inlineCalendarContainer.style.display = "block";
			openCalendarEditorBtn.textContent = "Hide Calendar Settings";
			if (!calendarInlineLoaded && (window as any).mountCalendarEditorInline) {
				(window as any).mountCalendarEditorInline(inlineCalendarContainer);
				calendarInlineLoaded = true;
			}
		});
	}

	// Initial paint of labels/globe (safe even while hidden).
	refreshWorld();

	(window as any).getCurrentSetupConfig = getConfig;
}
