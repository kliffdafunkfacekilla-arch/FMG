import { store } from "../state/store";
import type { Zone } from "../simulation/civilization/zones-generator";

export function mountZonesEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "zonesPanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "50%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translate(-50%, -50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "450px";
	wrapper.style.maxHeight = "85vh";
	wrapper.style.overflowY = "auto";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(236, 72, 153, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.fontSize = "0.875rem";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#f472b6;font-size:1.1rem;">🟣 Zones Editor</h3>
      <span id="closeZones" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div id="zonesList" style="display:flex;flex-direction:column;gap:0.75rem;max-height:600px;overflow-y:auto;padding-right:0.5rem;">
      <!-- List populated dynamically -->
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeZones") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	const renderList = () => {
		const state = store.getState() as any;
		const zones: Zone[] = state.zones || [];
		const listContainer = document.getElementById("zonesList")!;
		listContainer.innerHTML = "";

		if (zones.length === 0) {
			listContainer.innerHTML = `<div style="text-align:center;color:#64748b;padding:1rem;">No zones generated yet.</div>`;
			return;
		}

		for (const zone of zones) {
			const row = document.createElement("div");
			row.style.display = "flex";
			row.style.flexDirection = "column";
			row.style.gap = "0.5rem";
			row.style.background = "#1e293b";
			row.style.padding = "0.75rem";
			row.style.borderRadius = "6px";
			row.style.border = "1px solid #334";

			let modsHtml = "";
			const mods = zone.modifiers || {};
			for (const key of Object.keys(mods)) {
				modsHtml += `
          <div style="display:flex;gap:0.25rem;align-items:center;">
            <input type="text" value="${key}" class="modKey" data-id="${zone.id}" data-oldkey="${key}" style="width:40%;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.75rem;">
            <input type="number" step="0.1" value="${mods[key]}" class="modVal" data-id="${zone.id}" data-key="${key}" style="width:40%;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.75rem;">
            <button class="removeModBtn" data-id="${zone.id}" data-key="${key}" style="background:#e11d48;color:white;border:none;border-radius:4px;cursor:pointer;padding:0.2rem 0.5rem;font-size:0.75rem;">X</button>
          </div>
        `;
			}

			row.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <div style="width:14px;height:14px;border-radius:50%;background:${zone.color};border:1px solid #000;flex-shrink:0;"></div>
          <input type="text" value="${zone.name}" class="zoneName" data-id="${zone.id}" style="width:100%;box-sizing:border-box;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
          <input type="text" value="${zone.type}" class="zoneType" data-id="${zone.id}" style="width:100%;box-sizing:border-box;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
        </div>
        <div style="margin-top:0.25rem;border-top:1px dashed #334;padding-top:0.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
            <span style="font-size:0.75rem;color:#94a3b8;">Modifiers</span>
            <button class="addModBtn" data-id="${zone.id}" style="background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;padding:0.1rem 0.4rem;font-size:0.7rem;">+ Add</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.25rem;">
            ${modsHtml}
          </div>
        </div>
      `;
			listContainer.appendChild(row);
		}

		// Attach listeners
		const nameInputs = listContainer.querySelectorAll(".zoneName");
		nameInputs.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const val = (e.target as HTMLInputElement).value;
				updateZone(id, { name: val });
			});
		});

		const typeInputs = listContainer.querySelectorAll(".zoneType");
		typeInputs.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const val = (e.target as HTMLInputElement).value;
				updateZone(id, { type: val });
			});
		});

		const addBtns = listContainer.querySelectorAll(".addModBtn");
		addBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const id = Number((e.target as HTMLButtonElement).getAttribute("data-id"));
				const state = store.getState() as any;
				const zone = state.zones.find((z: any) => z.id === id);
				if (zone) {
					const mods = { ...(zone.modifiers || {}) };
					mods["new_stat"] = 0;
					updateZone(id, { modifiers: mods });
					renderList();
				}
			});
		});

		const removeBtns = listContainer.querySelectorAll(".removeModBtn");
		removeBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const id = Number((e.target as HTMLButtonElement).getAttribute("data-id"));
				const key = (e.target as HTMLButtonElement).getAttribute("data-key")!;
				const state = store.getState() as any;
				const zone = state.zones.find((z: any) => z.id === id);
				if (zone) {
					const mods = { ...(zone.modifiers || {}) };
					delete mods[key];
					updateZone(id, { modifiers: mods });
					renderList();
				}
			});
		});

		const modKeys = listContainer.querySelectorAll(".modKey");
		modKeys.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const oldKey = (e.target as HTMLInputElement).getAttribute("data-oldkey")!;
				const newKey = (e.target as HTMLInputElement).value;
				if (oldKey === newKey) return;
				const state = store.getState() as any;
				const zone = state.zones.find((z: any) => z.id === id);
				if (zone) {
					const mods = { ...(zone.modifiers || {}) };
					const val = mods[oldKey];
					delete mods[oldKey];
					mods[newKey] = val;
					updateZone(id, { modifiers: mods });
					renderList();
				}
			});
		});

		const modVals = listContainer.querySelectorAll(".modVal");
		modVals.forEach((input) => {
			input.addEventListener("change", (e) => {
				const id = Number((e.target as HTMLInputElement).getAttribute("data-id"));
				const key = (e.target as HTMLInputElement).getAttribute("data-key")!;
				const val = Number((e.target as HTMLInputElement).value);
				const state = store.getState() as any;
				const zone = state.zones.find((z: any) => z.id === id);
				if (zone) {
					const mods = { ...(zone.modifiers || {}) };
					mods[key] = val;
					updateZone(id, { modifiers: mods });
				}
			});
		});
	};

	const updateZone = (id: number, changes: any) => {
		const state = store.getState() as any;
		const zones = state.zones;
		if (!zones) return;
		const updated = zones.map((z: any) => (z.id === id ? { ...z, ...changes } : z));
		store.updateState({ zones: updated });
	};

	(window as any).openZonesEditor = () => {
		renderList();
		wrapper.style.display = "block";
	};
}
