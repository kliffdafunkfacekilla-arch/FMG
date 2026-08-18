import { store } from "../state/store";
import { GOODS } from "../simulation/civilization/goods-generator";
import { initBiomeConfig } from "./biomes-editor";
import { calculateStoryHooks } from "../simulation/civilization/story-hooks";

interface ChartData {
	label: string;
	value: number;
	color: string;
	secondaryVal?: number;
}

export function mountDashboard(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="dashboardPanel" style="display: none; background: rgba(22, 22, 29, 0.98); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; font-family: 'Outfit', 'Inter', sans-serif; color: #f1f5f9; width: 100%; box-sizing: border-box; box-shadow: 0 15px 40px rgba(0,0,0,0.65); overflow: hidden; max-height: 85vh; display: flex; flex-direction: column;">
      
      <!-- Premium Header -->
      <div style="background: rgba(0, 0, 0, 0.4); padding: 1rem 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.3rem;">📊</span>
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #a855f7; letter-spacing: 0.02em;">Analytical Data Dashboard</h3>
            <p style="margin: 0; font-size: 0.72rem; color: #94a3b8;">Real-time world simulation analytics &amp; registry</p>
          </div>
        </div>
        <span id="closeDashboardBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.3rem; hover:color:white; transition: color 0.15s; padding: 0.2rem 0.5rem; line-height: 1;">&times;</span>
      </div>

      <!-- Live Key Metrics Ribbon -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; padding: 0.8rem 1.2rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; text-align: center;">
        <div style="background: rgba(255,255,255,0.03); padding: 0.4rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
          <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: bold;">States</div>
          <div id="metricStates" style="font-size: 1.1rem; font-weight: 700; color: #3b82f6;">0</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 0.4rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
          <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Populated Cities</div>
          <div id="metricBurgs" style="font-size: 1.1rem; font-weight: 700; color: #10b981;">0</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 0.4rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
          <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Active Religions</div>
          <div id="metricReligions" style="font-size: 1.1rem; font-weight: 700; color: #f43f5e;">0</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 0.4rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
          <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Ecology Health</div>
          <div id="metricEcology" style="font-size: 1.1rem; font-weight: 700; color: #22c55e;">100%</div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; background: rgba(0,0,0,0.15); border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; padding: 0 0.5rem;">
        <button class="dbTabBtn active" data-tab="demographics" style="flex: 1; padding: 0.75rem 0.2rem; background: transparent; border: none; color: #cbd5e1; font-weight: 600; cursor: pointer; font-size: 0.75rem; border-bottom: 2px solid #a855f7; transition: all 0.15s;">👥 Demographics</button>
        <button class="dbTabBtn" data-tab="economy" style="flex: 1; padding: 0.75rem 0.2rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.75rem; border-bottom: 2px solid transparent; transition: all 0.15s;">💰 Markets &amp; Trade</button>
        <button class="dbTabBtn" data-tab="ecology" style="flex: 1; padding: 0.75rem 0.2rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.75rem; border-bottom: 2px solid transparent; transition: all 0.15s;">🌱 Ecology &amp; Biomes</button>
        <button class="dbTabBtn" data-tab="fringe" style="flex: 1; padding: 0.75rem 0.2rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.75rem; border-bottom: 2px solid transparent; transition: all 0.15s;">🏴‍☠️ Fringe &amp; Wars</button>
        <button class="dbTabBtn" data-tab="story" style="flex: 1; padding: 0.75rem 0.2rem; background: transparent; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.75rem; border-bottom: 2px solid transparent; transition: all 0.15s;">📖 Story Seeds</button>
      </div>

      <!-- Main Content Split Screen (Charts Left, Inspector Right) -->
      <div style="display: flex; flex: 1; overflow: hidden; min-height: 0;">
        
        <!-- Left Side: Interactive Dashboard Views -->
        <div id="dashboardViewsContainer" style="flex: 1.4; padding: 1.2rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.2rem; border-right: 1px solid rgba(255,255,255,0.08); min-width: 0; box-sizing: border-box;">
          
          <!-- Tab 1: Demographics -->
          <div id="dbTabDemographics" class="dbTabContent" style="display: flex; flex-direction: column; gap: 1.2rem; width: 100%;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <h4 style="margin: 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #fbbf24;">State Populations (Military Size in Outer Ring)</h4>
                <span style="font-size: 0.7rem; color: #94a3b8;">Click bar to inspect state</span>
              </div>
              <div id="chartStatePop" style="min-height: 180px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); box-sizing: border-box;"></div>
            </div>

            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #818cf8;">Cultural Population Shares</h4>
              <div id="chartCulturesShare" style="min-height: 180px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); box-sizing: border-box;"></div>
            </div>

            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #f43f5e;">Religious Followers Breakdown</h4>
              <div id="chartReligionsPop" style="min-height: 150px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); box-sizing: border-box;"></div>
            </div>
          </div>

          <!-- Tab 2: Economy & Markets -->
          <div id="dbTabEconomy" class="dbTabContent" style="display: none; flex-direction: column; gap: 1.2rem; width: 100%;">
            <div>
              <h4 style="margin: 0 0 0.4rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #34d399;">Fantasy Bloomberg: Supply vs Demand by Good</h4>
              <p style="margin: 0 0 0.8rem 0; font-size: 0.7rem; color: #94a3b8;">Oversupplied vs high-demand items dynamically adjust city prices</p>
              <div id="chartSupplyDemand" style="min-height: 200px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); box-sizing: border-box;"></div>
            </div>

            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #fbbf24;">Average Market Prices of Goods</h4>
              <div id="chartMarketPrices" style="min-height: 150px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); box-sizing: border-box;"></div>
            </div>

            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #cbd5e1;">Commodities Registry</h4>
              <div style="max-height: 180px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.75rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #94a3b8;">
                      <th style="padding: 0.4rem 0.6rem;">Good Name</th>
                      <th style="padding: 0.4rem 0.6rem;">Type</th>
                      <th style="padding: 0.4rem 0.6rem;">Avg Price</th>
                      <th style="padding: 0.4rem 0.6rem;">Base Value</th>
                      <th style="padding: 0.4rem 0.6rem; text-align: center;">Details</th>
                    </tr>
                  </thead>
                  <tbody id="dbMarketRegistryBody" style="color: #cbd5e1;"></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Tab 3: Ecology & Biomes -->
          <div id="dbTabEcology" class="dbTabContent" style="display: none; flex-direction: column; gap: 1.2rem; width: 100%;">
            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #22c55e;">World Biomes Land Coverage (Cells)</h4>
              <div id="chartBiomesShare" style="min-height: 200px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); box-sizing: border-box;"></div>
            </div>

            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); padding: 0.8rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.6rem;">
              <h4 style="margin: 0; font-size: 0.8rem; text-transform: uppercase; color: #10b981; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.3rem;">Ecosystem Density &amp; Biomass Indices</h4>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; text-align: center;">
                <div style="background: rgba(16, 185, 129, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.15);">
                  <div style="font-size: 0.65rem; color: #a7f3d0; font-weight: bold;">Plants &amp; Flora</div>
                  <div id="dbEcoPlants" style="font-size: 1.2rem; font-weight: 700; color: #10b981;">0.0</div>
                  <div style="font-size: 0.6rem; color: #64748b; margin-top: 0.1rem;">Avg Biomass/Cell</div>
                </div>
                <div style="background: rgba(59, 130, 246, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                  <div style="font-size: 0.65rem; color: #bfdbfe; font-weight: bold;">Herbivores</div>
                  <div id="dbEcoHerbivores" style="font-size: 1.2rem; font-weight: 700; color: #3b82f6;">0.0</div>
                  <div style="font-size: 0.6rem; color: #64748b; margin-top: 0.1rem;">Avg Biomass/Cell</div>
                </div>
                <div style="background: rgba(244, 63, 94, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(244, 63, 94, 0.15);">
                  <div style="font-size: 0.65rem; color: #fecdd3; font-weight: bold;">Predators &amp; Beasts</div>
                  <div id="dbEcoPredators" style="font-size: 1.2rem; font-weight: 700; color: #f43f5e;">0.0</div>
                  <div style="font-size: 0.6rem; color: #64748b; margin-top: 0.1rem;">Avg Biomass/Cell</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 4: Fringe & Conflicts -->
          <div id="dbTabFringe" class="dbTabContent" style="display: none; flex-direction: column; gap: 1.2rem; width: 100%;">
            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #ef4444;">Fringe Groups &amp; Outlaws Registry</h4>
              <div style="max-height: 180px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.75rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #94a3b8;">
                      <th style="padding: 0.4rem 0.6rem;">Fringe Group Name</th>
                      <th style="padding: 0.4rem 0.6rem;">Type</th>
                      <th style="padding: 0.4rem 0.6rem;">Size</th>
                      <th style="padding: 0.4rem 0.6rem;">Hideout</th>
                      <th style="padding: 0.4rem 0.6rem; text-align: center;">Inspect</th>
                    </tr>
                  </thead>
                  <tbody id="dbFringeTableBody" style="color: #cbd5e1;"></tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #fbbf24;">State Diplomatic Relations &amp; Conflicts</h4>
              <div style="max-height: 180px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.75rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #94a3b8;">
                      <th style="padding: 0.4rem 0.6rem;">State A</th>
                      <th style="padding: 0.4rem 0.6rem;">State B</th>
                      <th style="padding: 0.4rem 0.6rem;">Relationship</th>
                      <th style="padding: 0.4rem 0.6rem;">Threat Factor</th>
                    </tr>
                  </thead>
                  <tbody id="dbRelationsTableBody" style="color: #cbd5e1;"></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Tab 5: Story Seeds & Paragons -->
          <div id="dbTabStory" class="dbTabContent" style="display: none; flex-direction: column; gap: 1.2rem; width: 100%;">
            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #a855f7;">Story Hooks Calculator</h4>
              <p style="margin: 0 0 0.8rem 0; font-size: 0.7rem; color: #94a3b8;">Select a location (or hover map if supported) to generate Threat/Opportunity metrics and Story Seeds.</p>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; text-align: center; margin-bottom: 1rem;">
                <div style="background: rgba(239, 68, 68, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.15);">
                  <div style="font-size: 0.65rem; color: #fca5a5; font-weight: bold;">Threat Score</div>
                  <div id="dbStoryThreat" style="font-size: 1.4rem; font-weight: 700; color: #ef4444;">-</div>
                </div>
                <div style="background: rgba(16, 185, 129, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.15);">
                  <div style="font-size: 0.65rem; color: #a7f3d0; font-weight: bold;">Opportunity Score</div>
                  <div id="dbStoryOpportunity" style="font-size: 1.4rem; font-weight: 700; color: #10b981;">-</div>
                </div>
              </div>

              <div id="dbStorySeedsContainer" style="display: flex; flex-direction: column; gap: 0.8rem;">
                <div style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 2rem;">No area selected. Click a map cell to calculate story hooks.</div>
              </div>
            </div>

            <div>
              <h4 style="margin: 0 0 0.6rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #fbbf24;">Local Paragons</h4>
              <div id="dbStoryParagons" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 1rem;">No local paragons found.</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Side: Unified Entity Inspector -->
        <div style="flex: 0.9; padding: 1.2rem; overflow-y: auto; display: flex; flex-direction: column; background: rgba(0,0,0,0.15); min-width: 0; box-sizing: border-box;">
          <h4 style="margin: 0 0 0.8rem 0; font-size: 0.85rem; text-transform: uppercase; tracking: 0.05em; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: center;">
            <span>🔍 Entity Inspector</span>
            <span style="font-size: 0.7rem; color: #a855f7; font-weight: normal;">Click any row/segment</span>
          </h4>

          <div id="dbInspectorContent" style="display: flex; flex-direction: column; gap: 0.8rem; flex-grow: 1;">
            <div style="margin: auto; text-align: center; color: #64748b; padding: 2rem 0;">
              <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🔍</span>
              <span style="font-size: 0.8rem;">Select an entity, chart bar, registry row, or group to inspect detailed parameters.</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;

	// --- Tabs Action ---
	const tabs = container.querySelectorAll(".dbTabBtn");
	const tabContents = container.querySelectorAll(".dbTabContent");

	tabs.forEach((t) => {
		t.addEventListener("click", () => {
			const targetTab = t.getAttribute("data-tab");
			tabs.forEach((btn) => {
				btn.classList.remove("active");
				(btn as HTMLButtonElement).style.color = "#94a3b8";
				(btn as HTMLButtonElement).style.borderBottomColor = "transparent";
			});
			t.classList.add("active");
			(t as HTMLButtonElement).style.color = "#cbd5e1";
			(t as HTMLButtonElement).style.borderBottomColor = "#a855f7";

			tabContents.forEach((tc) => {
				const contentEl = tc as HTMLDivElement;
				if (contentEl.id === `dbTab${targetTab?.charAt(0).toUpperCase()}${targetTab?.slice(1)}`) {
					contentEl.style.display = "flex";
				} else {
					contentEl.style.display = "none";
				}
			});
		});
	});

	// --- Close Button ---
	document.getElementById("closeDashboardBtn")?.addEventListener("click", () => {
		const panel = document.getElementById("dashboardPanel");
		const mount = document.getElementById("dashboardMount");
		if (panel) panel.style.display = "none";
		if (mount) mount.style.display = "none";
	});

	// Subscribe to store to update the dashboard dynamically
	let activeEntity: { type: string; id: any } | null = null;

	store.subscribe((state) => {
		const panel = document.getElementById("dashboardPanel");
		// Only run heavy render if the dashboard is visible
		if (!panel || (panel.style.display !== "block" && panel.style.display !== "flex")) {
			return;
		}

		const states = state.states || [];
		const burgs = state.burgs || [];
		const cultures = state.cultures || [];
		const religions = state.religions || [];
		const relations = state.relations || [];
		const fringeGroups = state.fringeGroups || [];
		const markets = state.markets || [];
		const heights = state.heights;
		const biomes = state.biomes;
		const plants = state.plants;
		const herbivores = state.herbivores;
		const predators = state.predators;

		// --- Update Key Metric Ribbon ---
		const statesMetric = document.getElementById("metricStates");
		if (statesMetric) statesMetric.innerText = states.length.toString();

		const burgsMetric = document.getElementById("metricBurgs");
		if (burgsMetric) burgsMetric.innerText = burgs.length.toString();

		const relMetric = document.getElementById("metricReligions");
		if (relMetric) relMetric.innerText = religions.length.toString();

		// Calculate Average Ecology Health
		const ecoMetric = document.getElementById("metricEcology");
		if (ecoMetric && plants && heights) {
			let totalEcoVal = 0;
			let landCount = 0;
			for (let i = 0; i < plants.length; i++) {
				if (heights[i] >= 20) {
					totalEcoVal += plants[i];
					landCount++;
				}
			}
			const avgEco = landCount > 0 ? totalEcoVal / landCount : 0;
			// Scale health from plants average (typically ranges 0 - 100)
			const pct = Math.min(100, Math.round((avgEco / 40) * 100));
			ecoMetric.innerText = `${pct}%`;
		}

		// --- RENDER DEMOGRAPHICS CHARTS ---
		renderStatePopChart(states, burgs, (stateId) => {
			activeEntity = { type: "state", id: stateId };
			updateInspector(state, activeEntity);
		});

		renderCulturesShareChart(cultures, burgs, (cultId) => {
			activeEntity = { type: "culture", id: cultId };
			updateInspector(state, activeEntity);
		});

		renderReligionsPopChart(religions, burgs, (relId) => {
			activeEntity = { type: "religion", id: relId };
			updateInspector(state, activeEntity);
		});

		// --- RENDER ECONOMY TAB CHARTS & TABLE ---
		renderSupplyDemandChart(markets, (goodId) => {
			activeEntity = { type: "good", id: goodId };
			updateInspector(state, activeEntity);
		});

		renderMarketPricesChart(markets);

		renderMarketRegistry(markets, (goodId) => {
			activeEntity = { type: "good", id: goodId };
			updateInspector(state, activeEntity);
		});

		// --- RENDER ECOLOGY & BIOMES ---
		renderBiomesShareChart(biomes, heights);

		// Render Ecology averages
		if (plants && herbivores && predators && heights) {
			let pSum = 0, hSum = 0, rSum = 0, count = 0;
			for (let i = 0; i < plants.length; i++) {
				if (heights[i] >= 20) {
					pSum += plants[i];
					hSum += herbivores[i];
					rSum += predators[i];
					count++;
				}
			}
			const div = count > 0 ? count : 1;
			const pAvg = document.getElementById("dbEcoPlants");
			if (pAvg) pAvg.innerText = (pSum / div).toFixed(1);
			const hAvg = document.getElementById("dbEcoHerbivores");
			if (hAvg) hAvg.innerText = (hSum / div).toFixed(1);
			const rAvg = document.getElementById("dbEcoPredators");
			if (rAvg) rAvg.innerText = (rSum / div).toFixed(1);
		}

		// --- RENDER FRINGE & RELATIONS ---
		renderFringeTable(fringeGroups, (fringeId) => {
			activeEntity = { type: "fringe", id: fringeId };
			updateInspector(state, activeEntity);
		});

		renderRelationsTable(relations, states);

		// Keep Inspector fresh with live metrics updates if open
		if (activeEntity) {
			updateInspector(state, activeEntity);
		}
	});
}

