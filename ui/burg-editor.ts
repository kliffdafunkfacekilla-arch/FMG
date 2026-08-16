import type { Burg } from "../simulation/civilization/burg-generator";
import { store } from "../state/store";

export function mountBurgEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="burgEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #f43f5e; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Burg Editor</span>
        <span id="closeBurgBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>
      <div style="display: flex; flex-direction: column; gap: 0.6rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">City Name:</label>
          <input id="editBurgName" type="text" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        
        <div style="display: flex; gap: 0.5rem;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Culture:</label>
            <select id="editBurgCulture" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;"></select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Type:</label>
            <select id="editBurgType" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              <option value="Generic">Generic</option>
              <option value="River">River</option>
              <option value="Lake">Lake</option>
              <option value="Naval">Naval</option>
              <option value="Nomadic">Nomadic</option>
              <option value="Highland">Highland</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Population:</label>
            <input id="editBurgPop" type="number" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end; font-size: 0.8rem; color: #94a3b8; line-height: 1.4; padding-left: 0.5rem;">
            <div>Elevation: <strong id="valBurgElevation" style="color: #fbbf24;">-</strong></div>
            <div>Temp: <strong id="valBurgTemp" style="color: #fbbf24;">-</strong></div>
          </div>
        </div>

        <!-- Features Checklist -->
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Features:</label>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; background: #0f0f12; padding: 0.5rem; border-radius: 6px; border: 1px solid #333;">
            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
              <input type="checkbox" id="chkBurgCapital" /> Capital
            </label>
            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
              <input type="checkbox" id="chkBurgPort" /> Port
            </label>
            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
              <input type="checkbox" id="chkBurgCitadel" /> Citadel
            </label>
            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
              <input type="checkbox" id="chkBurgWalls" /> Walls
            </label>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveBurgBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="cancelBurgBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

	let activeBurg: Burg | null = null;

	const panel = document.getElementById("burgEditorPanel") as HTMLDivElement;
	const nameInput = document.getElementById("editBurgName") as HTMLInputElement;
	const popInput = document.getElementById("editBurgPop") as HTMLInputElement;
	const cultureSelect = document.getElementById(
		"editBurgCulture",
	) as HTMLSelectElement;
	const _typeSelect = document.getElementById(
		"editBurgType",
	) as HTMLSelectElement;

	const chkCapital = document.getElementById(
		"chkBurgCapital",
	) as HTMLInputElement;
	const chkPort = document.getElementById("chkBurgPort") as HTMLInputElement;
	const _chkCitadel = document.getElementById(
		"chkBurgCitadel",
	) as HTMLInputElement;
	const _chkWalls = document.getElementById("chkBurgWalls") as HTMLInputElement;

	const valElevation = document.getElementById(
		"valBurgElevation",
	) as HTMLElement;
	const valTemp = document.getElementById("valBurgTemp") as HTMLElement;

	const saveBtn = document.getElementById("saveBurgBtn") as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelBurgBtn",
	) as HTMLButtonElement;
	const closeBtn = document.getElementById("closeBurgBtn") as HTMLSpanElement;

	const closePanel = () => {
		panel.style.display = "none";
	};

	closeBtn.addEventListener("click", closePanel);
	cancelBtn.addEventListener("click", closePanel);

	saveBtn.addEventListener("click", () => {
		if (activeBurg) {
			activeBurg.name = nameInput.value;
			activeBurg.population = parseInt(popInput.value, 10) || 1000;
			activeBurg.isCapital = chkCapital.checked;
			activeBurg.port = chkPort.checked ? 1 : 0;

			// Update state store
			const state = store.getState() as any;
			if (state.burgs) {
				const updatedBurgs = state.burgs.map((b: Burg) =>
					b.id === activeBurg?.id ? { ...activeBurg } : b,
				);

				// Also update cellCultures if culture changed
				const cellCultures = state.cellCultures
					? new Uint8Array(state.cellCultures)
					: null;
				if (cellCultures && cultureSelect.value) {
					cellCultures[activeBurg.cell] = parseInt(cultureSelect.value, 10);
				}

				store.updateState({
					burgs: updatedBurgs,
					cellCultures,
				});
			}

			panel.style.display = "none";
			onUpdate();
		}
	});

	// Export activation hook
	(window as any).openBurgEditor = (burg: Burg) => {
		activeBurg = burg;
		nameInput.value = burg.name;
		popInput.value = String(burg.population);

		chkCapital.checked = !!burg.isCapital;
		chkPort.checked = !!burg.port;

		// Read state parameters
		const state = store.getState() as any;

		// Populate Culture dropdown
		cultureSelect.innerHTML = "";
		if (state.cultures) {
			state.cultures.forEach((c: any) => {
				const opt = document.createElement("option");
				opt.value = String(c.id);
				opt.innerText = c.name;
				if (state.cellCultures && state.cellCultures[burg.cell] === c.id) {
					opt.selected = true;
				}
				cultureSelect.appendChild(opt);
			});
		}

		// Display height and temperature
		const heightVal = state.heights ? state.heights[burg.cell] : 0;
		const tempVal = state.temp ? state.temp[burg.cell] : 0;

		valElevation.innerText = `${Math.round(heightVal * 15)}m`;
		valTemp.innerText = `${Math.round(tempVal)}°C`;

		panel.style.display = "block";
	};
}
