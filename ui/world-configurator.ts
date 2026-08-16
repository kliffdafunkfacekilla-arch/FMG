import {
	geoGraticule,
	geoOrthographic,
	geoPath,
	interpolateSpectral,
	scaleSequential,
	select,
} from "d3";
import { store } from "../state/store";

const projection = geoOrthographic().translate([100, 100]).scale(100);
const path = geoPath(projection);

// Self-contained round number helper
function rn(v: number, d = 0): number {
	const m = 10 ** d;
	return Math.round(v * m) / m;
}

// Self-contained coordinates translation helper
function calculateMapCoordinates() {
	const _state = store.getState();
	const options = (window as any).options;
	const size = options.mapSize;
	const latVal = options.latitude;
	const lonVal = options.longitude;

	const latN = rn(90 - (latVal - size / 2) * 1.8, 1);
	const latS = rn(90 - (latVal + size / 2) * 1.8, 1);
	const lonW = rn((lonVal - size / 2) * 3.6 - 180, 1);
	const lonE = rn((lonVal + size / 2) * 3.6 - 180, 1);

	return { latN, latS, lonW, lonE };
}

// Initialize options on window to make it accessible to main simulation generator
(window as any).options = (window as any).options || {
	temperatureEquator: 28,
	temperatureNorthPole: -30,
	temperatureSouthPole: -15,
	winds: [225, 45, 225, 315, 135, 315],
	mapSize: 100,
	latitude: 50,
	longitude: 50,
	prec: 100,
};

