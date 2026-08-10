import { store } from "../state/store";

export function mountEcologyEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="ecologyEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Ecology Editor</span>
        <span id="closeEcologyBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <div>
        <label style="display: block; color: #94a3b8; font-size: 0.75rem; margin-bottom: 0.25rem;">Select Target Biome:</label>
        <select id="ecoBiomeSelect" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
          <option value="0">Marine (Oceans)</option>
          <option value="6">Deciduous Forest</option>
          <option value="7">Rainforest</option>
          <option value="1">Hot desert</option>
          <option value="10">Tundra</option>
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.6rem; border-top: 1px solid #333; padding-top: 0.6rem;">
        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Prey Consumption Rate (0-200%):</span>
            <span id="lblPreyRate" style="font-weight: bold; color: #10b981;">100%</span>
          </label>
          <input id="slidePreyRate" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
        </div>

        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Predator Sensitivity (0-200%):</span>
            <span id="lblPredRate" style="font-weight: bold; color: #10b981;">100%</span>
          </label>
          <input id="slidePredRate" type="range" min="0" max="200" value="100" style="width: 100%; cursor: pointer;" />
        </div>

        <div>
          <label style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.75rem;">
            <span>Magic Sensitivity Modifier:</span>
            <span id="lblMagicSens" style="font-weight: bold; color: #10b981;">1.0x</span>
          </label>
          <input id="slideMagicSens" type="range" min="0.1" max="5.0" step="0.1" value="1.0" style="width: 100%; cursor: pointer;" />
        </div>

        <button id="saveEcologyBtn" style="background: #10b981; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; width: 100%; margin-top: 0.2rem;">
          Save Biome Ecology Values
        </button>
      </div>
    </div>
  `;

  const panel = document.getElementById("ecologyEditorPanel") as HTMLDivElement;
  const closeBtn = document.getElementById("closeEcologyBtn") as HTMLSpanElement;

  const preySlider = document.getElementById("slidePreyRate") as HTMLInputElement;
  const lblPrey = document.getElementById("lblPreyRate") as HTMLSpanElement;
  const predSlider = document.getElementById("slidePredRate") as HTMLInputElement;
  const lblPred = document.getElementById("lblPredRate") as HTMLSpanElement;
  const magicSlider = document.getElementById("slideMagicSens") as HTMLInputElement;
  const lblMagic = document.getElementById("lblMagicSens") as HTMLSpanElement;

  const saveBtn = document.getElementById("saveEcologyBtn") as HTMLButtonElement;

  preySlider.addEventListener("input", () => { lblPrey.innerText = preySlider.value + "%"; });
  predSlider.addEventListener("input", () => { lblPred.innerText = predSlider.value + "%"; });
  magicSlider.addEventListener("input", () => { lblMagic.innerText = parseFloat(magicSlider.value).toFixed(1) + "x"; });

  const closePanel = () => {
    panel.style.display = "none";
  };
  closeBtn.addEventListener("click", closePanel);

  saveBtn.addEventListener("click", () => {
    // Ecology adjustments save locally or notify simulation changes
    panel.style.display = "none";
    onUpdate();
  });

  (window as any).openEcologyEditor = () => {
    panel.style.display = "block";
    const win = window as any;
    if (win.triggerLayerSelect) {
      win.triggerLayerSelect("biomes"); // Ecology relies on biomes layer
    }
  };
}