// --- Dynamic Entity Inspector Handler ---
export function updateStoryHooksForCell(cellId: number) {
	const state = store.getState() as any;
	const seeds = calculateStoryHooks(cellId, 3, state);
	
	const threatEl = document.getElementById("dbStoryThreat");
	const oppEl = document.getElementById("dbStoryOpportunity");
	const seedsContainer = document.getElementById("dbStorySeedsContainer");
	const paragonsContainer = document.getElementById("dbStoryParagons");

	if (!threatEl || !oppEl || !seedsContainer || !paragonsContainer) return;

	if (seeds.length === 0) {
		threatEl.innerText = "0";
		oppEl.innerText = "0";
		seedsContainer.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 2rem;">No immediate story hooks in this local area.</div>`;
	} else {
		let maxThreat = 0;
		let maxOpp = 0;
		seedsContainer.innerHTML = "";
		
		seeds.forEach(seed => {
			if (seed.threatScore > maxThreat) maxThreat = seed.threatScore;
			if (seed.opportunityScore > maxOpp) maxOpp = seed.opportunityScore;

			const issuesHtml = seed.issues.map(i => `<li>${i}</li>`).join("");
			seedsContainer.innerHTML += `
				<div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.8rem;">
					<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem; margin-bottom: 0.5rem;">
						<span style="font-weight: bold; color: #e2e8f0;">Generated Seed</span>
						<span style="font-size: 0.7rem; color: #a855f7; border: 1px solid #a855f7; padding: 0.1rem 0.3rem; border-radius: 4px;">${seed.openness.toUpperCase()}</span>
					</div>
					<ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.3rem;">
						${issuesHtml}
					</ul>
				</div>
			`;
		});

		threatEl.innerText = maxThreat.toString();
		oppEl.innerText = maxOpp.toString();

		// Push generated hooks to the SAGA backend immediately
		fetch("http://localhost:8000/api/story-hooks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ hooks: seeds })
		}).catch(err => {
			console.warn("Failed to sync Story Hooks to SAGA backend:", err);
		});
	}

	// Local Paragons logic
	const localBurgs = (state.burgs || []).filter((b: any) => {
		// Just a simple distance check or assume cellId is the burg for simplicity
		return b.cell === cellId; 
	});
	const localStateId = state.cellStates ? state.cellStates[cellId] : -1;

	const localParagons = (state.paragons || []).filter((p: any) => {
		if (p.affiliationType === "burg" && localBurgs.some((b: any) => b.i === p.affiliationId)) return true;
		if (p.affiliationType === "state" && p.affiliationId === localStateId) return true;
		return false;
	});

	if (localParagons.length === 0) {
		paragonsContainer.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 1rem;">No local paragons found.</div>`;
	} else {
		paragonsContainer.innerHTML = "";
		localParagons.forEach((p: any) => {
			paragonsContainer.innerHTML += `
				<div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 0.6rem; font-size: 0.75rem;">
					<div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
						<strong style="color: #fbbf24;">${p.name}</strong>
						<span style="color: #94a3b8;">${p.role}</span>
					</div>
					<div style="display: flex; gap: 0.4rem; font-size: 0.65rem; color: #cbd5e1; margin-bottom: 0.4rem;">
						<span style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 0.1rem 0.3rem; border-radius: 3px;">+ ${p.positiveTrait}</span>
						<span style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 0.1rem 0.3rem; border-radius: 3px;">- ${p.negativeTrait}</span>
					</div>
					<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.2rem; font-size: 0.6rem; color: #94a3b8; text-align: center;">
						<div>STR: <span style="color:#e2e8f0">${p.stats.might}</span></div>
						<div>DEX: <span style="color:#e2e8f0">${p.stats.finesse}</span></div>
						<div>INT: <span style="color:#e2e8f0">${p.stats.knowledge}</span></div>
						<div>CHA: <span style="color:#e2e8f0">${p.stats.charm}</span></div>
					</div>
				</div>
			`;
		});
	}
}

