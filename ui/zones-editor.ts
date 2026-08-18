import { store } from "../state/store";

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
	wrapper.style.width = "400px";
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

    <div id="zonesList" style="display:flex;flex-direction:column;gap:0.5rem;max-height:400px;overflow-y:auto;padding-right:0.5rem;">
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
		const zones = state.zones || [];
		const listContainer = document.getElementById("zonesList")!;
		listContainer.innerHTML = "";

		if (zones.length === 0) {
			listContainer.innerHTML = `<div style="text-align:center;color:#64748b;padding:1rem;">No zones generated yet.</div>`;
			return;
		}

		for (const zone of zones) {
			const row = document.createElement("div");
			row.style.display = "grid";
			row.style.gridTemplateColumns = "20px 1fr 1fr";
			row.style.gap = "0.5rem";
			row.style.alignItems = "center";
			row.style.background = "#1e293b";
			row.style.padding = "0.5rem";
			row.style.borderRadius = "6px";
			row.style.border = "1px solid #334";

			row.innerHTML = `
        <div style="width:14px;height:14px;border-radius:50%;background:${zone.color};border:1px solid #000;"></div>
        <input type="text" value="${zone.name}" class="zoneName" data-id="${zone.id}" style="width:100%;box-sizing:border-box;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
        <input type="text" value="${zone.type}" class="zoneType" data-id="${zone.id}" style="width:100%;box-sizing:border-box;padding:0.2rem;background:#0f0f12;border:1px solid #445;color:#fff;border-radius:4px;font-size:0.8rem;">
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
