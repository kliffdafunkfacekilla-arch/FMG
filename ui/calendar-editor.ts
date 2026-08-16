import {
<<<<<<< HEAD
	initializeEcology,
	simulateEcologyStep,
} from "../simulation/ecology/ecology-simulator";
import {
	calculateMagePopulations,
	calculateMagicFlux,
	generateLeyLines,
	generateMagicNodes,
} from "../simulation/magic/magic-system";
import {
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
	type CustomMonth,
	type CustomMoon,
	CustomMoonPhase,
	type CustomSeason,
<<<<<<< HEAD
	type CustomHoliday,
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
	store,
} from "../state/store";

export function mountCalendarEditor(containerId: string, onUpdate: () => void) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = `
    <div id="calendarEditorPanel" style="display: none; background: rgba(30, 30, 38, 0.98); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1.2rem; border-radius: 12px; font-size: 0.85rem; color: #e2e8f0; width: 100%; box-sizing: border-box; box-shadow: 0 8px 30px rgba(0,0,0,0.6); max-height: 85vh; overflow-y: auto;">
      <h3 style="margin-top: 0; color: #10b981; border-bottom: 1px solid #333; padding-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: center;">
        <span>Calendar & Planetary Cycles</span>
        <span id="closeCalendarBtn" style="cursor: pointer; color: #94a3b8; font-size: 1.2rem; transition: color 0.2s;">&times;</span>
      </h3>

      <!-- Tab Navigation -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; margin-bottom: 0.8rem;">
        <button id="tabWeeksBtn" style="flex: 1; padding: 0.4rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Weeks & Months</button>
        <button id="tabSeasonsBtn" style="flex: 1; padding: 0.4rem; background: #1e1e24; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Seasons</button>
        <button id="tabMoonsBtn" style="flex: 1; padding: 0.4rem; background: #1e1e24; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Moons</button>
        <button id="tabHolidaysBtn" style="flex: 1; padding: 0.4rem; background: #1e1e24; color: #94a3b8; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Holidays</button>
      </div>

      <!-- Tab Content: Weeks & Months -->
      <div id="tabWeeksContent" style="display: block;">
        <h4 style="margin: 0.5rem 0; color: #fbbf24;">Weekdays</h4>
        <div id="weekdaysList" style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem;"></div>
        <button id="addWeekdayBtn" style="background: #3b82f6; border: none; padding: 0.3rem 0.6rem; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">+ Add Weekday</button>

        <h4 style="margin: 0.5rem 0; color: #fbbf24;">Months</h4>
        <div id="monthsList" style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem;"></div>
        <button id="addMonthBtn" style="background: #3b82f6; border: none; padding: 0.3rem 0.6rem; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">+ Add Month</button>
      </div>

      <!-- Tab Content: Seasons -->
      <div id="tabSeasonsContent" style="display: none;">
        <h4 style="margin: 0.5rem 0; color: #fbbf24;">Seasons Configuration</h4>
        <div id="seasonsList" style="display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 0.8rem;"></div>
        <button id="addSeasonBtn" style="background: #3b82f6; border: none; padding: 0.3rem 0.6rem; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">+ Add Season</button>
      </div>

      <!-- Tab Content: Moons -->
      <div id="tabMoonsContent" style="display: none;">
        <h4 style="margin: 0.5rem 0; color: #fbbf24;">Celestial Moons</h4>
        <div id="moonsList" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 0.8rem;"></div>
        <button id="addMoonBtn" style="background: #3b82f6; border: none; padding: 0.3rem 0.6rem; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">+ Add Moon</button>
      </div>

      <!-- Tab Content: Holidays -->
      <div id="tabHolidaysContent" style="display: none;">
        <h4 style="margin: 0.5rem 0; color: #fbbf24;">Civic & Celestial Holidays</h4>
        <div id="holidaysList" style="display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 0.8rem;"></div>
        <button id="addHolidayBtn" style="background: #3b82f6; border: none; padding: 0.3rem 0.6rem; color: white; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">+ Add Custom Holiday/Event</button>
      </div>

      <!-- Simulation Actions -->
<div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid #333;padding-top:0.8rem;">
<button id="quickRecalcBtn" style="flex:1;background:#6366f1;border:none;padding:0.4rem;color:white;border-radius:4px;cursor:pointer;font-size:0.75rem;">Quick Recalc</button>
<button id="syncEcologyBtn" style="flex:1;background:#10b981;border:none;padding:0.4rem;color:white;border-radius:4px;cursor:pointer;font-size:0.75rem;">Sync Ecology</button>
<button id="syncMagicBtn" style="flex:1;background:#8b5cf6;border:none;padding:0.4rem;color:white;border-radius:4px;cursor:pointer;font-size:0.75rem;">Sync Magic</button>
<button id="manualPlacementBtn" style="flex:1;background:#f59e0b;border:none;padding:0.4rem;color:white;border-radius:4px;cursor:pointer;font-size:0.75rem;">Manual Placement</button>
</div>

<!-- Apply Action Buttons -->
      <div style="display: flex; gap: 0.5rem; margin-top: 1.2rem; border-top: 1px solid #333; padding-top: 0.8rem;">
        <button id="applyCalendarBtn" style="flex: 2; background: #10b981; border: none; padding: 0.5rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">Apply Settings</button>
        <button id="cancelCalendarBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.5rem; color: white; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Cancel</button>
      </div>
    </div>
  `;

	const panel = document.getElementById(
		"calendarEditorPanel",
	) as HTMLDivElement;
	const closeBtn = document.getElementById(
		"closeCalendarBtn",
	) as HTMLSpanElement;
	const applyBtn = document.getElementById(
		"applyCalendarBtn",
	) as HTMLButtonElement;
	const quickRecalcBtn = document.getElementById(
		"quickRecalcBtn",
	) as HTMLButtonElement;
	const syncEcologyBtn = document.getElementById(
		"syncEcologyBtn",
	) as HTMLButtonElement;
	const syncMagicBtn = document.getElementById(
		"syncMagicBtn",
	) as HTMLButtonElement;
	const manualPlacementBtn = document.getElementById(
		"manualPlacementBtn",
	) as HTMLButtonElement;
	const cancelBtn = document.getElementById(
		"cancelCalendarBtn",
	) as HTMLButtonElement;

	const tabWeeksBtn = document.getElementById(
		"tabWeeksBtn",
	) as HTMLButtonElement;
	const tabSeasonsBtn = document.getElementById(
		"tabSeasonsBtn",
	) as HTMLButtonElement;
	const tabMoonsBtn = document.getElementById(
		"tabMoonsBtn",
	) as HTMLButtonElement;
