import type { Burg } from "../simulation/civilization/burg-generator";
import type { State } from "../simulation/civilization/state-generator";
import { store } from "../state/store";

export function mountStateEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="stateEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #3b82f6; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span id="stateEditorTitle">States Overview</span>
        <span id="closeStateBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <!-- 1. Sub Panel: States List Table -->
      <div id="stateListSubPanel" style="display: block;">
        <div style="max-height: 220px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.4rem;">Color</th>
                <th style="padding: 0.4rem;">State</th>
                <th style="padding: 0.4rem;">Capital</th>
                <th style="padding: 0.4rem; text-align: center;">Edit</th>
              </tr>
            </thead>
            <tbody id="stateTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>
      </div>

      <!-- 2. Sub Panel: State Details Edit Form -->
      <div id="stateDetailSubPanel" style="display: none; flex-direction: column; gap: 0.6rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">State Name:</label>
          <input id="editStateName" type="text" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Capital City:</label>
          <select id="editStateCapital" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;"></select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Border Color (Hex):</label>
          <input id="editStateColor" type="color" style="width: 100%; height: 35px; border: none; background: transparent; cursor: pointer;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Expansionism (0.1–10.0):</label>
          <input id="editStateExpansionism" type="range" min="0.1" max="10.0" step="0.1" value="1.0" style="width: 100%; cursor: pointer;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Xenophobia (0.0–1.0):</label>
          <input id="editStateXenophobia" type="range" min="0.0" max="1.0" step="0.05" value="0.2" style="width: 100%; cursor: pointer;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Government Type:</label>
          <select id="editStateGovernment" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
            <option value="Monarchy">Monarchy</option>
            <option value="Republic">Republic</option>
            <option value="Empire">Empire</option>
            <option value="Theocracy">Theocracy</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Heraldry Motif:</label>
          <select id="editStateHeraldry" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
            <option value="Lion">Lion Rampant</option>
            <option value="Eagle">Imperial Eagle</option>
            <option value="Shield">Cross Shield</option>
            <option value="Stripes">Stripes Chevron</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Habitat Type:</label>
          <select id="editStateHabitat" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
            <option value="land">Land</option>
            <option value="ocean">Ocean</option>
            <option value="amphibious">Amphibious</option>
          </select>
        </div>
        <div style="background: rgba(16, 185, 129, 0.1); padding: 0.5rem; border-radius: 4px; border: 1px dashed rgba(16, 185, 129, 0.3); margin-top: 0.5rem;">
          <label style="display: block; margin-bottom: 0.2rem; color: #10b981; font-weight: bold;">State Tech Level:</label>
          <div id="valStateTechLevel" style="color: #fff; font-size: 1.2rem; font-weight: bold; margin-bottom: 0.2rem;">0.0</div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8; font-size: 0.75rem;">Unlocked Technologies:</label>
          <div id="valStateTechnologies" style="color: #cbd5e1; font-size: 0.8rem;">None</div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveStateBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="backToStateListBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Back</button>
        </div>
      </div>

    </div>
  `;

	let activeState: State | null = null;

	const panel = document.getElementById("stateEditorPanel") as HTMLDivElement;
	const listPanel = document.getElementById(
		"stateListSubPanel",
	) as HTMLDivElement;
	const detailPanel = document.getElementById(
		"stateDetailSubPanel",
	) as HTMLDivElement;
	const titleText = document.getElementById("stateEditorTitle") as HTMLElement;

	const tableBody = document.getElementById(
		"stateTableBody",
	) as HTMLTableSectionElement;
	const nameInput = document.getElementById(
		"editStateName",
	) as HTMLInputElement;
	const capitalSelect = document.getElementById(
		"editStateCapital",
	) as HTMLSelectElement;
	const colorInput = document.getElementById(
		"editStateColor",
	) as HTMLInputElement;

	const saveBtn = document.getElementById("saveStateBtn") as HTMLButtonElement;
	const backBtn = document.getElementById(
		"backToStateListBtn",
	) as HTMLButtonElement;
	const closeBtn = document.getElementById("closeStateBtn") as HTMLSpanElement;

	const closePanel = () => {
		panel.style.display = "none";
	};

	closeBtn.addEventListener("click", closePanel);

	const showList = () => {
		titleText.innerText = "States Overview";
		listPanel.style.display = "block";
		detailPanel.style.display = "none";
		renderStatesList();
	};

	backBtn.addEventListener("click", showList);

	const renderStatesList = () => {
		const stateData = store.getState() as any;
		const states = stateData.states || [];
		const burgs = stateData.burgs || [];

		tableBody.innerHTML = "";
		states.forEach((s: State) => {
			const capitalBurg = burgs.find((b: Burg) => b.id === s.capital);
			const capName = capitalBurg ? capitalBurg.name : "None";

			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.4rem;"><div style="width: 14px; height: 14px; background: ${s.color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;"></div></td>
        <td style="padding: 0.4rem; font-weight: bold; color: #fff;">${s.name}</td>
        <td style="padding: 0.4rem; color: #94a3b8;">${capName}</td>
        <td style="padding: 0.4rem; text-align: center;"><button class="editSingleStateBtn" data-id="${s.id}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button></td>
      `;
			tableBody.appendChild(tr);
		});

		// Add click listeners
		const editBtns = tableBody.querySelectorAll(".editSingleStateBtn");
		editBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const id = parseInt(
					(e.currentTarget as HTMLButtonElement).getAttribute("data-id") || "0",
					10,
				);
				const targetState = states.find((s: State) => s.id === id);
				if (targetState) {
					(window as any).openStateEditor(targetState);
				}
			});
		});
	};

	saveBtn.addEventListener("click", () => {
		if (activeState) {
			activeState.name = nameInput.value;
			activeState.color = colorInput.value;
			activeState.capital = parseInt(capitalSelect.value, 10) || 0;

			const habitatSelect = document.getElementById(
				"editStateHabitat",
			) as HTMLSelectElement;
			activeState.habitat = (habitatSelect?.value || "land") as any;

			const expInput = document.getElementById(
				"editStateExpansionism",
			) as HTMLInputElement;
			const xenoInput = document.getElementById(
				"editStateXenophobia",
			) as HTMLInputElement;
			const govSelect = document.getElementById(
				"editStateGovernment",
			) as HTMLSelectElement;
			const herSelect = document.getElementById(
				"editStateHeraldry",
			) as HTMLSelectElement;

			activeState.expansionism = parseFloat(expInput?.value || "1.0");
			activeState.xenophobia = parseFloat(xenoInput?.value || "0.2");
			activeState.governmentType = govSelect?.value || "Monarchy";
			activeState.heraldry = herSelect?.value || "Lion";

			// Update capital center based on selected capital burg
			const stateData = store.getState() as any;
			const burgs = stateData.burgs || [];
			const selectedBurg = burgs.find(
				(b: Burg) => b.id === activeState!.capital,
			);
			if (selectedBurg) {
				activeState.center = selectedBurg.cell;
			}

			if (stateData.states) {
				const updatedStates = stateData.states.map((s: State) =>
					s.id === activeState!.id ? { ...activeState } : s,
				);
				store.updateState({ states: updatedStates });
			}

			showList();
			onUpdate();
		}
	});

	// Export activation hook
	(window as any).openStateEditor = (state: State) => {
		activeState = state;
		titleText.innerText = `Edit: ${state.name}`;
		nameInput.value = state.name;
		colorInput.value = state.color;

		const habitatSelect = document.getElementById(
			"editStateHabitat",
		) as HTMLSelectElement;
		if (habitatSelect) {
			habitatSelect.value = state.habitat || "land";
		}

		const expInput = document.getElementById(
			"editStateExpansionism",
		) as HTMLInputElement;
		const xenoInput = document.getElementById(
			"editStateXenophobia",
		) as HTMLInputElement;
		const govSelect = document.getElementById(
			"editStateGovernment",
		) as HTMLSelectElement;
		const herSelect = document.getElementById(
			"editStateHeraldry",
		) as HTMLSelectElement;

		if (expInput) expInput.value = String(state.expansionism ?? 1.0);
		if (xenoInput) xenoInput.value = String(state.xenophobia ?? 0.2);
		if (govSelect) govSelect.value = state.governmentType || "Monarchy";
		if (herSelect) herSelect.value = state.heraldry || "Lion";

		// Populate capitals select dropdown
		capitalSelect.innerHTML = "";
		const stateData = store.getState() as any;
		const burgs = stateData.burgs || [];

		burgs.forEach((b: Burg) => {
			const opt = document.createElement("option");
			opt.value = String(b.id);
			opt.innerText = b.name;
			if (b.id === state.capital) {
				opt.selected = true;
			}
			capitalSelect.appendChild(opt);
		});

		if (s.technologies && s.technologies.length > 0) {
			(document.getElementById("valStateTechnologies") as HTMLDivElement).innerText = s.technologies.join(", ");
		} else {
			(document.getElementById("valStateTechnologies") as HTMLDivElement).innerText = "None";
		}
		(document.getElementById("valStateTechLevel") as HTMLDivElement).innerText = (s.techLevel || 0).toFixed(1);

		listPanel.style.display = "none";
		detailPanel.style.display = "flex";
		panel.style.display = "block";
	};

	// Export base list hook
	(window as any).openStatesList = () => {
		showList();
		panel.style.display = "block";
	};
}
