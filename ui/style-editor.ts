import { store } from "../state/store";

export function mountStyleEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const defaultStyles = JSON.stringify(store.getState().layerStyles);

	container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
      <h4 style="margin: 0; color: #10b981; font-size: 0.95rem;">Visual Theme Preset</h4>
      <select id="stylePreset" style="width: 100%; padding: 0.4rem; background: #0f0f12; border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 6px; cursor: pointer;">
        <option value="classic">Classic (Default)</option>
        <option value="monochrome">Grayscale (Heights)</option>
        <option value="clean">Minimalist</option>
      </select>
      
      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.6rem; margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; color: #10b981; font-size: 0.9rem;">Layer Style Customizer</h4>
            <button id="styleResetBtn" style="background: #ef4444; border: none; padding: 0.2rem 0.5rem; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Reset All</button>
        </div>
        <select id="styleLayerSelect" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 4px; cursor: pointer;">
          <option value="heightmap">Heightmap Style</option>
          <option value="biomes">Biomes Style</option>
          <option value="cultures">Cultures Style</option>
          <option value="states">States Style</option>
          <option value="provinces">Provinces Style</option>
          <option value="religions">Religions Style</option>
          <option value="goods">Goods Style</option>
          <option value="temp">Temperature Style</option>
          <option value="prec">Precipitation Style</option>
          <option value="grid">Grid/Cells Style</option>
          <option value="rivers">Rivers Style</option>
          <option value="routes">Routes Style</option>
          <option value="burgs">Burgs Style</option>
          <option value="military">Military Style</option>
          <option value="markers">Markers Style</option>
          <option value="labels">Labels Style</option>
          <option value="zones">Zones Style</option>
        </select>
        
        <div id="styleControls" style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem; color: #cbd5e1; width: 100%;">
        </div>
        
        <!-- Global map color filter toggle -->
        <div style="margin-top: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.85rem; color: #cbd5e1;">Global Color Filter (Sepia):</span>
            <input type="checkbox" id="globalFilterToggle" style="cursor: pointer;" />
        </div>
      </div>
    </div>
  `;

	const presetSelect = document.getElementById(
		"stylePreset",
	) as HTMLSelectElement;
	const layerSelect = document.getElementById(
		"styleLayerSelect",
	) as HTMLSelectElement;
	const controlsDiv = document.getElementById(
		"styleControls",
	) as HTMLDivElement;
	const resetBtn = document.getElementById(
		"styleResetBtn",
	) as HTMLButtonElement;
	const filterToggle = document.getElementById(
		"globalFilterToggle",
	) as HTMLInputElement;

	presetSelect.addEventListener("change", () => {
		const val = presetSelect.value;
		const windowObj = window as any;
		if (val === "monochrome") {
			windowObj.triggerLayerSelect("heightmap");
		} else {
			windowObj.triggerLayerSelect("states");
		}
		onUpdate();
	});

	resetBtn.addEventListener("click", () => {
		store.updateState({ layerStyles: JSON.parse(defaultStyles) });
		renderControls();
		onUpdate();
	});

	filterToggle.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement;
		if (canvas) {
			if (target.checked) {
				canvas.style.filter = "sepia(0.4) contrast(1.1) brightness(0.9)";
			} else {
				canvas.style.filter = "none";
			}
		}
	});

	const renderControls = () => {
		const layer = layerSelect.value;
		const state = store.getState();
		const currentStyle = state.layerStyles[layer] || {
			opacity: 1,
			color: "#ffffff",
			size: 1,
		};

		controlsDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label>Opacity (<span id="opacityVal">${currentStyle.opacity}</span>)</label>
            <input type="range" id="styleOpacity" min="0" max="1" step="0.05" value="${currentStyle.opacity}" style="width: 100px; cursor: pointer;">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label>Size / Stroke</label>
            <input type="number" id="styleSize" min="0.1" max="50" step="0.1" value="${currentStyle.size || 1}" style="width: 60px; background: #0f0f12; color: white; border: 1px solid #444; border-radius: 4px; padding: 2px;">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label>Color Base</label>
            <input type="color" id="styleColor" value="${colorToHex(currentStyle.color)}" style="background: transparent; border: none; padding: 0; width: 24px; height: 24px; cursor: pointer;">
        </div>
    `;

		document.getElementById("styleOpacity")?.addEventListener("input", (e) => {
			const val = parseFloat((e.target as HTMLInputElement).value);
			document.getElementById("opacityVal")!.innerText = val.toString();
			updateStyle(layer, { opacity: val });
		});

		document.getElementById("styleSize")?.addEventListener("change", (e) => {
			const val = parseFloat((e.target as HTMLInputElement).value);
			updateStyle(layer, { size: val });
		});

		document.getElementById("styleColor")?.addEventListener("change", (e) => {
			const val = (e.target as HTMLInputElement).value;
			updateStyle(layer, { color: val });
		});
	};

	const updateStyle = (layer: string, changes: any) => {
		const state = store.getState();
		const current = state.layerStyles[layer] || {};
		const newStyles = {
			...state.layerStyles,
			[layer]: { ...current, ...changes },
		};
		store.updateState({ layerStyles: newStyles });
		onUpdate();
	};

	const colorToHex = (color: string) => {
		if (!color) return "#ffffff";
		if (color.startsWith("#")) {
			if (color.length === 4) {
				return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
			}
			if (color.length > 7) {
				return color.substring(0, 7);
			}
			return color;
		}
		if (color.startsWith("rgba") || color.startsWith("rgb")) {
			const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
			if (m) {
				const r = parseInt(m[1], 10).toString(16).padStart(2, "0");
				const g = parseInt(m[2], 10).toString(16).padStart(2, "0");
				const b = parseInt(m[3], 10).toString(16).padStart(2, "0");
				return `#${r}${g}${b}`;
			}
		}
		return "#ffffff"; // fallback
	};

	layerSelect.addEventListener("change", renderControls);
	renderControls();
}
