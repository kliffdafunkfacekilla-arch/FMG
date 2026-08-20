import type {
	RelationType,
	StateRelation,
} from "../simulation/civilization/diplomacy-generator";
import { store } from "../state/store";

export function mountDiplomacyEditor(
	containerId: string,
	onUpdate: () => void,
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="diplomacyEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #3b82f6; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Diplomacy & Espionage Desk</span>
        <span id="closeDiplomacyBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <div style="display: flex; border-bottom: 1px solid #333; margin-bottom: 0.8rem; gap: 0.5rem;">
        <button id="tabDiplomacyRelations" style="flex: 1; background: #2563eb; color: white; border: none; padding: 0.4rem; font-weight: bold; font-size: 0.78rem; border-radius: 4px 4px 0 0; cursor: pointer;">🤝 Relations</button>
        <button id="tabDiplomacyEspionage" style="flex: 1; background: #1e1b4b; color: #94a3b8; border: none; padding: 0.4rem; font-weight: bold; font-size: 0.78rem; border-radius: 4px 4px 0 0; cursor: pointer;">🕵️ Espionage & Ops</button>
      </div>

      <!-- SECTION 1: RELATIONS -->
      <div id="diplomacyRelationsSection">
        <div style="max-height: 180px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.4rem;">State A</th>
                <th style="padding: 0.4rem;">Relation</th>
                <th style="padding: 0.4rem;">State B</th>
                <th style="padding: 0.4rem; text-align: center;">Edit</th>
              </tr>
            </thead>
            <tbody id="diplomacyTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>

        <div id="diplomacyEditForm" style="display: none; flex-direction: column; gap: 0.6rem; border-top: 1px solid #333; padding-top: 0.6rem;">
          <h4 style="margin: 0; color: #fbbf24; font-size: 0.85rem;" id="diplomacyEditTitle">Edit Relation</h4>
          
          <div>
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Relation Type:</label>
            <select id="editRelationType" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
              <option value="Alliance">Alliance</option>
              <option value="Friendly">Friendly</option>
              <option value="Neutral">Neutral</option>
              <option value="Suspicious">Suspicious</option>
              <option value="War">War</option>
            </select>
          </div>

          <div>
            <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Threat Level (0-100):</label>
            <input id="editRelationThreat" type="range" min="0" max="100" value="0" style="width: 100%; cursor: pointer;" />
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
            <button id="saveRelationBtn" style="flex: 1; background: #10b981; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
            <button id="cancelRelationBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.35rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- SECTION 2: ESPIONAGE -->
      <div id="diplomacyEspionageSection" style="display: none; flex-direction: column; gap: 0.6rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #0f0f12; padding: 0.5rem; border-radius: 6px; border: 1px solid #333;">
          <div>
            <label style="display: block; font-size: 0.72rem; color: #94a3b8; margin-bottom: 0.15rem;">Source State (Your Agents):</label>
            <select id="espiSourceSelect" style="width: 100%; padding: 0.2rem; background: #18181b; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.75rem;"></select>
          </div>
          <div>
            <label style="display: block; font-size: 0.72rem; color: #94a3b8; margin-bottom: 0.15rem;">Target State (Operations):</label>
            <select id="espiTargetSelect" style="width: 100%; padding: 0.2rem; background: #18181b; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.75rem;"></select>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem; font-weight: bold; color: #fbbf24; font-size: 0.78rem;">Insidious Intelligence Actions:</div>
          
          <!-- Ops Grid -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 0.4rem;">
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 0.4rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #60a5fa;">🔍 Intel Infiltration</strong>
                <div style="font-size: 0.7rem; color: #94a3b8;">Reveal real-time wealth, military power, and city counts.</div>
              </div>
              <button id="btnEspiIntel" style="background: #2563eb; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.72rem;">50g</button>
            </div>

            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 0.4rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f43f5e;">⚔️ Fund & Arm Outlaws</strong>
                <div style="font-size: 0.7rem; color: #94a3b8;">Enlarge active hostile/rebel sizes by +60 and decay target's security by 15.</div>
              </div>
              <button id="btnEspiRebels" style="background: #dc2626; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.72rem;">150g</button>
            </div>

            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 0.4rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #fb923c;">🔥 Sabotage Production</strong>
                <div style="font-size: 0.7rem; color: #94a3b8;">Destroy 50% of the target state's local food stocks, causing hunger.</div>
              </div>
              <button id="btnEspiSabotage" style="background: #ea580c; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.72rem;">120g</button>
            </div>

            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 0.4rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #a855f7;">📣 Incite Civil Unrest</strong>
                <div style="font-size: 0.7rem; color: #94a3b8;">Agitate the populace, lowering city happiness by 15 and security by 10%.</div>
              </div>
              <button id="btnEspiUnrest" style="background: #7c3aed; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.72rem;">100g</button>
            </div>
          </div>
        </div>

        <div id="espiOutputBox" style="display: none; background: #0c0a09; border: 1px solid #292524; padding: 0.5rem; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #22c55e; max-height: 120px; overflow-y: auto;"></div>
      </div>
    </div>
  `;

	const panel = document.getElementById("diplomacyEditorPanel") as HTMLDivElement;
	const tableBody = document.getElementById("diplomacyTableBody") as HTMLTableSectionElement;
	const closeBtn = document.getElementById("closeDiplomacyBtn") as HTMLSpanElement;

	const tabRelations = document.getElementById("tabDiplomacyRelations") as HTMLButtonElement;
	const tabEspionage = document.getElementById("tabDiplomacyEspionage") as HTMLButtonElement;
	const relationsSection = document.getElementById("diplomacyRelationsSection") as HTMLDivElement;
	const espionageSection = document.getElementById("diplomacyEspionageSection") as HTMLDivElement;

	const editForm = document.getElementById("diplomacyEditForm") as HTMLDivElement;
	const editTitle = document.getElementById("diplomacyEditTitle") as HTMLElement;
	const typeSelect = document.getElementById("editRelationType") as HTMLSelectElement;
	const threatSlider = document.getElementById("editRelationThreat") as HTMLInputElement;

	const saveBtn = document.getElementById("saveRelationBtn") as HTMLButtonElement;
	const cancelBtn = document.getElementById("cancelRelationBtn") as HTMLButtonElement;

	// Espionage Selectors
	const sourceSelect = document.getElementById("espiSourceSelect") as HTMLSelectElement;
	const targetSelect = document.getElementById("espiTargetSelect") as HTMLSelectElement;
	const espiOutputBox = document.getElementById("espiOutputBox") as HTMLDivElement;

	// Espionage Buttons
	const btnEspiIntel = document.getElementById("btnEspiIntel") as HTMLButtonElement;
	const btnEspiRebels = document.getElementById("btnEspiRebels") as HTMLButtonElement;
	const btnEspiSabotage = document.getElementById("btnEspiSabotage") as HTMLButtonElement;
	const btnEspiUnrest = document.getElementById("btnEspiUnrest") as HTMLButtonElement;

	let activeIndex: number | null = null;

	const closePanel = () => {
		panel.style.display = "none";
	};
	closeBtn.addEventListener("click", closePanel);

	// Tabs logic
	tabRelations.addEventListener("click", () => {
		tabRelations.style.background = "#2563eb";
		tabRelations.style.color = "white";
		tabEspionage.style.background = "#1e1b4b";
		tabEspionage.style.color = "#94a3b8";
		relationsSection.style.display = "block";
		espionageSection.style.display = "none";
	});

	tabEspionage.addEventListener("click", () => {
		tabEspionage.style.background = "#2563eb";
		tabEspionage.style.color = "white";
		tabRelations.style.background = "#1e1b4b";
		tabRelations.style.color = "#94a3b8";
		relationsSection.style.display = "none";
		espionageSection.style.display = "flex";
		populateEspionageDropdowns();
	});

	const populateEspionageDropdowns = () => {
		const state = store.getState() as any;
		const states = state.states || [];

		sourceSelect.innerHTML = "";
		targetSelect.innerHTML = "";

		for (const s of states) {
			const sourceOpt = document.createElement("option");
			sourceOpt.value = String(s.id);
			sourceOpt.innerText = `${s.name} (${s.treasury}g)`;
			sourceSelect.appendChild(sourceOpt);

			const targetOpt = document.createElement("option");
			targetOpt.value = String(s.id);
			targetOpt.innerText = s.name;
			targetSelect.appendChild(targetOpt);
		}

		if (states.length > 1) {
			targetSelect.selectedIndex = 1;
		}
	};

	const renderRelationsList = () => {
		const state = store.getState() as any;
		const relations = state.relations || [];
		const states = state.states || [];

		tableBody.innerHTML = "";
		relations.forEach((rel: StateRelation, idx: number) => {
			const stateAName =
				states.find((s: any) => s.id === rel.stateA)?.name ||
				`State ${rel.stateA}`;
			const stateBName =
				states.find((s: any) => s.id === rel.stateB)?.name ||
				`State ${rel.stateB}`;

			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.4rem; color: #fff; font-weight: bold;">${stateAName}</td>
        <td style="padding: 0.4rem; color: #a855f7;">${rel.type} (${rel.threat})</td>
        <td style="padding: 0.4rem; color: #fff; font-weight: bold;">${stateBName}</td>
        <td style="padding: 0.4rem; text-align: center;">
          <button class="editRelBtn" data-idx="${idx}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
        </td>
      `;
			tableBody.appendChild(tr);
		});

		const editBtns = tableBody.querySelectorAll(".editRelBtn");
		editBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const idx = parseInt(
					(e.currentTarget as HTMLButtonElement).getAttribute("data-idx") ||
						"0",
					10,
				);
				const rel = relations[idx];
				if (rel) {
					activeIndex = idx;
					const stateAName =
						states.find((s: any) => s.id === rel.stateA)?.name ||
						`State ${rel.stateA}`;
					const stateBName =
						states.find((s: any) => s.id === rel.stateB)?.name ||
						`State ${rel.stateB}`;

					editTitle.innerText = `${stateAName} ↔ ${stateBName}`;
					typeSelect.value = rel.type;
					threatSlider.value = String(rel.threat);
					editForm.style.display = "flex";
				}
			});
		});
	};

	saveBtn.addEventListener("click", () => {
		if (activeIndex !== null) {
			const state = store.getState() as any;
			const relations = [...(state.relations || [])];
			if (relations[activeIndex]) {
				relations[activeIndex].type = typeSelect.value as RelationType;
				relations[activeIndex].threat = parseInt(threatSlider.value, 10);
				store.updateState({ relations });
			}
			activeIndex = null;
			editForm.style.display = "none";
			renderRelationsList();
			onUpdate();
		}
	});

	cancelBtn.addEventListener("click", () => {
		activeIndex = null;
		editForm.style.display = "none";
	});

	// --- ESPIONAGE COVER OOPS IMPLEMENTATION ---
	const getSourceAndTarget = () => {
		const state = store.getState() as any;
		const states = state.states ? state.states.map((s: any) => ({ ...s })) : [];
		const srcId = parseInt(sourceSelect.value, 10);
		const tgtId = parseInt(targetSelect.value, 10);

		if (srcId === tgtId) {
			showEspiResult("⚠️ Source and Target state cannot be the same!", "#ef4444");
			return null;
		}

		const srcState = states.find((s: any) => s.id === srcId);
		const tgtState = states.find((s: any) => s.id === tgtId);

		return { states, srcState, tgtState, srcId, tgtId };
	};

	const showEspiResult = (msg: string, color: string) => {
		espiOutputBox.innerText = msg;
		espiOutputBox.style.color = color;
		espiOutputBox.style.display = "block";
	};

	// 1. Intel Infiltration (50g)
	btnEspiIntel.addEventListener("click", () => {
		const res = getSourceAndTarget();
		if (!res) return;
		const { states, srcState, tgtState } = res;

		if (srcState.treasury < 50) {
			showEspiResult(`⚠️ Insolvency! ${srcState.name} does not have 50g to pay spy assets.`, "#ef4444");
			return;
		}

		srcState.treasury -= 50;

		const state = store.getState() as any;
		const cellStates = state.cellStates || [];
		const burgs = state.burgs || [];
		const tgtBurgs = burgs.filter((b: any) => cellStates[b.cell] === tgtState.id);

		store.updateState({ states });

		showEspiResult(
			`[INTELLIGENCE RECON REPORT]\n` +
			`State: ${tgtState.name}\n` +
			`Treasury: ${tgtState.treasury} gold\n` +
			`Military Power: ${tgtState.militaryPower}\n` +
			`Populace size: ${tgtState.population.toLocaleString()}\n` +
			`Key Strongholds: ${tgtBurgs.map((b: any) => b.name).join(", ") || "None"}`,
			"#60a5fa"
		);

		populateEspionageDropdowns();
		onUpdate();
	});

	// 2. Fund & Arm Rebels (150g)
	btnEspiRebels.addEventListener("click", () => {
		const res = getSourceAndTarget();
		if (!res) return;
		const { states, srcState, tgtState } = res;

		if (srcState.treasury < 150) {
			showEspiResult(`⚠️ Insolvency! Needs 150g to procure arms smuggling lines.`, "#ef4444");
			return;
		}

		srcState.treasury -= 150;

		const state = store.getState() as any;
		const cellStates = state.cellStates || [];
		const burgs = state.burgs ? state.burgs.map((b: any) => ({ ...b })) : [];
		const fringeGroups = state.fringeGroups ? state.fringeGroups.map((g: any) => ({ ...g })) : [];

		const tgtBurgs = burgs.filter((b: any) => cellStates[b.cell] === tgtState.id);
		if (tgtBurgs.length === 0) {
			showEspiResult(`⚠️ Operation aborted: target state has no established cities to support rebels!`, "#ef4444");
			return;
		}

		// Decay security of target state burgs
		for (const b of burgs) {
			if (cellStates[b.cell] === tgtState.id) {
				b.security = Math.max(0, (b.security || 100) - 15);
			}
		}

		// Spawn or boost rebels
		const randomBurg = tgtBurgs[Math.floor(Math.random() * tgtBurgs.length)];
		let existingRebel = fringeGroups.find((g: any) => g.originBurgId === randomBurg.id && g.type === "Rebels");
		
		if (existingRebel) {
			existingRebel.size += 60;
		} else {
			const nextId = Math.max(1, ...fringeGroups.map((g: any) => g.id)) + 1;
			fringeGroups.push({
				id: nextId,
				type: "Rebels",
				originBurgId: randomBurg.id,
				originBurgName: randomBurg.name,
				size: 60,
				name: `${randomBurg.name} Liberty Front`,
				description: `Insurgency group covertly funded and armed by spy networks of ${srcState.name} to agitate order.`,
				habitat: "land",
				hideoutDiscovered: false,
				hideoutType: "Underground Syndicate"
			});
		}

		store.updateState({
			states,
			burgs,
			fringeGroups
		});

		showEspiResult(
			`[COVERT STRIKE SUCCESS]\n` +
			`Infiltrators successfully sneaked weapon stocks to ${randomBurg.name}.\n` +
			`Rebel forces expanded by +60 armed dissidents, destabilizing local security levels!`,
			"#f43f5e"
		);

		populateEspionageDropdowns();
		onUpdate();
	});

	// 3. Sabotage Production (120g)
	btnEspiSabotage.addEventListener("click", () => {
		const res = getSourceAndTarget();
		if (!res) return;
		const { states, srcState, tgtState } = res;

		if (srcState.treasury < 120) {
			showEspiResult(`⚠️ Insolvency! Sabotage operation requires 120g.`, "#ef4444");
			return;
		}

		srcState.treasury -= 120;

		const state = store.getState() as any;
		const cellStates = state.cellStates || [];
		const burgs = state.burgs || [];
		const markets = state.markets ? state.markets.map((m: any) => {
			const targetBurg = burgs.find((b: any) => b.id === m.burgId);
			if (targetBurg && cellStates[targetBurg.cell] === tgtState.id) {
				// Destroy 50% of supply!
				const updatedSupply = { ...m.supply };
				for (const key of Object.keys(updatedSupply)) {
					updatedSupply[key] = Math.max(0, Math.floor((updatedSupply[key] || 0) * 0.5));
				}
				return { ...m, supply: updatedSupply };
			}
			return m;
		}) : [];

		store.updateState({
			states,
			markets
		});

		showEspiResult(
			`[PRODUCTION SABOTAGE SUCCESS]\n` +
			`Operatives contaminated and burned silos throughout ${tgtState.name}!\n` +
			`All target marketplaces report food and goods reserves slashed by 50%!`,
			"#fb923c"
		);

		populateEspionageDropdowns();
		onUpdate();
	});

	// 4. Incite Civil Unrest (100g)
	btnEspiUnrest.addEventListener("click", () => {
		const res = getSourceAndTarget();
		if (!res) return;
		const { states, srcState, tgtState } = res;

		if (srcState.treasury < 100) {
			showEspiResult(`⚠️ Insolvency! Inciting riots and unrest costs 100g.`, "#ef4444");
			return;
		}

		srcState.treasury -= 100;

		const state = store.getState() as any;
		const cellStates = state.cellStates || [];
		const burgs = state.burgs ? state.burgs.map((b: any) => {
			if (cellStates[b.cell] === tgtState.id) {
				return {
					...b,
					happiness: Math.max(0, (b.happiness !== undefined ? b.happiness : 75) - 15),
					security: Math.max(0, (b.security !== undefined ? b.security : 100) - 10)
				};
			}
			return b;
		}) : [];

		store.updateState({
			states,
			burgs
		});

		showEspiResult(
			`[PROPAGANDA CAMPAIGN SUCCESS]\n` +
			`Agents of ${srcState.name} dispersed agitating pamphlets across the target province.\n` +
			`Morale plummeted! All target cities dropped by -15 Happiness and -10% Security!`,
			"#a855f7"
		);

		populateEspionageDropdowns();
		onUpdate();
	});

	(window as any).openDiplomacyEditor = () => {
		renderRelationsList();
		panel.style.display = "block";
		const win = window as any;
		if (win.triggerLayerSelect) {
			win.triggerLayerSelect("states"); // Diplomacy operates on the states view
		}
	};
}
