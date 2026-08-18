import { store } from "../state/store";

export function mountCulturesEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "culturesPanel";
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
	wrapper.style.border = "1px solid rgba(147, 51, 234, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.fontSize = "0.875rem";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#c084fc;font-size:1.1rem;">🧬 Cultures Editor</h3>
      <span id="closeCultures" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div id="culturesList" style="display:flex;flex-direction:column;gap:0.5rem;max-height:400px;overflow-y:auto;padding-right:0.5rem;">
      <!-- List populated dynamically -->
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeCultures") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	const renderList = () => {
		const state = store.getState() as any;
		const cultures = state.cultures || [];
		const listContainer = document.getElementById("culturesList")!;
		listContainer.innerHTML = "";

		if (cultures.length === 0) {
			listContainer.innerHTML = `<div style="text-align:center;color:#64748b;padding:1rem;">No cultures generated yet.</div>`;
			return;
		}

		for (const culture of cultures) {
			if (culture.id === 0) continue; // Skip neutral
			const row = document.createElement("div");
			row.style.display = "grid";
			row.style.gridTemplateColumns = "20px 1fr 2fr 1fr";
			row.style.gap = "0.5rem";
			row.style.alignItems = "center";
			row.style.background = "#1e293b";
			row.style.padding = "0.5rem";
			row.style.borderRadius = "6px";
			row.style.border = "1px solid #334";

			row.innerHTML = `
        <div style="width:14px;height:14px;border-radius:50%;background:${culture.color};border:1px solid #000;"></div>
        <input type="color" value="${culture.color}" class="cultureColor" data-id="${culture.id}" style="width:100%;height:24px;padding:0;border:none;cursor:pointer;background:transparent;">
        <input type="text" value="${culture.name}" class="cultureName" data-id="${culture.id}" style="width:100%;box-sizing:border-box;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
        <select class="cultureHabitat" data-id="${culture.id}" style="width:100%;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
          <option value="land" ${culture.habitat === "land" ? "selected" : ""}>Land</option>
          <option value="ocean" ${culture.habitat === "ocean" ? "selected" : ""}>Ocean</option>
          <option value="amphibious" ${culture.habitat === "amphibious" ? "selected" : ""}>Amphibious</option>
        </select>
      `;
			listContainer.appendChild(row);
		}

		// Attach listeners
		const nameInputs = listContainer.querySelectorAll(".cultureName");
		nameInputs.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const val = (e.target as HTMLInputElement).value;
				updateCulture(id, { name: val });
			});
		});

		const colorInputs = listContainer.querySelectorAll(".cultureColor");
		colorInputs.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const val = (e.target as HTMLInputElement).value;
				updateCulture(id, { color: val });
			});
		});

		const habitatSelects = listContainer.querySelectorAll(".cultureHabitat");
		habitatSelects.forEach((select) => {
			select.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLSelectElement).getAttribute("data-id"));
				const val = (e.target as HTMLSelectElement).value;
				updateCulture(id, { habitat: val });
			});
		});
	};

	const updateCulture = (id: number, changes: any) => {
		const state = store.getState() as any;
		const cultures = state.cultures;
		if (!cultures) return;
		const updated = cultures.map((c: any) => (c.id === id ? { ...c, ...changes } : c));
		store.updateState({ cultures: updated });
	};

	(window as any).openCulturesEditor = () => {
		renderList();
		wrapper.style.display = "block";
	};
}
