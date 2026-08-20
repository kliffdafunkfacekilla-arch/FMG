import { type AppState, store } from "../state/store";

export function mountLayersPanel(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const getVisibilityKey = (layer: string): keyof AppState | null => {
		switch (layer) {
			case "grid": return "showGrid";
			case "rivers": return "showRivers";
			case "routes": return "showRoutes";
			case "burgs": return "showBurgs";
			case "military": return "showMilitary";
			case "markers": return "showMarkers";
			case "labels": return "showLabels";
			case "zones": return "showZones";
			case "borders": return "showBorders";
			case "coastlines": return "showCoastlines";
			case "relief": return "showReliefIcons";
			case "emblems": return "showEmblems";
			case "caravans": return "showRoutes"; // caravans follow routes visibility
			case "scalebar": return "showScalebar";
			default: return null;
		}
	};

	/** Thematic fill-mode layers: show fill mode toggle button */
	const FILL_MODE_LAYERS = new Set(["heightmap", "biomes", "cultures", "states", "provinces", "religions", "goods", "temp", "prec"]);

	const getShortcut = (layer: string): string => {
		switch (layer) {
			case "grid": return "G";
			case "rivers": return "R";
			case "routes": return "T";
			case "burgs": return "B";
			case "military": return "M";
			case "markers": return "K";
			case "labels": return "L";
			case "zones": return "Z";
			case "borders": return "D";
			case "coastlines": return "C";
			case "relief": return "I";
			case "emblems": return "E";
			case "scalebar": return "S";
			default: return "";
		}
	};


	const wrapper = document.createElement("div");
	wrapper.id = "layersEditorPanel";
	wrapper.style.display = "none";
	wrapper.style.background = "rgba(30, 30, 38, 0.95)";
	wrapper.style.border = "1px solid rgba(255, 255, 255, 0.1)";
	wrapper.style.padding = "1rem";
	wrapper.style.borderRadius = "12px";
	wrapper.style.fontSize = "0.85rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.width = "300px";
	wrapper.style.boxSizing = "border-box";
	wrapper.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
	wrapper.style.marginTop = "0.5rem";
	wrapper.style.position = "absolute";
	wrapper.style.top = "10px";
	wrapper.style.right = "10px";
	wrapper.style.zIndex = "1000";

	wrapper.innerHTML = `
    <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
      <span>Layers</span>
      <span id="closeLayersBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
    </h3>
    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 6px; margin-bottom: 0.6rem;">
      <span style="font-weight: bold; color: #fbbf24;">View Mode:</span>
      <div style="display: flex; gap: 0.2rem;">
        <button id="viewModeLand" style="background: #333; border: 1px solid #444; color: white; border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer;">Land</button>
        <button id="viewModeBoth" style="background: #3b82f6; border: 1px solid #444; color: white; border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer;">Both</button>
        <button id="viewModeOcean" style="background: #333; border: 1px solid #444; color: white; border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer;">Ocean</button>
      </div>
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 6px; margin-bottom: 0.6rem;">
      <span style="font-weight: bold; color: #fbbf24;">Preset:</span>
      <select id="presetSelect" style="padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; flex-grow: 1; margin: 0 0.5rem;">
        <option value="Political">Political</option>
        <option value="Cultural">Cultural</option>
        <option value="Religions">Religions</option>
        <option value="Biomes">Biomes</option>
        <option value="Provinces">Provinces</option>
        <option value="Heightmap">Heightmap</option>
        <option value="Custom">Custom</option>
      </select>
      <button id="addPresetBtn" title="Create Custom Preset" style="background: #3b82f6; border: none; color: white; border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer;">+</button>
    </div>
    <div style="max-height: 300px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; padding: 0.5rem;">
      <ul id="layersList" style="list-style: none; margin: 0; padding: 0;"></ul>
    </div>
  `;

	container.appendChild(wrapper);

	const layersList = document.getElementById("layersList") as HTMLUListElement;
	const presetSelect = document.getElementById(
		"presetSelect",
	) as HTMLSelectElement;
	const closeBtn = document.getElementById("closeLayersBtn") as HTMLSpanElement;

	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	const renderLayers = () => {
		const state = store.getState();
		const order = state.layerOrder;
		layersList.innerHTML = "";

		order.forEach((layerId, index) => {
			const li = document.createElement("li");
			li.style.display = "flex";
			li.style.justifyContent = "space-between";
			li.style.alignItems = "center";
			li.style.padding = "0.4rem";
			li.style.background = "#1a1a24";
			li.style.marginBottom = "0.2rem";
			li.style.borderRadius = "4px";
			li.style.cursor = "grab";
			li.setAttribute("draggable", "true");
			li.setAttribute("data-id", layerId);
			li.setAttribute("data-index", index.toString());

			const visKey = getVisibilityKey(layerId);
			const isVisible = visKey ? state[visKey as keyof AppState] : true;
			const shortcut = getShortcut(layerId);
			const shortcutHint = shortcut ? ` [${shortcut}]` : "";
			const isFillLayer = FILL_MODE_LAYERS.has(layerId);
			const fillMode: string = (state.layerFillModes?.[layerId]) || "fill";
			const fillModeLabel = fillMode === "border-only" ? "⬜ Border" : fillMode === "both" ? "⊞ Both" : "■ Fill";

			li.innerHTML = `
        <span style="font-weight: bold; color: ${isVisible ? "#fff" : "#64748b"}; text-transform: capitalize; flex:1;">
          ≡ ${layerId}
        </span>
        ${isFillLayer ? `<button title="Fill mode" class="fillModeBtn" data-layer="${layerId}" data-mode="${fillMode}" style="background: #1e3a5f; border: none; color: #93c5fd; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem; margin-right: 0.25rem;">${fillModeLabel}</button>` : ""}
        ${visKey ? `<button title="Toggle visibility${shortcutHint}" class="toggleLayerBtn" data-key="${visKey}" style="background: ${isVisible ? "#10b981" : "#4b5563"}; border: none; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">${isVisible ? "ON" : "OFF"}</button>` : ""}
      `;

			layersList.appendChild(li);

			li.addEventListener("dragstart", (e) => {
				if (e.dataTransfer) {
					e.dataTransfer.setData("text/plain", index.toString());
					e.dataTransfer.effectAllowed = "move";
				}
				li.style.opacity = "0.5";
			});

			li.addEventListener("dragend", () => {
				li.style.opacity = "1";
			});

			li.addEventListener("dragover", (e) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			});

			li.addEventListener("drop", (e) => {
				e.preventDefault();
				if (e.dataTransfer) {
					const fromIndexStr = e.dataTransfer.getData("text/plain");
					if (!fromIndexStr) return;
					const fromIndex = parseInt(fromIndexStr, 10);
					const toIndex = index;

					if (fromIndex !== toIndex) {
						const newOrder = [...store.getState().layerOrder];
						const [moved] = newOrder.splice(fromIndex, 1);
						newOrder.splice(toIndex, 0, moved);
						store.updateState({ layerOrder: newOrder });
						renderLayers();
					}
				}
			});
		});

		const toggleBtns = layersList.querySelectorAll(".toggleLayerBtn");
		toggleBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const key = (e.currentTarget as HTMLButtonElement).getAttribute("data-key");
				if (key) {
					const currentState = store.getState()[key as keyof AppState];
					store.updateState({ [key]: !currentState });
					renderLayers();
				}
			});
		});

		// Fill mode cycle: fill → border-only → both → fill
		const fillModeBtns = layersList.querySelectorAll(".fillModeBtn");
		fillModeBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const layerKey = (e.currentTarget as HTMLButtonElement).getAttribute("data-layer")!;
				const current = (e.currentTarget as HTMLButtonElement).getAttribute("data-mode") || "fill";
				const next = current === "fill" ? "border-only" : current === "border-only" ? "both" : "fill";
				const newModes = { ...(store.getState().layerFillModes || {}), [layerKey]: next };
				store.updateState({ layerFillModes: newModes } as any);
				renderLayers();
			});
		});
	};

	const updateViewModeButtons = () => {
		const state = store.getState();
		const landBtn = document.getElementById("viewModeLand")!;
		const bothBtn = document.getElementById("viewModeBoth")!;
		const oceanBtn = document.getElementById("viewModeOcean")!;
		
		landBtn.style.background = state.viewMode === "land" ? "#3b82f6" : "#333";
		bothBtn.style.background = state.viewMode === "both" ? "#3b82f6" : "#333";
		oceanBtn.style.background = state.viewMode === "ocean" ? "#3b82f6" : "#333";
	};

	document.getElementById("viewModeLand")?.addEventListener("click", () => store.updateState({ viewMode: "land" }));
	document.getElementById("viewModeBoth")?.addEventListener("click", () => store.updateState({ viewMode: "both" }));
	document.getElementById("viewModeOcean")?.addEventListener("click", () => store.updateState({ viewMode: "ocean" }));

	presetSelect.addEventListener("change", (e) => {
		const val = (e.target as HTMLSelectElement).value;
		const stateUpdate: Partial<AppState> = {};
		if (val === "Political") {
			stateUpdate.showZones = false;
			stateUpdate.showGrid = false;
		} else if (val === "Biomes") {
			stateUpdate.showRivers = true;
			stateUpdate.showRoutes = false;
		}
		if (Object.keys(stateUpdate).length > 0) {
			store.updateState(stateUpdate);
		}
	});

	store.subscribe((state) => {
		if (wrapper.style.display !== "none") {
			renderLayers();
			updateViewModeButtons();
		}
	});

	(window as any).openLayersPanel = () => {
		wrapper.style.display = "block";
		renderLayers();
		updateViewModeButtons();
	};

	document.addEventListener("keydown", (e) => {
		if (
			e.target instanceof HTMLInputElement ||
			e.target instanceof HTMLTextAreaElement
		)
			return;

		let targetKey: keyof AppState | null = null;
		switch (e.key.toUpperCase()) {
			case "G":
				targetKey = "showGrid";
				break;
			case "R":
				targetKey = "showRivers";
				break;
			case "T":
				targetKey = "showRoutes";
				break;
			case "B":
				targetKey = "showBurgs";
				break;
			case "M":
				targetKey = "showMilitary";
				break;
			case "K":
				targetKey = "showMarkers";
				break;
			case "L":
				targetKey = "showLabels";
				break;
			case "Z":
				targetKey = "showZones";
				break;
			case "D": targetKey = "showBorders"; break;
			case "C": targetKey = "showCoastlines"; break;
			case "I": targetKey = "showReliefIcons"; break;
			case "E": targetKey = "showEmblems"; break;
			case "S": targetKey = "showScalebar"; break;
		}

		if (targetKey) {
			const currentState = store.getState()[targetKey] as boolean;
			store.updateState({ [targetKey]: !currentState });
			renderLayers();
		}
	});
}
