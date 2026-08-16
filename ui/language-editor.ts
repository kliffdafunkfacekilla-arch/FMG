import { generateName } from "../simulation/civilization/name-generator";
import { store } from "../state/store";

<<<<<<< HEAD
interface Culture {
	id: number;
	name: string;
	color: string;
	center: number;
	base: number;
	habitat: "land" | "ocean" | "amphibious";
}

export function mountLanguageEditor(
	containerId: string,
	onUpdate?: () => void,
) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="languageEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <h3 style="margin-top: 0; color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span id="cultureEditorTitle">Cultures & Languages</span>
        <span id="closeLanguageBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.1rem;">&times;</span>
      </h3>
=======
export function mountLanguageEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div style="background: rgba(30, 30, 38, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem;">
      <h3 style="margin-top: 0; color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: 0.25rem;">Language Syllable Editor</h3>
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
      
      <!-- 1. Cultures List Sub-panel -->
      <div id="cultureListSubPanel" style="display: block;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem;">
          <button id="createCultureBtn" style="background: #10b981; border: none; padding: 0.3rem 0.6rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.2rem;">
            <span>➕</span> Create Culture
          </button>
        </div>
        <div style="max-height: 200px; overflow-y: auto; background: #0f0f12; border: 1px solid #444; border-radius: 6px; margin-bottom: 0.8rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid #333; background: #1a1a24; color: #94a3b8;">
                <th style="padding: 0.4rem;">Color</th>
                <th style="padding: 0.4rem;">Culture</th>
                <th style="padding: 0.4rem;">Habitat</th>
                <th style="padding: 0.4rem; text-align: center;">Edit</th>
              </tr>
            </thead>
            <tbody id="cultureTableBody" style="color: #cbd5e1;"></tbody>
          </table>
        </div>
      </div>

      <!-- 2. Culture Edit Sub-panel -->
      <div id="cultureDetailSubPanel" style="display: none; flex-direction: column; gap: 0.6rem;">
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Culture Name:</label>
          <input id="editCultureName" type="text" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Habitat Type:</label>
          <select id="editCultureHabitat" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="land">Land Only</option>
            <option value="ocean">Oceanic / Aquatic</option>
            <option value="amphibious">Amphibious</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Base Language (Syllables):</label>
          <select id="langSelect" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer;">
            <option value="english">English (Default)</option>
            <option value="norse">Norse / Scandinavian</option>
            <option value="roman">Roman / Latin</option>
            <option value="elven">Elven / Sylvan</option>
            <option value="mongol">Mongolian / Steppe</option>
            <option value="arabic">Arabic / Desert</option>
            <option value="celtic">Celtic / Highland</option>
            <option value="polynesian">Polynesian / Maritime</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Culture Color:</label>
          <input id="editCultureColor" type="color" style="width: 100%; height: 35px; border: none; background: transparent; cursor: pointer;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.2rem; color: #94a3b8;">Syllable Preview Generation:</label>
          <div style="display: flex; gap: 0.5rem;">
            <input id="langTestPreview" type="text" readonly style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 4px; font-weight: bold;" />
            <button id="testGenBtn" style="flex: 1; background: #8b5cf6; border: none; padding: 0.25rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Test</button>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="saveCultureBtn" style="flex: 1; background: #10b981; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Save</button>
          <button id="deleteCultureBtn" style="flex: 1; background: #ef4444; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Delete</button>
          <button id="backToCultureListBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.4rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">Back</button>
        </div>
      </div>

    </div>
  `;

<<<<<<< HEAD
	const panel = document.getElementById(
		"languageEditorPanel",
	) as HTMLDivElement;
	const listSubPanel = document.getElementById(
		"cultureListSubPanel",
	) as HTMLDivElement;
	const detailSubPanel = document.getElementById(
		"cultureDetailSubPanel",
	) as HTMLDivElement;
	const titleText = document.getElementById(
		"cultureEditorTitle",
	) as HTMLElement;
	const tableBody = document.getElementById(
		"cultureTableBody",
	) as HTMLTableSectionElement;
	const closeBtn = document.getElementById(
		"closeLanguageBtn",
	) as HTMLSpanElement;

	const editNameInput = document.getElementById(
		"editCultureName",
	) as HTMLInputElement;
	const editHabitatSelect = document.getElementById(
		"editCultureHabitat",
	) as HTMLSelectElement;
	const langSelect = document.getElementById("langSelect") as HTMLSelectElement;
	const editColorInput = document.getElementById(
		"editCultureColor",
	) as HTMLInputElement;
	const previewInput = document.getElementById(
		"langTestPreview",
	) as HTMLInputElement;
	const testGenBtn = document.getElementById("testGenBtn") as HTMLButtonElement;

	const saveBtn = document.getElementById(
		"saveCultureBtn",
	) as HTMLButtonElement;
	const backBtn = document.getElementById(
		"backToCultureListBtn",
	) as HTMLButtonElement;

	let activeCulture: Culture | null = null;

	const closePanel = () => {
		if (panel) panel.style.display = "none";
	};

	if (closeBtn) closeBtn.addEventListener("click", closePanel);

	const showList = () => {
		titleText.innerText = "Cultures & Languages";
		listSubPanel.style.display = "block";
		detailSubPanel.style.display = "none";
		renderCulturesList();
	};

	backBtn.addEventListener("click", showList);

	const getLanguageValueFromBase = (base: number): string => {
		if (base === 22) return "celtic";
		if (base === 31) return "mongol";
		if (base === 25) return "polynesian";
		if (base === 18) return "arabic";
		if (base === 33) return "elven";
		if (base === 1) return "norse";
		if (base === 2) return "roman";
		return "english";
	};

	const getBaseFromLanguageValue = (lang: string): number => {
		if (lang === "celtic") return 22;
		if (lang === "mongol") return 31;
		if (lang === "polynesian") return 25;
		if (lang === "arabic") return 18;
		if (lang === "elven") return 33;
		if (lang === "norse") return 1;
		if (lang === "roman") return 2;
		return 0; // english/common
	};

	const renderCulturesList = () => {
		const stateData = store.getState() as any;
		const cultures = stateData.cultures || [];
		tableBody.innerHTML = "";

		cultures.forEach((c: Culture) => {
			const tr = document.createElement("tr");
			tr.style.borderBottom = "1px solid #222";
			tr.innerHTML = `
        <td style="padding: 0.4rem;"><div style="width: 14px; height: 14px; background: ${c.color}; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;"></div></td>
        <td style="padding: 0.4rem; font-weight: bold; color: #fff;">${c.name}</td>
        <td style="padding: 0.4rem; color: #94a3b8; text-transform: capitalize;">${c.habitat || "land"}</td>
        <td style="padding: 0.4rem; text-align: center;">
          <button class="editSingleCultureBtn" data-id="${c.id}" style="background: #8b5cf6; border: none; color: white; padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Edit</button>
        </td>
      `;
			tableBody.appendChild(tr);
		});

		const editBtns = tableBody.querySelectorAll(".editSingleCultureBtn");
		editBtns.forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = parseInt(btn.getAttribute("data-id") || "0", 10);
				const targetCulture = cultures.find((c: Culture) => c.id === id);
				if (targetCulture) {
					openCultureEditor(targetCulture);
				}
			});
		});
	};

	const openCultureEditor = (culture: Culture) => {
		activeCulture = culture;
		titleText.innerText = `Edit: ${culture.name}`;
		listSubPanel.style.display = "none";
		detailSubPanel.style.display = "flex";

		editNameInput.value = culture.name;
		editHabitatSelect.value = culture.habitat || "land";
		langSelect.value = getLanguageValueFromBase(culture.base || 0);
		editColorInput.value = culture.color;

		generateTestPreview();
	};

	const generateTestPreview = () => {
		const seed = "test-" + Math.floor(Math.random() * 100000);
		previewInput.value = generateName(langSelect.value, seed);
	};

	testGenBtn.addEventListener("click", generateTestPreview);
	langSelect.addEventListener("change", generateTestPreview);

	saveBtn.addEventListener("click", () => {
		if (activeCulture) {
			activeCulture.name = editNameInput.value;
			activeCulture.color = editColorInput.value;
			activeCulture.habitat = editHabitatSelect.value as any;
			activeCulture.base = getBaseFromLanguageValue(langSelect.value);

			const stateData = store.getState() as any;
			if (stateData.cultures) {
				const updated = stateData.cultures.map((c: Culture) =>
					c.id === activeCulture!.id ? { ...activeCulture } : c,
				);
				store.updateState({ cultures: updated });
			}

			if (onUpdate) onUpdate();
			showList();
		}
	});

	// Create Culture handler
	const createBtn = document.getElementById("createCultureBtn") as HTMLButtonElement;
	if (createBtn) {
		createBtn.addEventListener("click", () => {
			const stateData = store.getState() as any;
			const cultures = [...(stateData.cultures || [])];
			const nextId = cultures.reduce((max, c) => Math.max(max, c.id), 0) + 1;
			
			const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308"];
			const randColor = colors[Math.floor(Math.random() * colors.length)];

			const newCulture: Culture = {
				id: nextId,
				name: `Culture ${nextId}`,
				color: randColor,
				center: Math.floor(Math.random() * (stateData.heights?.length || 1000)),
				base: 0,
				habitat: "land"
			};

			cultures.push(newCulture);
			store.updateState({ cultures });
			renderCulturesList();
			if (onUpdate) onUpdate();

			// Immediately edit the newly created culture
			openCultureEditor(newCulture);
		});
	}

	// Delete Culture handler
	const deleteBtn = document.getElementById("deleteCultureBtn") as HTMLButtonElement;
	if (deleteBtn) {
		deleteBtn.addEventListener("click", () => {
			if (activeCulture) {
				const stateData = store.getState() as any;
				const cultures = (stateData.cultures || []).filter((c: Culture) => c.id !== activeCulture!.id);
				store.updateState({ cultures });
				activeCulture = null;
				if (onUpdate) onUpdate();
				showList();
			}
		});
	}

	// Register window hook for easy integration
	(window as any).openLanguageEditor = (culture?: Culture) => {
		if (panel) {
			panel.style.display = "block";
			if (culture) {
				openCultureEditor(culture);
			} else {
				showList();
			}
		}
	};

	// Perform initial load
	renderCulturesList();
=======
	const langSelect = document.getElementById("langSelect") as HTMLSelectElement;
	const preview = document.getElementById(
		"langTestPreview",
	) as HTMLInputElement;
	const genBtn = document.getElementById("testGenBtn") as HTMLButtonElement;

	const testName = () => {
		const seed = "test-" + Math.floor(Math.random() * 100000);
		preview.value = generateName(langSelect.value, seed);
	};

	genBtn.addEventListener("click", testName);
	langSelect.addEventListener("change", testName);

	testName();
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
}
