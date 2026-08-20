import { store } from "../state/store";

export function mountFringeEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="fringeEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 0.5rem;">
      <h3 style="margin-top: 0; color: #f43f5e; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Fringe & Outlaw Factions</span>
        <span id="closeFringeBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <div style="margin-bottom: 0.8rem; background: #0f0f12; border: 1px solid rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="color: #94a3b8; font-size: 0.72rem;">Active Hostiles</div>
          <div id="fringeActiveCount" style="font-size: 1.25rem; font-weight: bold; color: #f43f5e;">0</div>
        </div>
        <div>
          <div style="color: #94a3b8; font-size: 0.72rem;">Total Threat Size</div>
          <div id="fringeTotalSize" style="font-size: 1.25rem; font-weight: bold; color: #fbbf24;">0 men</div>
        </div>
        <div>
          <div style="color: #94a3b8; font-size: 0.72rem;">Oceanic Pirates</div>
          <div id="fringeOceanicCount" style="font-size: 1.25rem; font-weight: bold; color: #38bdf8;">0</div>
        </div>
      </div>

      <div style="max-height: 220px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; padding: 0.2rem; margin-bottom: 0.8rem;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
          <thead>
            <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
              <th style="padding: 0.4rem;">Faction Name</th>
              <th style="padding: 0.4rem;">Origin / Security</th>
              <th style="padding: 0.4rem; text-align: right;">Size</th>
              <th style="padding: 0.4rem; text-align: center;">Hideout</th>
            </tr>
          </thead>
          <tbody id="fringeTableBody" style="color: #cbd5e1;">
            <tr>
              <td colspan="4" style="text-align: center; padding: 1rem; color: #94a3b8;">No fringe groups active. Increase stress or magic density!</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div id="fringeDetailsBox" style="display: none; border-top: 1px solid #333; padding-top: 0.6rem; margin-top: 0.4rem; flex-direction: column; gap: 0.5rem; background: rgba(0, 0, 0, 0.25); padding: 0.6rem; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 id="fringeDetailTitle" style="margin: 0; color: #fbbf24; font-size: 0.85rem;">Faction Intel</h4>
          <span id="fringeDetailTypeTag" style="font-size: 0.65rem; padding: 0.1rem 0.3rem; border-radius: 3px; font-weight: bold; text-transform: uppercase;"></span>
        </div>
        <p id="fringeDetailDesc" style="margin: 0.2rem 0; color: #cbd5e1; font-size: 0.75rem; line-height: 1.3;"></p>
        
        <!-- Burg Stats Details Section -->
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 0.4rem; font-size: 0.72rem;">
          <div style="font-weight: bold; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem; margin-bottom: 0.2rem; display: flex; justify-content: space-between;">
            <span>Origin Burg Stats: <strong id="fringeDetailBurg" style="color: white;">-</strong></span>
            <span>State: <strong id="fringeDetailState" style="color: white;">-</strong></span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;">
            <div>🛡️ Security: <strong id="fringeDetailSecurity" style="color: #4ade80;">100%</strong></div>
            <div>💉 Narcotics: <strong id="fringeDetailNarcotics" style="color: #cbd5e1;">0%</strong></div>
            <div>😊 Happiness: <strong id="fringeDetailHappiness" style="color: #fbbf24;">75%</strong></div>
            <div>❤️ Pop Health: <strong id="fringeDetailHealth" style="color: #f43f5e;">85%</strong></div>
          </div>
        </div>

        <!-- Hideout Status Section -->
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 0.4rem; font-size: 0.72rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div>Hideout: <strong id="fringeDetailHideoutType" style="color: #f472b6;">Mountain Fortress</strong></div>
            <div>Status: <span id="fringeDetailHideoutStatus" style="font-weight: bold;">🔒 Undiscovered</span></div>
          </div>
          <div style="display: flex; gap: 0.25rem;">
            <button id="fringeActionScoutBtn" style="background: #3b82f6; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.68rem;">🔍 Scout (50g)</button>
          </div>
        </div>

        <!-- Faction Customization Section -->
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.72rem;">
          <div style="font-weight: bold; color: #f43f5e; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem; margin-bottom: 0.1rem;">⚙️ Customize Outlaw Faction</div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <span style="color: #94a3b8; flex: 0 0 45px;">Name:</span>
            <input id="editFringeName" type="text" style="flex: 1; padding: 0.2rem 0.4rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <span style="color: #94a3b8; flex: 0 0 45px;">Type:</span>
            <select id="editFringeType" style="flex: 1; padding: 0.2rem 0.4rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
              <option value="Pirates">Pirates</option>
              <option value="Bandits">Bandits</option>
              <option value="Smugglers">Smugglers</option>
              <option value="Vice Dealers">Vice Dealers</option>
              <option value="Rebels">Rebels</option>
              <option value="Cultists">Cultists</option>
            </select>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.3rem; margin-top: 0.1rem;">
            <span>📍 Influence Area: <strong id="fringeDetailInfluence" style="color: #38bdf8;">1 cell</strong></span>
            <button id="saveFringeChangesBtn" style="background: #10b981; color: white; border: none; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.68rem;">💾 Save Changes</button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem;">
          <span>State Treasury: <strong id="fringeDetailTreasury" style="color: #10b981;">0g</strong></span>
          <div style="display: flex; gap: 0.3rem;">
            <button id="fringeActionSkirmishBtn" style="background: #eab308; color: black; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.68rem;">⚔️ Skirmish (50g)</button>
            <button id="fringeActionRaidBtn" style="background: #ef4444; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.68rem; opacity: 0.5;" disabled>🔥 Raid Hideout</button>
          </div>
        </div>
        
        <div id="fringeActionFeedback" style="display: none; text-align: center; font-size: 0.7rem; font-weight: bold; margin-top: 0.2rem;"></div>
      </div>
    </div>
  `;

	const panel = document.getElementById("fringeEditorPanel") as HTMLDivElement;
	const closeBtn = document.getElementById("closeFringeBtn") as HTMLSpanElement;
	const tableBody = document.getElementById(
		"fringeTableBody",
	) as HTMLTableSectionElement;
	const activeCountEl = document.getElementById(
		"fringeActiveCount",
	) as HTMLDivElement;
	const totalSizeEl = document.getElementById(
		"fringeTotalSize",
	) as HTMLDivElement;
	const oceanicCountEl = document.getElementById(
		"fringeOceanicCount",
	) as HTMLDivElement;

	const detailsBox = document.getElementById(
		"fringeDetailsBox",
	) as HTMLDivElement;
	const detailTitle = document.getElementById(
		"fringeDetailTitle",
	) as HTMLHeadingElement;
	const detailTypeTag = document.getElementById(
		"fringeDetailTypeTag",
	) as HTMLSpanElement;
	const detailDesc = document.getElementById(
		"fringeDetailDesc",
	) as HTMLParagraphElement;

	// Burg Stats Labels
	const detailBurg = document.getElementById("fringeDetailBurg") as HTMLElement;
	const detailState = document.getElementById(
		"fringeDetailState",
	) as HTMLElement;
	const detailSecurity = document.getElementById(
		"fringeDetailSecurity",
	) as HTMLElement;
	const detailNarcotics = document.getElementById(
		"fringeDetailNarcotics",
	) as HTMLElement;
	const detailHappiness = document.getElementById(
		"fringeDetailHappiness",
	) as HTMLElement;
	const detailHealth = document.getElementById(
		"fringeDetailHealth",
	) as HTMLElement;
	const detailTreasury = document.getElementById(
		"fringeDetailTreasury",
	) as HTMLElement;

	// Customization Inputs
	const editFringeName = document.getElementById("editFringeName") as HTMLInputElement;
	const editFringeType = document.getElementById("editFringeType") as HTMLSelectElement;
	const fringeDetailInfluence = document.getElementById("fringeDetailInfluence") as HTMLElement;
	const saveFringeChangesBtn = document.getElementById("saveFringeChangesBtn") as HTMLButtonElement;

	// Hideout Labels
	const detailHideoutType = document.getElementById(
		"fringeDetailHideoutType",
	) as HTMLElement;
	const detailHideoutStatus = document.getElementById(
		"fringeDetailHideoutStatus",
	) as HTMLElement;

	// Buttons
	const scoutBtn = document.getElementById(
		"fringeActionScoutBtn",
	) as HTMLButtonElement;
	const skirmishBtn = document.getElementById(
		"fringeActionSkirmishBtn",
	) as HTMLButtonElement;
	const raidBtn = document.getElementById(
		"fringeActionRaidBtn",
	) as HTMLButtonElement;
	const actionFeedback = document.getElementById(
		"fringeActionFeedback",
	) as HTMLDivElement;

	let selectedGroupId: number | null = null;

	closeBtn.addEventListener("click", () => {
		panel.style.display = "none";
	});

	const renderList = () => {
		const state = store.getState() as any;
		const groups = state.fringeGroups || [];
		const burgs = state.burgs || [];

		activeCountEl.innerText = String(groups.length);
		const totalSize = groups.reduce(
			(acc: number, curr: any) => acc + curr.size,
			0,
		);
		totalSizeEl.innerText = `${totalSize.toLocaleString()} men`;

		const oceanicCount = groups.filter(
			(g: any) => g.habitat === "ocean",
		).length;
		oceanicCountEl.innerText = String(oceanicCount);

		if (groups.length === 0) {
			tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 1rem; color: #94a3b8;">No active threats detected. Peace is restored!</td>
        </tr>
      `;
			detailsBox.style.display = "none";
			selectedGroupId = null;
			return;
		}

		tableBody.innerHTML = "";
		for (const g of groups) {
			const burg = burgs.find((b: any) => b.id === g.originBurgId);
			const security = burg
				? burg.security !== undefined
					? Math.round(burg.security)
					: 100
				: 100;

			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
			tr.style.cursor = "pointer";
			tr.style.background =
				selectedGroupId === g.id ? "rgba(244, 63, 94, 0.15)" : "transparent";

			let badgeBg = "#475569";
			if (g.type === "Rebels") badgeBg = "#dc2626";
			else if (g.type === "Bandits") badgeBg = "#ea580c";
			else if (g.type === "Cultists") badgeBg = "#9333ea";
			else if (g.type === "Pirates") badgeBg = "#2563eb";
			else if (g.type === "Smugglers") badgeBg = "#0d9488";
			else if (g.type === "Vice Dealers") badgeBg = "#ec4899";

			const securityColor =
				security < 40 ? "#ef4444" : security < 70 ? "#f59e0b" : "#10b981";
			const hideoutLabel = g.hideoutDiscovered ? "🔍 Found" : "🔒 Hidden";
			const hideoutColor = g.hideoutDiscovered ? "#10b981" : "#94a3b8";

			tr.innerHTML = `
        <td style="padding: 0.4rem; font-weight: 500;">
          <div style="display: flex; flex-direction: column;">
            <span style="display: flex; align-items: center; gap: 0.25rem;">
              ${g.name}
            </span>
            <span style="font-size: 0.65rem; color: #94a3b8;">
              <span style="background: ${badgeBg}; color: white; padding: 0px 4px; border-radius: 3px; font-weight: bold; font-size: 0.55rem; text-transform: uppercase;">${g.type}</span>
            </span>
          </div>
        </td>
        <td style="padding: 0.4rem; color: #cbd5e1; font-size: 0.72rem;">
          <div>${burg ? burg.name : "Unknown"}</div>
          <div style="color: ${securityColor}; font-weight: bold; font-size: 0.68rem;">🛡️ Sec: ${security}%</div>
        </td>
        <td style="padding: 0.4rem; text-align: right; vertical-align: middle; font-weight: bold; color: #cbd5e1;">${g.size}</td>
        <td style="padding: 0.4rem; text-align: center; vertical-align: middle; color: ${hideoutColor}; font-weight: bold; font-size: 0.72rem;">
          ${hideoutLabel}
        </td>
      `;

			tr.addEventListener("click", () => {
				selectGroup(g.id);
			});

			tableBody.appendChild(tr);
		}

		if (selectedGroupId !== null) {
			const stillExists = groups.find((g: any) => g.id === selectedGroupId);
			if (stillExists) {
				showDetails(stillExists);
			} else {
				detailsBox.style.display = "none";
				selectedGroupId = null;
			}
		}
	};

	const selectGroup = (id: number) => {
		selectedGroupId = id;
		renderList();
		const state = store.getState() as any;
		const group = (state.fringeGroups || []).find((g: any) => g.id === id);
		if (group) {
			showDetails(group);
		}
	};

	const showDetails = (g: any) => {
		const state = store.getState() as any;
		const burgs = state.burgs || [];
		const states = state.states || [];
		const cellStates = state.cellStates || [];

		const burg = burgs.find((b: any) => b.id === g.originBurgId);
		const burgName = burg ? burg.name : "Unknown Burg";
		const stateId = burg && cellStates ? cellStates[burg.cell] : 0;
		const sovereignState = states.find((s: any) => s.id === stateId);
		const stateName = sovereignState ? sovereignState.name : "Independent";
		const stateTreasury = sovereignState ? sovereignState.treasury : 0;

		// Burg properties with defaults
		const security = burg
			? burg.security !== undefined
				? Math.round(burg.security)
				: 100
			: 100;
		const narcotics = burg
			? burg.drugSupply !== undefined
				? Math.round(burg.drugSupply)
				: 0
			: 0;
		const happiness = burg
			? burg.happiness !== undefined
				? Math.round(burg.happiness)
				: 75
			: 75;
		const health = burg
			? burg.health !== undefined
				? Math.round(burg.health)
				: 85
			: 85;

		detailTitle.innerText = g.name;
		detailTypeTag.innerText = g.type;
		detailDesc.innerText = g.description;
		detailBurg.innerText = burgName;
		detailState.innerText = stateName;

		detailSecurity.innerText = `${security}%`;
		detailSecurity.style.color =
			security < 40 ? "#ef4444" : security < 70 ? "#eab308" : "#10b981";

		detailNarcotics.innerText = `${narcotics}%`;
		detailNarcotics.style.color =
			narcotics > 40 ? "#ef4444" : narcotics > 10 ? "#eab308" : "#94a3b8";

		detailHappiness.innerText = `${happiness}%`;
		detailHappiness.style.color =
			happiness < 40 ? "#ef4444" : happiness < 70 ? "#eab308" : "#10b981";

		detailHealth.innerText = `${health}%`;
		detailHealth.style.color =
			health < 50 ? "#ef4444" : health < 75 ? "#eab308" : "#10b981";

		detailTreasury.innerText = `${stateTreasury.toLocaleString()} gold`;

		let typeColor = "#64748b";
		if (g.type === "Rebels") typeColor = "#ef4444";
		else if (g.type === "Bandits") typeColor = "#f97316";
		else if (g.type === "Cultists") typeColor = "#a855f7";
		else if (g.type === "Pirates") typeColor = "#3b82f6";
		else if (g.type === "Smugglers") typeColor = "#14b8a6";
		else if (g.type === "Vice Dealers") typeColor = "#ec4899";

		detailTypeTag.style.background = typeColor;
		detailTypeTag.style.color = "white";

		// Populate customizer
		if (editFringeName) editFringeName.value = g.name || "";
		if (editFringeType) editFringeType.value = g.type || "Bandits";
		if (fringeDetailInfluence) {
			const influenceRad = g.influenceRadius || 1;
			fringeDetailInfluence.innerText = `${influenceRad} cell` + (influenceRad > 1 ? "s" : "");
		}

		if (saveFringeChangesBtn) {
			saveFringeChangesBtn.onclick = () => {
				const stateData = store.getState() as any;
				const currentGroups = stateData.fringeGroups || [];
				const updatedGroups = currentGroups.map((group: any) => {
					if (group.id === g.id) {
						const newName = editFringeName.value.trim() || group.name;
						const newType = editFringeType.value;
						let desc = group.description;
						if (newType === "Vice Dealers") {
							desc = "A covert network of illicit vice rings, contraband dealers, and black market smugglers specializing in narcotics.";
						} else if (newType === "Pirates") {
							desc = "Ocean-faring renegades raiding shipping lanes, trade barges, and fishing vessels.";
						} else if (newType === "Bandits") {
							desc = "Highwaymen and plunderers ambush-raiding supply roads and woodland villages.";
						} else if (newType === "Smugglers") {
							desc = "A stealthy cartel of black-market merchants circumventing high sovereign tariffs.";
						} else if (newType === "Rebels") {
							desc = "Armed insurgents fighting against sovereign rule to achieve independence.";
						} else if (newType === "Cultists") {
							desc = "Fanatical worshippers gathered in secret to perform dangerous rites.";
						}
						return {
							...group,
							name: newName,
							type: newType,
							description: desc
						};
					}
					return group;
				});

				store.updateState({ fringeGroups: updatedGroups });
				
				const newlyUpdated = updatedGroups.find((item: any) => item.id === g.id);
				if (newlyUpdated) {
					showDetails(newlyUpdated);
				}
				
				renderList();
				if (onUpdate) onUpdate();
				
				if (actionFeedback) {
					actionFeedback.innerText = "💾 Outlaw Faction updated successfully!";
					actionFeedback.style.color = "#10b981";
					actionFeedback.style.display = "block";
					setTimeout(() => { actionFeedback.style.display = "none"; }, 3000);
				}
			};
		}

		// Hideout Details
		detailHideoutType.innerText = g.hideoutType || "Secret Hideout";
		if (g.hideoutDiscovered) {
			detailHideoutStatus.innerText = "🔍 Discovered";
			detailHideoutStatus.style.color = "#10b981";

			scoutBtn.style.opacity = "0.5";
			scoutBtn.disabled = true;
			scoutBtn.innerText = "Scouted";

			raidBtn.style.opacity = "1";
			raidBtn.disabled = false;
			const raidCost = Math.max(80, Math.floor(g.size * 1.5));
			raidBtn.innerText = `🔥 Raid Hideout (${raidCost}g)`;
		} else {
			detailHideoutStatus.innerText = "🔒 Hidden";
			detailHideoutStatus.style.color = "#ef4444";

			scoutBtn.style.opacity = "1";
			scoutBtn.disabled = false;
			const scoutCost = Math.max(30, Math.floor(g.size * 0.4));
			scoutBtn.innerText = `🔍 Scout (${scoutCost}g)`;

			raidBtn.style.opacity = "0.5";
			raidBtn.disabled = true;
			raidBtn.innerText = "Raid (Need Intel)";
		}

		const skirmishCost = Math.max(40, Math.floor(g.size * 0.8));
		skirmishBtn.innerText = `⚔️ Skirmish (${skirmishCost}g)`;

		detailsBox.style.display = "flex";

		// Bind actions
		scoutBtn.onclick = () => scoutFaction(g.id);
		skirmishBtn.onclick = () => skirmishFaction(g.id);
		raidBtn.onclick = () => raidFaction(g.id);
	};

	const scoutFaction = (id: number) => {
		const state = store.getState() as any;
		const groups = state.fringeGroups
			? state.fringeGroups.map((group: any) => ({ ...group }))
			: [];
		const g = groups.find((group: any) => group.id === id);
		if (!g) return;

		const burgs = state.burgs || [];
		const states = state.states ? state.states.map((s: any) => ({ ...s })) : [];
		const cellStates = state.cellStates || [];

		const burg = burgs.find((b: any) => b.id === g.originBurgId);
		if (!burg) return;

		const stateId = cellStates ? cellStates[burg.cell] : 0;
		const sovereignState = states.find((s: any) => s.id === stateId);

		const scoutCost = Math.max(30, Math.floor(g.size * 0.4));

		if (sovereignState && sovereignState.treasury < scoutCost) {
			showFeedback(
				`State treasury is solvent but too low to fund spies! Needs ${scoutCost}g.`,
				"#f87171",
			);
			return;
		}

		if (sovereignState) {
			sovereignState.treasury -= scoutCost;
		}

		g.hideoutDiscovered = true;

		store.updateState({
			states,
			fringeGroups: groups,
		});

		showFeedback(
			`Success! Intel scouts discovered their ${g.hideoutType}! Ready for a full military raid.`,
			"#4ade80",
		);
		renderList();
		onUpdate();
	};

	const skirmishFaction = (id: number) => {
		const state = store.getState() as any;
		const groups = state.fringeGroups
			? state.fringeGroups.map((group: any) => ({ ...group }))
			: [];
		const groupIndex = groups.findIndex((group: any) => group.id === id);
		if (groupIndex === -1) return;

		const g = groups[groupIndex];
		const burgs = state.burgs || [];
		const states = state.states ? state.states.map((s: any) => ({ ...s })) : [];
		const cellStates = state.cellStates || [];

		const burg = burgs.find((b: any) => b.id === g.originBurgId);
		if (!burg) return;

		const stateId = cellStates ? cellStates[burg.cell] : 0;
		const sovereignState = states.find((s: any) => s.id === stateId);

		const skirmishCost = Math.max(40, Math.floor(g.size * 0.8));

		if (sovereignState && sovereignState.treasury < skirmishCost) {
			showFeedback(
				`State treasury insufficient for army skirmish deployment! Needs ${skirmishCost}g.`,
				"#f87171",
			);
			return;
		}

		if (sovereignState) {
			sovereignState.treasury -= skirmishCost;
		}

		// Skirmish only weakens the group (reduces size by 45%) but does not delete them since hideout remains
		const oldSize = g.size;
		g.size = Math.max(5, Math.floor(g.size * 0.55));

		store.updateState({
			states,
			fringeGroups: groups,
		});

		showFeedback(
			`Skirmish reduced hostile strength from ${oldSize} to ${g.size} men. Raid hideout to wipe them out!`,
			"#eab308",
		);
		renderList();
		onUpdate();
	};

	const raidFaction = (id: number) => {
		const state = store.getState() as any;
		const groups = state.fringeGroups
			? state.fringeGroups.map((group: any) => ({ ...group }))
			: [];
		const groupIndex = groups.findIndex((group: any) => group.id === id);
		if (groupIndex === -1) return;

		const g = groups[groupIndex];
		const burgs = state.burgs ? state.burgs.map((b: any) => ({ ...b })) : [];
		const states = state.states ? state.states.map((s: any) => ({ ...s })) : [];
		const cellStates = state.cellStates || [];

		const burg = burgs.find((b: any) => b.id === g.originBurgId);
		if (!burg) return;

		const stateId = cellStates ? cellStates[burg.cell] : 0;
		const sovereignState = states.find((s: any) => s.id === stateId);

		const raidCost = Math.max(80, Math.floor(g.size * 1.5));

		if (sovereignState && sovereignState.treasury < raidCost) {
			showFeedback(
				`State treasury cannot support full military strike! Needs ${raidCost}g.`,
				"#f87171",
			);
			return;
		}

		if (sovereignState) {
			sovereignState.treasury -= raidCost;
		}

		// Eradicate! Completely delete group
		groups.splice(groupIndex, 1);

		// Instantly boost burg security after successful raid
		if (burg) {
			burg.security = Math.min(100, (burg.security || 100) + 35);
			// Drug supply falls rapidly or triggers withdrawal
			if (g.type === "Smugglers" && burg.drugSupply > 15) {
				// Triggers drug withdrawal morale swing!
				burg.happiness = Math.max(0, (burg.happiness || 75) - 20);
			}
		}

		store.updateState({
			states,
			burgs,
			fringeGroups: groups,
		});

		showFeedback(
			`VICTORY! Successfully stormed their ${g.hideoutType}. Faction fully dismantled and region secured!`,
			"#4ade80",
		);
		renderList();
		onUpdate();
	};

	const showFeedback = (msg: string, color: string) => {
		actionFeedback.innerText = msg;
		actionFeedback.style.color = color;
		actionFeedback.style.display = "block";
		setTimeout(() => {
			actionFeedback.style.display = "none";
		}, 4500);
	};

	(window as any).openFringeEditor = () => {
		renderList();
		panel.style.display = "block";
	};
}
