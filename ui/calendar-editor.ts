import { store, CustomMonth, CustomSeason, CustomMoon, CustomMoonPhase } from "../state/store";

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

      <!-- Apply Action Buttons -->
      <div style="display: flex; gap: 0.5rem; margin-top: 1.2rem; border-top: 1px solid #333; padding-top: 0.8rem;">
        <button id="applyCalendarBtn" style="flex: 2; background: #10b981; border: none; padding: 0.5rem; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">Apply Settings</button>
        <button id="cancelCalendarBtn" style="flex: 1; background: #4b5563; border: none; padding: 0.5rem; color: white; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Cancel</button>
      </div>
    </div>
  `;

  const panel = document.getElementById("calendarEditorPanel") as HTMLDivElement;
  const closeBtn = document.getElementById("closeCalendarBtn") as HTMLSpanElement;
  const applyBtn = document.getElementById("applyCalendarBtn") as HTMLButtonElement;
  const cancelBtn = document.getElementById("cancelCalendarBtn") as HTMLButtonElement;

  const tabWeeksBtn = document.getElementById("tabWeeksBtn") as HTMLButtonElement;
  const tabSeasonsBtn = document.getElementById("tabSeasonsBtn") as HTMLButtonElement;
  const tabMoonsBtn = document.getElementById("tabMoonsBtn") as HTMLButtonElement;

  const tabWeeksContent = document.getElementById("tabWeeksContent") as HTMLDivElement;
  const tabSeasonsContent = document.getElementById("tabSeasonsContent") as HTMLDivElement;
  const tabMoonsContent = document.getElementById("tabMoonsContent") as HTMLDivElement;

  const weekdaysList = document.getElementById("weekdaysList") as HTMLDivElement;
  const addWeekdayBtn = document.getElementById("addWeekdayBtn") as HTMLButtonElement;

  const monthsList = document.getElementById("monthsList") as HTMLDivElement;
  const addMonthBtn = document.getElementById("addMonthBtn") as HTMLButtonElement;

  const seasonsList = document.getElementById("seasonsList") as HTMLDivElement;
  const addSeasonBtn = document.getElementById("addSeasonBtn") as HTMLButtonElement;

  const moonsList = document.getElementById("moonsList") as HTMLDivElement;
  const addMoonBtn = document.getElementById("addMoonBtn") as HTMLButtonElement;

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

  // Weekdays builders
  const renderWeekdays = () => {
    weekdaysList.innerHTML = localWeekdays.map((day, idx) => `
      <div style="display: flex; gap: 0.4rem; align-items: center;">
        <input type="text" class="weekday-input" data-idx="${idx}" value="${day}" style="flex: 1; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem;" />
        <button class="remove-weekday-btn" data-idx="${idx}" style="background: #ef4444; border: none; width: 24px; height: 24px; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">&times;</button>
      </div>
    `).join("");

    document.querySelectorAll(".weekday-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localWeekdays[idx] = target.value;
      });
    });

    document.querySelectorAll(".remove-weekday-btn").forEach(btn => {
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
    monthsList.innerHTML = localMonths.map((m, idx) => `
      <div style="display: flex; gap: 0.4rem; align-items: center;">
        <input type="text" class="month-name-input" data-idx="${idx}" value="${m.name}" style="flex: 2; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px; font-size: 0.8rem;" />
        <div style="display: flex; align-items: center; gap: 0.2rem; flex: 1;">
          <input type="number" class="month-weeks-input" data-idx="${idx}" value="${m.weekCount}" min="1" max="10" style="width: 100%; padding: 0.25rem; background: #0f0f12; border: 1px solid #444; color: #fbbf24; border-radius: 4px; font-size: 0.8rem; font-weight: bold;" />
          <span style="color: #94a3b8; font-size: 0.75rem;">wks</span>
        </div>
        <button class="remove-month-btn" data-idx="${idx}" style="background: #ef4444; border: none; width: 24px; height: 24px; color: white; font-weight: bold; border-radius: 4px; cursor: pointer;">&times;</button>
      </div>
    `).join("");

    document.querySelectorAll(".month-name-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localMonths[idx].name = target.value;
      });
    });

    document.querySelectorAll(".month-weeks-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localMonths[idx].weekCount = parseInt(target.value, 10) || 4;
      });
    });

    document.querySelectorAll(".remove-month-btn").forEach(btn => {
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
    seasonsList.innerHTML = localSeasons.map((s, idx) => `
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
    `).join("");

    document.querySelectorAll(".season-name-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].name = target.value;
      });
    });

    document.querySelectorAll(".season-start-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].startMonth = parseInt(target.value, 10);
      });
    });

    document.querySelectorAll(".season-end-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].endMonth = parseInt(target.value, 10);
      });
    });

    document.querySelectorAll(".season-temp-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].tempMod = parseFloat(target.value) || 0;
      });
    });

    document.querySelectorAll(".season-prec-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].precMod = parseFloat(target.value) || 1.0;
      });
    });

    document.querySelectorAll(".season-pop-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].popMod = parseFloat(target.value) || 1.0;
      });
    });

    document.querySelectorAll(".season-prod-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localSeasons[idx].prodMod = parseFloat(target.value) || 1.0;
      });
    });

    document.querySelectorAll(".remove-season-btn").forEach(btn => {
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
      prodMod: 1.0
    });
    renderSeasons();
  });

  // Moons builders
  const renderMoons = () => {
    moonsList.innerHTML = localMoons.map((m, idx) => `
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
          <span style="font-size: 0.75rem; color: #fbbf24; font-weight: bold;">Moon Phase States</span>
          <div class="phases-container" data-idx="${idx}" style="display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.2rem;">
            ${(m.customPhases || []).map((p, pIdx) => `
              <div style="display: flex; gap: 0.2rem; align-items: center; font-size: 0.75rem;">
                <input type="text" class="phase-name-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.name}" placeholder="Phase" style="flex: 2; background: #0f0f12; border: 1px solid #444; color: white; font-size: 0.7rem; padding: 0.15rem;" />
                <input type="number" step="0.1" class="phase-ratio-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.ratio}" placeholder="Weight" style="width: 35px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; font-size: 0.7rem; padding: 0.15rem;" />
                <input type="number" step="0.1" class="phase-mod-input" data-moon="${idx}" data-phase="${pIdx}" value="${p.modifier}" placeholder="Mod" style="width: 35px; background: #0f0f12; border: 1px solid #444; color: #a7f3d0; font-size: 0.7rem; padding: 0.15rem;" />
                <button class="remove-phase-btn" data-moon="${idx}" data-phase="${pIdx}" style="background: #ef4444; border: none; padding: 0 0.2rem; color: white; cursor: pointer; font-size: 0.7rem; border-radius: 3px;">&times;</button>
              </div>
            `).join("")}
          </div>
          <button class="add-phase-btn" data-idx="${idx}" style="background: #10b981; border: none; margin-top: 0.4rem; padding: 0.2rem 0.4rem; color: white; border-radius: 3px; font-size: 0.7rem; cursor: pointer;">+ Add Phase State</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".moon-name-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localMoons[idx].name = target.value;
      });
    });

    document.querySelectorAll(".moon-length-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localMoons[idx].cycleLength = parseInt(target.value, 10) || 30;
      });
    });

    document.querySelectorAll(".phase-name-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const mIdx = parseInt(target.dataset.moon || "0", 10);
        const pIdx = parseInt(target.dataset.phase || "0", 10);
        localMoons[mIdx].customPhases[pIdx].name = target.value;
      });
    });

    document.querySelectorAll(".phase-ratio-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const mIdx = parseInt(target.dataset.moon || "0", 10);
        const pIdx = parseInt(target.dataset.phase || "0", 10);
        localMoons[mIdx].customPhases[pIdx].ratio = parseFloat(target.value) || 1.0;
      });
    });

    document.querySelectorAll(".phase-mod-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const mIdx = parseInt(target.dataset.moon || "0", 10);
        const pIdx = parseInt(target.dataset.phase || "0", 10);
        localMoons[mIdx].customPhases[pIdx].modifier = parseFloat(target.value) || 1.0;
      });
    });

    document.querySelectorAll(".remove-phase-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const mIdx = parseInt(target.dataset.moon || "0", 10);
        const pIdx = parseInt(target.dataset.phase || "0", 10);
        localMoons[mIdx].customPhases.splice(pIdx, 1);
        renderMoons();
      });
    });

    document.querySelectorAll(".add-phase-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const idx = parseInt(target.dataset.idx || "0", 10);
        localMoons[idx].customPhases.push({
          name: `Phase ${localMoons[idx].customPhases.length + 1}`,
          ratio: 1.0,
          modifier: 1.0
        });
        renderMoons();
      });
    });

    document.querySelectorAll(".remove-moon-btn").forEach(btn => {
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
        { name: "Full Moon", ratio: 1.0, modifier: 1.0 }
      ]
    });
    renderMoons();
  });

  const closePanel = () => {
    panel.style.display = "none";
  };

  closeBtn.addEventListener("click", closePanel);
  cancelBtn.addEventListener("click", closePanel);

  applyBtn.addEventListener("click", () => {
    store.updateState({
      weekdays: [...localWeekdays],
      months: [...localMonths],
      seasons: [...localSeasons],
      moons: [...localMoons]
    });
    panel.style.display = "none";
    onUpdate();
  });

  // Export activation hook
  (window as any).openCalendarEditor = () => {
    const state = store.getState();
    localWeekdays = [...state.weekdays];
    localMonths = state.months.map(m => ({ ...m }));
    localSeasons = state.seasons.map(s => ({ ...s }));
    localMoons = state.moons.map(m => ({
      ...m,
      customPhases: m.customPhases.map(p => ({ ...p }))
    }));

    renderWeekdays();
    renderMonths();
    renderSeasons();
    renderMoons();
    selectTab("weeks");

    panel.style.display = "block";
  };
}
