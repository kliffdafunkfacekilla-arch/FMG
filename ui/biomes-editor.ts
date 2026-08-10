import { store } from "../state/store";

export function mountBiomesEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="biomesEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Biomes Editor</span>
        <span id="closeBiomesBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <!-- Paint Tool Toggle -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 6px; margin-bottom: 0.6rem;">
        <span style="font-weight: bold; color: #10b981;">Paint Biome Tool:</span>
        <select id="biomePaintSelect" style="padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
          <option value="-1">Paint Tool Off</option>
          <option value="0">Marine</option>
          <option value="15">Pelagic Zone</option>
          <option value="1">Hot Desert</option>
          <option value="3">Savanna</option>
          <option value="4">Grassland</option>
          <option value="6">Deciduous Forest</option>
          <option value="7">Rainforest</option>
          <option value="10">Tundra</option>
          <option value="12">Wetland</option>
          <option value="13">Shallow Reef</option>
          <option value="14">Kelp Forest</option>
        </select>
      </div>

      <div style="max-height: 200px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
              <th style="padding: 0.4rem;">Color</th>
              <th style="padding: 0.4rem;">Biome Name</th>
              <th style="padding: 0.4rem; text-align: center;">Edit</th>
            </tr>
          </thead>
          <tbody id="biomesTableBody" style="color: #cbd5e1;"></tbody>
        </table>
      </div>

      <div id="biomeEditForm" style="display: none; flex-direction: column; gap: 0.6rem; border-top: 1px solid #333; padding-top: 0.6rem;">
        <h4 style="margin: 0; color: #fbbf24; font-size: 0.85rem;" id="biomeEditTitle">Edit Biome Parameters</h4>
        
        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Color (Hex):</label>
            <input id="editBiomeColor" type="color" style="width: 100%; height: 30px; border: none; background: transparent; cursor: pointer;" />
          </div>
          <div style="flex: 2;">
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Target Temp (°C):</label>
            <input id="editBiomeTemp" type="number" min="-30" max="50" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
        </div>

        <div>
          <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Target Moisture (0-100%):</label>
          <input id="editBiomeMoisture" type="range" min="0" max="100" style="width: 100%; cursor: pointer;" />
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
          <button id="saveBiomeBtn" style="flex: 1; background: #10b981; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="cancelBiomeBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const panel = document.getElementById("biomesEditorPanel") as HTMLDivElement;
  const tableBody = document.getElementById("biomesTableBody") as HTMLTableSectionElement;
  const closeBtn = document.getElementById("closeBiomesBtn") as HTMLSpanElement;

  const paintSelect = document.getElementById("biomePaintSelect") as HTMLSelectElement;
  const editForm = document.getElementById("biomeEditForm") as HTMLDivElement;
  const editTitle = document.getElementById("biomeEditTitle") as HTMLElement;

  const colorInput = document.getElementById("editBiomeColor") as HTMLInputElement;
  const tempInput = document.getElementById("editBiomeTemp") as HTMLInputElement;
  const moistInput = document.getElementById("editBiomeMoisture") as HTMLInputElement;

  const saveBtn = document.getElementById("saveBiomeBtn") as HTMLButtonElement;
  const cancelBtn = document.getElementById("cancelBiomeBtn") as HTMLButtonElement;

  let activeBiomeId: number | null = null;

  const biomeNames = [
    "Marine", "Hot desert", "Cold desert", "Savanna", "Grassland",
    "Tropical seasonal forest", "Temperate deciduous forest", "Tropical rainforest",
    "Temperate rainforest", "Taiga", "Tundra", "Glacier", "Wetland",
    "Shallow Reef", "Kelp Forest", "Pelagic Zone", "Abyssal Plain",
    "Oceanic Trench", "Chaos Land", "Chaos Water"
  ];

  // Default color map for reference or updates
  const defaultColors = [
    "#0077be", "#e6c280", "#b3d1ff", "#c2d68f", "#9bbb59",
    "#4f81bd", "#8064a2", "#31859c", "#4bacc6", "#2c5234",
    "#7f7f7f", "#ffffff", "#76b5c5", "#15b8a6", "#22c55e",
    "#1d4ed8", "#172554", "#030712", "#ec4899", "#8b5cf6"
  ];

  const closePanel = () => {
    panel.style.display = "none";
  };
  closeBtn.addEventListener("click", closePanel);

  const renderBiomesTable = () => {
    tableBody.innerHTML = "";
    biomeNames.forEach((name, idx) => {
      const color = defaultColors[idx] || "#ffffff";
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #222";
      tr.innerHTML = `
        <td style="padding: 0.4rem;">
          <div style="width: 14px; height: 14px; background: ${color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;"></div>
        </td>
        <td style="padding: 0.4rem; color: #fff; font-weight: bold;">${name}</td>
        <td style="padding: 0.4rem; text-align: center;">
          <button class="editSingleBiomeBtn" data-id="${idx}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    const editBtns = tableBody.querySelectorAll(".editSingleBiomeBtn");
    editBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).getAttribute("data-id") || "0", 10);
        activeBiomeId = id;
        editTitle.innerText = `Edit: ${biomeNames[id]}`;
        colorInput.value = defaultColors[id] || "#ffffff";
        tempInput.value = "15"; // fallback mid-value
        moistInput.value = "50";
        editForm.style.display = "flex";
      });
    });
  };

  saveBtn.addEventListener("click", () => {
    if (activeBiomeId !== null) {
      // Modify local color configurations
      defaultColors[activeBiomeId] = colorInput.value;
      editForm.style.display = "none";
      renderBiomesTable();
      onUpdate();
    }
  });

  cancelBtn.addEventListener("click", () => {
    editForm.style.display = "none";
  });

  // Export paint value retrieval globally
  (window as any).getCurrentBiomePaintValue = (): number => {
    return parseInt(paintSelect.value, 10);
  };

  (window as any).openBiomesEditor = () => {
    renderBiomesTable();
    panel.style.display = "block";
    const win = window as any;
    if (win.triggerLayerSelect) {
      win.triggerLayerSelect("biomes"); // Auto shift map view to Biomes
    }
  };
}
