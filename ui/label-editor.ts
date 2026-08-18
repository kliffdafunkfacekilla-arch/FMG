import { store } from "../state/store";

export interface MapLabel {
	id: number;
	text: string;
	x: number;
	y: number;
	rotation: number; // in degrees
	size: number;
}

let isPlacingLabel = false;
let currentOnUpdate: (() => void) | null = null;

export function mountLabelEditor(containerId: string, onUpdate: () => void) {
	currentOnUpdate = onUpdate;
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="labelEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; flex-direction: column; gap: 0.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #fb7185; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Labels Editor</span>
        <span id="closeLabelBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
      	<button id="btnPlaceLabelMode" style="flex: 1; background: #3b82f6; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Enable Placement Mode</button>
      </div>

      <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
	      <div>
	        <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Next Label Text:</label>
	        <input id="labelTextInput" type="text" value="New Territory" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box;" />
	      </div>
	      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
	        <div style="flex: 1;">
	          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Size:</label>
	          <input id="labelSizeInput" type="number" value="16" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box;" />
	        </div>
	        <div style="flex: 1;">
	          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Rotation (°):</label>
	          <input id="labelRotInput" type="number" value="0" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box;" />
	        </div>
	      </div>
	      <button id="addLabelBtn" style="width: 100%; background: #e11d48; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; margin-top: 0.5rem;">
	        Add Label to Center
	      </button>
      </div>

      <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.4rem;">Text</th>
                <th style="padding: 0.4rem; text-align: center;">Size</th>
                <th style="padding: 0.4rem; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody id="labelTableBody" style="color: #cbd5e1;"></tbody>
          </table>
      </div>

    </div>
  `;

	const txtInput = document.getElementById("labelTextInput") as HTMLInputElement;
	const sizeInput = document.getElementById("labelSizeInput") as HTMLInputElement;
	const rotInput = document.getElementById("labelRotInput") as HTMLInputElement;
	const btnCenter = document.getElementById("addLabelBtn") as HTMLButtonElement;
	const btnPlace = document.getElementById("btnPlaceLabelMode") as HTMLButtonElement;

	const panel = document.getElementById("labelEditorPanel") as HTMLDivElement;
	const closeBtn = document.getElementById("closeLabelBtn") as HTMLSpanElement;

	if (closeBtn && panel) {
		closeBtn.addEventListener("click", () => {
			panel.style.display = "none";
			isPlacingLabel = false;
			btnPlace.innerText = "Enable Placement Mode";
			btnPlace.style.background = "#3b82f6";
		});
	}

	btnPlace.addEventListener("click", () => {
		isPlacingLabel = !isPlacingLabel;
		if (isPlacingLabel) {
			btnPlace.innerText = "Disable Placement Mode (Click map to place)";
			btnPlace.style.background = "#eab308";
			btnPlace.style.color = "black";
		} else {
			btnPlace.innerText = "Enable Placement Mode";
			btnPlace.style.background = "#3b82f6";
			btnPlace.style.color = "white";
		}
	});

	btnCenter.addEventListener("click", () => {
		const state = store.getState() as any;
		addLabelAt(state.width / 2 || 400, state.height / 2 || 300);
	});

	// Register a click hook that main.ts can call
	(window as any).handleLabelMapClick = (x: number, y: number) => {
		if (!isPlacingLabel) return false;
		addLabelAt(x, y);
		return true; // handled
	};

	(window as any).refreshLabelsList = refreshLabelsList;

	refreshLabelsList();
}

function addLabelAt(x: number, y: number) {
	const txtInput = document.getElementById("labelTextInput") as HTMLInputElement;
	const sizeInput = document.getElementById("labelSizeInput") as HTMLInputElement;
	const rotInput = document.getElementById("labelRotInput") as HTMLInputElement;

	const state = store.getState() as any;
	const labels = state.labels || [];

	const newLabel: MapLabel = {
		id: Math.floor(Math.random() * 100000),
		text: txtInput.value,
		x,
		y,
		size: parseInt(sizeInput.value, 10) || 16,
		rotation: parseInt(rotInput.value, 10) || 0,
	};

	store.updateState({ labels: [...labels, newLabel] });
	refreshLabelsList();
	if (currentOnUpdate) currentOnUpdate();
}

export function refreshLabelsList() {
	const tableBody = document.getElementById("labelTableBody") as HTMLTableSectionElement;
	if (!tableBody) return;

	const state = store.getState() as any;
	const labels = state.labels || [];
	tableBody.innerHTML = "";

	if (labels.length === 0) {
		tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:0.5rem; color:#64748b;">No labels found.</td></tr>`;
		return;
	}

	labels.forEach((lbl: MapLabel) => {
		const tr = document.createElement("tr");
		tr.style.borderBottom = "1px solid #222";
		tr.innerHTML = `
			<td style="padding: 0.4rem; color: #fff;">${lbl.text}</td>
			<td style="padding: 0.4rem; text-align: center; color: #94a3b8;">${lbl.size}</td>
			<td style="padding: 0.4rem; text-align: center;">
				<button class="delLabelBtn" data-id="${lbl.id}" style="background: #ef4444; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Del</button>
			</td>
		`;
		tableBody.appendChild(tr);
	});

	tableBody.querySelectorAll(".delLabelBtn").forEach(btn => {
		btn.addEventListener("click", (e) => {
			const id = parseInt((e.currentTarget as HTMLButtonElement).getAttribute("data-id") || "0", 10);
			const filtered = (store.getState() as any).labels.filter((l: MapLabel) => l.id !== id);
			store.updateState({ labels: filtered });
			refreshLabelsList();
			if (currentOnUpdate) currentOnUpdate();
		});
	});
}