// --- Dynamic Entity Inspector Handler ---
function updateInspector(state: any, entity: { type: string; id: any }) {
	const content = document.getElementById("dbInspectorContent");
	if (!content) return;

	const { type, id } = entity;
	let html = "";

	if (type === "state") {
		const s = state.states?.find((st: any) => st.id === id);
		if (!s) return;
		const capitalBurg = state.burgs?.find((b: any) => b.id === s.capital || b.i === s.capital);
		const stateBurgs = state.burgs?.filter((b: any) => b.state === s.id || b.state === s.i) || [];
		const totalStatePop = stateBurgs.reduce((sum: number, b: any) => sum + b.population, 0);

		if (capitalBurg) updateStoryHooksForCell(capitalBurg.cell);

		html = `
      <div style="background: rgba(${hexToRgb(s.color || "#3b82f6")}, 0.1); border: 1px solid ${s.color || "#3b82f6"}; padding: 0.8rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 1.1rem; color: ${s.color || "#3b82f6"}; font-weight: bold;">${s.name}</h4>
          <span style="background: ${s.color || "#3b82f6"}; color: #fff; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Sovereign State</span>
        </div>
        <p style="margin: 0 0 0.8rem 0; font-size: 0.75rem; color: #94a3b8; font-style: italic;">A powerful nation ruled under a ${s.government || "Monarchy"}.</p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Capital City:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${capitalBurg ? capitalBurg.name : "None"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Urban Population:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${totalStatePop.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Sovereign Cities:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${stateBurgs.length}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Expansionism:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${s.expansionism || "1.0"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Xenophobia:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${s.xenophobia !== undefined ? s.xenophobia : "0.2"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Heraldic Sigil:</span>
            <span style="color: #fbbf24; font-weight: 600;">🛡️ ${s.heraldry || "Lion Rampant"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Domain Realm:</span>
            <span style="color: #38bdf8; font-weight: 600; text-transform: capitalize;">🌊 ${s.habitat || "land"}</span>
          </div>
        </div>

        <h5 style="margin: 0.8rem 0 0.4rem 0; font-size: 0.75rem; text-transform: uppercase; color: #a855f7;">National Territory Cities</h5>
        <div style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem;">
          ${stateBurgs.map((b: any) => `
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; background: rgba(0,0,0,0.2); padding: 0.25rem 0.4rem; border-radius: 4px;">
              <span style="color: #e2e8f0; font-weight: 500;">🏰 ${b.name}</span>
              <span style="color: #94a3b8;">Pop: ${b.population.toLocaleString()}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
	} else if (type === "burg") {
		const b = state.burgs?.find((bg: any) => bg.id === id || bg.i === id);
		if (!b) return;

		updateStoryHooksForCell(b.cell);

		const bState = state.states?.find((st: any) => st.id === b.state || st.i === b.state);
		const bCult = state.cultures?.find((cl: any) => cl.id === b.culture || cl.i === b.culture);

		html = `
      <div style="background: rgba(129, 140, 248, 0.08); border: 1px solid #818cf8; padding: 0.8rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 1.1rem; color: #818cf8; font-weight: bold;">${b.name}</h4>
          <span style="background: #818cf8; color: #000; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Burg</span>
        </div>
        <p style="margin: 0 0 0.8rem 0; font-size: 0.75rem; color: #94a3b8; font-style: italic;">A population center of ${b.population.toLocaleString()} souls.</p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Affiliation:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${bState ? bState.name : "Independent"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Culture:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${bCult ? bCult.name : "Unknown"}</span>
          </div>
        </div>
      </div>
    `;
	} else if (type === "culture") {
		const c = state.cultures?.find((cl: any) => cl.id === id);
		if (!c) return;
		const cultBurgs = state.burgs?.filter((b: any) => b.culture === c.id) || [];
		const totalCultPop = cultBurgs.reduce((sum: number, b: any) => sum + b.population, 0);

		html = `
      <div style="background: rgba(129, 140, 248, 0.08); border: 1px solid #818cf8; padding: 0.8rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 1.1rem; color: #818cf8; font-weight: bold;">${c.name}</h4>
          <span style="background: #818cf8; color: #000; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Culture</span>
        </div>
        <p style="margin: 0 0 0.8rem 0; font-size: 0.75rem; color: #94a3b8; font-style: italic;">An ancient heritage of customs, art, and beliefs.</p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Cultural Centers:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${cultBurgs.length} Cities</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Adherent Population:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${totalCultPop.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Language Origin:</span>
            <span style="color: #f1f5f9; font-weight: 600;">${c.name.replace("ian", "") || "Ancient Dialect"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Adaptation Habitat:</span>
            <span style="color: #38bdf8; font-weight: 600; text-transform: capitalize;">🌊 ${c.habitat || "land"}</span>
          </div>
        </div>
      </div>
    `;
	} else if (type === "religion") {
		const r = state.religions?.find((rg: any) => rg.id === id);
		if (!r) return;
		// Count adherents inside burgs that belong to this religion
		const relBurgs = state.burgs?.filter((b: any) => {
			// Find cell religion
			if (state.cellReligions) {
				return state.cellReligions[b.cell] === r.id;
			}
			return b.id % state.religions.length === r.id;
		}) || [];
		const totalRelPop = relBurgs.reduce((sum: number, b: any) => sum + b.population, 0);

		html = `
      <div style="background: rgba(244, 63, 94, 0.08); border: 1px solid #f43f5e; padding: 0.8rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 1.1rem; color: #f43f5e; font-weight: bold;">${r.name}</h4>
          <span style="background: #f43f5e; color: #fff; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Religion</span>
        </div>
        <p style="margin: 0 0 0.8rem 0; font-size: 0.75rem; color: #94a3b8; font-style: italic;">A divine framework guiding the spiritual alignment of cells.</p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Spiritual Centers:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${relBurgs.length} Cities</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Faith Population:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${totalRelPop.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Divine Focus:</span>
            <span style="color: #cbd5e1; font-weight: 600;">Pantheon / Animistic Leyline</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Domain Habitat:</span>
            <span style="color: #38bdf8; font-weight: 600; text-transform: capitalize;">🌊 ${r.habitat || "land"}</span>
          </div>
        </div>
      </div>
    `;
	} else if (type === "fringe") {
		const fg = state.fringeGroups?.find((f: any) => f.id === id);
		if (!fg) return;

		html = `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; padding: 0.8rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 1.05rem; color: #ef4444; font-weight: bold;">${fg.name}</h4>
          <span style="background: #ef4444; color: #fff; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 10px; font-weight: bold; text-transform: uppercase;">${fg.type}</span>
        </div>
        <p style="margin: 0 0 0.8rem 0; font-size: 0.75rem; color: #cbd5e1; line-height: 1.3;">${fg.description}</p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Combat Size:</span>
            <span style="color: #fca5a5; font-weight: 600;">⚔️ ${fg.size} Outlaws</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Hideout Type:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${fg.hideoutType}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Base Origin:</span>
            <span style="color: #cbd5e1; font-weight: 600;">🏰 ${fg.originBurgName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Hideout Discovered:</span>
            <span style="${fg.hideoutDiscovered ? "color: #22c55e;" : "color: #eab308;"} font-weight: 600;">
              ${fg.hideoutDiscovered ? "🔓 EXPOSED" : "🔒 HIDDEN"}
            </span>
          </div>
        </div>
      </div>
    `;
	} else if (type === "good") {
		const good = GOODS[id];
		if (!good) return;

		// Calculate total supply, demand, and average price across all markets
		let totalSupply = 0;
		let totalDemand = 0;
		let avgPriceSum = 0;
		let validMarkets = 0;

		if (state.markets) {
			for (const m of state.markets) {
				totalSupply += m.supply[id] || 0;
				totalDemand += m.demand[id] || 0;
				if (m.prices[id] !== undefined) {
					avgPriceSum += m.prices[id];
					validMarkets++;
				}
			}
		}

		const avgPrice = validMarkets > 0 ? avgPriceSum / validMarkets : good.value;

		html = `
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid #10b981; padding: 0.8rem; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 1.1rem; color: #10b981; font-weight: bold;">${good.name}</h4>
          <span style="background: #10b981; color: #000; font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 10px; font-weight: bold; text-transform: uppercase;">${good.type}</span>
        </div>
        <p style="margin: 0 0 0.8rem 0; font-size: 0.75rem; color: #94a3b8;">Categorized under: <strong>${good.tags.join(", ")}</strong></p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Base Standard Value:</span>
            <span style="color: #fbbf24; font-weight: 600;">🪙 ${good.value} silver / ${good.unit}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Global Market Supply:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${Math.round(totalSupply).toLocaleString()} units</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Global Market Demand:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${Math.round(totalDemand).toLocaleString()} units</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Average Active Price:</span>
            <span style="color: #eab308; font-weight: 600;">🪙 ${avgPrice.toFixed(2)} silver</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
            <span style="color: #94a3b8;">Market Liquidity Index:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${totalSupply > 0 ? (totalDemand / totalSupply).toFixed(2) : "0.00"} (D/S ratio)</span>
          </div>
        </div>
      </div>
    `;
	}

	content.innerHTML = html;
}

