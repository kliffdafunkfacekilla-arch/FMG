import { store } from "../state/store";
import { nameBases } from "../core/name-database";
import { Names } from "../simulation/civilization/name-generator";

export function mountNamesbaseEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "namesbasePanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "50%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translate(-50%, -50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "500px";
	wrapper.style.maxHeight = "85vh";
	wrapper.style.overflowY = "auto";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(56, 189, 248, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.fontSize = "0.875rem";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#38bdf8;font-size:1.1rem;">🔠 Namesbase Configuration</h3>
      <span id="closeNamesbase" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div id="namesbaseList" style="display:flex;flex-direction:column;gap:0.4rem;max-height:400px;overflow-y:auto;padding-right:0.5rem;border-right:1px solid #333;">
        <!-- List populated dynamically -->
      </div>
      
      <div id="namesbasePreview" style="display:flex;flex-direction:column;gap:0.5rem;">
        <h4 style="margin:0;color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;">Name Preview</h4>
        <div id="previewOutput" style="display:flex;flex-direction:column;gap:0.3rem;background:#0f0f12;padding:0.5rem;border-radius:6px;border:1px solid #334;font-family:monospace;min-height:200px;">
          <div style="color:#64748b;text-align:center;margin-top:2rem;">Select a base to generate preview names</div>
        </div>
        <button id="regeneratePreviewBtn" style="padding:0.4rem;background:#1e293b;border:1px solid #334;color:#38bdf8;border-radius:4px;cursor:pointer;margin-top:auto;display:none;">Regenerate Preview</button>
      </div>
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeNamesbase") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	let currentSelectedBase = -1;
	const regenBtn = document.getElementById("regeneratePreviewBtn") as HTMLButtonElement;
	
	const generatePreview = (baseId: number) => {
		const out = document.getElementById("previewOutput")!;
		out.innerHTML = "";
		for (let i = 0; i < 15; i++) {
			const n = document.createElement("div");
			n.textContent = Names.getBase(baseId, 3, 8);
			out.appendChild(n);
		}
	};
	
	regenBtn.addEventListener("click", () => {
		if (currentSelectedBase >= 0) {
			generatePreview(currentSelectedBase);
		}
	});

	const renderList = () => {
		const listContainer = document.getElementById("namesbaseList")!;
		listContainer.innerHTML = "";

		nameBases.forEach((base, idx) => {
			const btn = document.createElement("button");
			btn.textContent = base.name;
			btn.style.padding = "0.5rem";
			btn.style.background = "#1e293b";
			btn.style.border = "1px solid #334";
			btn.style.color = "#fff";
			btn.style.borderRadius = "4px";
			btn.style.cursor = "pointer";
			btn.style.textAlign = "left";
			
			btn.addEventListener("mouseover", () => btn.style.background = "#334155");
			btn.addEventListener("mouseout", () => {
				if (currentSelectedBase !== idx) btn.style.background = "#1e293b";
			});

			btn.addEventListener("click", () => {
				// Reset others
				listContainer.querySelectorAll("button").forEach(b => b.style.background = "#1e293b");
				btn.style.background = "#3b82f6";
				currentSelectedBase = idx;
				generatePreview(idx);
				regenBtn.style.display = "block";
			});

			listContainer.appendChild(btn);
		});
	};

	(window as any).openNamesbaseEditor = () => {
		renderList();
		wrapper.style.display = "block";
	};
}
