import { store } from "../state/store";

export function mountNotesEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "notesPanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "50%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translate(-50%, -50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "500px";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(250, 204, 21, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#facc15;font-size:1.1rem;">📝 World Notes</h3>
      <span id="closeNotes" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      <textarea id="notesArea" style="width:100%;height:300px;box-sizing:border-box;padding:0.5rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;font-family:inherit;resize:none;" placeholder="Write down lore, history, or campaign notes here..."></textarea>
      <button id="saveNotesBtn" style="padding:0.5rem;border-radius:6px;border:none;background:#10b981;color:#fff;font-weight:bold;cursor:pointer;margin-top:0.5rem;">Save Notes</button>
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeNotes") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	const saveBtn = document.getElementById("saveNotesBtn") as HTMLButtonElement;
	const textArea = document.getElementById("notesArea") as HTMLTextAreaElement;

	saveBtn.addEventListener("click", () => {
		store.updateState({ notes: textArea.value });
		wrapper.style.display = "none";
	});

	(window as any).openNotesEditor = () => {
		const state = store.getState() as any;
		textArea.value = state.notes || "";
		wrapper.style.display = "block";
	};
}