// --- Dynamic SVG Bar Chart for State Populations ---
function renderStatePopChart(states: any[], burgs: any[], onClick: (stateId: number) => void) {
	const container = document.getElementById("chartStatePop");
	if (!container) return;

	if (states.length === 0) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No sovereign states registered</span>`;
		return;
	}

	// Calculate population per state
	const data: ChartData[] = states.map((s) => {
		const stateBurgs = burgs.filter((b) => b.state === s.id);
		const pop = stateBurgs.reduce((sum, b) => sum + b.population, 0);
		return {
			label: s.name,
			value: pop,
			color: s.color || "#3b82f6",
			secondaryVal: s.id,
		};
	});

	data.sort((a, b) => b.value - a.value);

	const maxVal = Math.max(...data.map((d) => d.value), 1);
	const height = 150;
	const paddingLeft = 100;
	const barHeight = 14;
	const gap = 8;
	const chartHeight = data.length * (barHeight + gap) + 15;

	let svg = `<svg viewBox="0 0 350 ${chartHeight}" width="100%" height="100%" style="font-family: inherit;">`;

	// Draw bars
	data.forEach((d, i) => {
		const y = i * (barHeight + gap) + 10;
		const barWidth = maxVal > 0 ? (d.value / maxVal) * 200 : 0;

		svg += `
      <!-- Row hover trigger -->
      <g style="cursor: pointer;" class="stateBarGroup" data-stateid="${d.secondaryVal}">
        <text x="5" y="${y + 11}" fill="#94a3b8" font-size="9" text-anchor="start" font-weight="500">${truncateText(d.label, 15)}</text>
        <rect x="${paddingLeft}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${d.color}" rx="3" opacity="0.8" style="transition: opacity 0.15s;"></rect>
        <text x="${paddingLeft + barWidth + 6}" y="${y + 11}" fill="#f1f5f9" font-size="9" font-weight="600">${formatCompactNumber(d.value)}</text>
      </g>
    `;
	});

	svg += `</svg>`;
	container.innerHTML = svg;

	// Bind click event listeners to bars
	container.querySelectorAll(".stateBarGroup").forEach((g) => {
		g.addEventListener("click", () => {
			const stateId = parseInt(g.getAttribute("data-stateid") || "0", 10);
			onClick(stateId);
		});
	});
}

// --- Dynamic Segmented Donut Chart for Cultural Share ---
function renderCulturesShareChart(cultures: any[], burgs: any[], onClick: (cultId: number) => void) {
	const container = document.getElementById("chartCulturesShare");
	if (!container) return;

	if (cultures.length === 0) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No active cultures simulated</span>`;
		return;
	}

	const data = cultures.map((c) => {
		const cultBurgs = burgs.filter((b) => b.culture === c.id);
		const pop = cultBurgs.reduce((sum, b) => sum + b.population, 0);
		return {
			label: c.name,
			value: pop,
			color: c.color || "#818cf8",
			secondaryVal: c.id,
		};
	});

	const totalPop = data.reduce((sum, d) => sum + d.value, 0);
	if (totalPop === 0) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">Awaiting cultural population simulation...</span>`;
		return;
	}

	// Dynamic Donut implementation using SVG stroke-dasharray!
	const radius = 50;
	const strokeWidth = 14;
	const circumference = 2 * Math.PI * radius;

	let accumulatedPercent = 0;
	let svg = `<svg viewBox="0 0 350 160" width="100%" height="100%" style="font-family: inherit;">`;

	// Center Circle details
	svg += `
    <g transform="translate(100, 80)">
      <circle cx="0" cy="0" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.04)" stroke-width="${strokeWidth}"></circle>
  `;

	data.forEach((d) => {
		if (d.value === 0) return;
		const pct = d.value / totalPop;
		const strokeLength = pct * circumference;
		const strokeOffset = circumference - strokeLength + accumulatedPercent * circumference;

		svg += `
      <circle cx="0" cy="0" r="${radius}" 
              fill="transparent" 
              stroke="${d.color}" 
              stroke-width="${strokeWidth}" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${strokeOffset}" 
              transform="rotate(-90)" 
              style="cursor: pointer; transition: stroke-width 0.15s; outline: none;" 
              class="cultureDonutSlice" 
              data-cultid="${d.secondaryVal}"
              title="${d.label}: ${Math.round(pct * 100)}%">
      </circle>
    `;

		accumulatedPercent += pct;
	});

	// Centered Text Labels
	svg += `
      <text x="0" y="3" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="700" text-transform="uppercase">Total Pop</text>
      <text x="0" y="16" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="bold">${formatCompactNumber(totalPop)}</text>
    </g>
  `;

	// Draw side legend
	data.sort((a, b) => b.value - a.value);
	const legendSlice = data.slice(0, 5); // top 5
	legendSlice.forEach((d, idx) => {
		const y = idx * 24 + 20;
		const pct = totalPop > 0 ? Math.round((d.value / totalPop) * 100) : 0;
		svg += `
      <g transform="translate(185, ${y})" style="cursor: pointer;" class="cultureLegendRow" data-cultid="${d.secondaryVal}">
        <rect x="0" y="0" width="10" height="10" fill="${d.color}" rx="2"></rect>
        <text x="16" y="9" fill="#f1f5f9" font-size="9" font-weight="600">${truncateText(d.label, 14)}</text>
        <text x="145" y="9" fill="#94a3b8" font-size="9" font-weight="500" text-anchor="end">${pct}%</text>
      </g>
    `;
	});

	svg += `</svg>`;
	container.innerHTML = svg;

	// Add event listeners to slices/legends
	const triggerAction = (el: Element) => {
		const cultId = parseInt(el.getAttribute("data-cultid") || "0", 10);
		onClick(cultId);
	};

	container.querySelectorAll(".cultureDonutSlice, .cultureLegendRow").forEach((el) => {
		el.addEventListener("click", () => triggerAction(el));
	});
}