<<<<<<< HEAD
	const tabHolidaysBtn = document.getElementById(
		"tabHolidaysBtn",
	) as HTMLButtonElement;
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee

	const tabWeeksContent = document.getElementById(
		"tabWeeksContent",
	) as HTMLDivElement;
	const tabSeasonsContent = document.getElementById(
		"tabSeasonsContent",
	) as HTMLDivElement;
	const tabMoonsContent = document.getElementById(
		"tabMoonsContent",
	) as HTMLDivElement;
<<<<<<< HEAD
	const tabHolidaysContent = document.getElementById(
		"tabHolidaysContent",
	) as HTMLDivElement;
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee

	const weekdaysList = document.getElementById(
		"weekdaysList",
	) as HTMLDivElement;
	const addWeekdayBtn = document.getElementById(
		"addWeekdayBtn",
	) as HTMLButtonElement;

	const monthsList = document.getElementById("monthsList") as HTMLDivElement;
	const addMonthBtn = document.getElementById(
		"addMonthBtn",
	) as HTMLButtonElement;

	const seasonsList = document.getElementById("seasonsList") as HTMLDivElement;
	const addSeasonBtn = document.getElementById(
		"addSeasonBtn",
	) as HTMLButtonElement;

	const moonsList = document.getElementById("moonsList") as HTMLDivElement;
	const addMoonBtn = document.getElementById("addMoonBtn") as HTMLButtonElement;

<<<<<<< HEAD
	const holidaysList = document.getElementById("holidaysList") as HTMLDivElement;
	const addHolidayBtn = document.getElementById("addHolidayBtn") as HTMLButtonElement;

	let localWeekdays: string[] = [];
	let localMonths: CustomMonth[] = [];
	let localSeasons: CustomSeason[] = [];
	let localMoons: CustomMoon[] = [];
	let localHolidays: CustomHoliday[] = [];

	// Tab Switch logic
	const selectTab = (tab: "weeks" | "seasons" | "moons" | "holidays") => {
		tabWeeksBtn.style.background = tab === "weeks" ? "#2563eb" : "#1e1e24";
		tabWeeksBtn.style.color = tab === "weeks" ? "white" : "#94a3b8";
		tabWeeksContent.style.display = tab === "weeks" ? "block" : "none";

		tabSeasonsBtn.style.background = tab === "seasons" ? "#2563eb" : "#1e1e24";
		tabSeasonsBtn.style.color = tab === "seasons" ? "white" : "#94a3b8";
		tabSeasonsContent.style.display = tab === "seasons" ? "block" : "none";

		tabMoonsBtn.style.background = tab === "moons" ? "#2563eb" : "#1e1e24";
		tabMoonsBtn.style.color = tab === "moons" ? "white" : "#94a3b8";
		tabMoonsContent.style.display = tab === "moons" ? "block" : "none";

		tabHolidaysBtn.style.background = tab === "holidays" ? "#2563eb" : "#1e1e24";
		tabHolidaysBtn.style.color = tab === "holidays" ? "white" : "#94a3b8";
		tabHolidaysContent.style.display = tab === "holidays" ? "block" : "none";
	};

	tabWeeksBtn.addEventListener("click", () => selectTab("weeks"));
	tabSeasonsBtn.addEventListener("click", () => selectTab("seasons"));
	tabMoonsBtn.addEventListener("click", () => selectTab("moons"));
	tabHolidaysBtn.addEventListener("click", () => selectTab("holidays"));

