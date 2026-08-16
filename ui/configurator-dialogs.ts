import { WorldConfigurator } from "./world-configurator";

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

// Emulate original preferences stored in localStorage
const stored = (key: string): string | null => localStorage.getItem(key);
const storeOption = (key: string, value: string): void =>
	localStorage.setItem(key, value);
const removeOption = (key: string): void => localStorage.removeItem(key);

export function mountConfigurator(
	containerId: string,
	onConfigChange: (config: SetupConfig) => void,
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Render the exact HTML table structure and options style from original FMG
	container.innerHTML = `
    <div id="optionsTabContent" style="width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.6rem; color: #cbd5e1; font-size: 0.82rem;">
      <p data-tip="Map generation settings. Generate a new map to apply the settings" style="margin: 0; color: #fbbf24; font-size: 0.85rem; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem;">
        Map settings (new map to apply):
      </p>
      
      <table style="width: 100%; border-collapse: collapse;">
        <!-- Canvas Size -->
        <tr data-tip="Set original map size on generation. It cannot be changed later. Always keep canvas size equal to your screen size or less.">
          <td style="width: 1.5rem;"><i data-tip="Restore default canvas size" id="restoreDefaultCanvasSize" class="icon-ccw" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0; width: 6rem;">Canvas size</td>
          <td style="padding: 0.3rem 0;">
            <input id="mapWidthInput" class="paired" type="number" min="240" value="1000" style="width: 4rem; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            <span>x</span>
            <input id="mapHeightInput" class="paired" type="number" min="135" value="650" style="width: 4rem; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            <span>px</span>
          </td>
          <td></td>
        </tr>

        <!-- Map Seed -->
        <tr data-tip="Map seed number. Press 'Enter' to apply. Seed produces the same map only if canvas size and options are the same">
          <td><i data-tip="Show seed history to apply a previous seed" id="optionsMapHistory" class="icon-hourglass-1" style="cursor: pointer; color: #a855f7;"></i></td>
          <td style="padding: 0.3rem 0;">Map seed</td>
          <td style="padding: 0.3rem 0;">
            <input id="optionsSeed" class="long" type="text" value="seed-12345" style="width: 90%; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </td>
          <td><i data-tip="Copy map seed as URL" id="optionsCopySeed" class="icon-docs" style="cursor: pointer;"></i></td>
        </tr>

        <!-- Points Number -->
        <tr data-tip="Set number of points to be used for graph generation. Highly affects performance. 10K is recommended">
          <td><i data-locked="0" id="lock_points" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Points number</td>
          <td style="padding: 0.3rem 0;">
            <input id="pointsInput" type="range" min="1000" max="100000" step="1000" value="10000" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="pointsOutputFormatted" style="color: #4ade80; font-weight: bold; font-size: 0.75rem;">10K</output></td>
        </tr>

        <!-- Map Name -->
        <tr data-tip="Define map name (will be used to name downloaded files)">
          <td><i data-locked="0" id="lock_mapName" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Map name</td>
          <td style="padding: 0.3rem 0;">
            <input id="mapNameInput" class="long" type="text" value="New World" style="width: 90%; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </td>
          <td><i data-tip="Regenerate map name" id="optionsNameRegenerate" class="icon-arrows-cw" style="cursor: pointer;"></i></td>
        </tr>

        <!-- Year and Era -->
        <tr data-tip="Define current year and era name">
          <td><i data-locked="0" id="lock_year" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Year and era</td>
          <td style="padding: 0.3rem 0; display: flex; gap: 0.2rem; align-items: center;">
            <input id="yearInput" type="number" step="1" value="100" style="width: 25%; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
            <input id="eraInput" type="text" value="Common Era" style="width: 65%; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </td>
          <td><i id="optionsEraRegenerate" data-tip="Regenerate era" class="icon-arrows-cw" style="cursor: pointer;"></i></td>
        </tr>

        <!-- Heightmap template selector -->
        <tr data-tip="Select template to be used on generation">
          <td><i data-locked="0" id="lock_template" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Heightmap</td>
          <td style="padding: 0.3rem 0;">
            <select id="templateInput" style="width: 90%; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              <option value="Continents" selected>Continents</option>
              <option value="High Island">High Island</option>
              <option value="Low Island">Low Island</option>
              <option value="Archipelago">Archipelago</option>
              <option value="Atoll">Atoll</option>
              <option value="Volcano">Volcano</option>
            </select>
          </td>
          <td></td>
        </tr>

        <!-- Cultures Number -->
        <tr data-tip="Define how many Cultures should be generated">
          <td><i data-locked="0" id="lock_cultures" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Cultures count</td>
          <td style="padding: 0.3rem 0;">
            <input id="culturesInput" type="range" min="1" max="30" value="6" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="culturesOutput" style="color: #cbd5e1; font-size: 0.75rem;">6</output></td>
        </tr>

        <!-- States Number -->
        <tr data-tip="Define how many states and capitals should be generated">
          <td><i data-locked="0" id="lock_states" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">States count</td>
          <td style="padding: 0.3rem 0;">
            <input id="statesInput" type="range" min="0" max="100" value="8" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="statesOutput" style="color: #cbd5e1; font-size: 0.75rem;">8</output></td>
        </tr>

        <!-- Provinces Ratio -->
        <tr data-tip="Set what share of eligible burgs in each state will become province centers. Higher values create more provinces">
          <td><i data-locked="0" id="lock_provinces" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Provinces ratio</td>
          <td style="padding: 0.3rem 0;">
            <input id="provincesInput" type="range" min="0" max="100" value="30" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="provincesOutput" style="color: #cbd5e1; font-size: 0.75rem;">30</output></td>
        </tr>

        <!-- Size Variety -->
        <tr data-tip="Define how much states and cultures can vary in size. Defines expansionism value">
          <td><i data-locked="0" id="lock_sizeVariety" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Size variety</td>
          <td style="padding: 0.3rem 0;">
            <input id="sizeVarietyInput" type="range" min="0.1" max="10" step="0.1" value="1.5" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="sizeVarietyOutput" style="color: #cbd5e1; font-size: 0.75rem;">1.5</output></td>
        </tr>

        <!-- Growth Rate -->
        <tr data-tip="Set state and cultures growth rate. Defines how many lands will stay neutral">
          <td><i data-locked="0" id="lock_growthRate" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Growth rate</td>
          <td style="padding: 0.3rem 0;">
            <input id="growthRateInput" type="range" min="0.1" max="2" step="0.1" value="1.0" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="growthRateOutput" style="color: #cbd5e1; font-size: 0.75rem;">1.0</output></td>
        </tr>

        <!-- Burgs Number -->
        <tr data-tip="Define a number of non-capital settlements to be placed (if enough suitable land exists)">
          <td><i data-locked="0" id="lock_burgs" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Burgs count</td>
          <td style="padding: 0.3rem 0;">
            <input id="burgsInput" type="range" min="0" max="999" value="30" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="burgsOutput" style="color: #cbd5e1; font-size: 0.75rem;">30</output></td>
        </tr>

        <!-- Religions Number -->
        <tr data-tip="Define how many organized religions and cults should be generated.">
          <td><i data-locked="0" id="lock_religions" class="icon-lock-open" style="cursor: pointer;"></i></td>
          <td style="padding: 0.3rem 0;">Religions count</td>
          <td style="padding: 0.3rem 0;">
            <input id="religionsInput" type="range" min="0" max="50" value="5" style="width: 90%; cursor: pointer;" />
          </td>
          <td style="text-align: right;"><output id="religionsOutput" style="color: #cbd5e1; font-size: 0.75rem;">5</output></td>
        </tr>
      </table>

      <!-- Generator Settings Section -->
      <p style="margin: 0.5rem 0 0 0; color: #10b981; font-size: 0.85rem; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem;">
        Generator settings:
      </p>

      <table style="width: 100%; border-collapse: collapse;">
        <!-- Distance Unit selection -->
        <tr data-tip="Select distance units for calculations">
          <td style="width: 1.5rem;"></td>
          <td style="padding: 0.3rem 0; width: 6rem;">Distance Unit</td>
          <td style="padding: 0.3rem 0;">
            <select id="distanceUnitSelect" style="width: 90%; padding: 0.1rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              <option value="miles">Miles</option>
              <option value="kms" selected>Kilometers</option>
              <option value="leagues">Leagues</option>
            </select>
          </td>
          <td></td>
        </tr>
      </table>

      <!-- Climate dialog triggering & Regeneration -->
      <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem;">
        <button id="openClimateBtn" style="width: 100%; text-align: left; background: #9333ea; border: none; color: white; padding: 0.35rem 0.6rem; cursor: pointer; font-weight: bold; font-size: 0.8rem; border-radius: 4px;">
          🌍 Configure World
        </button>

        <button id="regenNewMapBtn" style="background: linear-gradient(135deg, #2563eb, #3b82f6); border: none; padding: 0.45rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.8rem; width: 100%;">
          🎲 Generate New Map
        </button>

        <button id="restoreDefaultsBtn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 0.35rem; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.75rem; width: 100%;">
          ⚠️ Reset to defaults
        </button>
      </div>
    </div>

    <!-- Climate Modal Overlay -->
    <div id="climatePopupModal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: rgba(20, 20, 25, 0.98); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 1.2rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 300px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); flex-direction: column; gap: 0.8rem; pointer-events: auto;">
      <h3 style="margin-top: 0; color: #a855f7; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem;">
        <span>Configure World Climate</span>
        <span id="closeClimateModalBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.2rem;">&times;</span>
      </h3>
      
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

      <button id="updateClimateBtn" style="background: linear-gradient(135deg, #9333ea, #a855f7); border: none; padding: 0.5rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.8rem; width: 100%;">
        🔄 Update Map Climate
      </button>
    </div>
  `;

	// DOM elements
	const mapWidthInput = document.getElementById(
		"mapWidthInput",
	) as HTMLInputElement;
	const mapHeightInput = document.getElementById(
		"mapHeightInput",
	) as HTMLInputElement;
	const restoreDefaultCanvasSize = document.getElementById(
		"restoreDefaultCanvasSize",
	) as HTMLElement;

	const optionsSeed = document.getElementById(
		"optionsSeed",
	) as HTMLInputElement;
	const pointsInput = document.getElementById(
		"pointsInput",
	) as HTMLInputElement;
	const pointsOutputFormatted = document.getElementById(
		"pointsOutputFormatted",
	) as HTMLOutputElement;

	const mapNameInput = document.getElementById(
		"mapNameInput",
	) as HTMLInputElement;
	const optionsNameRegenerate = document.getElementById(
		"optionsNameRegenerate",
	) as HTMLElement;

	const yearInput = document.getElementById("yearInput") as HTMLInputElement;
	const eraInput = document.getElementById("eraInput") as HTMLInputElement;
	const optionsEraRegenerate = document.getElementById(
		"optionsEraRegenerate",
	) as HTMLElement;

	const templateInput = document.getElementById(
		"templateInput",
	) as HTMLSelectElement;

	const culturesInput = document.getElementById(
		"culturesInput",
	) as HTMLInputElement;
	const culturesOutput = document.getElementById(
		"culturesOutput",
	) as HTMLOutputElement;

	const statesInput = document.getElementById(
		"statesInput",
	) as HTMLInputElement;
	const statesOutput = document.getElementById(
		"statesOutput",
	) as HTMLOutputElement;

	const provincesInput = document.getElementById(
		"provincesInput",
	) as HTMLInputElement;
	const provincesOutput = document.getElementById(
		"provincesOutput",
	) as HTMLOutputElement;

	const sizeVarietyInput = document.getElementById(
		"sizeVarietyInput",
	) as HTMLInputElement;
	const sizeVarietyOutput = document.getElementById(
		"sizeVarietyOutput",
	) as HTMLOutputElement;

	const growthRateInput = document.getElementById(
		"growthRateInput",
	) as HTMLInputElement;
	const growthRateOutput = document.getElementById(
		"growthRateOutput",
	) as HTMLOutputElement;

	const burgsInput = document.getElementById("burgsInput") as HTMLInputElement;
	const burgsOutput = document.getElementById(
		"burgsOutput",
	) as HTMLOutputElement;

	const religionsInput = document.getElementById(
		"religionsInput",
	) as HTMLInputElement;
	const religionsOutput = document.getElementById(
		"religionsOutput",
	) as HTMLOutputElement;

	const distanceUnitSelect = document.getElementById(
		"distanceUnitSelect",
	) as HTMLSelectElement;

	// Climate modal controls
	const openClimateBtn = document.getElementById(
		"openClimateBtn",
	) as HTMLButtonElement;
	const climatePopup = document.getElementById(
		"climatePopupModal",
	) as HTMLDivElement;
	const _closeClimateBtn = document.getElementById(
		"closeClimateModalBtn",
	) as HTMLSpanElement;
	const updateClimateBtn = document.getElementById(
		"updateClimateBtn",
	) as HTMLButtonElement;

	const slideTemp = document.getElementById("slideTemp") as HTMLInputElement;
	const lblTemp = document.getElementById("lblTemp") as HTMLSpanElement;
	const slideWind = document.getElementById("slideWind") as HTMLInputElement;
	const lblWind = document.getElementById("lblWind") as HTMLSpanElement;
	const slidePrec = document.getElementById("slidePrec") as HTMLInputElement;
	const lblPrec = document.getElementById("lblPrec") as HTMLSpanElement;

	const regenBtn = document.getElementById(
		"regenNewMapBtn",
	) as HTMLButtonElement;
	const restoreDefaultsBtn = document.getElementById(
		"restoreDefaultsBtn",
	) as HTMLButtonElement;

	// Initialize display sync of ranges to outputs
	pointsInput.addEventListener("input", () => {
		const val = parseInt(pointsInput.value, 10);
		pointsOutputFormatted.innerText =
			val >= 1000 ? `${Math.round(val / 1000)}K` : String(val);
	});
	culturesInput.addEventListener("input", () => {
		culturesOutput.innerText = culturesInput.value;
	});
	statesInput.addEventListener("input", () => {
		statesOutput.innerText = statesInput.value;
	});
	provincesInput.addEventListener("input", () => {
		provincesOutput.innerText = provincesInput.value;
	});
	sizeVarietyInput.addEventListener("input", () => {
		sizeVarietyOutput.innerText = sizeVarietyInput.value;
	});
	growthRateInput.addEventListener("input", () => {
		growthRateOutput.innerText = growthRateInput.value;
	});
	burgsInput.addEventListener("input", () => {
		burgsOutput.innerText = burgsInput.value;
	});
	religionsInput.addEventListener("input", () => {
		religionsOutput.innerText = religionsInput.value;
	});

	slideTemp.addEventListener("input", () => {
		lblTemp.innerText = slideTemp.value;
	});
	slideWind.addEventListener("input", () => {
		lblWind.innerText = slideWind.value;
	});
	slidePrec.addEventListener("input", () => {
		lblPrec.innerText = `${slidePrec.value}%`;
	});

	// Generate unique seed helper
	const rollSeed = () => `map-${Math.floor(Math.random() * 1000000)}`;
	optionsSeed.value = rollSeed();

	// Load preferences from localStorage (lock states emulation)
	const initializeOption = (
		id: string,
		inputEl: HTMLInputElement | HTMLSelectElement,
		defaultVal: string,
	) => {
		const pref = stored(id);
		const lockEl = document.getElementById(`lock_${id}`);
		if (pref !== null) {
			inputEl.value = pref;
			if (lockEl) {
				lockEl.dataset.locked = "1";
				lockEl.className = "icon-lock";
			}
		} else {
			inputEl.value = defaultVal;
			if (lockEl) {
				lockEl.dataset.locked = "0";
				lockEl.className = "icon-lock-open";
			}
		}
		// trigger input event to sync output elements
		inputEl.dispatchEvent(new Event("input"));
	};

	// Wire locks event listeners
	const lockEls = container.querySelectorAll("[data-locked]");
	lockEls.forEach((el) => {
		const element = el as HTMLElement;
		const optionId = element.id.slice(5); // drop "lock_"
		element.addEventListener("click", () => {
			const isLocked = element.dataset.locked === "1";
			if (isLocked) {
				removeOption(optionId);
				element.dataset.locked = "0";
				element.className = "icon-lock-open";
			} else {
				const matchingInput =
					document.getElementById(`${optionId}Input`) ||
					document.getElementById(optionId) ||
					document.getElementById(`${optionId}InputContainer`);
				const value = (matchingInput as HTMLInputElement)?.value || "";
				storeOption(optionId, value);
				element.dataset.locked = "1";
				element.className = "icon-lock";
			}
		});
	});

	// Init canvas and locks values
	mapWidthInput.value = String(window.innerWidth);
	mapHeightInput.value = String(window.innerHeight);
	initializeOption("points", pointsInput, "10000");
	initializeOption("mapName", mapNameInput, "New World");
	initializeOption("year", yearInput, "100");
	initializeOption("template", templateInput, "Continents");
	initializeOption("cultures", culturesInput, "6");
	initializeOption("states", statesInput, "8");
	initializeOption("provinces", provincesInput, "30");
	initializeOption("sizeVariety", sizeVarietyInput, "1.5");
	initializeOption("growthRate", growthRateInput, "1.0");
	initializeOption("burgs", burgsInput, "30");
	initializeOption("religions", religionsInput, "5");

	// Actions
	restoreDefaultCanvasSize.addEventListener("click", () => {
		mapWidthInput.value = String(window.innerWidth);
		mapHeightInput.value = String(window.innerHeight);
	});

	optionsNameRegenerate.addEventListener("click", () => {
		const bases = [
			"Gondor",
			"Rohan",
			"Erebor",
			"Mordor",
			"Harad",
			"Dale",
			"Arnor",
		];
		mapNameInput.value = `${bases[Math.floor(Math.random() * bases.length)]} World`;
	});

	optionsEraRegenerate.addEventListener("click", () => {
		const eras = [
			"Second Era",
			"Third Era",
			"Fourth Era",
			"Common Era",
			"Age of Dragons",
		];
		eraInput.value = eras[Math.floor(Math.random() * eras.length)];
	});

	if (openClimateBtn) {
		openClimateBtn.addEventListener("click", () => {
			WorldConfigurator.open();
		});
	}

	const getConfig = (): SetupConfig => ({
		canvasWidth: parseInt(mapWidthInput.value, 10) || window.innerWidth,
		canvasHeight: parseInt(mapHeightInput.value, 10) || window.innerHeight,
		seed: optionsSeed.value || rollSeed(),
		cellsCount: parseInt(pointsInput.value, 10) || 10000,
		mapName: mapNameInput.value || "New World",
		year: parseInt(yearInput.value, 10) || 100,
		era: eraInput.value || "Common Era",
		heightmapType: templateInput.value,
		culturesCount: parseInt(culturesInput.value, 10) || 6,
		statesCount: parseInt(statesInput.value, 10) || 8,
		provincesRatio: parseInt(provincesInput.value, 10) || 30,
		sizeVariety: parseFloat(sizeVarietyInput.value) || 1.5,
		growthRate: parseFloat(growthRateInput.value) || 1.0,
		townsCount: parseInt(burgsInput.value, 10) || 30,
		religionsCount: parseInt(religionsInput.value, 10) || 5,
		tempEquator: parseInt(slideTemp.value, 10),
		windsAngle: parseInt(slideWind.value, 10),
		precipitationInput: parseInt(slidePrec.value, 10),
		distanceUnit: distanceUnitSelect.value,
	});

	regenBtn.addEventListener("click", () => {
		onConfigChange(getConfig());
	});

	updateClimateBtn.addEventListener("click", () => {
		const win = window as any;
		if (win.runClimateRegen) {
			win.runClimateRegen(
				parseInt(slideTemp.value, 10),
				parseInt(slideWind.value, 10),
				parseInt(slidePrec.value, 10),
			);
		}
		if (climatePopup) {
			climatePopup.style.display = "none";
		}
	});

	restoreDefaultsBtn.addEventListener("click", () => {
		localStorage.clear();
		initializeOption("points", pointsInput, "10000");
		initializeOption("mapName", mapNameInput, "Default World");
		initializeOption("year", yearInput, "100");
		initializeOption("template", templateInput, "Continents");
		initializeOption("cultures", culturesInput, "6");
		initializeOption("states", statesInput, "8");
		initializeOption("provinces", provincesInput, "30");
		initializeOption("sizeVariety", sizeVarietyInput, "1.5");
		initializeOption("growthRate", growthRateInput, "1.0");
		initializeOption("burgs", burgsInput, "30");
		initializeOption("religions", religionsInput, "5");

		slideTemp.value = "28";
		slideWind.value = "225";
		slidePrec.value = "100";

		lblTemp.innerText = "28";
		lblWind.innerText = "225";
		lblPrec.innerText = "100%";

		onConfigChange(getConfig());
	});

	(window as any).getCurrentSetupConfig = getConfig;
}
