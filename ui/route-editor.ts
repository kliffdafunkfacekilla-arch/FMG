import type { Route } from "../simulation/civilization/route-generator";
import { store } from "../state/store";

let isPlacingRoute = false;
let currentRoutePath: number[] = [];
let currentOnUpdate: (() => void) | null = null;
let activeRoute: Route | null = null;

export function mountRouteEditor(containerId: string, onUpdate: () => void) {
	currentOnUpdate = onUpdate;
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="routeEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #f97316; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span id="routeEditorTitle">Routes Overview</span>
        <span id="closeRouteBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>

      <!-- Sub Panel: List View -->
      <div id="routeListSubPanel" style="display: block;">
      	<button id="btnStartRoute" style="width: 100%; background: #3b82f6; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; margin-bottom: 0.5rem;">Create New Route</button>
        <div style="max-height: 220px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.4rem;">Type</th>
                <th style="padding: 0.4rem;">Length (Cells)</th>
                <th style="padding: 0.4rem; text-align: center;">Edit</th>
              </tr>
            </thead>
            <tbody id="routeTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>
      </div>

      <!-- Sub Panel: Editor / Creator View -->
      <div id="routeDetailSubPanel" style="display: none; flex-direction: column; gap: 0.6rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Route Type / Group:</label>
          <select id="editRouteType" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="road">Road</option>
            <option value="trail">Trail</option>
            <option value="sea">Sea Route</option>
            <option value="airship">Airship Route</option>
          </select>
        </div>
        
        <div id="routeCreationStatus" style="display: none; background: rgba(59, 130, 246, 0.2); padding: 0.4rem; border-radius: 4px; color: #60a5fa; text-align: center; font-weight: bold; margin-bottom: 0.5rem;">
        	Click points on map to build route.
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Calculated Length:</label>
          <div style="background: #0f0f12; padding: 0.4rem; border: 1px solid #444; color: #fbbf24; border-radius: 4px; font-weight: bold; font-size: 0.9rem;" id="valRouteLength">-</div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveRouteBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="deleteRouteBtn" style="flex: 1; background: #ef4444; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Delete</button>
          <button id="cancelRouteBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;

	const panel = document.getElementById("routeEditorPanel") as HTMLDivElement;
	const listPanel = document.getElementById("routeListSubPanel") as HTMLDivElement;
	const detailPanel = document.getElementById("routeDetailSubPanel") as HTMLDivElement;
	const titleText = document.getElementById("routeEditorTitle") as HTMLElement;
	const statusBox = document.getElementById("routeCreationStatus") as HTMLDivElement;

	const typeSelect = document.getElementById("editRouteType") as HTMLSelectElement;
	const valLength = document.getElementById("valRouteLength") as HTMLDivElement;

	const btnStart = document.getElementById("btnStartRoute") as HTMLButtonElement;
	const saveBtn = document.getElementById("saveRouteBtn") as HTMLButtonElement;
	const deleteBtn = document.getElementById("deleteRouteBtn") as HTMLButtonElement;
	const cancelBtn = document.getElementById("cancelRouteBtn") as HTMLButtonElement;
	const closeBtn = document.getElementById("closeRouteBtn") as HTMLSpanElement;

	const showList = () => {
		isPlacingRoute = false;
		currentRoutePath = [];
		activeRoute = null;
		
		titleText.innerText = "Routes Overview";
		listPanel.style.display = "block";
		detailPanel.style.display = "none";
		renderRoutesList();
	};

	const showEditor = (isNew: boolean) => {
		listPanel.style.display = "none";
		detailPanel.style.display = "flex";
		
		if (isNew) {
			titleText.innerText = "Create Route";
			statusBox.style.display = "block";
			deleteBtn.style.display = "none";
			valLength.innerText = "0 cells";
		} else {
			titleText.innerText = "Edit Route";
			statusBox.style.display = "none";
			deleteBtn.style.display = "block";
		}
	};

	closeBtn.addEventListener("click", () => {
		panel.style.display = "none";
		isPlacingRoute = false;
	});
	cancelBtn.addEventListener("click", showList);

	btnStart.addEventListener("click", () => {
		isPlacingRoute = true;
		currentRoutePath = [];
		activeRoute = null;
		showEditor(true);
	});

	saveBtn.addEventListener("click", () => {
		const state = store.getState() as any;
		const routes = state.routes || [];

		if (isPlacingRoute) {
			if (currentRoutePath.length < 2) {
				alert("A route needs at least 2 points!");
				return;
			}
			const nextId = routes.reduce((max: number, r: Route) => Math.max(max, r.id), 0) + 1;
			const newRoute: Route = {
				id: nextId,
				type: typeSelect.value as "road" | "trail" | "sea" | "airship",
				path: [...currentRoutePath]
			};
			store.updateState({ routes: [...routes, newRoute] });
		} else if (activeRoute) {
			activeRoute.type = typeSelect.value as "road" | "trail" | "sea" | "airship";
			const updatedRoutes = routes.map((r: Route) => r.id === activeRoute!.id ? { ...activeRoute } : r);
			store.updateState({ routes: updatedRoutes });
		}

		showList();
		if (currentOnUpdate) currentOnUpdate();
	});

	deleteBtn.addEventListener("click", () => {
		if (activeRoute) {
			const state = store.getState() as any;
			const updatedRoutes = (state.routes || []).filter((r: Route) => r.id !== activeRoute!.id);
			store.updateState({ routes: updatedRoutes });
			showList();
			if (currentOnUpdate) currentOnUpdate();
		}
	});

	// External click hook
	(window as any).handleRouteMapClick = (cellId: number) => {
		if (!isPlacingRoute) return false;
		
		currentRoutePath.push(cellId);
		valLength.innerText = `${currentRoutePath.length} cells`;
		
		// Optionally draw temporary line? (handled via redrawing the route layer in main)
		// For now just updating state triggers redraw if we want
		
		return true; // handled
	};

	(window as any).openRouteEditor = (route: Route) => {
		activeRoute = route;
		isPlacingRoute = false;
		typeSelect.value = route.type;

		let totalLength = 0;
		const state = store.getState() as any;
		if (state.grid && route.path && route.path.length > 1) {
			const points = state.grid.points;
			for (let i = 0; i < route.path.length - 1; i++) {
				const p1 = points[route.path[i]];
				const p2 = points[route.path[i + 1]];
				if (p1 && p2) {
					totalLength += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
				}
			}
		}

		valLength.innerText = `${Math.round(totalLength * 1.8)} leagues`;
		
		showEditor(false);
		panel.style.display = "block";
	};

	(window as any).openRoutesList = () => {
		showList();
		panel.style.display = "block";
	};

	function renderRoutesList() {
		const tableBody = document.getElementById("routeTableBody") as HTMLTableSectionElement;
		if (!tableBody) return;

		const state = store.getState() as any;
		const routes = state.routes || [];
		tableBody.innerHTML = "";

		if (routes.length === 0) {
			tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:0.5rem; color:#64748b;">No routes found.</td></tr>`;
			return;
		}

		routes.forEach((r: Route) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
				<td style="padding: 0.4rem; color: #fff;">${r.type.toUpperCase()}</td>
				<td style="padding: 0.4rem; color: #94a3b8;">${r.path.length} cells</td>
				<td style="padding: 0.4rem; text-align: center;">
					<button class="editSingleRouteBtn" data-id="${r.id}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
				</td>
			`;
			tableBody.appendChild(tr);
		});

		tableBody.querySelectorAll(".editSingleRouteBtn").forEach(btn => {
			btn.addEventListener("click", (e) => {
				const id = parseInt((e.currentTarget as HTMLButtonElement).getAttribute("data-id") || "0", 10);
				const target = routes.find((r: Route) => r.id === id);
				if (target) (window as any).openRouteEditor(target);
			});
		});
	}

	renderRoutesList();
}
