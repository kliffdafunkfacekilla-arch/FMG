import { store } from "../state/store";
import type { Paragon } from "../state/store";
import { POSITIVE_TRAITS, NEUTRAL_TRAITS, NEGATIVE_TRAITS } from "../simulation/civilization/paragons-generator";

let panelElement: HTMLElement | null = null;
let currentParagonId: string = "";

const HTML_CONTENT = `
<div id="paragonsEditorPanel" style="display: none; position: absolute; top: 50px; left: 50px; width: 680px; height: 500px; background: rgba(15, 23, 42, 0.95); border: 1px solid #334155; border-radius: 8px; font-family: sans-serif; flex-direction: column; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
  <!-- Header -->
  <div style="padding: 0.8rem 1rem; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0; cursor: move;" id="paragonsEditorHeader">
    <h3 style="margin: 0; font-size: 0.9rem; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.05em;">👑 Paragons Editor</h3>
    <button id="closeParagonsBtn" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 1.2rem;">&times;</button>
  </div>

  <div style="display: flex; flex: 1; overflow: hidden;">
    <!-- Left Pane: List -->
    <div style="flex: 1; border-right: 1px solid #334155; display: flex; flex-direction: column;">
      <div style="padding: 0.8rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid #334155;">
        <button id="btnNewParagon" style="width: 100%; padding: 0.4rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+ New Paragon</button>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 0.5rem;" id="paragonsListContainer">
        <!-- List inserted here -->
      </div>
    </div>

    <!-- Right Pane: Inspector -->
    <div style="flex: 1.5; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.8rem;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
        <div>
          <label style="display: block; font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.2rem;">Name</label>
          <input id="pgName" type="text" style="width: 100%; padding: 0.4rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px; box-sizing: border-box;"/>
        </div>
        <div>
          <label style="display: block; font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.2rem;">Role/Title</label>
          <input id="pgRole" type="text" style="width: 100%; padding: 0.4rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px; box-sizing: border-box;"/>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
        <div>
          <label style="display: block; font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.2rem;">Affiliation Type</label>
          <select id="pgAffType" style="width: 100%; padding: 0.4rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px; box-sizing: border-box;">
            <option value="state">State</option>
            <option value="burg">Burg</option>
            <option value="religion">Religion</option>
          </select>
        </div>
        <div>
          <label style="display: block; font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.2rem;">Affiliation Target</label>
          <select id="pgAffId" style="width: 100%; padding: 0.4rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px; box-sizing: border-box;">
            <option value="-1">N/A</option>
          </select>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #334155; margin: 0.4rem 0;" />
      <h4 style="margin:0; font-size:0.8rem; color:#cbd5e1;">Traits</h4>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
        <div>
          <label style="display: block; font-size: 0.65rem; color: #10b981; margin-bottom: 0.2rem;">Positive</label>
          <select id="pgPos" style="width: 100%; padding: 0.3rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;"></select>
        </div>
        <div>
          <label style="display: block; font-size: 0.65rem; color: #ef4444; margin-bottom: 0.2rem;">Negative</label>
          <select id="pgNeg" style="width: 100%; padding: 0.3rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;"></select>
        </div>
        <div>
          <label style="display: block; font-size: 0.65rem; color: #fbbf24; margin-bottom: 0.2rem;">Neutral 1</label>
          <select id="pgNeu1" style="width: 100%; padding: 0.3rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;"></select>
        </div>
        <div>
          <label style="display: block; font-size: 0.65rem; color: #fbbf24; margin-bottom: 0.2rem;">Neutral 2</label>
          <select id="pgNeu2" style="width: 100%; padding: 0.3rem; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;"></select>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #334155; margin: 0.4rem 0;" />
      <h4 style="margin:0; font-size:0.8rem; color:#cbd5e1;">Stats (1-10)</h4>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem;">
        <div><label style="font-size:0.6rem; color:#94a3b8;">Might</label><input type="number" id="st_might" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Endurance</label><input type="number" id="st_endurance" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Finesse</label><input type="number" id="st_finesse" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Reflex</label><input type="number" id="st_reflex" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        
        <div><label style="font-size:0.6rem; color:#94a3b8;">Vitality</label><input type="number" id="st_vitality" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Fortitude</label><input type="number" id="st_fortitude" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Knowledge</label><input type="number" id="st_knowledge" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Logic</label><input type="number" id="st_logic" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        
        <div><label style="font-size:0.6rem; color:#94a3b8;">Awareness</label><input type="number" id="st_awareness" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Intuition</label><input type="number" id="st_intuition" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Charm</label><input type="number" id="st_charm" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
        <div><label style="font-size:0.6rem; color:#94a3b8;">Willpower</label><input type="number" id="st_willpower" min="1" max="10" style="width:100%; background:#0f172a; color:white; border:1px solid #334155; padding:0.2rem;"/></div>
      </div>

      <div style="margin-top: auto; display: flex; justify-content: space-between; gap: 0.5rem; padding-top: 1rem;">
        <button id="btnDelParagon" style="background: #ef4444; border: none; color: white; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; display: none;">Delete</button>
        <div style="flex: 1;"></div>
        <button id="btnSaveParagon" style="background: #3b82f6; border: none; color: white; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Save Changes</button>
      </div>

    </div>
  </div>
</div>
`;