=======
	let localWeekdays: string[] = [];
	let localMonths: CustomMonth[] = [];
	let localSeasons: CustomSeason[] = [];
	let localMoons: CustomMoon[] = [];

	// Tab Switch logic
	const selectTab = (tab: "weeks" | "seasons" | "moons") => {
		tabWeeksBtn.style.background = tab === "weeks" ? "#2563eb" : "#1e1e24";
		tabWeeksBtn.style.color = tab === "weeks" ? "white" : "#94a3b8";
		tabWeeksContent.style.display = tab === "weeks" ? "block" : "none";

		tabSeasonsBtn.style.background = tab === "seasons" ? "#2563eb" : "#1e1e24";
		tabSeasonsBtn.style.color = tab === "seasons" ? "white" : "#94a3b8";
		tabSeasonsContent.style.display = tab === "seasons" ? "block" : "none";

		tabMoonsBtn.style.background = tab === "moons" ? "#2563eb" : "#1e1e24";
		tabMoonsBtn.style.color = tab === "moons" ? "white" : "#94a3b8";
		tabMoonsContent.style.display = tab === "moons" ? "block" : "none";
	};

	tabWeeksBtn.addEventListener("click", () => selectTab("weeks"));
	tabSeasonsBtn.addEventListener("click", () => selectTab("seasons"));
	tabMoonsBtn.addEventListener("click", () => selectTab("moons"));

