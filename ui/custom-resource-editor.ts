import { GOODS, type Good, type DemandCategory } from "../simulation/civilization/goods-generator";
import { store } from "../state/store";

/**
 * Custom Resource Editor — lets the user define new raw or manufactured goods
 * using the same schema as GOODS_DATA, with live preview and validation.
 */
export function mountCustomResourceEditor(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const wrapper = document.createElement("div");
	wrapper.id = "customResourcePanel";
	wrapper.style.display = "none";
	wrapper.style.position = "fixed";
	wrapper.style.top = "50%";
	wrapper.style.left = "50%";
	wrapper.style.transform = "translate(-50%, -50%)";
	wrapper.style.zIndex = "2000";
	wrapper.style.width = "560px";
	wrapper.style.maxHeight = "85vh";
	wrapper.style.overflowY = "auto";
	wrapper.style.background = "rgba(15, 15, 20, 0.97)";
	wrapper.style.border = "1px solid rgba(251, 191, 36, 0.4)";
	wrapper.style.borderRadius = "14px";
	wrapper.style.padding = "1.5rem";
	wrapper.style.color = "#e2e8f0";
	wrapper.style.fontFamily = "'Outfit', 'Inter', sans-serif";
	wrapper.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
	wrapper.style.fontSize = "0.875rem";

	wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.75rem;">
      <h3 style="margin:0;color:#fbbf24;font-size:1.1rem;">⚗️ Custom Resource Editor</h3>
      <span id="closeCustomResource" style="cursor:pointer;color:#94a3b8;font-size:1.4rem;line-height:1;">&times;</span>
    </div>

    <div id="customResourceTabs" style="display:flex;gap:0.5rem;margin-bottom:1rem;">
      <button class="crTab active" data-tab="create" style="flex:1;padding:0.4rem;border-radius:6px;border:1px solid #333;background:#1e293b;color:#fbbf24;cursor:pointer;font-size:0.8rem;">➕ Create New</button>
      <button class="crTab" data-tab="list" style="flex:1;padding:0.4rem;border-radius:6px;border:1px solid #333;background:#0f0f12;color:#94a3b8;cursor:pointer;font-size:0.8rem;">📋 All Resources</button>
    </div>

    <!-- CREATE FORM -->
    <div id="crCreateTab">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Name *</label>
          <input id="crName" type="text" placeholder="e.g. Dragonsteel" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Type</label>
          <select id="crType" style="width:100%;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
            <option value="raw">Raw</option>
            <option value="manufactured">Manufactured</option>
          </select>
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Icon Emoji</label>
          <input id="crIcon" type="text" placeholder="⚔️" maxlength="4" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;font-size:1.2rem;">
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Color</label>
          <input id="crColor" type="color" value="#888888" style="width:100%;height:36px;padding:2px;background:#1e293b;border:1px solid #334;border-radius:6px;cursor:pointer;">
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Unit (barrel, wain…)</label>
          <input id="crUnit" type="text" placeholder="unit" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Base Value</label>
          <input id="crValue" type="number" min="1" max="100" value="5" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Spawn Chance (0–10)</label>
          <input id="crChance" type="number" min="0" max="10" value="3" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
        </div>
        <div>
          <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">Tags (comma-separated)</label>
          <input id="crTags" type="text" placeholder="military, ore, raw" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
        </div>
      </div>

      <div style="margin-bottom:0.75rem;">
        <label style="display:block;color:#94a3b8;font-size:0.75rem;margin-bottom:0.25rem;">
          Distribution Expression
          <span style="color:#4b5563;font-style:italic;"> (land() &amp;&amp; biome(5, 6) || minHeight(40))</span>
        </label>
        <input id="crDist" type="text" placeholder="land() && biome(5, 6, 7)" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;font-family:monospace;">
        <div style="color:#4b5563;font-size:0.7rem;margin-top:0.25rem;">Functions: land(), ocean(), biome(n…), minHeight(n), maxHeight(n), minTemp(n), maxTemp(n), river(), shore(n), random(n), nth(n)</div>
      </div>

      <div style="margin-bottom:0.75rem;">
        <label style="color:#94a3b8;font-size:0.75rem;display:block;margin-bottom:0.5rem;">Demand Coverage (how much this good satisfies each category)</label>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;">
          ${["food","construction","military","luxury","utilities"].map(cat => `
          <div style="text-align:center;">
            <div style="font-size:0.7rem;color:#64748b;margin-bottom:0.2rem;">${cat}</div>
            <input id="crDemand_${cat}" type="number" min="0" max="2" step="0.1" value="0" style="width:100%;box-sizing:border-box;padding:0.3rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:4px;text-align:center;font-size:0.8rem;">
          </div>`).join("")}
        </div>
      </div>

      <div id="crRecipeSection" style="margin-bottom:0.75rem;display:none;">
        <label style="color:#94a3b8;font-size:0.75rem;display:block;margin-bottom:0.5rem;">
          Recipe Ingredients <span style="color:#4b5563;font-size:0.7rem;">(one recipe, ingredient:amount pairs)</span>
        </label>
        <div id="crRecipeRows"></div>
        <button id="crAddIngredient" style="margin-top:0.4rem;padding:0.3rem 0.7rem;background:#1e40af;border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:0.75rem;">+ Add Ingredient</button>
      </div>

      <div id="crValidationMsg" style="color:#ef4444;font-size:0.8rem;margin-bottom:0.5rem;display:none;"></div>

      <button id="crSubmit" style="width:100%;padding:0.6rem;background:linear-gradient(135deg,#d97706,#fbbf24);border:none;color:#000;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9rem;">
        ✨ Add Resource to World
      </button>

      <div id="crSuccessMsg" style="color:#10b981;font-size:0.8rem;margin-top:0.5rem;text-align:center;display:none;">
        Resource added! It will appear on the map after next generation.
      </div>
    </div>

    <!-- LIST TAB -->
    <div id="crListTab" style="display:none;">
      <div style="margin-bottom:0.5rem;">
        <input id="crSearch" type="text" placeholder="Search resources…" style="width:100%;box-sizing:border-box;padding:0.4rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:6px;">
      </div>
      <div id="crResourceList" style="max-height:400px;overflow-y:auto;"></div>
    </div>
  `;

	document.body.appendChild(wrapper);

	// ─── Tab switching ───────────────────────────────────────────────────────
	wrapper.querySelectorAll(".crTab").forEach(btn => {
		btn.addEventListener("click", () => {
			const tab = (btn as HTMLElement).dataset.tab!;
			wrapper.querySelectorAll(".crTab").forEach(b => {
				(b as HTMLElement).style.background = "#0f0f12";
				(b as HTMLElement).style.color = "#94a3b8";
				(b as HTMLElement).classList.remove("active");
			});
			(btn as HTMLElement).style.background = "#1e293b";
			(btn as HTMLElement).style.color = "#fbbf24";
			(btn as HTMLElement).classList.add("active");
			(document.getElementById("crCreateTab") as HTMLElement).style.display = tab === "create" ? "block" : "none";
			(document.getElementById("crListTab") as HTMLElement).style.display = tab === "list" ? "block" : "none";
			if (tab === "list") renderResourceList();
		});
	});

	// ─── Show/hide recipe section based on type ─────────────────────────────
	(document.getElementById("crType") as HTMLSelectElement).addEventListener("change", (e) => {
		const isManufactured = (e.target as HTMLSelectElement).value === "manufactured";
		(document.getElementById("crRecipeSection") as HTMLElement).style.display = isManufactured ? "block" : "none";
	});

	// ─── Add ingredient row ──────────────────────────────────────────────────
	const goodNames = Object.values(GOODS).map((g: any) => g.name);
	document.getElementById("crAddIngredient")!.addEventListener("click", () => {
		const row = document.createElement("div");
		row.style.display = "grid";
		row.style.gridTemplateColumns = "1fr auto auto";
		row.style.gap = "0.4rem";
		row.style.marginBottom = "0.3rem";
		row.innerHTML = `
      <select class="crIngName" style="padding:0.3rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:4px;">
        ${goodNames.map(n => `<option>${n}</option>`).join("")}
      </select>
      <input class="crIngAmt" type="number" min="0.1" step="0.1" value="1" style="width:60px;padding:0.3rem;background:#1e293b;border:1px solid #334;color:#fff;border-radius:4px;text-align:center;">
      <button class="crRemoveIng" style="padding:0.2rem 0.5rem;background:#7f1d1d;border:none;color:#fff;border-radius:4px;cursor:pointer;">✕</button>
    `;
		row.querySelector(".crRemoveIng")!.addEventListener("click", () => row.remove());
		document.getElementById("crRecipeRows")!.appendChild(row);
	});

	// ─── Submit ──────────────────────────────────────────────────────────────
	document.getElementById("crSubmit")!.addEventListener("click", () => {
		const validationEl = document.getElementById("crValidationMsg")!;
		const successEl = document.getElementById("crSuccessMsg")!;
		validationEl.style.display = "none";
		successEl.style.display = "none";

		const name = (document.getElementById("crName") as HTMLInputElement).value.trim();
		if (!name) {
			validationEl.textContent = "Name is required.";
			validationEl.style.display = "block";
			return;
		}

		if (goodNames.includes(name)) {
			validationEl.textContent = `A resource named "${name}" already exists.`;
			validationEl.style.display = "block";
			return;
		}

		const type = (document.getElementById("crType") as HTMLSelectElement).value as "raw" | "manufactured";
		const icon = (document.getElementById("crIcon") as HTMLInputElement).value.trim() || "📦";
		const color = (document.getElementById("crColor") as HTMLInputElement).value;
		const unit = (document.getElementById("crUnit") as HTMLInputElement).value.trim() || "unit";
		const value = parseInt((document.getElementById("crValue") as HTMLInputElement).value) || 5;
		const chance = parseInt((document.getElementById("crChance") as HTMLInputElement).value) || 3;
		const tagsRaw = (document.getElementById("crTags") as HTMLInputElement).value;
		const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);
		const distribution = (document.getElementById("crDist") as HTMLInputElement).value.trim() || "land()";

		const demandCoverage: Partial<Record<DemandCategory, number>> = {};
		(["food", "construction", "military", "luxury", "utilities"] as DemandCategory[]).forEach(cat => {
			const val = parseFloat((document.getElementById(`crDemand_${cat}`) as HTMLInputElement).value);
			if (val > 0) demandCoverage[cat] = val;
		});

		// Build recipe if manufactured
		let recipes: Record<number, number>[] | undefined;
		if (type === "manufactured") {
			const rows = document.querySelectorAll("#crRecipeRows > div");
			if (rows.length > 0) {
				const recipe: Record<number, number> = {};
				rows.forEach(row => {
					const ingName = (row.querySelector(".crIngName") as HTMLSelectElement).value;
					const ingAmt = parseFloat((row.querySelector(".crIngAmt") as HTMLInputElement).value);
					const ingGood = Object.values(GOODS).find((g: any) => g.name === ingName);
					if (ingGood) recipe[(ingGood as any).i] = ingAmt;
				});
				if (Object.keys(recipe).length > 0) recipes = [recipe];
			}
		}

		// Assign next available ID
		const maxId = Math.max(0, ...Object.keys(GOODS).map(Number));
		const newId = maxId + 1;

		const newGood: Good = {
			i: newId,
			name,
			type,
			icon,
			color,
			unit,
			value,
			chance,
			tags,
			distribution,
			demandCoverage,
			...(recipes && { recipes }),
		};

		// Register in GOODS registry (runtime-only; persists until page reload)
		(GOODS as any)[newId] = newGood;

		successEl.style.display = "block";
		(document.getElementById("crName") as HTMLInputElement).value = "";
		setTimeout(() => { successEl.style.display = "none"; }, 3000);
	});

	// ─── Resource list tab ───────────────────────────────────────────────────
	const renderResourceList = () => {
		const search = ((document.getElementById("crSearch") as HTMLInputElement)?.value || "").toLowerCase();
		const list = document.getElementById("crResourceList")!;
		list.innerHTML = "";

		const allGoods = Object.values(GOODS).filter((g: any) =>
			!search || g.name.toLowerCase().includes(search) || g.tags?.some((t: string) => t.includes(search))
		);

		allGoods.forEach((g: any) => {
			const row = document.createElement("div");
			row.style.cssText = "display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:#1a1a24;border-radius:6px;margin-bottom:0.3rem;";
			row.innerHTML = `
        <div style="width:12px;height:12px;background:${g.color};border-radius:2px;flex-shrink:0;"></div>
        <span style="font-size:1rem;">${g.icon || "📦"}</span>
        <span style="flex:1;font-weight:bold;color:#e2e8f0;">${g.name}</span>
        <span style="color:#64748b;font-size:0.7rem;background:#0f0f12;padding:0.15rem 0.4rem;border-radius:4px;">${g.type}</span>
        <span style="color:#fbbf24;font-size:0.75rem;font-weight:bold;">⚖️ ${g.value}</span>
        <div style="color:#64748b;font-size:0.7rem;max-width:150px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${(g.tags || []).join(", ")}</div>
      `;
			list.appendChild(row);
		});

		if (allGoods.length === 0) {
			list.innerHTML = `<div style="color:#4b5563;text-align:center;padding:1rem;">No matching resources.</div>`;
		}
	};

	document.getElementById("crSearch")?.addEventListener("input", renderResourceList);

	// ─── Close ───────────────────────────────────────────────────────────────
	document.getElementById("closeCustomResource")!.addEventListener("click", () => {
		wrapper.style.display = "none";
	});

	// ─── Expose globally ─────────────────────────────────────────────────────
	(window as any).openCustomResourceEditor = () => {
		wrapper.style.display = "block";
		(document.getElementById("crName") as HTMLInputElement)?.focus();
	};
}