function buildOptions(opts: string[], el: HTMLSelectElement) {
	el.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join("");
}

let onUpdateCallback: (() => void) | null = null;

export function mountParagonsEditor(mountId: string, onUpdate: () => void) {
	const mountEl = document.getElementById(mountId);
	if (!mountEl) return;
	onUpdateCallback = onUpdate;

	if (!panelElement) {
		const div = document.createElement("div");
		div.innerHTML = HTML_CONTENT;
		mountEl.appendChild(div);
		panelElement = document.getElementById("paragonsEditorPanel");

		// Bind dragging
		let isDragging = false;
		let startX = 0, startY = 0;
		const header = document.getElementById("paragonsEditorHeader");
		header?.addEventListener("mousedown", (e) => {
			isDragging = true;
			startX = e.clientX - panelElement!.offsetLeft;
			startY = e.clientY - panelElement!.offsetTop;
		});
		window.addEventListener("mousemove", (e) => {
			if (!isDragging) return;
			panelElement!.style.left = `${e.clientX - startX}px`;
			panelElement!.style.top = `${e.clientY - startY}px`;
		});
		window.addEventListener("mouseup", () => { isDragging = false; });

		// Bind events
		document.getElementById("closeParagonsBtn")?.addEventListener("click", () => {
			panelElement!.style.display = "none";
		});

		// Populate traits dropdowns
		const pgPos = document.getElementById("pgPos") as HTMLSelectElement;
		const pgNeg = document.getElementById("pgNeg") as HTMLSelectElement;
		const pgNeu1 = document.getElementById("pgNeu1") as HTMLSelectElement;
		const pgNeu2 = document.getElementById("pgNeu2") as HTMLSelectElement;
		buildOptions(POSITIVE_TRAITS, pgPos);
		buildOptions(NEGATIVE_TRAITS, pgNeg);
		buildOptions(NEUTRAL_TRAITS, pgNeu1);
		buildOptions(NEUTRAL_TRAITS, pgNeu2);

		document.getElementById("btnNewParagon")?.addEventListener("click", () => {
			currentParagonId = "";
			document.getElementById("pgName")!.value = "New Paragon";
			document.getElementById("pgRole")!.value = "Unknown";
			(document.getElementById("pgAffType") as HTMLSelectElement).value = "burg";
			updateAffiliationTargets();
			document.getElementById("btnDelParagon")!.style.display = "none";
			// random defaults
			pgPos.value = POSITIVE_TRAITS[0];
			pgNeg.value = NEGATIVE_TRAITS[0];
			pgNeu1.value = NEUTRAL_TRAITS[0];
			pgNeu2.value = NEUTRAL_TRAITS[1];
			// stat defaults
			const statIds = ["might", "endurance", "finesse", "reflex", "vitality", "fortitude", "knowledge", "logic", "awareness", "intuition", "charm", "willpower"];
			statIds.forEach(id => (document.getElementById(`st_${id}`) as HTMLInputElement).value = "5");
		});

		document.getElementById("pgAffType")?.addEventListener("change", updateAffiliationTargets);

		document.getElementById("btnSaveParagon")?.addEventListener("click", saveCurrentParagon);
		document.getElementById("btnDelParagon")?.addEventListener("click", deleteCurrentParagon);
	}
}

export function openParagonsEditor() {
	if (!panelElement) return;

	refreshParagonsList();
	panelElement!.style.display = "flex";
}

function updateAffiliationTargets() {
	const typeSel = document.getElementById("pgAffType") as HTMLSelectElement;
	const idSel = document.getElementById("pgAffId") as HTMLSelectElement;
	const type = typeSel.value;

	idSel.innerHTML = `<option value="-1">N/A</option>`;
	idSel.disabled = false;

	const state = store.getState() as any;

	if (type === "state") {
		const states = state.states || [];
		states.forEach((s: any) => {
			idSel.innerHTML += `<option value="${s.i || s.id}">${s.name}</option>`;
		});
	} else if (type === "burg") {
		const burgs = state.burgs || [];
		burgs.forEach((b: any) => {
			if (b.population > 0) idSel.innerHTML += `<option value="${b.i || b.id}">${b.name}</option>`;
		});
	} else if (type === "religion") {
		const rels = state.religions || [];
		rels.forEach((r: any) => {
			idSel.innerHTML += `<option value="${r.i || r.id}">${r.name}</option>`;
		});
	}
}