>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
	// Weekdays builders
	const renderWeekdays = () => {
		weekdaysList.innerHTML = localWeekdays
			.map(
				(day, idx) => `
      <div style="display: flex; gap: 0.4rem; align-items: center;">
        <input type="text" class="weekday-input" data-idx="${idx}" value="${day}" style="flex: 1; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem;" />
        <button class="remove-weekday-btn" data-idx="${idx}" style="background: #ef4444; border: none; width: 24px; height: 24px; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">&times;</button>
      </div>
    `,
			)
			.join("");

		document.querySelectorAll(".weekday-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localWeekdays[idx] = target.value;
			});
		});

		document.querySelectorAll(".remove-weekday-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localWeekdays.splice(idx, 1);
				renderWeekdays();
			});
		});
	};

	addWeekdayBtn.addEventListener("click", () => {
		localWeekdays.push(`Day ${localWeekdays.length + 1}`);
		renderWeekdays();
	});

	// Months builders
	const renderMonths = () => {
		monthsList.innerHTML = localMonths
			.map(
				(m, idx) => `
      <div style="display: flex; gap: 0.4rem; align-items: center;">
        <input type="text" class="month-name-input" data-idx="${idx}" value="${m.name}" style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem;" />
        <div style="display: flex; align-items: center; gap: 0.2rem; flex: 1;">
          <input type="number" class="month-weeks-input" data-idx="${idx}" value="${m.weekCount}" min="1" max="10" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 4px; font-size: 0.8rem; font-weight: bold;" />
          <span style="color: #94a3b8; font-size: 0.75rem;">wks</span>
        </div>
        <button class="remove-month-btn" data-idx="${idx}" style="background: #ef4444; border: none; width: 24px; height: 24px; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">&times;</button>
      </div>
    `,
			)
			.join("");

		document.querySelectorAll(".month-name-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMonths[idx].name = target.value;
			});
		});

		document.querySelectorAll(".month-weeks-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMonths[idx].weekCount = parseInt(target.value, 10) || 4;
			});
		});

		document.querySelectorAll(".remove-month-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMonths.splice(idx, 1);
				renderMonths();
			});
		});
	};

	addMonthBtn.addEventListener("click", () => {
		localMonths.push({ name: `Month ${localMonths.length + 1}`, weekCount: 4 });
		renderMonths();
	});

	// Seasons builders
	const renderSeasons = () => {
		seasonsList.innerHTML = localSeasons
			.map(
				(s, idx) => `
      <div style="background: rgba(15, 15, 18, 0.6); padding: 0.6rem; border: 1px solid #333; border-radius: 6px; display: flex; flex-direction: column; gap: 0.4rem;">
        <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: space-between;">
          <input type="text" class="season-name-input" data-idx="${idx}" value="${s.name}" style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem; font-weight: bold;" />
          <button class="remove-season-btn" data-idx="${idx}" style="background: #ef4444; border: none; padding: 0.2rem 0.5rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Delete</button>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: #94a3b8;">Start Month:</label>
            <select class="season-start-select" data-idx="${idx}" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              ${localMonths.map((m, mIdx) => `<option value="${mIdx}" ${mIdx === s.startMonth ? "selected" : ""}>${m.name}</option>`).join("")}
            </select>
          </div>
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: #94a3b8;">End Month:</label>
            <select class="season-end-select" data-idx="${idx}" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              ${localMonths.map((m, mIdx) => `<option value="${mIdx}" ${mIdx === s.endMonth ? "selected" : ""}>${m.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.75rem; margin-top: 0.2rem;">
          <div>
            Temp: <input type="number" class="season-temp-input" data-idx="${idx}" value="${s.tempMod}" style="width: 45px; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 3px;" /> °C
          </div>
          <div>
            Prec: <input type="number" step="0.1" class="season-prec-input" data-idx="${idx}" value="${s.precMod}" style="width: 45px; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 3px;" />x
          </div>
          <div>
            Growth: <input type="number" step="0.1" class="season-pop-input" data-idx="${idx}" value="${s.popMod}" style="width: 45px; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 3px;" />x
          </div>
          <div>
            Prod: <input type="number" step="0.1" class="season-prod-input" data-idx="${idx}" value="${s.prodMod}" style="width: 45px; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 3px;" />x
          </div>
        </div>
      </div>
    `,
			)
			.join("");

		document.querySelectorAll(".season-name-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].name = target.value;
			});
		});

		document.querySelectorAll(".season-start-select").forEach((sel) => {
			sel.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].startMonth = parseInt(target.value, 10);
			});
		});

		document.querySelectorAll(".season-end-select").forEach((sel) => {
			sel.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].endMonth = parseInt(target.value, 10);
			});
		});

		document.querySelectorAll(".season-temp-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].tempMod = parseFloat(target.value) || 0;
			});
		});

		document.querySelectorAll(".season-prec-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].precMod = parseFloat(target.value) || 1.0;
			});
		});

		document.querySelectorAll(".season-pop-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].popMod = parseFloat(target.value) || 1.0;
			});
		});

		document.querySelectorAll(".season-prod-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons[idx].prodMod = parseFloat(target.value) || 1.0;
			});
		});

		document.querySelectorAll(".remove-season-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localSeasons.splice(idx, 1);
				renderSeasons();
			});
		});
	};

	addSeasonBtn.addEventListener("click", () => {
		localSeasons.push({
			name: `Season ${localSeasons.length + 1}`,
			startMonth: 0,
			endMonth: 2,
			tempMod: 0,
			precMod: 1.0,
			popMod: 1.0,
			prodMod: 1.0,
		});
		renderSeasons();
	});

	// Moons builders
	const renderMoons = () => {
		moonsList.innerHTML = localMoons
			.map(
				(m, idx) => `
      <div style="background: rgba(15, 15, 18, 0.6); padding: 0.6rem; border: 1px solid #333; border-radius: 6px; display: flex; flex-direction: column; gap: 0.4rem;">
        <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: space-between;">
          <input type="text" class="moon-name-input" data-idx="${idx}" value="${m.name}" style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem; font-weight: bold;" />
          <button class="remove-moon-btn" data-idx="${idx}" style="background: #ef4444; border: none; padding: 0.2rem 0.5rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Delete</button>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: #94a3b8;">Cycle Duration (days):</label>
          <input type="number" class="moon-length-input" data-idx="${idx}" value="${m.cycleLength}" min="1" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 4px; font-size: 0.8rem; font-weight: bold;" />
        </div>
        <div style="margin-top: 0.4rem;">
<<<<<<< HEAD
          <span style="font-size: 0.75rem; color: #fbbf24; font-weight: bold;">Moon Phase States & Effects</span>
          <div class="phases-container" data-idx="${idx}" style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.2rem;">
            ${(m.customPhases || [])
							.map(
								(p, pIdx) => `
              <div style="display: flex; flex-direction: column; gap: 0.25rem; background: rgba(0, 0, 0, 0.35); padding: 0.4rem; border-radius: 4px; border: 1px solid #222;">
                <div style="display: flex; gap: 0.2rem; align-items: center; font-size: 0.75rem;">
                  <input type="text" class="phase-name-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.name}" placeholder="Phase" style="flex: 2; background: #0f0f12; border: 1px solid #444; color: white; font-size: 0.7rem; padding: 0.15rem;" />
                  <input type="number" step="0.1" class="phase-ratio-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.ratio}" placeholder="Weight" style="width: 35px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; font-size: 0.7rem; padding: 0.15rem;" />
                  <input type="number" step="0.1" class="phase-mod-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.modifier}" placeholder="Mod" style="width: 35px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; font-size: 0.7rem; padding: 0.15rem;" />
                  <button class="remove-phase-btn" data-moon="${idx}" data-phase="${pIdx}" style="background: #ef4444; border: none; padding: 0 0.2rem; color: white; cursor: pointer; font-size: 0.7rem; border-radius: 3px;">&times;</button>
                </div>
                <div style="display: flex; gap: 0.4rem; align-items: center; font-size: 0.7rem;">
                  <span style="color: #94a3b8; white-space: nowrap;">Phase Effect:</span>
                  <select class="phase-effect-select" data-moon="${idx}" data-phase="${pIdx}" style="flex: 1; background: #0f0f12; border: 1px solid #444; color: #fbbf24; font-size: 0.7rem; padding: 0.15rem; border-radius: 3px;">
                    <option value="" ${!p.effect ? "selected" : ""}>No Custom Effect</option>
                    <option value="mana_surge" ${p.effect === "mana_surge" ? "selected" : ""}>✨ Mana Surge (+50% Magic craft, Active notice)</option>
                    <option value="outlaw_surge" ${p.effect === "outlaw_surge" ? "selected" : ""}>🌘 Lunacy (+Passive Outlaw growth, -3 daily safety)</option>
                    <option value="harvest_surge" ${p.effect === "harvest_surge" ? "selected" : ""}>🌙 Harvest Blessing (+50% Crop & marine food harvest)</option>
                    <option value="plague_surge" ${p.effect === "plague_surge" ? "selected" : ""}>🌑 Crimson Eclipse (-4 daily health, -3 daily happiness)</option>
                    <option value="peace_surge" ${p.effect === "peace_surge" ? "selected" : ""}>🌕 Celestial Harmony (+3 daily happiness, +2 daily safety)</option>
                  </select>
                </div>
=======
          <span style="font-size: 0.75rem; color: #fbbf24; font-weight: bold;">Moon Phase States</span>
          <div class="phases-container" data-idx="${idx}" style="display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.2rem;">
            ${(m.customPhases || [])
							.map(
								(p, pIdx) => `
              <div style="display: flex; gap: 0.2rem; align-items: center; font-size: 0.75rem;">
                <input type="text" class="phase-name-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.name}" placeholder="Phase" style="flex: 2; background: #0f0f12; border: 1px solid #444; color: white; font-size: 0.7rem; padding: 0.15rem;" />
                <input type="number" step="0.1" class="phase-ratio-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.ratio}" placeholder="Weight" style="width: 35px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; font-size: 0.7rem; padding: 0.15rem;" />
                <input type="number" step="0.1" class="phase-mod-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.modifier}" placeholder="Mod" style="width: 35px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; font-size: 0.7rem; padding: 0.15rem;" />
                <button class="remove-phase-btn" data-moon="${idx}" data-phase="${pIdx}" style="background: #ef4444; border: none; padding: 0 0.2rem; color: white; cursor: pointer; font-size: 0.7rem; border-radius: 3px;">&times;</button>
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
              </div>
            `,
							)
							.join("")}
          </div>
          <button class="add-phase-btn" data-idx="${idx}" style="background: #10b981; border: none; margin-top: 0.4rem; padding: 0.2rem 0.4rem; color: white; border-radius: 3px; font-size: 0.7rem; cursor: pointer;">+ Add Phase State</button>
        </div>
      </div>
    `,
			)
			.join("");

		document.querySelectorAll(".moon-name-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMoons[idx].name = target.value;
			});
		});

		document.querySelectorAll(".moon-length-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMoons[idx].cycleLength = parseInt(target.value, 10) || 30;
			});
		});

		document.querySelectorAll(".phase-name-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const mIdx = parseInt(target.dataset.moon || "0", 10);
				const pIdx = parseInt(target.dataset.phase || "0", 10);
				localMoons[mIdx].customPhases[pIdx].name = target.value;
			});
		});

		document.querySelectorAll(".phase-ratio-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const mIdx = parseInt(target.dataset.moon || "0", 10);
				const pIdx = parseInt(target.dataset.phase || "0", 10);
				localMoons[mIdx].customPhases[pIdx].ratio =
					parseFloat(target.value) || 1.0;
			});
		});

		document.querySelectorAll(".phase-mod-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const mIdx = parseInt(target.dataset.moon || "0", 10);
				const pIdx = parseInt(target.dataset.phase || "0", 10);
				localMoons[mIdx].customPhases[pIdx].modifier =
					parseFloat(target.value) || 1.0;
			});
		});

