import { store } from "../state/store";
import type { AppState } from "../state/store";
import type { MemoryGraph, MemoryNode } from "../simulation/story/memory-dag";

export function mountMemoryViewer(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "memoryViewerPanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "10%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translateX(-50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "750px";
	wrapper.style.maxHeight = "80vh";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(99, 102, 241, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.display = "flex";
	wrapper.style.flexDirection = "column";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#818cf8;font-size:1.1rem;">🧠 World Memory DAG</h3>
      <span id="closeMemoryViewer" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>
    
    <div style="margin-bottom: 1rem; color: #94a3b8; font-size: 0.85rem;">
      The AI Director's long-term memory graph. Shows interlinked events, actors, and locations.
    </div>

    <div id="memoryNodeContainer" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:0.5rem;padding-right:0.5rem;min-height:400px;">
      <!-- Nodes will render here -->
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeMemoryViewer") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});
	wrapper.style.display = "none";
}

export function openMemoryViewer() {
	const panel = document.getElementById("memoryViewerPanel") as HTMLDivElement;
	if (panel) {
		renderMemoryGraph();
		panel.style.display = "flex";
	}
}

function renderMemoryGraph() {
	const container = document.getElementById("memoryNodeContainer");
	if (!container) return;
	
	container.innerHTML = "";

	const state = store.getState() as AppState;
	const graph: MemoryGraph | undefined = state.memoryGraph;

	if (!graph || graph.nodes.length === 0) {
		container.innerHTML = `<div style="color: #64748b; text-align: center; padding: 2rem;">Memory graph is empty. Run the simulation to generate events.</div>`;
		return;
	}

	// Sort nodes by timestamp/creation (simplistic id sorting for now since ids have timestamp)
	const sortedNodes = [...graph.nodes].sort((a, b) => b.id.localeCompare(a.id));

	sortedNodes.forEach(node => {
		const nodeCard = document.createElement("div");
		nodeCard.style.background = "#1e293b";
		nodeCard.style.border = "1px solid #334155";
		nodeCard.style.borderRadius = "8px";
		nodeCard.style.padding = "0.75rem";
		
		let typeColor = "#94a3b8";
		if (node.type === "Event") typeColor = "#38bdf8";
		else if (node.type === "StoryHook") typeColor = "#f43f5e";
		else if (node.type === "Actor") typeColor = "#10b981";

		// Find edges
		const edges = graph.edges.filter(e => e.sourceId === node.id);
		let edgesHtml = "";
		if (edges.length > 0) {
			edgesHtml = `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b; border-top: 1px dashed #334155; padding-top: 0.4rem;">
				<strong>Links:</strong>
				<ul style="margin: 0.2rem 0 0 1rem; padding: 0;">
					${edges.map(e => `<li><span style="color:#a78bfa;">${e.relation}</span>: ${e.targetId}</li>`).join("")}
				</ul>
			</div>`;
		}

		nodeCard.innerHTML = `
			<div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;">
				<span style="font-size:0.7rem;font-weight:bold;color:${typeColor};text-transform:uppercase;letter-spacing:1px;">${node.type}</span>
				<span style="font-size:0.65rem;color:#64748b;">${node.timestamp}</span>
			</div>
			<div style="font-size:0.9rem;font-weight:bold;color:#f8fafc;margin-bottom:0.2rem;">${node.title}</div>
			<div style="font-size:0.8rem;color:#cbd5e1;line-height:1.4;">${node.description}</div>
			${edgesHtml}
		`;
		
		container.appendChild(nodeCard);
	});
}