// --- Dynamic Religion Population Bar Chart ---
function renderReligionsPopChart(religions: any[], burgs: any[], onClick: (relId: number) => void) {
	const container = document.getElementById("chartReligionsPop");
	if (!container) return;

	if (religions.length === 0) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No active religions simulated</span>`;
		return;
	}

	const data = religions.map((r) => {
		const relBurgs = burgs.filter((b) => b.id % religions.length === r.id);
		const pop = relBurgs.reduce((sum, b) => sum + b.population, 0);
		return {
			label: r.name,
			value: pop,
			color: r.color || "#f43f5e",
			secondaryVal: r.id,
		};
	});

	data.sort((a, b) => b.value - a.value);

	const maxVal = Math.max(...data.map((d) => d.value), 1);
	const height = 120;
	const paddingBottom = 20;
	const barWidth = 24;
	const gap = 12;
	const chartWidth = data.length * (barWidth + gap) + 40;

	let svg = `<svg viewBox="0 0 320 130" width="100%" height="100%" style="font-family: inherit;">`;

	data.forEach((d, i) => {
		const x = i * (barWidth + gap) + 30;
		const barHeight = maxVal > 0 ? (d.value / maxVal) * 80 : 0;
		const y = 95 - barHeight;

		svg += `
      <g style="cursor: pointer;" class="religionBarGroup" data-relid="${d.secondaryVal}">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${d.color}" rx="3" opacity="0.85"></rect>
        <text x="${x + barWidth / 2}" y="${y - 4}" fill="#f1f5f9" font-size="8" font-weight="700" text-anchor="middle">${formatCompactNumber(d.value)}</text>
        <text x="${x + barWidth / 2}" y="112" fill="#94a3b8" font-size="8" font-weight="500" text-anchor="middle">${truncateText(d.label, 6)}</text>
      </g>
    `;
	});

	svg += `</svg>`;
	container.innerHTML = svg;

	container.querySelectorAll(".religionBarGroup").forEach((g) => {
		g.addEventListener("click", () => {
			const relId = parseInt(g.getAttribute("data-relid") || "0", 10);
			onClick(relId);
		});
	});
}

// --- Economy Dual-Bar Chart: Supply vs Demand ---
function renderSupplyDemandChart(markets: any[], onClick: (goodId: number) => void) {
	const container = document.getElementById("chartSupplyDemand");
	if (!container) return;

	if (markets.length === 0) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No market exchanges computed yet. Advance simulation time.</span>`;
		return;
	}

	// Sum supply and demand per commodity
	const supply: Record<number, number> = {};
	const demand: Record<number, number> = {};

	markets.forEach((m) => {
		Object.keys(m.supply).forEach((gIdStr) => {
			const gId = parseInt(gIdStr, 10);
			supply[gId] = (supply[gId] || 0) + (m.supply[gId] || 0);
			demand[gId] = (demand[gId] || 0) + (m.demand[gId] || 0);
		});
	});

	const items = Object.keys(GOODS).map((gIdStr) => {
		const gId = parseInt(gIdStr, 10);
		return {
			id: gId,
			name: GOODS[gId].name,
			supply: supply[gId] || 0,
			demand: demand[gId] || 0,
		};
	});

	items.sort((a, b) => b.demand - a.demand);
	const top10 = items.slice(0, 8);

	const maxVal = Math.max(...top10.flatMap((t) => [t.supply, t.demand]), 1);

	let svg = `<svg viewBox="0 0 350 180" width="100%" height="100%" style="font-family: inherit;">`;

	// Legend
	svg += `
    <g transform="translate(180, 10)">
      <rect x="0" y="0" width="8" height="8" fill="#10b981" rx="1.5"></rect>
      <text x="12" y="7" fill="#94a3b8" font-size="8" font-weight="600">Total Supply</text>
      <rect x="80" y="0" width="8" height="8" fill="#f43f5e" rx="1.5"></rect>
      <text x="92" y="7" fill="#94a3b8" font-size="8" font-weight="600">Total Demand</text>
    </g>
  `;

	const paddingLeft = 60;
	const rowHeight = 18;
	const gap = 4;

	top10.forEach((item, idx) => {
		const y = idx * (rowHeight + gap) + 30;
		const supplyWidth = (item.supply / maxVal) * 110;
		const demandWidth = (item.demand / maxVal) * 110;

		svg += `
      <g style="cursor: pointer;" class="ecoGoodRow" data-goodid="${item.id}">
        <text x="5" y="${y + 11}" fill="#f1f5f9" font-size="8.5" font-weight="600" text-anchor="start">${truncateText(item.name, 10)}</text>
        
        <!-- Supply bar -->
        <rect x="${paddingLeft}" y="${y}" width="${supplyWidth}" height="6" fill="#10b981" rx="1.5" opacity="0.85"></rect>
        
        <!-- Demand bar -->
        <rect x="${paddingLeft}" y="${y + 8}" width="${demandWidth}" height="6" fill="#f43f5e" rx="1.5" opacity="0.85"></rect>
        
        <!-- values -->
        <text x="${paddingLeft + Math.max(supplyWidth, demandWidth) + 8}" y="${y + 10}" fill="#94a3b8" font-size="8" font-weight="500">${Math.round(item.supply)} / ${Math.round(item.demand)}</text>
      </g>
    `;
	});

	svg += `</svg>`;
	container.innerHTML = svg;

	container.querySelectorAll(".ecoGoodRow").forEach((g) => {
		g.addEventListener("click", () => {
			const goodId = parseInt(g.getAttribute("data-goodid") || "0", 10);
			onClick(goodId);
		});
	});
}