<<<<<<< HEAD
		document.querySelectorAll(".phase-effect-select").forEach((sel) => {
			sel.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				const mIdx = parseInt(target.dataset.moon || "0", 10);
				const pIdx = parseInt(target.dataset.phase || "0", 10);
				localMoons[mIdx].customPhases[pIdx].effect = target.value;
			});
		});

		document.querySelectorAll(".remove-phase-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const mIdx = parseInt(target.dataset.moon || "0", 10);
				const pIdx = parseInt(target.dataset.phase || "0", 10);
				localMoons[mIdx].customPhases.splice(pIdx, 1);
=======
		document.querySelectorAll(".remove-phase-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const mIdx = parseInt(target.dataset.moon || "0", 10);
				const pIdx = parseInt(target.dataset.phase || "0", 10);
				localMoons[mIdx].customPhases.splice(pIdx, 1);
				renderMoons();
			});
		});

		document.querySelectorAll(".add-phase-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMoons[idx].customPhases.push({
					name: `Phase ${localMoons[idx].customPhases.length + 1}`,
					ratio: 1.0,
					modifier: 1.0,
				});
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
				renderMoons();
			});
		});

<<<<<<< HEAD
		document.querySelectorAll(".add-phase-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMoons[idx].customPhases.push({
					name: `Phase ${localMoons[idx].customPhases.length + 1}`,
					ratio: 1.0,
					modifier: 1.0,
					effect: "",
				});
				renderMoons();
			});
		});

		document.querySelectorAll(".remove-moon-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMoons.splice(idx, 1);
				renderMoons();
			});
		});
	};

	addMoonBtn.addEventListener("click", () => {
		localMoons.push({
			name: `Moon ${localMoons.length + 1}`,
			cycleLength: 30,
			customPhases: [
				{ name: "New Moon", ratio: 1.0, modifier: 1.0, effect: "" },
				{ name: "Full Moon", ratio: 1.0, modifier: 1.0, effect: "" },
			],
		});
		renderMoons();
	});

	const renderHolidays = () => {
		holidaysList.innerHTML = localHolidays
			.map(
				(h, idx) => `
      <div style="background: rgba(15, 15, 18, 0.6); padding: 0.6rem; border: 1px solid #333; border-radius: 6px; display: flex; flex-direction: column; gap: 0.4rem;">
        <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: space-between;">
          <input type="text" class="holiday-name-input" data-idx="${idx}" value="${h.name}" placeholder="Holiday/Event Name" style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem; font-weight: bold;" />
          <button class="remove-holiday-btn" data-idx="${idx}" style="background: #ef4444; border: none; padding: 0.2rem 0.5rem; color: white; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Delete</button>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: #94a3b8;">Month:</label>
            <select class="holiday-month-select" data-idx="${idx}" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              ${localMonths.map((m, mIdx) => `<option value="${mIdx}" ${mIdx === h.month ? "selected" : ""}>${m.name}</option>`).join("")}
            </select>
          </div>
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: #94a3b8;">Day of Month:</label>
            <input type="number" class="holiday-day-input" data-idx="${idx}" value="${h.day}" min="1" max="100" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
          </div>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: #94a3b8;">Type:</label>
            <select class="holiday-type-select" data-idx="${idx}" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              <option value="holiday" ${h.type === "holiday" ? "selected" : ""}>Festive / Holiday (Positive)</option>
              <option value="darkday" ${h.type === "darkday" ? "selected" : ""}>Dark / Unholy Day (Negative)</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: #94a3b8;">Target Effect:</label>
            <select class="holiday-effect-select" data-idx="${idx}" style="width: 100%; padding: 0.2rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
              <option value="population" ${h.effect === "population" ? "selected" : ""}>👥 Population Growth</option>
              <option value="happiness" ${h.effect === "happiness" ? "selected" : ""}>😊 Public Happiness</option>
              <option value="safety" ${h.effect === "safety" ? "selected" : ""}>🛡️ Town Security/Safety</option>
              <option value="health" ${h.effect === "health" ? "selected" : ""}>❤️ Public Health/Sanitation</option>
            </select>
          </div>
        </div>
        <div style="font-size: 0.75rem; color: #fbbf24; display: flex; align-items: center; gap: 0.3rem;">
          <span>Shift / Modifier value:</span>
          <input type="number" step="0.1" class="holiday-modifier-input" data-idx="${idx}" value="${h.modifier}" style="width: 60px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; border-radius: 4px; padding: 0.15rem;" />
          <span style="color: #94a3b8;">(e.g., +10 or -15)</span>
        </div>
      </div>
    `,
			)
			.join("");

		document.querySelectorAll(".holiday-name-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays[idx].name = target.value;
			});
		});

		document.querySelectorAll(".holiday-month-select").forEach((sel) => {
			sel.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays[idx].month = parseInt(target.value, 10);
			});
		});

		document.querySelectorAll(".holiday-day-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays[idx].day = parseInt(target.value, 10) || 1;
			});
		});

		document.querySelectorAll(".holiday-type-select").forEach((sel) => {
			sel.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays[idx].type = target.value as "holiday" | "darkday";
			});
		});

		document.querySelectorAll(".holiday-effect-select").forEach((sel) => {
			sel.addEventListener("change", (e) => {
				const target = e.target as HTMLSelectElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays[idx].effect = target.value as "happiness" | "population" | "safety" | "health";
			});
		});

		document.querySelectorAll(".holiday-modifier-input").forEach((input) => {
			input.addEventListener("change", (e) => {
				const target = e.target as HTMLInputElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays[idx].modifier = parseFloat(target.value) || 0;
			});
		});

		document.querySelectorAll(".remove-holiday-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localHolidays.splice(idx, 1);
				renderHolidays();
			});
		});
	};

	addHolidayBtn.addEventListener("click", () => {
		localHolidays.push({
			name: `Holiday ${localHolidays.length + 1}`,
			month: 0,
			day: 1,
			type: "holiday",
			effect: "happiness",
			modifier: 10,
		});
		renderHolidays();
	});

	const closePanel = () => {
		panel.style.display = "none";
	};

	closeBtn.addEventListener("click", closePanel);
	cancelBtn.addEventListener("click", closePanel);

	if (quickRecalcBtn) {
		quickRecalcBtn.addEventListener("click", () => {
			if ((window as any).simulationLoop) {
				(window as any).simulationLoop.advanceTick(0);
				onUpdate();

				const originalText = quickRecalcBtn.textContent;
				quickRecalcBtn.textContent = "✓ Recalculated!";
				quickRecalcBtn.style.background = "#10b981";
				setTimeout(() => {
					quickRecalcBtn.textContent = originalText;
					quickRecalcBtn.style.background = "#6366f1";
				}, 1500);
			}
		});
	}

	if (syncEcologyBtn) {
		syncEcologyBtn.addEventListener("click", () => {
			const state = store.getState() as any;
			const pointsN = state.heights ? state.heights.length : 0;
			if (pointsN > 0 && state.grid) {
				const eco = initializeEcology(pointsN, state.heights);

				const biomes = state.biomes
					? new Uint8Array(state.biomes)
					: new Uint8Array(pointsN).fill(3);
				const temp = state.temp
					? Float32Array.from(state.temp)
					: new Float32Array(pointsN).fill(20);
				const prec = state.prec
					? Uint8Array.from(state.prec)
					: new Uint8Array(pointsN).fill(100);
				const farmingCells = state.farmingCells
					? new Uint8Array(state.farmingCells)
					: new Uint8Array(pointsN).fill(0);
				const loggingCells = state.loggingCells
					? new Uint8Array(state.loggingCells)
					: new Uint8Array(pointsN).fill(0);
				const oceanNutrients = state.oceanNutrients
					? new Float32Array(state.oceanNutrients)
					: new Float32Array(pointsN).fill(0.1);

				const ecologyRates = {
					plantGrowthRate: 0.15,
					herbivoreGrazingRate: 0.001,
					herbivoreReproductionRate: 0.002,
					herbivoreDeathRate: 0.05,
					predatorHuntingRate: 0.005,
					predatorReproductionRate: 0.003,
					predatorDeathRate: 0.1,
				};

				let currentPlants = eco.plants;
				let currentHerbivores = eco.herbivores;
				let currentPredators = eco.predators;
				let currentBiomes = biomes;

				for (let iter = 0; iter < 5; iter++) {
					const ecoState = {
						plants: currentPlants,
						herbivores: currentHerbivores,
						predators: currentPredators,
					};
					currentBiomes = simulateEcologyStep(
						ecoState,
						state.grid,
						state.heights,
						temp,
						prec,
						currentBiomes,
						farmingCells,
						loggingCells,
						ecologyRates,
						undefined,
						oceanNutrients,
					);
					currentPlants = ecoState.plants;
					currentHerbivores = ecoState.herbivores;
					currentPredators = ecoState.predators;
				}

				store.updateState({
					plants: currentPlants,
					herbivores: currentHerbivores,
					predators: currentPredators,
					biomes: currentBiomes,
				} as any);

				onUpdate();

				const originalText = syncEcologyBtn.textContent;
				syncEcologyBtn.textContent = "✓ Ecology Synced!";
				syncEcologyBtn.style.background = "#047857";
				setTimeout(() => {
					syncEcologyBtn.textContent = originalText;
					syncEcologyBtn.style.background = "#10b981";
				}, 1500);
			}
		});
	}

	if (syncMagicBtn) {
		syncMagicBtn.addEventListener("click", () => {
			const state = store.getState() as any;
			const pointsN = state.heights ? state.heights.length : 0;
			if (pointsN > 0 && state.grid && state.biomes) {
				const magicNodes = generateMagicNodes(
					state.grid,
					state.heights,
					state.biomes,
					8,
				);
				const leyLines = generateLeyLines(state.grid, magicNodes);
				const magicFlux = calculateMagicFlux(state.grid, magicNodes, leyLines);

				const safePops = state.grid.cells.prec
					? Float32Array.from(state.grid.cells.prec)
					: new Float32Array(pointsN).fill(100.0);
				const magePopulation = calculateMagePopulations(
					magicFlux,
					safePops,
					state.magicTypes || [],
				);

				store.updateState({
					magicNodes,
					magicFlux,
					magePopulation,
					leyLines,
				} as any);

				onUpdate();

				const originalText = syncMagicBtn.textContent;
				syncMagicBtn.textContent = "✓ Magic Synced!";
				syncMagicBtn.style.background = "#6d28d9";
				setTimeout(() => {
					syncMagicBtn.textContent = originalText;
					syncMagicBtn.style.background = "#8b5cf6";
				}, 1500);
			}
		});
	}

	if (manualPlacementBtn) {
		manualPlacementBtn.addEventListener("click", () => {
			const isActive = !(window as any).isSimulationManualPlacementActive;
			(window as any).isSimulationManualPlacementActive = isActive;

			if (isActive) {
				manualPlacementBtn.textContent = "✓ Placement On";
				manualPlacementBtn.style.background = "#d97706";
				manualPlacementBtn.style.border = "1px solid white";

				// Deactivate other heightmap brush modes to avoid conflicts
				const win = window as any;
				if (win.getCurrentBrushConfig) {
					const current = win.getCurrentBrushConfig();
					if (current) current.mode = "none";
				}
			} else {
				manualPlacementBtn.textContent = "Manual Placement";
				manualPlacementBtn.style.background = "#f59e0b";
				manualPlacementBtn.style.border = "none";
			}
		});
	}

	applyBtn.addEventListener("click", () => {
		store.updateState({
			weekdays: [...localWeekdays],
			months: [...localMonths],
			seasons: [...localSeasons],
			moons: [...localMoons],
			holidays: [...localHolidays],
		});
		panel.style.display = "none";
		onUpdate();
	});

	// Export activation hook
	(window as any).openCalendarEditor = () => {
		const state = store.getState();
		localWeekdays = [...state.weekdays];
		localMonths = state.months.map((m) => ({ ...m }));
		localSeasons = state.seasons.map((s) => ({ ...s }));
		localMoons = state.moons.map((m) => ({
			...m,
			customPhases: m.customPhases.map((p) => ({ ...p })),
		}));
		localHolidays = (state.holidays || []).map((h) => ({ ...h }));

		renderWeekdays();
		renderMonths();
		renderSeasons();
		renderMoons();
		renderHolidays();
		selectTab("weeks");

=======
		document.querySelectorAll(".remove-moon-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const target = e.currentTarget as HTMLButtonElement;
				const idx = parseInt(target.dataset.idx || "0", 10);
				localMoons.splice(idx, 1);
				renderMoons();
			});
		});
	};

	addMoonBtn.addEventListener("click", () => {
		localMoons.push({
			name: `Moon ${localMoons.length + 1}`,
			cycleLength: 30,
			customPhases: [
				{ name: "New Moon", ratio: 1.0, modifier: 1.0 },
				{ name: "Full Moon", ratio: 1.0, modifier: 1.0 },
			],
		});
		renderMoons();
	});

	const closePanel = () => {
		panel.style.display = "none";
	};

	closeBtn.addEventListener("click", closePanel);
	cancelBtn.addEventListener("click", closePanel);

	if (quickRecalcBtn)
		quickRecalcBtn.addEventListener("click", () =>
			console.log("Cycles recalculated"),
		);
	if (syncEcologyBtn)
		syncEcologyBtn.addEventListener("click", () =>
			console.log("Ecology synced"),
		);
	if (syncMagicBtn)
		syncMagicBtn.addEventListener("click", () => console.log("Magic synced"));
	if (manualPlacementBtn)
		manualPlacementBtn.addEventListener("click", () =>
			console.log("Manual placement mode"),
		);

	applyBtn.addEventListener("click", () => {
		store.updateState({
			weekdays: [...localWeekdays],
			months: [...localMonths],
			seasons: [...localSeasons],
			moons: [...localMoons],
		});
		panel.style.display = "none";
		onUpdate();
	});

	// Export activation hook
	(window as any).openCalendarEditor = () => {
		const state = store.getState();
		localWeekdays = [...state.weekdays];
		localMonths = state.months.map((m) => ({ ...m }));
		localSeasons = state.seasons.map((s) => ({ ...s }));
		localMoons = state.moons.map((m) => ({
			...m,
			customPhases: m.customPhases.map((p) => ({ ...p })),
		}));

		renderWeekdays();
		renderMonths();
		renderSeasons();
		renderMoons();
		selectTab("weeks");

>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		panel.style.display = "block";
	};

	// Inline mount: moves the existing calendar editor panel into a provided container
	// element so it appears inline below the Configure World modal.
	(window as any).mountCalendarEditorInline = (container: HTMLElement) => {
		const panel = document.getElementById(
			"calendarEditorPanel",
		) as HTMLDivElement;
		if (!panel) return;

		// Move the panel into the inline container
		container.appendChild(panel);
		panel.style.display = "block";
		panel.style.position = "relative";
		panel.style.boxShadow = "none";
		panel.style.maxHeight = "60vh";
		panel.style.width = "100%";

		// Hide the close button since the parent toggle handles visibility
		const closeBtn = document.getElementById("closeCalendarBtn");
		if (closeBtn) closeBtn.style.display = "none";

		// Populate the editor with current state
		const state = store.getState();
		localWeekdays = [...state.weekdays];
		localMonths = state.months.map((m) => ({ ...m }));
		localSeasons = state.seasons.map((s) => ({ ...s }));
		localMoons = state.moons.map((m) => ({
			...m,
			customPhases: m.customPhases.map((p) => ({ ...p })),
		}));
<<<<<<< HEAD
		localHolidays = (state.holidays || []).map((h) => ({ ...h }));

=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		renderWeekdays();
		renderMonths();
		renderSeasons();
		renderMoons();
<<<<<<< HEAD
		renderHolidays();
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		selectTab("weeks");

		// Wire cancel button to collapse the inline container
		const cancelBtn = document.getElementById(
			"cancelCalendarBtn",
		) as HTMLButtonElement;
		if (cancelBtn) {
			cancelBtn.onclick = () => {
				container.style.display = "none";
				const btn = document.getElementById("openCalendarEditorBtn");
				if (btn) btn.textContent = "Config Custom Calendar";
			};
		}
	};
}
