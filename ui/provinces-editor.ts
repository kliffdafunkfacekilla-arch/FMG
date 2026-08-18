import { store } from "../state/store";

export function mountProvincesEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "provincesPanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "50%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translate(-50%, -50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "400px";
	wrapper.style.maxHeight = "85vh";
	wrapper.style.overflowY = "auto";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(16, 185, 129, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.fontSize = "0.875rem";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#34d399;font-size:1.1rem;">🛡️ Provinces Editor</h3>
      <span id="closeProvinces" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div id="provincesList" style="display:flex;flex-direction:column;gap:0.5rem;max-height:400px;overflow-y:auto;padding-right:0.5rem;">
      <!-- List populated dynamically -->
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeProvinces") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	const renderList = () => {
		const state = store.getState() as any;
		const provinces = state.provinces || [];
		const states = state.states || [];
		const listContainer = document.getElementById("provincesList")!;
		listContainer.innerHTML = "";

		if (provinces.length === 0) {
			listContainer.innerHTML = `<div style="text-align:center;color:#64748b;padding:1rem;">No provinces generated yet.</div>`;
			return;
		}

		for (const prov of provinces) {
			if (prov.id === 0) continue; 
			const row = document.createElement("div");
			row.style.display = "grid";
			row.style.gridTemplateColumns = "20px 2fr 2fr";
			row.style.gap = "0.5rem";
			row.style.alignItems = "center";
			row.style.background = "#1e293b";
			row.style.padding = "0.5rem";
			row.style.borderRadius = "6px";
			row.style.border = "1px solid #334";

			let statesOptions = states.map((s: any) => `<option value="${s.id}" ${prov.stateId === s.id ? "selected" : ""}>${s.name}</option>`).join("");

			row.innerHTML = `
        <div style="width:14px;height:14px;border-radius:50%;background:${prov.color};border:1px solid #000;"></div>
        <input type="text" value="${prov.name}" class="provName" data-id="${prov.id}" style="width:100%;box-sizing:border-box;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
        <select class="provState" data-id="${prov.id}" style="width:100%;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
          <option value="0">None (Neutral)</option>
          ${statesOptions}
        </select>
      `;
			listContainer.appendChild(row);
		}

		// Attach listeners
		const nameInputs = listContainer.querySelectorAll(".provName");
		nameInputs.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const val = (e.target as HTMLInputElement).value;
				updateProvince(id, { name: val });
			});
		});

		const stateSelects = listContainer.querySelectorAll(".provState");
		stateSelects.forEach((select) => {
			select.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLSelectElement).getAttribute("data-id"));
				const val = Number((e.target as HTMLSelectElement).value);
				updateProvince(id, { stateId: val });
			});
		});
	};

	const updateProvince = (id: number, changes: any) => {
		const state = store.getState() as any;
		const provinces = state.provinces;
		if (!provinces) return;
		const updated = provinces.map((p: any) => (p.id === id ? { ...p, ...changes } : p));
		store.updateState({ provinces: updated });
	};

	(window as any).openProvincesEditor = () => {
		renderList();
		wrapper.style.display = "block";
	};
}
