import { store } from "../state/store";
import { initBiomeConfig } from "./biomes-editor";

export function mountEcologyEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Ensure biome config is initialized
	const configList = initBiomeConfig();

	container.innerHTML = `
    <div id="ecologyEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Ecology & Harvesting</span>
        <span id="closeEcologyBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <!-- 1. Biomes List Selection Panel -->
      <div id="ecoBiomesListPanel" style="margin-bottom: 0.8rem;">
        <label style="display: block; color: #94a3b8; font-size: 0.75rem; margin-bottom: 0.25rem;">Click Biome to Adjust Ecology:</label>
        <div style="max-height: 140px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; padding: 0.2rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.3rem 0.4rem;">Color</th>
                <th style="padding: 0.3rem 0.4rem;">Biome Name</th>
                <th style="padding: 0.3rem 0.4rem; text-align: right;">Harvest Good</th>
              </tr>
            </thead>
            <tbody id="ecoBiomesTableBody" style="color: #cbd5e1; cursor: pointer;"></tbody>
          </table>
        </div>
      </div>

      <!-- 2. Parameter Detail Adjust Form -->
      <div id="ecologyDetailForm" style="display: none; flex-direction: column; gap: 0.6rem; border-top: 1px solid #333; padding-top: 0.6rem;">
        <h4 id="ecologyBiomeTitle" style="margin: 0; color: #fbbf24; font-size: 0.85rem;">Adjust Parameters</h4>
        
        <!-- Plant Setting and Natural Resource Setting -->
        <div style="display: flex; gap: 0.5rem;">
          <div style="flex: 1;">
            <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.72rem;">
              <span>Plant Growth (0-100%):</span>
              <span id="lblPlantDensity" style="font-weight: bold; color: #10b981;">50%</span>
            </label>
            <input id="slidePlantDensity" type="range" min="0" max="100" value="50" style="width: 100%; cursor: pointer;" />
          </div>
          <div style="flex: 1;">
            <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.72rem;">
              <span>Natural Res. (0-100%):</span>
              <span id="lblResourceDensity" style="font-weight: bold; color: #10b981;">50%</span>
            </label>
            <input id="slideResourceDensity" type="range" min="0" max="100" value="50" style="width: 100%; cursor: pointer;" />
          </div>
        </div>

        <!-- Human Harvesting Factors and Needs Provided Goods -->
        <div style="display: flex; gap: 0.5rem; align-items: flex-end;">
          <div style="flex: 1;">
            <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.72rem;">
              <span>Harvest Intensity:</span>
              <span id="lblHarvestFactor" style="font-weight: bold; color: #10b981;">30%</span>
            </label>
            <input id="slideHarvestFactor" type="range" min="0" max="100" value="30" style="width: 100%; cursor: pointer;" />
          </div>
          <div style="flex: 1;">
            <label style="display: block; color: #cbd5e1; font-size: 0.72rem; margin-bottom: 0.2rem;">Provided Good:</label>
            <select id="selHarvestGood" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
              <option value="Fish">Fish</option>
              <option value="Wood">Wood</option>
              <option value="Stone">Stone</option>
              <option value="Marble">Marble</option>
              <option value="Iron">Iron</option>
              <option value="Copper">Copper</option>
              <option value="Tin">Tin</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
              <option value="Grain">Grain</option>
              <option value="Cattle">Cattle</option>
              <option value="Game">Game</option>
              <option value="Wine">Wine</option>
              <option value="Olives">Olives</option>
              <option value="Honey">Honey</option>
              <option value="Salt">Salt</option>
              <option value="Hemp">Hemp</option>
              <option value="Pearls">Pearls</option>
              <option value="Gemstones">Gemstones</option>
              <option value="Dyes">Dyes</option>
              <option value="Silk">Silk</option>
              <option value="Spices">Spices</option>
              <option value="Amber">Amber</option>
              <option value="Furs">Furs</option>
              <option value="Sheep">Sheep</option>
              <option value="Coal">Coal</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <div style="flex: 1;">
            <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.72rem;">
              <span>Prey Rate (0-200%):</span>
              <span id="lblPreyRate" style="font-weight: bold; color: #10b981;">100%</span>
            </label>
            <input id="slidePreyRate" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
          </div>
          <div style="flex: 1;">
            <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.72rem;">
              <span>Predator Sens (0-200%):</span>
              <span id="lblPredRate" style="font-weight: bold; color: #10b981;">100%</span>
            </label>
            <input id="slidePredRate" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
          </div>
        </div>

        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.72rem;">
            <span>Magic Sensitivity Modifier:</span>
            <span id="lblMagicSens" style="font-weight: bold; color: #10b981;">1.0x</span>
          </label>
          <input id="slideMagicSens" type="range" min="0.1" max="5.0" step="0.1" value="1.0" style="width: 100%; cursor: pointer;" />
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.2rem;">
          <button id="saveEcologyBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.78rem;">
            Save Biome Ecology Values
          </button>
          <button id="cancelEcologyBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.78rem;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

	const panel = document.getElementById("ecologyEditorPanel") as HTMLDivElement;
	const tableBody = document.getElementById(
		"ecoBiomesTableBody",
	) as HTMLTableSectionElement;
	const closeBtn = document.getElementById(
		"closeEcologyBtn",
	) as HTMLSpanElement;

	const detailForm = document.getElementById(
		"ecologyDetailForm",
	) as HTMLDivElement;
	const detailTitle = document.getElementById(
		"ecologyBiomeTitle",
	) as HTMLElement;

	// Inputs
	const slidePlant = document.getElementById(
		"slidePlantDensity",
	) as HTMLInputElement;
	const lblPlant = document.getElementById("lblPlantDensity") as HTMLSpanElement;

	const slideResource = document.getElementById(
		"slideResourceDensity",
	) as HTMLInputElement;
	const lblResource = document.getElementById(
		"lblResourceDensity",
	) as HTMLSpanElement;

	const slideHarvest = document.getElementById(
		"slideHarvestFactor",
	) as HTMLInputElement;
	const lblHarvest = document.getElementById(
		"lblHarvestFactor",
	) as HTMLSpanElement;

	const selGood = document.getElementById("selHarvestGood") as HTMLSelectElement;

	const preySlider = document.getElementById(
		"slidePreyRate",
	) as HTMLInputElement;
	const lblPrey = document.getElementById("lblPreyRate") as HTMLSpanElement;

	const predSlider = document.getElementById(
		"slidePredRate",
	) as HTMLInputElement;
	const lblPred = document.getElementById("lblPredRate") as HTMLSpanElement;

	const magicSlider = document.getElementById(
		"slideMagicSens",
	) as HTMLInputElement;
	const lblMagic = document.getElementById("lblMagicSens") as HTMLSpanElement;

	const saveBtn = document.getElementById(
		"saveEcologyBtn",
	) as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelEcologyBtn",
	) as HTMLButtonElement;

	let activeBiomeId: number | null = null;

	// Interactive feedback
	slidePlant.addEventListener("input", () => {
		lblPlant.innerText = slidePlant.value + "%";
	});
	slideResource.addEventListener("input", () => {
		lblResource.innerText = slideResource.value + "%";
	});
	slideHarvest.addEventListener("input", () => {
		lblHarvest.innerText = slideHarvest.value + "%";
	});
	preySlider.addEventListener("input", () => {
		lblPrey.innerText = preySlider.value + "%";
	});
	predSlider.addEventListener("input", () => {
		lblPred.innerText = predSlider.value + "%";
	});
	magicSlider.addEventListener("input", () => {
		lblMagic.innerText = parseFloat(magicSlider.value).toFixed(1) + "x";
	});

	const closePanel = () => {
		panel.style.display = "none";
	};
	closeBtn.addEventListener("click", closePanel);

	const renderEcoBiomesList = () => {
		tableBody.innerHTML = "";
		const currentList = (window as any).customBiomeConfig || configList;
		currentList.forEach((b: any) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.35rem 0.4rem;">
          <div style="width: 12px; height: 12px; background: ${b.color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;"></div>
        </td>
        <td style="padding: 0.35rem 0.4rem; color: #fff; font-weight: bold;">${b.name}</td>
        <td style="padding: 0.35rem 0.4rem; text-align: right; color: #fbbf24; font-weight: bold;">${b.harvestGoods || "None"}</td>
      `;
			tr.addEventListener("click", () => {
				activeBiomeId = b.id;
				detailTitle.innerText = `Adjusting Ecology: ${b.name}`;

				// Set values
				slidePlant.value = String(b.plantDensity ?? 50);
				lblPlant.innerText = (b.plantDensity ?? 50) + "%";

				slideResource.value = String(b.resourceDensity ?? 50);
				lblResource.innerText = (b.resourceDensity ?? 50) + "%";

				slideHarvest.value = String(b.humanHarvestFactor ?? 30);
				lblHarvest.innerText = (b.humanHarvestFactor ?? 30) + "%";

				selGood.value = b.harvestGoods || "Wood";

				preySlider.value = String(b.preyRate ?? 100);
				lblPrey.innerText = (b.preyRate ?? 100) + "%";

				predSlider.value = String(b.predRate ?? 100);
				lblPred.innerText = (b.predRate ?? 100) + "%";

				magicSlider.value = String(b.magicSens ?? 1.0);
				lblMagic.innerText = parseFloat(String(b.magicSens ?? 1.0)).toFixed(1) + "x";

				detailForm.style.display = "flex";
			});
			tableBody.appendChild(tr);
		});
	};

	saveBtn.addEventListener("click", () => {
		if (activeBiomeId !== null) {
			const currentList = (window as any).customBiomeConfig || configList;
			const b = currentList[activeBiomeId];
			if (b) {
				b.plantDensity = parseInt(slidePlant.value, 10);
				b.resourceDensity = parseInt(slideResource.value, 10);
				b.humanHarvestFactor = parseInt(slideHarvest.value, 10);
				b.harvestGoods = selGood.value;
				b.preyRate = parseInt(preySlider.value, 10);
				b.predRate = parseInt(predSlider.value, 10);
				b.magicSens = parseFloat(magicSlider.value);
			}

			store.updateState({
				preyRate: parseInt(preySlider.value, 10),
				predRate: parseInt(predSlider.value, 10),
				magicSens: parseFloat(magicSlider.value),
			});

			activeBiomeId = null;
			detailForm.style.display = "none";
			renderEcoBiomesList();
			onUpdate();
		}
	});

	cancelBtn.addEventListener("click", () => {
		activeBiomeId = null;
		detailForm.style.display = "none";
	});

	(window as any).openEcologyEditor = () => {
		renderEcoBiomesList();
		panel.style.display = "block";
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("biomes"); // Ecology relies on biomes layer
		}
	};
}
