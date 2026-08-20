export const GuidedBuilder = {
    open: (): void => {
        const existing = document.getElementById("guidedBuilderWrapper");
        if (existing) existing.remove();

        const dialogHtml = `
            <div id="guidedBuilderWrapper" class="ui-dialog ui-widget ui-widget-content ui-corner-all ui-front ui-dialog-buttons stable" style="position: absolute; height: auto; width: 25em; top: 120px; right: 20px; display: flex; flex-direction: column; z-index: 10001; background: #2a2a35; border: 1px solid #10b981; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); font-family: monospace;">
                <div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #064e3b; border-bottom: 1px solid #10b981; cursor: move; color: white;">
                    <span class="ui-dialog-title" style="font-weight: bold;">✨ AI World Guide</span>
                    <button id="guideCloseBtn" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only ui-dialog-titlebar-close" title="Close" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 1.1rem; font-weight: bold;">&times;</button>
                </div>

                <div id="guidedBuilderContent" class="dialog stable ui-dialog-content ui-widget-content" style="padding: 1rem; color: #cbd5e1; font-size: 0.82rem; display: flex; flex-direction: column; gap: 1rem;">
                    
                    <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                        <div style="font-size: 2rem;">🧙</div>
                        <div id="guidePromptText" style="flex: 1; padding: 0.5rem; background: #0f0f12; border: 1px solid #444; border-radius: 4px; font-style: italic;">
                            Thinking...
                        </div>
                    </div>

                    <button id="guideActionBtn" style="display: none; padding: 0.5rem; background: #10b981; border: none; color: #0f0f12; border-radius: 4px; cursor: pointer; font-weight: bold; text-align: center;">
                        Take Action
                    </button>
                    
                    <button id="guideRefreshBtn" style="padding: 0.4rem; background: transparent; border: 1px solid #444; color: #94a3b8; border-radius: 4px; cursor: pointer; text-align: center;">
                        Next Suggestion
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", dialogHtml);

        const closeBtn = document.getElementById("guideCloseBtn");
        if (closeBtn) closeBtn.onclick = () => document.getElementById("guidedBuilderWrapper")?.remove();

        const refreshBtn = document.getElementById("guideRefreshBtn");
        const actionBtn = document.getElementById("guideActionBtn");
        
        let currentPayload: any = {};
        let currentAction: string = "";
        
        // Remove mockState; read directly from FMG global state when fetching suggestion

        const getSuggestion = async () => {
            const promptText = document.getElementById("guidePromptText");
            if (promptText) promptText.innerText = "Analyzing world state...";
            if (actionBtn) actionBtn.style.display = "none";
            if (refreshBtn) refreshBtn.setAttribute("disabled", "true");

            try {
                // Pull from FMG's actual global state (assuming window.pack structure)
                const realState = {
                    heightmap_generated: (window as any).pack?.cells?.h?.length > 0,
                    biomes_generated: (window as any).pack?.cells?.biome?.length > 0,
                    cultures_generated: (window as any).pack?.cultures?.length > 1,
                    states_generated: (window as any).pack?.states?.length > 1
                };

                const response = await fetch("http://localhost:8000/api/guide/suggest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ world_state: realState })
                });
                
                const data = await response.json();
                
                if (promptText) promptText.innerText = data.prompt_text;
                currentAction = data.suggested_action;
                currentPayload = data.action_payload;

                if (actionBtn && currentAction) {
                    actionBtn.innerText = currentAction.replace(/_/g, ' ').toUpperCase();
                    actionBtn.style.display = "block";
                }

            } catch (e: any) {
                if (promptText) promptText.innerText = "Error reaching AI Guide. Is the backend running?";
            } finally {
                if (refreshBtn) refreshBtn.removeAttribute("disabled");
            }
        };

        if (refreshBtn) refreshBtn.onclick = getSuggestion;

        if (actionBtn) {
            actionBtn.onclick = () => {
                // This would hook into FMG's actual generation functions
                console.log("Triggering generation:", currentAction, currentPayload);
                // The actual logic will be hooked into FMG's engine here
                // e.g. if (currentAction === 'generate_heightmap') window.generateHeightmap();

                getSuggestion(); // Automatically get next step after action
            };
        }

        // Fetch initial suggestion
        getSuggestion();
    }
};
