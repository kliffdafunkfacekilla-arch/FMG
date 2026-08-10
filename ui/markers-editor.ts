import { store } from "../state/store";
import { generateMarkers } from "../simulation/civilization/markers-generator";

export function mountMarkersEditor(containerId: string, onUpdate: () => void) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div id="markersEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Markers Editor</span>
        <span id="closeMarkersBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <div style="max-height: 180px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
              <th style="padding: 0.4rem;">Icon</th>
              <th style="padding: 0.4rem;">Marker Type</th>
              <th style="padding: 0.4rem;">Req. Biome</th>
              <th style="padding: 0.4rem; text-align: center;">Frequency</th>
            </tr>
          </thead>
          <tbody id="markersTableBody" style="color: #cbd5e1;"></tbody>
        </table>
      </div>

      <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem;">
        <button id="regenAllMarkersBtn" style="flex: 1; background: #eab308; border: none; padding: 0.35rem; color: black; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
          🔄 Regenerate Markers
        </button>
      </div>
    </div>
  `;

  const panel = document.getElementById("markersEditorPanel") as HTMLDivElement;
  const tableBody = document.getElementById("markersTableBody") as HTMLTableSectionElement;
  const closeBtn = document.getElementById("closeMarkersBtn") as HTMLSpanElement;
  const regenBtn = document.getElementById("regenAllMarkersBtn") as HTMLButtonElement;

  const closePanel = () => {
    panel.style.display = "none";
  };
  closeBtn.addEventListener("click", closePanel);

  const markerTypes = [
    { icon: "🏔️", type: "Mountain Peak", biome: "Taiga / Glacier", freq: "Medium" },
    { icon: "🌋", type: "Volcanic Fissure", biome: "Chaos Land", freq: "Low" },
    { icon: "🏝️", type: "Reef Atoll", biome: "Shallow Reef", freq: "High" },
    { icon: "遺跡", type: "Ancient Ruins", biome: "Any Land", freq: "Low" },
    { icon: "🌲", type: "Sacred Grove", biome: "deciduous Forest", freq: "Medium" }
  ];

  const renderMarkersTable = () => {
    tableBody.innerHTML = "";
    markerTypes.forEach((m) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #222";
      tr.innerHTML = `
        <td style="padding: 0.4rem; font-size: 1.1rem; text-align: center;">${m.icon}</td>
        <td style="padding: 0.4rem; color: #fff; font-weight: bold;">${m.type}</td>
        <td style="padding: 0.4rem; color: #94a3b8;">${m.biome}</td>
        <td style="padding: 0.4rem; text-align: center; color: #a855f7; font-weight: bold;">${m.freq}</td>
      `;
      tableBody.appendChild(tr);
    });
  };

  regenBtn.addEventListener("click", () => {
    const state = store.getState() as any;
    if (!state.grid || !state.heights || !state.biomes) return;
    const nextMarkers = generateMarkers(state.grid, state.heights, state.biomes, state.seed || "regen-seed");
    store.updateState({ markers: nextMarkers });
    onUpdate();
  });

  (window as any).openMarkersEditor = () => {
    renderMarkersTable();
    panel.style.display = "block";
    const win = window as any;
    if (win.triggerLayerSelect) {
      win.triggerLayerSelect("markers"); // Auto switch map view to Markers
    }
  };
}