export const WorldConfigurator = {
	open: (): void => {
		const existing = document.getElementById("worldConfiguratorWrapper");
		if (existing) existing.remove();

		const options = (window as any).options;

		// Load values from localStorage if they were locked previously
		const loadLocked = (id: string, defaultVal: any) => {
			const stored = localStorage.getItem(id);
			return stored !== null ? Number(stored) : defaultVal;
		};
		options.temperatureEquator = loadLocked(
			"temperatureEquator",
			options.temperatureEquator,
		);
		options.temperatureNorthPole = loadLocked(
			"temperatureNorthPole",
			options.temperatureNorthPole,
		);
		options.temperatureSouthPole = loadLocked(
			"temperatureSouthPole",
			options.temperatureSouthPole,
		);
		options.mapSize = loadLocked("mapSize", options.mapSize);
		options.latitude = loadLocked("latitude", options.latitude);
		options.longitude = loadLocked("longitude", options.longitude);
		options.prec = loadLocked("prec", options.prec);

		const dialogHtml = `
      <div id="worldConfiguratorWrapper" class="ui-dialog ui-widget ui-widget-content ui-corner-all ui-front ui-dialog-buttons stable" style="position: absolute; height: auto; width: 44em; top: 120px; left: calc(50% - 22em); display: flex; flex-direction: column; z-index: 10001; background: #2a2a35; border: 1px solid #5e4fa2; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); font-family: monospace;">
        <div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #1a1a24; border-bottom: 1px solid #5e4fa2; cursor: move; color: white;">
          <span class="ui-dialog-title" style="font-weight: bold;">Configure World</span>
          <button id="wcCloseBtn" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only ui-dialog-titlebar-close" title="Close" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 1.1rem; font-weight: bold;">&times;</button>
        </div>

        <div id="worldConfigurator" class="dialog stable ui-dialog-content ui-widget-content" style="padding: 1rem; color: #cbd5e1; font-size: 0.82rem; overflow-y: auto;">
          <div style="display: flex; gap: 1.5rem;">
            <div id="worldControls" style="display: flex; flex-direction: column; gap: 0.6rem; flex: 1;">
              
              <!-- Equator Temp -->
              <div>
                <i data-locked="0" id="lock_temperatureEquator" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                <label>
                  <i>Equator:</i>
                  <input id="temperatureEquatorInput" type="number" min="-50" max="50" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                  <span>°C<span id="temperatureEquatorConverted"></span></span>
                  <input id="temperatureEquatorOutput" type="range" min="-50" max="50" style="width: 100%; cursor: pointer;" />
                </label>
              </div>

              <!-- North Pole Temp -->
              <div>
                <i data-locked="0" id="lock_temperatureNorthPole" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                <label>
                  <i>North Pole:</i>
                  <input id="temperatureNorthPoleInput" type="number" min="-50" max="50" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                  <span>°C<span id="temperatureNorthPoleConverted"></span></span>
                  <input id="temperatureNorthPoleOutput" type="range" min="-50" max="50" style="width: 100%; cursor: pointer;" />
                </label>
              </div>

              <!-- South Pole Temp -->
              <div>
                <i data-locked="0" id="lock_temperatureSouthPole" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                <label>
                  <i>South Pole:</i>
                  <input id="temperatureSouthPoleInput" type="number" min="-50" max="50" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                  <span>°C<span id="temperatureSouthPoleConverted"></span></span>
                  <input id="temperatureSouthPoleOutput" type="range" min="-50" max="50" style="width: 100%; cursor: pointer;" />
                </label>
              </div>

              <!-- Map Size -->
              <div>
                <i data-locked="0" id="lock_mapSize" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                <label>
                  <i>Map size:</i>
                  <input id="mapSizeInput" type="number" min="1" max="100" step="0.1" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />%
                  <input id="mapSizeOutput" type="range" min="1" max="100" step="0.1" style="width: 100%; cursor: pointer;" />
                </label>
              </div>

              <!-- Latitudes -->
              <div>
                <i data-locked="0" id="lock_latitude" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                <label>
                  <i>Latitudes:</i>
                  <input id="latitudeInput" type="number" min="0" max="100" step="0.1" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                  <br /><i>N</i><input id="latitudeOutput" type="range" min="0" max="100" step="0.1" style="width: 80%; cursor: pointer;" /><i>S</i>
                </label>
              </div>

              <!-- Longitudes -->
              <div>
                <i data-locked="0" id="lock_longitude" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                <label>
                  <i>Longitudes:</i>
                  <input id="longitudeInput" type="number" min="0" max="100" step="0.1" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                  <br /><i>W</i><input id="longitudeOutput" type="range" min="0" max="100" step="0.1" style="width: 80%; cursor: pointer;" /><i>E</i>
                </label>
              </div>

              <!-- Precipitation -->
              <div>
                <label>
                  <i data-locked="0" id="lock_prec" class="icon-lock-open" style="cursor: pointer; margin-right: 0.3rem;"></i>
                  <i>Precipitation:</i>
                  <input id="precInput" type="number" style="width: 3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />%
                  <input id="precOutput" type="range" min="0" max="500" style="width: 100%; cursor: pointer;" />
                </label>
              </div>

              <!-- Info Readouts -->
              <div style="border-top: 1px solid #444; padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.75rem; color: #94a3b8;">
                <div>Canvas size: <span id="lblWcMapSize" style="color: #cbd5e1;"></span> px</div>
                <div>Meridian length: <span id="lblWcMeridianLength" style="color: #cbd5e1;"></span> px</div>
                <div>Coords: <span id="lblWcMapCoordinates" style="color: #fbbf24;"></span></div>
              </div>
            </div>

            <!-- Globe Visualizer Area -->
            <div style="display: flex; flex-direction: column; align-items: flex-end; flex: 1;">
              <svg id="globe" width="220" height="220" viewBox="-20 -25 240 240" style="background: #111; border-radius: 50%; border: 1px solid #444;">
                <defs>
                  <linearGradient id="temperatureGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop id="grad90" offset="0%" stop-color="blue" />
                    <stop id="grad60" offset="16.6%" stop-color="green" />
                    <stop id="grad30" offset="33.3%" stop-color="yellow" />
                    <stop id="grad0" offset="50%" stop-color="red" />
                    <stop id="grad-30" offset="66.6%" stop-color="yellow" />
                    <stop id="grad-60" offset="83.3%" stop-color="green" />
                    <stop id="grad-90" offset="100%" stop-color="blue" />
                  </linearGradient>
                </defs>
                <circle id="globeGradient" cx="100" cy="100" r="100" fill="url(#temperatureGradient)" />
                <line id="globePrimeMeridian" x1="100" x2="100" y1="0" y2="200" stroke="rgba(255,255,255,0.2)" stroke-dasharray="2" />
                <line id="globeEquator" x1="0" x2="200" y1="100" y2="100" stroke="rgba(255,255,255,0.4)" />
                <circle id="globeOutline" cx="100" cy="100" r="100" fill="none" stroke="#fff" stroke-width="1.5" />
                <path id="globeArea" fill="rgba(59, 130, 246, 0.25)" stroke="#3b82f6" stroke-width="1.5" />

                <!-- Wind Arrows Layer -->
                <g id="globeWindArrows" stroke="white" stroke-width="2" fill="none" cursor="pointer">
                  <!-- Tier 0 -->
                  <g class="wind-arrow" data-tier="0" transform="translate(100, 15)">
                    <circle cx="0" cy="0" r="8" fill="rgba(0,0,0,0.5)" stroke="white" />
                    <line x1="0" y1="5" x2="0" y2="-5" />
                    <path d="M-3,-2 L0,-5 L3,-2" />
                  </g>
                  <!-- Tier 1 -->
                  <g class="wind-arrow" data-tier="1" transform="translate(100, 48)">
                    <circle cx="0" cy="0" r="8" fill="rgba(0,0,0,0.5)" stroke="white" />
                    <line x1="0" y1="5" x2="0" y2="-5" />
                    <path d="M-3,-2 L0,-5 L3,-2" />
                  </g>
                  <!-- Tier 2 -->
                  <g class="wind-arrow" data-tier="2" transform="translate(100, 82)">
                    <circle cx="0" cy="0" r="8" fill="rgba(0,0,0,0.5)" stroke="white" />
                    <line x1="0" y1="5" x2="0" y2="-5" />
                    <path d="M-3,-2 L0,-5 L3,-2" />
                  </g>
                  <!-- Tier 3 -->
                  <g class="wind-arrow" data-tier="3" transform="translate(100, 118)">
                    <circle cx="0" cy="0" r="8" fill="rgba(0,0,0,0.5)" stroke="white" />
                    <line x1="0" y1="5" x2="0" y2="-5" />
                    <path d="M-3,-2 L0,-5 L3,-2" />
                  </g>
                  <!-- Tier 4 -->
                  <g class="wind-arrow" data-tier="4" transform="translate(100, 152)">
                    <circle cx="0" cy="0" r="8" fill="rgba(0,0,0,0.5)" stroke="white" />
                    <line x1="0" y1="5" x2="0" y2="-5" />
                    <path d="M-3,-2 L0,-5 L3,-2" />
                  </g>
                  <!-- Tier 5 -->
                  <g class="wind-arrow" data-tier="5" transform="translate(100, 185)">
                    <circle cx="0" cy="0" r="8" fill="rgba(0,0,0,0.5)" stroke="white" />
                    <line x1="0" y1="5" x2="0" y2="-5" />
                    <path d="M-3,-2 L0,-5 L3,-2" />
                  </g>
                </g>
              </svg>
              <button id="restoreWinds" style="margin-top: 0.5rem; background: #4b5563; border: none; color: white; padding: 0.25rem 0.5rem; cursor: pointer; border-radius: 4px; font-size: 0.75rem; width: 100%;">Restore winds</button>
            </div>
          </div>

          <div style="margin-top: 0.8rem; display: flex; gap: 0.3rem;">
            <span style="font-weight: bold; align-self: center;">Presets:</span>
            <button class="preset-btn" data-size="100" data-lat="50" style="background: #3b82f6; border: none; color: white; padding: 0.25rem 0.4rem; cursor: pointer; border-radius: 4px; font-size: 0.75rem;">Whole world</button>
            <button class="preset-btn" data-size="33" data-lat="25" style="background: #3b82f6; border: none; color: white; padding: 0.25rem 0.4rem; cursor: pointer; border-radius: 4px; font-size: 0.75rem;">Northern</button>
            <button class="preset-btn" data-size="33" data-lat="50" style="background: #3b82f6; border: none; color: white; padding: 0.25rem 0.4rem; cursor: pointer; border-radius: 4px; font-size: 0.75rem;">Tropical</button>
            <button class="preset-btn" data-size="33" data-lat="75" style="background: #3b82f6; border: none; color: white; padding: 0.25rem 0.4rem; cursor: pointer; border-radius: 4px; font-size: 0.75rem;">Southern</button>
          </div>
        </div>

        <div class="ui-dialog-buttonpane ui-widget-content ui-helper-clearfix" style="padding: 0.5rem; background: #1a1a24; border-top: 1px solid #5e4fa2; display: flex; justify-content: space-between; align-items: center; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">
          <div class="dontAsk">
            <input id="wcAutoChange" class="checkbox" type="checkbox" checked style="cursor: pointer;" />
            <label for="wcAutoChange" style="color: #cbd5e1; cursor: pointer; font-size: 0.75rem;"><i>auto-apply changes</i></label>
          </div>
          <button id="wcApplyBtn" style="background: #10b981; border: none; color: white; padding: 0.35rem 1rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">Update world</button>
        </div>
      </div>
    `;

		document.body.insertAdjacentHTML("beforeend", dialogHtml);
		const wrapper = document.getElementById(
			"worldConfiguratorWrapper",
		) as HTMLDivElement;

		// Draggable behavior setup
		const titlebar = wrapper.querySelector(
			".ui-dialog-titlebar",
		) as HTMLDivElement;
		let isDragging = false;
		let startX = 0,
			startY = 0;

		titlebar.addEventListener("mousedown", (e) => {
			isDragging = true;
			startX = e.clientX - wrapper.offsetLeft;
			startY = e.clientY - wrapper.offsetTop;
		});

		document.addEventListener("mousemove", (e) => {
			if (!isDragging) return;
			wrapper.style.left = `${e.clientX - startX}px`;
			wrapper.style.top = `${e.clientY - startY}px`;
		});

		document.addEventListener("mouseup", () => {
			isDragging = false;
		});

		// Close button
		document.getElementById("wcCloseBtn")?.addEventListener("click", () => {
			wrapper.remove();
		});

		// Setup input variables
		const syncInput = (id: string, prop: string, isFloat = false) => {
			const numInput = document.getElementById(
				`${id}Input`,
			) as HTMLInputElement;
			const rangeInput = document.getElementById(
				`${id}Output`,
			) as HTMLInputElement;

			numInput.value = String(options[prop]);
			rangeInput.value = String(options[prop]);

			const updateVal = (val: number) => {
				options[prop] = val;
				numInput.value = String(val);
				rangeInput.value = String(val);

				// Lock on manual update
				localStorage.setItem(prop, String(val));
				const lockEl = document.getElementById(`lock_${prop}`);
				if (lockEl) {
					lockEl.dataset.locked = "1";
					lockEl.className = "icon-lock";
				}

				updateGlobeVisuals();
				if (
					(document.getElementById("wcAutoChange") as HTMLInputElement).checked
				) {
					triggerWorldUpdate();
				}
			};

			numInput.addEventListener("input", () => {
				updateVal(
					isFloat ? parseFloat(numInput.value) : parseInt(numInput.value, 10),
				);
			});
			rangeInput.addEventListener("input", () => {
				updateVal(
					isFloat
						? parseFloat(rangeInput.value)
						: parseInt(rangeInput.value, 10),
				);
			});
		};

		syncInput("temperatureEquator", "temperatureEquator");
		syncInput("temperatureNorthPole", "temperatureNorthPole");
		syncInput("temperatureSouthPole", "temperatureSouthPole");
		syncInput("mapSize", "mapSize", true);
		syncInput("latitude", "latitude", true);
		syncInput("longitude", "longitude", true);
		syncInput("prec", "prec");

		// Setup Preset Buttons
		const presetBtns = wrapper.querySelectorAll(".preset-btn");
		presetBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const size = parseFloat(target.getAttribute("data-size") || "100");
				const latVal = parseFloat(target.getAttribute("data-lat") || "50");

				options.mapSize = size;
				options.latitude = latVal;

				const sizeNum = document.getElementById(
					"mapSizeInput",
				) as HTMLInputElement;
				const sizeRange = document.getElementById(
					"mapSizeOutput",
				) as HTMLInputElement;
				const latNum = document.getElementById(
					"latitudeInput",
				) as HTMLInputElement;
				const latRange = document.getElementById(
					"latitudeOutput",
				) as HTMLInputElement;

				sizeNum.value = String(size);
				sizeRange.value = String(size);
				latNum.value = String(latVal);
				latRange.value = String(latVal);

				localStorage.setItem("mapSize", String(size));
				localStorage.setItem("latitude", String(latVal));

				const lockSize = document.getElementById("lock_mapSize");
				if (lockSize) {
					lockSize.dataset.locked = "1";
					lockSize.className = "icon-lock";
				}
				const lockLat = document.getElementById("lock_latitude");
				if (lockLat) {
					lockLat.dataset.locked = "1";
					lockLat.className = "icon-lock";
				}

				updateGlobeVisuals();
				if (
					(document.getElementById("wcAutoChange") as HTMLInputElement).checked
				) {
					triggerWorldUpdate();
				}
			});
		});

		// Setup Restore winds
		document.getElementById("restoreWinds")?.addEventListener("click", () => {
			options.winds = [225, 45, 225, 315, 135, 315];
			localStorage.setItem("winds", String(options.winds));
			updateGlobeVisuals();
			if (
				(document.getElementById("wcAutoChange") as HTMLInputElement).checked
			) {
				triggerWorldUpdate();
			}
		});

		// Update manual button
		document.getElementById("wcApplyBtn")?.addEventListener("click", () => {
			triggerWorldUpdate();
		});

		// Initialize lock icons and sync state
		const optionKeys = [
			"temperatureEquator",
			"temperatureNorthPole",
			"temperatureSouthPole",
			"mapSize",
			"latitude",
			"longitude",
			"prec",
		];
		optionKeys.forEach((key) => {
			const lockEl = document.getElementById(`lock_${key}`);
			const isLocked = localStorage.getItem(key) !== null;
			if (lockEl) {
				lockEl.dataset.locked = isLocked ? "1" : "0";
				lockEl.className = isLocked ? "icon-lock" : "icon-lock-open";

				lockEl.addEventListener("click", () => {
					const locked = lockEl.dataset.locked === "1";
					if (locked) {
						localStorage.removeItem(key);
						lockEl.dataset.locked = "0";
						lockEl.className = "icon-lock-open";
					} else {
						localStorage.setItem(key, String(options[key]));
						lockEl.dataset.locked = "1";
						lockEl.className = "icon-lock";
					}
				});
			}
		});

		// Update the visual representation
		function updateGlobeVisuals() {
			// 1. Temperature color gradient mapping on globe
			const tEq = options.temperatureEquator;
			const tNP = options.temperatureNorthPole;
			const tSP = options.temperatureSouthPole;

			const scale = scaleSequential(interpolateSpectral);
			const getColor = (value: number): string => scale(1 - value);
			const [tMin, tMax] = [-25, 30];
			const tDelta = tMax - tMin;

			select(wrapper)
				.select("#grad90")
				.attr("stop-color", getColor((tNP - tMin) / tDelta));
			select(wrapper)
				.select("#grad60")
				.attr(
					"stop-color",
					getColor((tEq - ((tEq - tNP) * 2) / 3 - tMin) / tDelta),
				);
			select(wrapper)
				.select("#grad30")
				.attr(
					"stop-color",
					getColor((tEq - ((tEq - tNP) * 1) / 4 - tMin) / tDelta),
				);
			select(wrapper)
				.select("#grad0")
				.attr("stop-color", getColor((tEq - tMin) / tDelta));
			select(wrapper)
				.select("#grad-30")
				.attr(
					"stop-color",
					getColor((tEq - ((tEq - tSP) * 1) / 4 - tMin) / tDelta),
				);
			select(wrapper)
				.select("#grad-60")
				.attr(
					"stop-color",
					getColor((tEq - ((tEq - tSP) * 2) / 3 - tMin) / tDelta),
				);
			select(wrapper)
				.select("#grad-90")
				.attr("stop-color", getColor((tSP - tMin) / tDelta));

			// 2. Info labels readouts
			const width = store.getState().width || 1000;
			const height = store.getState().height || 650;
			const eqD = ((height / 2) * 100) / options.mapSize;

			const mc = calculateMapCoordinates();

			const mapCoordsStr = `${mc.latN > 0 ? `${mc.latN}°N` : `${Math.abs(mc.latN)}°S`} ${Math.abs(mc.lonW)}°W; ${mc.latS > 0 ? `${mc.latS}°N` : `${Math.abs(mc.latS)}°S`} ${mc.lonE}°E`;
			document.getElementById("lblWcMapSize")!.innerText = `${width}x${height}`;
			document.getElementById("lblWcMeridianLength")!.innerText = String(
				Math.round(eqD * 2),
			);
			document.getElementById("lblWcMapCoordinates")!.innerText = mapCoordsStr;

			// 3. Map Area Box on Globe paths
			const area = geoGraticule().extent([
				[mc.lonW, mc.latS],
				[mc.lonE, mc.latN],
			]);
			select(wrapper)
				.select("#globeArea")
				.attr("d", path(area.outline()) || "");

			// 4. Wind arrows direction rotation
			const arrows = wrapper.querySelectorAll(".wind-arrow");
			arrows.forEach((el, idx) => {
				const arrow = el as SVGElement;
				const angle = options.winds[idx] || 0;
				arrow.setAttribute(
					"transform",
					`translate(100, ${[15, 48, 82, 118, 152, 185][idx]}) rotate(${angle})`,
				);
			});
		}

		// Bind wind arrow rotation clicks
		const windArrows = wrapper.querySelectorAll(".wind-arrow");
		windArrows.forEach((arrowEl, idx) => {
			arrowEl.addEventListener("click", (e) => {
				e.stopPropagation();
				options.winds[idx] = (options.winds[idx] + 45) % 360;
				localStorage.setItem("winds", String(options.winds));
				updateGlobeVisuals();

				if (
					(document.getElementById("wcAutoChange") as HTMLInputElement).checked
				) {
					triggerWorldUpdate();
				}
			});
		});

		updateGlobeVisuals();

		// Trigger simulation regen
		function triggerWorldUpdate() {
			const config = (window as any).getCurrentSetupConfig
				? (window as any).getCurrentSetupConfig()
				: null;
			if (config && (window as any).runSimulationGlobal) {
				// Run full simulation using current settings
				(window as any).runSimulationGlobal();
			}
		}
	},
};

(window as any).WorldConfigurator = WorldConfigurator;