// --- Market Average Prices Chart (Bar Chart) ---
function renderMarketPricesChart(markets: any[]) {
	const container = document.getElementById("chartMarketPrices");
	if (!container) return;

	if (markets.length === 0) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No prices generated yet.</span>`;
		return;
	}

	// Calculate average price of each good
	const priceSum: Record<number, number> = {};
	const priceCount: Record<number, number> = {};

	markets.forEach((m) => {
		Object.keys(m.prices).forEach((gIdStr) => {
			const gId = parseInt(gIdStr, 10);
			priceSum[gId] = (priceSum[gId] || 0) + (m.prices[gId] || 0);
			priceCount[gId] = (priceCount[gId] || 0) + 1;
		});
	});

	const data = Object.keys(GOODS).map((gIdStr) => {
		const gId = parseInt(gIdStr, 10);
		const avg = priceCount[gId] > 0 ? priceSum[gId] / priceCount[gId] : GOODS[gId].value;
		return {
			label: GOODS[gId].name,
			value: avg,
			color: "#fbbf24",
		};
	});

	data.sort((a, b) => b.value - a.value);
	const slice = data.slice(0, 10);

	const maxPrice = Math.max(...slice.map((d) => d.value), 1);
	let svg = `<svg viewBox="0 0 340 130" width="100%" height="100%" style="font-family: inherit;">`;

	const barWidth = 18;
	const gap = 11;

	slice.forEach((d, idx) => {
		const x = idx * (barWidth + gap) + 25;
		const barHeight = (d.value / maxPrice) * 80;
		const y = 95 - barHeight;

		svg += `
      <g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#fbbf24" rx="2" opacity="0.8"></rect>
        <text x="${x + barWidth / 2}" y="${y - 4}" fill="#fbbf24" font-size="7.5" font-weight="700" text-anchor="middle">${d.value.toFixed(1)}</text>
        <text x="${x + barWidth / 2}" y="110" fill="#94a3b8" font-size="7" font-weight="500" text-anchor="middle" transform="rotate(15, ${x + barWidth / 2}, 110)">${truncateText(d.label, 6)}</text>
      </g>
    `;
	});

	svg += `</svg>`;
	container.innerHTML = svg;
}

// --- Commodities Registry List rendering ---
function renderMarketRegistry(markets: any[], onClick: (goodId: number) => void) {
	const body = document.getElementById("dbMarketRegistryBody");
	if (!body) return;

	if (markets.length === 0) {
		body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 1rem; color: #64748b;">No market data. Run ticks first.</td></tr>`;
		return;
	}

	const priceSum: Record<number, number> = {};
	const priceCount: Record<number, number> = {};

	markets.forEach((m) => {
		Object.keys(m.prices).forEach((gIdStr) => {
			const gId = parseInt(gIdStr, 10);
			priceSum[gId] = (priceSum[gId] || 0) + (m.prices[gId] || 0);
			priceCount[gId] = (priceCount[gId] || 0) + 1;
		});
	});

	let html = "";
	Object.keys(GOODS).forEach((gIdStr) => {
		const gId = parseInt(gIdStr, 10);
		const g = GOODS[gId];
		const avgPrice = priceCount[gId] > 0 ? priceSum[gId] / priceCount[gId] : g.value;

		html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); hover:background: rgba(255,255,255,0.02);">
        <td style="padding: 0.35rem 0.6rem; font-weight: 600; color: #f1f5f9;">${g.name}</td>
        <td style="padding: 0.35rem 0.6rem; color: #94a3b8; text-transform: capitalize;">${g.type}</td>
        <td style="padding: 0.35rem 0.6rem; font-weight: bold; color: #fbbf24;">🪙 ${avgPrice.toFixed(2)}</td>
        <td style="padding: 0.35rem 0.6rem; color: #cbd5e1;">🪙 ${g.value}</td>
        <td style="padding: 0.35rem 0.6rem; text-align: center;">
          <button class="dbGoodInspectBtn" data-goodid="${gId}" style="background: #10b981; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: bold;">Inspect</button>
        </td>
      </tr>
    `;
	});

	body.innerHTML = html;

	body.querySelectorAll(".dbGoodInspectBtn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const goodId = parseInt(btn.getAttribute("data-goodid") || "0", 10);
			onClick(goodId);
		});
	});
}

// --- Biomes Distribution Bar Chart ---
function renderBiomesShareChart(biomes: Uint8Array | null, heights: Uint8Array | null) {
	const container = document.getElementById("chartBiomesShare");
	if (!container) return;

	if (!biomes || !heights) {
		container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No biome map data loaded</span>`;
		return;
	}

	const biomeList = initBiomeConfig();

	// Count cells per biome
	const counts: Record<number, number> = {};
	for (let i = 0; i < biomes.length; i++) {
		const bId = biomes[i];
		counts[bId] = (counts[bId] || 0) + 1;
	}

	const data = biomeList.map((b: any, idx: number) => {
		return {
			label: b.name,
			value: counts[idx] || 0,
			color: b.color || "#4b5563",
		};
	}).filter((d: any) => d.value > 0);

	data.sort((a: any, b: any) => b.value - a.value);

	const maxVal = Math.max(...data.map((d: any) => d.value), 1);
	const rowHeight = 15;
	const gap = 5;
	const chartHeight = data.length * (rowHeight + gap) + 15;

	let svg = `<svg viewBox="0 0 350 ${chartHeight}" width="100%" height="100%" style="font-family: inherit;">`;

	data.forEach((d: any, idx: number) => {
		const y = idx * (rowHeight + gap) + 10;
		const barWidth = (d.value / maxVal) * 180;

		svg += `
      <g>
        <text x="5" y="${y + 11}" fill="#cbd5e1" font-size="8" font-weight="500">${truncateText(d.label, 15)}</text>
        <rect x="110" y="${y}" width="${barWidth}" height="${rowHeight}" fill="${d.color}" rx="2" opacity="0.8"></rect>
        <text x="${115 + barWidth}" y="${y + 11}" fill="#94a3b8" font-size="8" font-weight="600">${d.value.toLocaleString()}</text>
      </g>
    `;
	});

	svg += `</svg>`;
	container.innerHTML = svg;
}

