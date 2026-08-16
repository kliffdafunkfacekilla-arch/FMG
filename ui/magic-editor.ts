import { store } from "../state/store";

export function mountMagicEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="magicEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #7c3aed; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Magic & Ley Lines Editor</span>
        <span id="closeMagicBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem;">
        <button id="createMagicBtn" style="background: #10b981; border: none; padding: 0.3rem 0.6rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.2rem;">
          <span>➕</span> Create Magic
        </button>
      </div>

      <div style="max-height: 150px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
              <th style="padding: 0.4rem;">Type</th>
              <th style="padding: 0.4rem;">Wieldability</th>
              <th style="padding: 0.4rem;">Rarity</th>
              <th style="padding: 0.4rem; text-align: center;">Cost</th>
              <th style="padding: 0.4rem; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody id="magicTableBody" style="color: #cbd5e1;"></tbody>
        </table>
      </div>


      <div id="magicEditForm" style="display: none; flex-direction: column; gap: 0.6rem; border-top: 1px solid #333; padding-top: 0.6rem;">
        <h4 style="margin: 0; color: #fbbf24; font-size: 0.85rem;" id="magicEditTitle">Edit Magic Parameters</h4>
        
        <div>
          <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Source / Wieldability:</label>
          <select id="editMagicWield" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="innate">Innate (Genetic)</option>
            <option value="learned">Learned (Academic)</option>
            <option value="divine">Divine (Blessing)</option>
          </select>
        </div>

        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Mana Cost:</label>
            <input id="editMagicCost" type="number" min="1" max="100" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
          <div style="flex: 1;">
            <label style="display: block; color: #94a3b8; font-size: 0.75rem;">User Ratio (%):</label>
            <input id="editMagicRatio" type="number" step="0.1" min="0.0" max="10.0" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
        </div>

        <div>
          <label style="display: block; color: #94a3b8; font-size: 0.75rem;">Ley Line Boost Factor (1.0 - 5.0):</label>
          <input id="editLeyBoost" type="range" min="1.0" max="5.0" step="0.1" value="2.0" style="width: 100%; cursor: pointer;" />
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
          <button id="saveMagicBtn" style="flex: 1; background: #10b981; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="cancelMagicBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

	const panel = document.getElementById("magicEditorPanel") as HTMLDivElement;
	const tableBody = document.getElementById(
		"magicTableBody",
	) as HTMLTableSectionElement;
	const closeBtn = document.getElementById("closeMagicBtn") as HTMLSpanElement;

	const editForm = document.getElementById("magicEditForm") as HTMLDivElement;
	const editTitle = document.getElementById("magicEditTitle") as HTMLElement;
	const wieldSelect = document.getElementById(
		"editMagicWield",
	) as HTMLSelectElement;
	const costInput = document.getElementById(
		"editMagicCost",
	) as HTMLInputElement;
	const ratioInput = document.getElementById(
		"editMagicRatio",
	) as HTMLInputElement;
	const leySlider = document.getElementById("editLeyBoost") as HTMLInputElement;

	const saveBtn = document.getElementById("saveMagicBtn") as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelMagicBtn",
	) as HTMLButtonElement;

	let activeIndex: number | null = null;

	const closePanel = () => {
		panel.style.display = "none";
	};
	closeBtn.addEventListener("click", closePanel);

	const renderMagicTable = () => {
		const state = store.getState() as any;
		const types = state.magicTypes || [];

		tableBody.innerHTML = "";
		types.forEach((t: any, idx: number) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.4rem; color: #fff; font-weight: bold;">${t.name}</td>
        <td style="padding: 0.4rem; color: #94a3b8;">${t.wieldability}</td>
        <td style="padding: 0.4rem; color: #22c55e;">${(t.rarity * 100).toFixed(2)}%</td>
        <td style="padding: 0.4rem; text-align: center; color: #eab308; font-weight: bold;">${t.cost}</td>
        <td style="padding: 0.4rem; text-align: center; display: flex; gap: 0.25rem; justify-content: center;">
          <button class="editSingleMagicBtn" data-idx="${idx}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
          <button class="deleteSingleMagicBtn" data-idx="${idx}" style="background: #ef4444; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Del</button>
        </td>
      `;
			tableBody.appendChild(tr);
		});

		const editBtns = tableBody.querySelectorAll(".editSingleMagicBtn");
		editBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const idx = parseInt(
					(e.currentTarget as HTMLButtonElement).getAttribute("data-idx") ||
						"0",
					10,
				);
				activeIndex = idx;
				const t = types[idx];
				if (t) {
					editTitle.innerText = `Edit: ${t.name}`;
					wieldSelect.value = t.wieldability;
					costInput.value = String(t.cost);
					ratioInput.value = String(t.rarity * 100);
					leySlider.value = "2.0"; // default placeholder
					editForm.style.display = "flex";
				}
			});
		});
<<<<<<< HEAD

		const delBtns = tableBody.querySelectorAll(".deleteSingleMagicBtn");
		delBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const idx = parseInt(
					(e.currentTarget as HTMLButtonElement).getAttribute("data-idx") ||
						"0",
					10,
				);
				const state = store.getState() as any;
				const currentTypes = [...(state.magicTypes || [])];
				currentTypes.splice(idx, 1);
				store.updateState({ magicTypes: currentTypes });
				renderMagicTable();
				onUpdate();
			});
		});
	};

	const createBtn = document.getElementById("createMagicBtn") as HTMLButtonElement;
	if (createBtn) {
		createBtn.addEventListener("click", () => {
			const state = store.getState() as any;
			const currentTypes = [...(state.magicTypes || [])];
			const nextId = currentTypes.length + 1;
			currentTypes.push({
				name: `Ley-Magic ${nextId}`,
				wieldability: "learned",
				rarity: 0.05,
				cost: 15
			});
			store.updateState({ magicTypes: currentTypes });
			renderMagicTable();
			onUpdate();
		});
	}


	saveBtn.addEventListener("click", () => {
		if (activeIndex !== null) {
			const state = store.getState() as any;
			const types = [...(state.magicTypes || [])];
			if (types[activeIndex]) {
				types[activeIndex].wieldability = wieldSelect.value as any;
				types[activeIndex].cost = parseInt(costInput.value, 10);
				types[activeIndex].rarity = parseFloat(ratioInput.value) / 100;
				store.updateState({ magicTypes: types });
			}
			activeIndex = null;
			editForm.style.display = "none";
			renderMagicTable();
			onUpdate();
		}
	});

	cancelBtn.addEventListener("click", () => {
		editForm.style.display = "none";
	});

=======
	};

	saveBtn.addEventListener("click", () => {
		if (activeIndex !== null) {
			const state = store.getState() as any;
			const types = [...(state.magicTypes || [])];
			if (types[activeIndex]) {
				types[activeIndex].wieldability = wieldSelect.value as any;
				types[activeIndex].cost = parseInt(costInput.value, 10);
				types[activeIndex].rarity = parseFloat(ratioInput.value) / 100;
				store.updateState({ magicTypes: types });
			}
			activeIndex = null;
			editForm.style.display = "none";
			renderMagicTable();
			onUpdate();
		}
	});

	cancelBtn.addEventListener("click", () => {
		editForm.style.display = "none";
	});

>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
	(window as any).openMagicEditor = () => {
		renderMagicTable();
		panel.style.display = "block";
	};
}
