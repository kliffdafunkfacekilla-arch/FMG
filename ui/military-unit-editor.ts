import { store } from "../state/store";

export interface RegimentDefinition {
	type: string;
	speed: number;
	combatValue: number;
}

export function mountMilitaryUnitEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

<<<<<<< HEAD
	const renderEditor = () => {
		const state = store.getState() as any;
		const unitTypes = state.militaryUnitTypes || [
			{ type: "infantry", speed: 1.0, combatValue: 10 },
			{ type: "cavalry", speed: 1.8, combatValue: 15 },
			{ type: "navy", speed: 2.2, combatValue: 20 },
		];

		container.innerHTML = `
    <div id="militaryUnitPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1.2rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; flex-direction: column; gap: 0.8rem; box-shadow: 0 10px 25px rgba(0,0,0,0.6);">
      <h3 style="margin-top: 0; margin-bottom: 0.8rem; color: #38bdf8; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: center;">
        <span>⚔️ Regiment Classes Setup</span>
        <span id="closeMilitaryBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.2rem;">&times;</span>
      </h3>
=======
	container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Military Units Setup</h3>
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
      
      <!-- Existing Unit Types List -->
      <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 0.3rem;">Active Unit Types</div>
      <div style="max-height: 180px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem; padding: 0.2rem;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
              <th style="padding: 0.4rem;">Type / Class</th>
              <th style="padding: 0.4rem; text-align: center;">Speed</th>
              <th style="padding: 0.4rem; text-align: center;">Attack</th>
              <th style="padding: 0.4rem; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody id="milUnitsTableBody" style="color: #cbd5e1;">
            ${unitTypes.map((u: any) => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.45rem; font-weight: bold; color: white; text-transform: capitalize;">${u.type}</td>
                <td style="padding: 0.45rem; text-align: center;">
                  <input type="number" step="0.1" class="milUnitSpeedInput" data-type="${u.type}" value="${u.speed}" style="width: 50px; text-align: center; background: #1a1a24; border: 1px solid #444; color: white; border-radius: 3px; padding: 0.1rem;" />
                </td>
                <td style="padding: 0.45rem; text-align: center;">
                  <input type="number" class="milUnitAttackInput" data-type="${u.type}" value="${u.combatValue}" style="width: 50px; text-align: center; background: #1a1a24; border: 1px solid #444; color: white; border-radius: 3px; padding: 0.1rem;" />
                </td>
                <td style="padding: 0.45rem; text-align: center;">
                  <button class="deleteMilUnitBtn" data-type="${u.type}" style="background: #ef4444; border: none; color: white; padding: 0.2rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Create New Unit Type Form -->
      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.8rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; text-transform: uppercase;">➕ Create New Unit Type</div>
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <div>
            <label style="display: block; margin-bottom: 0.15rem; color: #94a3b8; font-size: 0.75rem;">Class Name:</label>
            <input id="newMilTypeName" type="text" placeholder="e.g. Archers" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 0.15rem; color: #94a3b8; font-size: 0.75rem;">Speed:</label>
              <input id="newMilTypeSpeed" type="number" step="0.1" value="1.2" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 0.15rem; color: #94a3b8; font-size: 0.75rem;">Attack Power:</label>
              <input id="newMilTypeAttack" type="number" value="12" style="width: 100%; padding: 0.35rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box;" />
            </div>
          </div>
          <button id="btnCreateMilUnitType" style="margin-top: 0.4rem; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; width: 100%;">
            Create Regiment Class
          </button>
        </div>
      </div>
    </div>
    `;

<<<<<<< HEAD
		// Attach Events
		const panel = document.getElementById("militaryUnitPanel") as HTMLDivElement;
		const closeBtn = document.getElementById("closeMilitaryBtn") as HTMLSpanElement;

		if (closeBtn && panel) {
			closeBtn.addEventListener("click", () => {
				panel.style.display = "none";
			});
		}

		// Handle live editing of existing speed inputs
		container.querySelectorAll(".milUnitSpeedInput").forEach((input: any) => {
			input.addEventListener("change", (e: any) => {
				const type = e.target.getAttribute("data-type");
				const newVal = parseFloat(e.target.value) || 1.0;
				const currentTypes = [...unitTypes];
				const match = currentTypes.find((u) => u.type === type);
				if (match) {
					match.speed = newVal;
					store.updateState({ militaryUnitTypes: currentTypes });
				}
			});
		});

		// Handle live editing of existing attack inputs
		container.querySelectorAll(".milUnitAttackInput").forEach((input: any) => {
			input.addEventListener("change", (e: any) => {
				const type = e.target.getAttribute("data-type");
				const newVal = parseInt(e.target.value, 10) || 10;
				const currentTypes = [...unitTypes];
				const match = currentTypes.find((u) => u.type === type);
				if (match) {
					match.combatValue = newVal;
					store.updateState({ militaryUnitTypes: currentTypes });
				}
			});
		});

		// Handle deleting unit types
		container.querySelectorAll(".deleteMilUnitBtn").forEach((btn: any) => {
			btn.addEventListener("click", (e: any) => {
				const type = e.target.getAttribute("data-type");
				const currentTypes = unitTypes.filter((u: any) => u.type !== type);
				store.updateState({ militaryUnitTypes: currentTypes });
				renderEditor();
			});
		});

		// Handle creating brand new unit types
		const btnCreate = document.getElementById("btnCreateMilUnitType") as HTMLButtonElement;
		btnCreate?.addEventListener("click", () => {
			const nameInput = document.getElementById("newMilTypeName") as HTMLInputElement;
			const speedInput = document.getElementById("newMilTypeSpeed") as HTMLInputElement;
			const attackInput = document.getElementById("newMilTypeAttack") as HTMLInputElement;

			const rawName = nameInput?.value?.trim() || "";
			if (!rawName) {
				return;
			}
			const name = rawName.toLowerCase();

			// Avoid duplicates
			if (unitTypes.some((u: any) => u.type === name)) {
				return;
			}

			const speed = parseFloat(speedInput?.value) || 1.0;
			const combatValue = parseInt(attackInput?.value, 10) || 10;

			const updated = [...unitTypes, { type: name, speed, combatValue }];
			store.updateState({ militaryUnitTypes: updated });
			renderEditor();
		});
	};

	// Expose window handle to easily open this panel
	(window as any).openMilitaryUnitEditor = () => {
		renderEditor();
		const panel = document.getElementById("militaryUnitPanel");
		if (panel) panel.style.display = "flex";
	};

	// Initial render
	renderEditor();
=======
	const select = document.getElementById("milTypeSelect") as HTMLSelectElement;
	const attack = document.getElementById("milAttack") as HTMLInputElement;
	const speed = document.getElementById("milSpeed") as HTMLInputElement;

	select.addEventListener("change", () => {
		const val = select.value;
		if (val === "infantry") {
			attack.value = "10";
			speed.value = "1.0";
		} else if (val === "cavalry") {
			attack.value = "15";
			speed.value = "1.8";
		} else {
			attack.value = "20";
			speed.value = "2.2";
		}
	});
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
}
