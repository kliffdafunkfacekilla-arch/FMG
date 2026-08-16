import type { Route } from "../simulation/civilization/route-generator";
import { store } from "../state/store";

export function mountRouteEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="routeEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #f43f5e; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Route Editor</span>
        <span id="closeRouteBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>
      <div style="display: flex; flex-direction: column; gap: 0.6rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Route Type / Group:</label>
          <select id="editRouteType" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="road">Road</option>
            <option value="trail">Trail</option>
            <option value="sea">Sea Route</option>
          </select>
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

	let activeRoute: Route | null = null;

	const panel = document.getElementById("routeEditorPanel") as HTMLDivElement;
	const typeSelect = document.getElementById(
		"editRouteType",
	) as HTMLSelectElement;
	const valLength = document.getElementById("valRouteLength") as HTMLDivElement;

	const saveBtn = document.getElementById("saveRouteBtn") as HTMLButtonElement;
	const deleteBtn = document.getElementById(
		"deleteRouteBtn",
	) as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelRouteBtn",
	) as HTMLButtonElement;
	const closeBtn = document.getElementById("closeRouteBtn") as HTMLSpanElement;

	const closePanel = () => {
		panel.style.display = "none";
	};

	closeBtn.addEventListener("click", closePanel);
	cancelBtn.addEventListener("click", closePanel);

	saveBtn.addEventListener("click", () => {
		if (activeRoute) {
			activeRoute.type = typeSelect.value as "road" | "trail" | "sea";

			// Update state store
			const state = store.getState() as any;
			if (state.routes) {
				const updatedRoutes = state.routes.map((r: Route) =>
					r.id === activeRoute?.id ? { ...activeRoute } : r,
				);
				store.updateState({ routes: updatedRoutes });
			}

			panel.style.display = "none";
			onUpdate();
		}
	});

	deleteBtn.addEventListener("click", () => {
		if (activeRoute) {
			const state = store.getState() as any;
			if (state.routes) {
				const updatedRoutes = state.routes.filter(
					(r: Route) => r.id !== activeRoute?.id,
				);
				store.updateState({ routes: updatedRoutes });
			}

			panel.style.display = "none";
			onUpdate();
		}
	});

	// Export activation hook
	(window as any).openRouteEditor = (route: Route) => {
		activeRoute = route;
		typeSelect.value = route.type;

		// Calculate length
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

		// Convert length to visual leagues (1.8x factor matching FMG visual miles/leagues)
		valLength.innerText = `${Math.round(totalLength * 1.8)} leagues`;
		panel.style.display = "block";
	};
}