// --- Fringe Outlaws Table Rendering ---
function renderFringeTable(fringeGroups: any[], onClick: (id: number) => void) {
	const body = document.getElementById("dbFringeTableBody");
	if (!body) return;

	if (fringeGroups.length === 0) {
		body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 1rem; color: #64748b;">No active outlaws simulated</td></tr>`;
		return;
	}

	let html = "";
	fringeGroups.forEach((fg) => {
		html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); hover:background: rgba(255,255,255,0.02);">
        <td style="padding: 0.35rem 0.6rem; font-weight: 600; color: #f43f5e;">${fg.name}</td>
        <td style="padding: 0.35rem 0.6rem; color: #94a3b8;">${fg.type}</td>
        <td style="padding: 0.35rem 0.6rem; font-weight: bold; color: #cbd5e1;">⚔️ ${fg.size}</td>
        <td style="padding: 0.35rem 0.6rem; color: #94a3b8;">${fg.hideoutDiscovered ? "Exposed" : "Hidden"}</td>
        <td style="padding: 0.35rem 0.6rem; text-align: center;">
          <button class="dbFringeInspectBtn" data-fringeid="${fg.id}" style="background: #3b82f6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: bold;">Inspect</button>
        </td>
      </tr>
    `;
	});

	body.innerHTML = html;

	body.querySelectorAll(".dbFringeInspectBtn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const fringeId = parseInt(btn.getAttribute("data-fringeid") || "0", 10);
			onClick(fringeId);
		});
	});
}

// --- State Diplomacy & Conflicts Table Rendering ---
function renderRelationsTable(relations: any[], states: any[]) {
	const body = document.getElementById("dbRelationsTableBody");
	if (!body) return;

	if (relations.length === 0 || states.length === 0) {
		body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 1rem; color: #64748b;">Awaiting bilateral diplomatic relations...</td></tr>`;
		return;
	}

	const stateMap = new Map(states.map((s) => [s.id, s]));

	let html = "";
	relations.slice(0, 15).forEach((rel) => {
		const stateA = stateMap.get(rel.stateA);
		const stateB = stateMap.get(rel.stateB);
		if (!stateA || !stateB) return;

		let badgeColor = "#94a3b8"; // Neutral
		if (rel.type === "Alliance") badgeColor = "#10b981";
		if (rel.type === "Friendly") badgeColor = "#60a5fa";
		if (rel.type === "Suspicious") badgeColor = "#f59e0b";
		if (rel.type === "War") badgeColor = "#ef4444";

		html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <td style="padding: 0.35rem 0.6rem; font-weight: 600; color: ${stateA.color || "#cbd5e1"};">${stateA.name}</td>
        <td style="padding: 0.35rem 0.6rem; font-weight: 600; color: ${stateB.color || "#cbd5e1"};">${stateB.name}</td>
        <td style="padding: 0.35rem 0.6rem;">
          <span style="background: rgba(${hexToRgb(badgeColor)}, 0.15); color: ${badgeColor}; border: 1px solid ${badgeColor}; font-size: 0.65rem; padding: 0.05rem 0.3rem; border-radius: 4px; font-weight: 700; text-transform: uppercase;">${rel.type}</span>
        </td>
        <td style="padding: 0.35rem 0.6rem; font-weight: bold; color: ${rel.threat > 60 ? "#ef4444" : "#94a3b8"};">${rel.threat}%</td>
      </tr>
    `;
	});

	body.innerHTML = html;
}

// --- Pure JS Utility Helpers ---
function truncateText(str: string, len: number): string {
	if (str.length <= len) return str;
	return str.slice(0, len) + "...";
}

function formatCompactNumber(num: number): string {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + "M";
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + "K";
	}
	return num.toString();
}

function hexToRgb(hex: string): string {
	let cleanHex = hex.replace("#", "");
	if (cleanHex.length === 3) {
		cleanHex = cleanHex.split("").map((c) => c + c).join("");
	}
	const num = parseInt(cleanHex, 16);
	const r = (num >> 16) & 255;
	const g = (num >> 8) & 255;
	const b = num & 255;
	return `${r}, ${g}, ${b}`;
}

(window as any).openDashboard = () => {
	const panel = document.getElementById("dashboardPanel");
	if (panel) {
		panel.style.display = "flex";
	}
	// Force fire store notify once so dashboard loads fresh
	const win = window as any;
	if (win.store) {
		win.store.updateState({});
	}
};