function refreshParagonsList() {
	const container = document.getElementById("paragonsListContainer");
	if (!container) return;

	const state = store.getState() as any;
	const paragons = state.paragons || [];

	container.innerHTML = "";

	if (paragons.length === 0) {
		container.innerHTML = `<div style="text-align:center; color:#64748b; font-size:0.8rem; padding: 1rem;">No paragons found.</div>`;
		return;
	}

	paragons.forEach((p: Paragon) => {
		const div = document.createElement("div");
		div.style.padding = "0.5rem";
		div.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
		div.style.cursor = "pointer";
		div.style.fontSize = "0.8rem";
		div.style.color = "#cbd5e1";
		
		let badge = "";
		if (p.affiliationType === "burg") badge = "🏰 Burg";
		else if (p.affiliationType === "state") badge = "👑 State";
		else if (p.affiliationType === "religion") badge = "⛪ Rel";

		div.innerHTML = `
			<div style="font-weight: bold; color: #f8fafc;">${p.name}</div>
			<div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; margin-top: 0.2rem;">
				<span>${p.role}</span>
				<span style="background: rgba(255,255,255,0.1); padding: 0.1rem 0.3rem; border-radius: 4px;">${badge}</span>
			</div>
		`;

		div.addEventListener("click", () => {
			currentParagonId = p.id;
			loadParagon(p);
		});

		container.appendChild(div);
	});
}

function loadParagon(p: Paragon) {
	(document.getElementById("pgName") as HTMLInputElement).value = p.name;
	(document.getElementById("pgRole") as HTMLInputElement).value = p.role;
	
	const typeSel = document.getElementById("pgAffType") as HTMLSelectElement;
	typeSel.value = p.affiliationType;
	updateAffiliationTargets();
	
	const idSel = document.getElementById("pgAffId") as HTMLSelectElement;
	idSel.value = String(p.affiliationId);

	(document.getElementById("pgPos") as HTMLSelectElement).value = p.positiveTrait;
	(document.getElementById("pgNeg") as HTMLSelectElement).value = p.negativeTrait;
	(document.getElementById("pgNeu1") as HTMLSelectElement).value = p.neutralTraits[0];
	(document.getElementById("pgNeu2") as HTMLSelectElement).value = p.neutralTraits[1];

	const statIds = ["might", "endurance", "finesse", "reflex", "vitality", "fortitude", "knowledge", "logic", "awareness", "intuition", "charm", "willpower"];
	statIds.forEach(id => {
		(document.getElementById(`st_${id}`) as HTMLInputElement).value = String((p.stats as any)[id] || 5);
	});

	document.getElementById("btnDelParagon")!.style.display = "block";
}

function saveCurrentParagon() {
	const state = store.getState() as any;
	const paragons = [...(state.paragons || [])];

	const newP: Paragon = {
		id: currentParagonId || `p_manual_${Date.now()}`,
		name: (document.getElementById("pgName") as HTMLInputElement).value,
		role: (document.getElementById("pgRole") as HTMLInputElement).value,
		affiliationType: (document.getElementById("pgAffType") as HTMLSelectElement).value as any,
		affiliationId: parseInt((document.getElementById("pgAffId") as HTMLSelectElement).value, 10),
		positiveTrait: (document.getElementById("pgPos") as HTMLSelectElement).value,
		negativeTrait: (document.getElementById("pgNeg") as HTMLSelectElement).value,
		neutralTraits: [
			(document.getElementById("pgNeu1") as HTMLSelectElement).value,
			(document.getElementById("pgNeu2") as HTMLSelectElement).value
		],
		stats: {
			might: parseInt((document.getElementById("st_might") as HTMLInputElement).value, 10),
			endurance: parseInt((document.getElementById("st_endurance") as HTMLInputElement).value, 10),
			finesse: parseInt((document.getElementById("st_finesse") as HTMLInputElement).value, 10),
			reflex: parseInt((document.getElementById("st_reflex") as HTMLInputElement).value, 10),
			vitality: parseInt((document.getElementById("st_vitality") as HTMLInputElement).value, 10),
			fortitude: parseInt((document.getElementById("st_fortitude") as HTMLInputElement).value, 10),
			knowledge: parseInt((document.getElementById("st_knowledge") as HTMLInputElement).value, 10),
			logic: parseInt((document.getElementById("st_logic") as HTMLInputElement).value, 10),
			awareness: parseInt((document.getElementById("st_awareness") as HTMLInputElement).value, 10),
			intuition: parseInt((document.getElementById("st_intuition") as HTMLInputElement).value, 10),
			charm: parseInt((document.getElementById("st_charm") as HTMLInputElement).value, 10),
			willpower: parseInt((document.getElementById("st_willpower") as HTMLInputElement).value, 10),
		}
	};

	if (currentParagonId) {
		const idx = paragons.findIndex((p: Paragon) => p.id === currentParagonId);
		if (idx > -1) {
			paragons[idx] = newP;
		}
	} else {
		paragons.push(newP);
		currentParagonId = newP.id;
	}

	store.updateState({ paragons });
	refreshParagonsList();
	document.getElementById("btnDelParagon")!.style.display = "block";
	if (onUpdateCallback) onUpdateCallback();
}

function deleteCurrentParagon() {
	if (!currentParagonId) return;
	const state = store.getState() as any;
	let paragons = state.paragons || [];
	paragons = paragons.filter((p: Paragon) => p.id !== currentParagonId);
	
	store.updateState({ paragons });
	refreshParagonsList();
	
	currentParagonId = "";
	document.getElementById("btnNewParagon")?.click(); // reset form
	if (onUpdateCallback) onUpdateCallback();
}
