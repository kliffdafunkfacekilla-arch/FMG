import { store } from "../state/store";
import type { Note } from "../state/store";

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
	wrapper.style.width = "600px";
	wrapper.style.maxHeight = "85vh";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(250, 204, 21, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.display = "flex";
	wrapper.style.flexDirection = "column";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#facc15;font-size:1.1rem;">📝 World Lore & Notes</h3>
      <span id="closeNotes" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div style="display:flex;gap:1rem;flex:1;overflow:hidden;min-height:450px;">
      <!-- Left sidebar: Filter and List -->
      <div style="width:200px;display:flex;flex-direction:column;gap:0.5rem;border-right:1px solid rgba(255,255,255,0.1);padding-right:0.5rem;">
        <select id="noteFilter" style="width:100%;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
          <option value="all">All Notes</option>
          <option value="global">Global</option>
          <option value="state">States</option>
          <option value="burg">Burgs</option>
          <option value="culture">Cultures</option>
          <option value="religion">Religions</option>
          <option value="province">Provinces</option>
          <option value="zone">Zones</option>
          <option value="resource">Resources</option>
        </select>
        
        <div id="notesList" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem;">
          <!-- List goes here -->
        </div>
        
        <button id="addNoteBtn" style="padding:0.4rem;border-radius:4px;background:#3b82f6;color:white;border:none;cursor:pointer;font-weight:bold;font-size:0.8rem;">+ New Note</button>
      </div>

      <!-- Right panel: Edit -->
      <div id="noteEditor" style="flex:1;display:flex;flex-direction:column;gap:0.5rem;display:none;">
        <input type="hidden" id="editNoteId" />
        
        <div style="display:flex;gap:0.5rem;">
          <select id="editNoteType" style="width:40%;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
            <option value="global">Global</option>
            <option value="state">State</option>
            <option value="burg">Burg</option>
            <option value="culture">Culture</option>
            <option value="religion">Religion</option>
            <option value="province">Province</option>
            <option value="zone">Zone</option>
            <option value="resource">Resource</option>
          </select>
          <input type="text" id="editNoteTargetId" placeholder="Target ID (e.g. 1)" style="flex:1;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
        </div>

        <input type="text" id="editNoteTitle" placeholder="Title" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.9rem;font-weight:bold;">
        
        <input type="text" id="editNoteTags" placeholder="Tags (comma separated)" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">

        <textarea id="editNoteContent" style="flex:1;width:100%;box-sizing:border-box;padding:0.5rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;font-family:inherit;resize:none;font-size:0.85rem;" placeholder="Write down lore, history, or campaign notes here..."></textarea>
        
        <div style="display:flex;justify-content:space-between;margin-top:auto;">
          <button id="deleteNoteBtn" style="padding:0.5rem;border-radius:6px;border:none;background:#e11d48;color:#fff;cursor:pointer;font-size:0.8rem;">Delete</button>
          <button id="saveNoteBtn" style="padding:0.5rem 1rem;border-radius:6px;border:none;background:#10b981;color:#fff;font-weight:bold;cursor:pointer;font-size:0.8rem;">Save</button>
        </div>
      </div>
      
      <div id="noNoteSelected" style="flex:1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.9rem;">
        Select or create a note.
      </div>
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeNotes") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});
	wrapper.style.display = "none"; // Hide initially

	let currentNotes: Note[] = [];

	const renderList = () => {
		const filterVal = (document.getElementById("noteFilter") as HTMLSelectElement).value;
		const listContainer = document.getElementById("notesList")!;
		listContainer.innerHTML = "";

		const filtered = filterVal === "all" ? currentNotes : currentNotes.filter((n) => n.targetType === filterVal);

		if (filtered.length === 0) {
			listContainer.innerHTML = `<div style="text-align:center;color:#64748b;font-size:0.8rem;padding:1rem;">No notes found.</div>`;
			return;
		}

		for (const note of filtered) {
			const item = document.createElement("div");
			item.style.padding = "0.4rem";
			item.style.background = "#0f172a";
			item.style.border = "1px solid #334";
			item.style.borderRadius = "4px";
			item.style.cursor = "pointer";
			item.style.fontSize = "0.8rem";

			item.innerHTML = `
        <div style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${note.title || "Untitled"}</div>
        <div style="color:#94a3b8;font-size:0.7rem;margin-top:0.2rem;">${note.targetType.toUpperCase()} ${note.targetId ? "#" + note.targetId : ""}</div>
      `;

			item.addEventListener("click", () => {
				openNoteEditor(note);
			});

			listContainer.appendChild(item);
		}
	};

	const openNoteEditor = (note: Note) => {
		document.getElementById("noNoteSelected")!.style.display = "none";
		document.getElementById("noteEditor")!.style.display = "flex";

		(document.getElementById("editNoteId") as HTMLInputElement).value = note.id;
		(document.getElementById("editNoteType") as HTMLSelectElement).value = note.targetType;
		(document.getElementById("editNoteTargetId") as HTMLInputElement).value = String(note.targetId || "");
		(document.getElementById("editNoteTitle") as HTMLInputElement).value = note.title;
		(document.getElementById("editNoteTags") as HTMLInputElement).value = note.tags ? note.tags.join(", ") : "";
		(document.getElementById("editNoteContent") as HTMLTextAreaElement).value = note.content;
	};

	document.getElementById("noteFilter")!.addEventListener("change", renderList);

	document.getElementById("addNoteBtn")!.addEventListener("click", () => {
		const newNote: Note = {
			id: Date.now().toString(),
			targetType: "global",
			targetId: "",
			title: "New Note",
			content: "",
			tags: [],
		};
		openNoteEditor(newNote);
	});

	document.getElementById("saveNoteBtn")!.addEventListener("click", () => {
		const id = (document.getElementById("editNoteId") as HTMLInputElement).value;
		const targetType = (document.getElementById("editNoteType") as HTMLSelectElement).value as any;
		const targetIdStr = (document.getElementById("editNoteTargetId") as HTMLInputElement).value;
		const targetId = isNaN(Number(targetIdStr)) || targetIdStr === "" ? targetIdStr : Number(targetIdStr);
		const title = (document.getElementById("editNoteTitle") as HTMLInputElement).value;
		const tagsStr = (document.getElementById("editNoteTags") as HTMLInputElement).value;
		const tags = tagsStr.split(",").map((s) => s.trim()).filter((s) => s !== "");
		const content = (document.getElementById("editNoteContent") as HTMLTextAreaElement).value;

		const existingIdx = currentNotes.findIndex((n) => n.id === id);
		if (existingIdx >= 0) {
			currentNotes[existingIdx] = { id, targetType, targetId, title, tags, content };
		} else {
			currentNotes.push({ id, targetType, targetId, title, tags, content });
		}

		store.updateState({ notes: currentNotes });
		renderList();
		document.getElementById("noNoteSelected")!.style.display = "flex";
		document.getElementById("noteEditor")!.style.display = "none";
	});

	document.getElementById("deleteNoteBtn")!.addEventListener("click", () => {
		const id = (document.getElementById("editNoteId") as HTMLInputElement).value;
		currentNotes = currentNotes.filter((n) => n.id !== id);
		store.updateState({ notes: currentNotes });
		renderList();
		document.getElementById("noNoteSelected")!.style.display = "flex";
		document.getElementById("noteEditor")!.style.display = "none";
	});

	(window as any).openNotesEditor = () => {
		const state = store.getState() as any;
		// Migrate old string notes if necessary
		if (typeof state.notes === "string") {
			currentNotes = [
				{
					id: "legacy",
					targetType: "global",
					targetId: "",
					title: "Legacy Notes",
					content: state.notes,
					tags: ["legacy"],
				},
			];
			store.updateState({ notes: currentNotes });
		} else {
			currentNotes = state.notes || [];
		}

		renderList();
		document.getElementById("noNoteSelected")!.style.display = "flex";
		document.getElementById("noteEditor")!.style.display = "none";
		wrapper.style.display = "flex";
	};
}
