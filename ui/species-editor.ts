import { store } from "../state/store";
import type { Species } from "../state/store";

export function mountSpeciesEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "speciesPanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "50%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translate(-50%, -50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "650px";
	wrapper.style.maxHeight = "85vh";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(16, 185, 129, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.display = "flex";
	wrapper.style.flexDirection = "column";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#10b981;font-size:1.1rem;">🌿 Flora & Fauna Editor</h3>
      <span id="closeSpecies" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div style="display:flex;gap:1rem;flex:1;overflow:hidden;min-height:450px;">
      <!-- Left sidebar: List -->
      <div style="width:200px;display:flex;flex-direction:column;gap:0.5rem;border-right:1px solid rgba(255,255,255,0.1);padding-right:0.5rem;">
        <div id="speciesList" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem;">
          <!-- List goes here -->
        </div>
        
        <button id="addSpeciesBtn" style="padding:0.4rem;border-radius:4px;background:#3b82f6;color:white;border:none;cursor:pointer;font-weight:bold;font-size:0.8rem;">+ New Species</button>
      </div>

      <!-- Right panel: Edit -->
      <div id="speciesEditor" style="flex:1;display:flex;flex-direction:column;gap:0.5rem;display:none;overflow-y:auto;padding-right:0.5rem;">
        <input type="hidden" id="editSpeciesId" />
        
        <input type="text" id="editSpeciesName" placeholder="Species Name" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.9rem;font-weight:bold;">
        
        <div style="display:flex;gap:0.5rem;">
          <div style="flex:1;">
            <label style="font-size:0.7rem;color:#94a3b8;">Type</label>
            <select id="editSpeciesType" style="width:100%;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
              <option value="flora">Flora</option>
              <option value="fauna">Fauna</option>
            </select>
          </div>
          <div style="flex:1;">
            <label style="font-size:0.7rem;color:#94a3b8;">Sub-Type</label>
            <select id="editSpeciesSubType" style="width:100%;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
              <option value="carnivore">Carnivore</option>
              <option value="herbivore">Herbivore</option>
              <option value="plant">Plant</option>
              <option value="fungus">Fungus</option>
            </select>
          </div>
        </div>

        <div style="display:flex;gap:0.5rem;">
          <div style="flex:1;">
            <label style="font-size:0.7rem;color:#94a3b8;">Habitat</label>
            <select id="editSpeciesHabitat" style="width:100%;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
              <option value="land">Land</option>
              <option value="marine">Marine</option>
            </select>
          </div>
          <div style="flex:1;">
            <label style="font-size:0.7rem;color:#94a3b8;">Class</label>
            <select id="editSpeciesClass" style="width:100%;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
              <option value="mammal">Mammal</option>
              <option value="reptile">Reptile</option>
              <option value="avian">Avian</option>
              <option value="insect">Insect</option>
              <option value="tree">Tree</option>
              <option value="herb">Herb</option>
              <option value="flower">Flower</option>
              <option value="grass">Grass</option>
              <option value="mushroom">Mushroom</option>
              <option value="slime">Slime</option>
              <option value="mould">Mould</option>
              <option value="lichen">Lichen</option>
            </select>
          </div>
        </div>

        <!-- Biome Preferences -->
        <div style="margin-top:0.5rem;border-top:1px dashed #334;padding-top:0.5rem;">
          <label style="font-size:0.7rem;color:#94a3b8;margin-bottom:0.2rem;display:block;">Biome Preferences</label>
          <div style="display:flex;gap:0.5rem;">
            <div style="flex:1;">
              <label style="font-size:0.6rem;color:#64748b;">Primary (100%)</label>
              <input type="number" id="editSpeciesBiome1" placeholder="Biome ID" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
            </div>
            <div style="flex:1;">
              <label style="font-size:0.6rem;color:#64748b;">Secondary (50%)</label>
              <input type="number" id="editSpeciesBiome2" placeholder="Biome ID" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
            </div>
            <div style="flex:1;">
              <label style="font-size:0.6rem;color:#64748b;">Tertiary (10%)</label>
              <input type="number" id="editSpeciesBiome3" placeholder="Biome ID" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div style="margin-top:0.5rem;border-top:1px dashed #334;padding-top:0.5rem;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;cursor:pointer;">
            <input type="checkbox" id="editSpeciesHostile"> Hostile
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;cursor:pointer;">
            <input type="checkbox" id="editSpeciesPoisonous"> Poisonous/Venomous
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;cursor:pointer;">
            <input type="checkbox" id="editSpeciesFarmable"> Farmable
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;cursor:pointer;">
            <input type="checkbox" id="editSpeciesTamable"> Tamable
          </label>
        </div>

        <!-- Sliders -->
        <div style="margin-top:0.5rem;border-top:1px dashed #334;padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem;">
          <div>
            <div style="display:flex;justify-content:space-between;">
              <label style="font-size:0.7rem;color:#94a3b8;">Growth Rate</label>
              <span id="growthVal" style="font-size:0.7rem;color:#facc15;">50</span>
            </div>
            <input type="range" id="editSpeciesGrowth" min="1" max="100" value="50" style="width:100%;">
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;">
              <label style="font-size:0.7rem;color:#94a3b8;">Expansion / Migration Rate</label>
              <span id="expansionVal" style="font-size:0.7rem;color:#facc15;">20</span>
            </div>
            <input type="range" id="editSpeciesExpansion" min="1" max="100" value="20" style="width:100%;">
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;">
              <label style="font-size:0.7rem;color:#94a3b8;">Danger Level</label>
              <span id="dangerVal" style="font-size:0.7rem;color:#facc15;">10</span>
            </div>
            <input type="range" id="editSpeciesDanger" min="0" max="100" value="10" style="width:100%;">
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;">
              <label style="font-size:0.7rem;color:#94a3b8;">Required Tech Level (Farming/Taming)</label>
              <span id="techLevelVal" style="font-size:0.7rem;color:#facc15;">5</span>
            </div>
            <input type="range" id="editSpeciesTechLevel" min="1" max="10" value="5" style="width:100%;">
          </div>
        </div>

        <!-- Resources -->
        <div style="margin-top:0.5rem;border-top:1px dashed #334;padding-top:0.5rem;display:flex;gap:0.5rem;">
          <div style="flex:1;">
            <label style="font-size:0.7rem;color:#94a3b8;">Death Resource (Good ID)</label>
            <input type="number" id="editSpeciesDeathRes" placeholder="e.g. 1" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
          </div>
          <div style="flex:1;">
            <label style="font-size:0.7rem;color:#94a3b8;">Harvest Resource (Good ID)</label>
            <input type="number" id="editSpeciesHarvestRes" placeholder="e.g. 2" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;color:white;border:1px solid #334;border-radius:4px;font-size:0.8rem;">
          </div>
        </div>
        
        <div style="display:flex;justify-content:space-between;margin-top:1rem;">
          <button id="deleteSpeciesBtn" style="padding:0.5rem;border-radius:6px;border:none;background:#e11d48;color:#fff;cursor:pointer;font-size:0.8rem;">Delete</button>
          <button id="saveSpeciesBtn" style="padding:0.5rem 1rem;border-radius:6px;border:none;background:#10b981;color:#fff;font-weight:bold;cursor:pointer;font-size:0.8rem;">Save</button>
        </div>
      </div>
      
      <div id="noSpeciesSelected" style="flex:1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.9rem;">
        Select or create a species.
      </div>
    </div>
  `;

	container.appendChild(wrapper);

	const closeBtn = document.getElementById("closeSpecies") as HTMLSpanElement;
	closeBtn.addEventListener("click", () => {
		wrapper.style.display = "none";
	});
	wrapper.style.display = "none";

	// Live slider values
	document.getElementById("editSpeciesGrowth")!.addEventListener("input", (e) => {
		document.getElementById("growthVal")!.innerText = (e.target as HTMLInputElement).value;
	});
	document.getElementById("editSpeciesExpansion")!.addEventListener("input", (e) => {
		document.getElementById("expansionVal")!.innerText = (e.target as HTMLInputElement).value;
	});
	document.getElementById("editSpeciesDanger")!.addEventListener("input", (e) => {
		document.getElementById("dangerVal")!.innerText = (e.target as HTMLInputElement).value;
	});
	document.getElementById("editSpeciesTechLevel")!.addEventListener("input", (e) => {
		document.getElementById("techLevelVal")!.innerText = (e.target as HTMLInputElement).value;
	});

	let currentSpecies: Species[] = [];

	const renderList = () => {
		const listContainer = document.getElementById("speciesList")!;
		listContainer.innerHTML = "";

		if (currentSpecies.length === 0) {
			listContainer.innerHTML = `<div style="text-align:center;color:#64748b;font-size:0.8rem;padding:1rem;">No species defined.</div>`;
			return;
		}

		for (const sp of currentSpecies) {
			const item = document.createElement("div");
			item.style.padding = "0.4rem";
			item.style.background = "#0f172a";
			item.style.border = "1px solid #334";
			item.style.borderRadius = "4px";
			item.style.cursor = "pointer";
			item.style.fontSize = "0.8rem";

			item.innerHTML = `
        <div style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${sp.type === 'flora' ? '#a3e635' : '#fb923c'}">${sp.name || "Unnamed"}</div>
        <div style="color:#94a3b8;font-size:0.7rem;margin-top:0.2rem;">${sp.classType.toUpperCase()} - ${sp.habitat.toUpperCase()}</div>
      `;

			item.addEventListener("click", () => {
				store.updateState({ activeSpeciesId: sp.id });
				if ((window as any).triggerLayerSelect) {
					// Optionally force layer switch
				}
				openSpeciesEditor(sp);
			});

			listContainer.appendChild(item);
		}
	};

	const openSpeciesEditor = (sp: Species) => {
		document.getElementById("noSpeciesSelected")!.style.display = "none";
		document.getElementById("speciesEditor")!.style.display = "flex";

		(document.getElementById("editSpeciesId") as HTMLInputElement).value = String(sp.id);
		(document.getElementById("editSpeciesName") as HTMLInputElement).value = sp.name;
		(document.getElementById("editSpeciesType") as HTMLSelectElement).value = sp.type;
		(document.getElementById("editSpeciesSubType") as HTMLSelectElement).value = sp.subType;
		(document.getElementById("editSpeciesHabitat") as HTMLSelectElement).value = sp.habitat;
		(document.getElementById("editSpeciesClass") as HTMLSelectElement).value = sp.classType;

		(document.getElementById("editSpeciesBiome1") as HTMLInputElement).value = String(sp.primaryBiome);
		(document.getElementById("editSpeciesBiome2") as HTMLInputElement).value = String(sp.secondaryBiome);
		(document.getElementById("editSpeciesBiome3") as HTMLInputElement).value = String(sp.tertiaryBiome);

		(document.getElementById("editSpeciesHostile") as HTMLInputElement).checked = sp.hostile;
		(document.getElementById("editSpeciesPoisonous") as HTMLInputElement).checked = sp.poisonous;
		(document.getElementById("editSpeciesFarmable") as HTMLInputElement).checked = sp.farmable;
		(document.getElementById("editSpeciesTamable") as HTMLInputElement).checked = sp.tamable;

		(document.getElementById("editSpeciesGrowth") as HTMLInputElement).value = String(sp.growthRate);
		document.getElementById("growthVal")!.innerText = String(sp.growthRate);
		(document.getElementById("editSpeciesExpansion") as HTMLInputElement).value = String(sp.expansionRate);
		document.getElementById("expansionVal")!.innerText = String(sp.expansionRate);
		(document.getElementById("editSpeciesDanger") as HTMLInputElement).value = String(sp.danger);
		document.getElementById("dangerVal")!.innerText = String(sp.danger);
		(document.getElementById("editSpeciesTechLevel") as HTMLInputElement).value = String(sp.techLevel || 5);
		document.getElementById("techLevelVal")!.innerText = String(sp.techLevel || 5);

		(document.getElementById("editSpeciesDeathRes") as HTMLInputElement).value = String(sp.deathResource);
		(document.getElementById("editSpeciesHarvestRes") as HTMLInputElement).value = String(sp.harvestResource);
	};

	document.getElementById("addSpeciesBtn")!.addEventListener("click", () => {
		const newSp: Species = {
			id: currentSpecies.length > 0 ? Math.max(...currentSpecies.map(s => s.id)) + 1 : 1,
			name: "New Species",
			type: "fauna",
			subType: "herbivore",
			habitat: "land",
			classType: "mammal",
			primaryBiome: 5, // Default temperate
			secondaryBiome: 6,
			tertiaryBiome: 4,
			hostile: false,
			poisonous: false,
			farmable: true,
			tamable: true,
			techLevel: 5,
			growthRate: 50,
			expansionRate: 20,
			danger: 10,
			deathResource: 10, // Default meat
			harvestResource: 13, // Default wool/leather
		};
		openSpeciesEditor(newSp);
	});

	document.getElementById("saveSpeciesBtn")!.addEventListener("click", () => {
		const id = Number((document.getElementById("editSpeciesId") as HTMLInputElement).value);
		const sp: Species = {
			id,
			name: (document.getElementById("editSpeciesName") as HTMLInputElement).value,
			type: (document.getElementById("editSpeciesType") as HTMLSelectElement).value as any,
			subType: (document.getElementById("editSpeciesSubType") as HTMLSelectElement).value as any,
			habitat: (document.getElementById("editSpeciesHabitat") as HTMLSelectElement).value as any,
			classType: (document.getElementById("editSpeciesClass") as HTMLSelectElement).value as any,
			
			primaryBiome: Number((document.getElementById("editSpeciesBiome1") as HTMLInputElement).value),
			secondaryBiome: Number((document.getElementById("editSpeciesBiome2") as HTMLInputElement).value),
			tertiaryBiome: Number((document.getElementById("editSpeciesBiome3") as HTMLInputElement).value),
			
			hostile: (document.getElementById("editSpeciesHostile") as HTMLInputElement).checked,
			poisonous: (document.getElementById("editSpeciesPoisonous") as HTMLInputElement).checked,
			farmable: (document.getElementById("editSpeciesFarmable") as HTMLInputElement).checked,
			tamable: (document.getElementById("editSpeciesTamable") as HTMLInputElement).checked,
			
			techLevel: Number((document.getElementById("editSpeciesTechLevel") as HTMLInputElement).value),
			
			growthRate: Number((document.getElementById("editSpeciesGrowth") as HTMLInputElement).value),
			expansionRate: Number((document.getElementById("editSpeciesExpansion") as HTMLInputElement).value),
			danger: Number((document.getElementById("editSpeciesDanger") as HTMLInputElement).value),
			
			deathResource: Number((document.getElementById("editSpeciesDeathRes") as HTMLInputElement).value),
			harvestResource: Number((document.getElementById("editSpeciesHarvestRes") as HTMLInputElement).value),
		};

		const existingIdx = currentSpecies.findIndex((s) => s.id === id);
		if (existingIdx >= 0) {
			currentSpecies[existingIdx] = sp;
		} else {
			currentSpecies.push(sp);
		}

		store.updateState({ customSpecies: currentSpecies, activeSpeciesId: id });
		
		// If population array doesn't exist, create it
		const state = store.getState() as any;
		if (!state.speciesPopulations) state.speciesPopulations = {};
		if (!state.speciesPopulations[id]) {
			state.speciesPopulations[id] = new Float32Array(state.width ? state.grid.cellsDesired : 50000);
			store.updateState({ speciesPopulations: state.speciesPopulations });
		}

		renderList();
		document.getElementById("noSpeciesSelected")!.style.display = "flex";
		document.getElementById("speciesEditor")!.style.display = "none";
	});

	document.getElementById("deleteSpeciesBtn")!.addEventListener("click", () => {
		const id = Number((document.getElementById("editSpeciesId") as HTMLInputElement).value);
		currentSpecies = currentSpecies.filter((s) => s.id !== id);
		
		const state = store.getState() as any;
		if (state.speciesPopulations && state.speciesPopulations[id]) {
			delete state.speciesPopulations[id];
		}

		store.updateState({ customSpecies: currentSpecies, speciesPopulations: state.speciesPopulations });
		renderList();
		document.getElementById("noSpeciesSelected")!.style.display = "flex";
		document.getElementById("speciesEditor")!.style.display = "none";
	});

	(window as any).openSpeciesEditor = () => {
		const state = store.getState() as any;
		currentSpecies = state.customSpecies || [];
		renderList();
		document.getElementById("noSpeciesSelected")!.style.display = "flex";
		document.getElementById("speciesEditor")!.style.display = "none";
		wrapper.style.display = "flex";
	};
}
