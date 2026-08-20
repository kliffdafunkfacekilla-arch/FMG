export const VaultImporter = {
    open: (): void => {
        const existing = document.getElementById("vaultImporterWrapper");
        if (existing) existing.remove();

        const dialogHtml = `
            <div id="vaultImporterWrapper" class="ui-dialog ui-widget ui-widget-content ui-corner-all ui-front ui-dialog-buttons stable" style="position: absolute; height: auto; width: 30em; top: 120px; left: calc(50% - 15em); display: flex; flex-direction: column; z-index: 10001; background: #2a2a35; border: 1px solid #5e4fa2; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); font-family: monospace;">
                <div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #1a1a24; border-bottom: 1px solid #5e4fa2; cursor: move; color: white;">
                    <span class="ui-dialog-title" style="font-weight: bold;">Import Notes Vault</span>
                    <button id="vaultCloseBtn" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only ui-dialog-titlebar-close" title="Close" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 1.1rem; font-weight: bold;">&times;</button>
                </div>

                <div id="vaultImporterContent" class="dialog stable ui-dialog-content ui-widget-content" style="padding: 1rem; color: #cbd5e1; font-size: 0.82rem; display: flex; flex-direction: column; gap: 1rem;">
                    <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.8rem;">
                        <strong>Instructions:</strong> Your notes vault should be a directory containing markdown (.md) or text (.txt) files. 
                        Please organize your notes into sub-folders corresponding to world layers. The AI engine expects the following folder names:
                        <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0;">
                            <li><code>cultures</code> - For cultural lore and traditions</li>
                            <li><code>states</code> - For political factions and borders</li>
                            <li><code>paragons</code> - For important characters and leaders</li>
                            <li><code>hooks</code> - For story seeds and plot threads</li>
                        </ul>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 0.8rem; border-radius: 4px;">
                        <strong style="display: block; margin-bottom: 0.5rem;">Import Options:</strong>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.8rem;">
                            <label><input type="checkbox" id="chkBuildStates" checked /> Build States</label>
                            <label><input type="checkbox" id="chkBuildCultures" checked /> Build Cultures</label>
                            <label><input type="checkbox" id="chkBuildReligions" checked /> Build Religions</label>
                            <label><input type="checkbox" id="chkBuildParagons" checked /> Build Paragons</label>
                        </div>
                        <label style="display: block; margin-bottom: 0.2rem;">Missing Data Handling:</label>
                        <select id="missingDataHandling" style="width: 100%; padding: 0.3rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;">
                            <option value="autofill">Auto-fill empty areas with procedural states</option>
                            <option value="empty">Leave empty areas as uninhabited wilds</option>
                        </select>
                    </div>

                    <p>Enter the absolute path to your local notes vault:</p>
                    <input id="vaultPathInput" type="text" placeholder="/path/to/vault" style="width: 100%; padding: 0.5rem; background: #0f0f12; border: 1px solid #444; color: white; border-radius: 4px;" />
                    
                    <button id="importVaultBtn" style="padding: 0.5rem; background: #5e4fa2; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Import & Vectorize
                    </button>
                    
                    <div id="vaultImportStatus" style="min-height: 4em; padding: 0.5rem; background: #0f0f12; border: 1px solid #444; border-radius: 4px; font-family: monospace; white-space: pre-wrap; overflow-y: auto;">
                        Awaiting input...
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", dialogHtml);

        const closeBtn = document.getElementById("vaultCloseBtn");
        if (closeBtn) closeBtn.onclick = () => document.getElementById("vaultImporterWrapper")?.remove();

        const importBtn = document.getElementById("importVaultBtn");
        const statusDiv = document.getElementById("vaultImportStatus");
        
        if (importBtn && statusDiv) {
            importBtn.onclick = async () => {
                const pathInput = document.getElementById("vaultPathInput") as HTMLInputElement;
                const path = pathInput?.value;
                if (!path) {
                    statusDiv.innerText = "Please enter a valid path.";
                    return;
                }

                const buildStates = (document.getElementById("chkBuildStates") as HTMLInputElement)?.checked;
                const buildCultures = (document.getElementById("chkBuildCultures") as HTMLInputElement)?.checked;
                const buildReligions = (document.getElementById("chkBuildReligions") as HTMLInputElement)?.checked;
                const buildParagons = (document.getElementById("chkBuildParagons") as HTMLInputElement)?.checked;
                const missingData = (document.getElementById("missingDataHandling") as HTMLSelectElement)?.value || "autofill";

                statusDiv.innerText = "Sending to backend for LLM parsing and ChromaDB ingestion...";
                importBtn.setAttribute("disabled", "true");
                
                try {
                    const response = await fetch("http://localhost:8000/api/vault/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            vault_path: path,
                            options: {
                                build_states: buildStates,
                                build_cultures: buildCultures,
                                build_religions: buildReligions,
                                build_paragons: buildParagons,
                                missing_data: missingData
                            }
                        })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        statusDiv.innerText = `Import successful!\nEvents: ${data.events_ingested}\nParagons: ${data.paragons_ingested}\nStates: ${data.states.length}\nCultures: ${data.cultures.length}\nReligions: ${data.religions.length}\nImage Heightmap: ${data.heightmap ? "Yes" : "No"}`;
                        
                        // Close the importer modal and start the vault-to-world generation
                        document.getElementById("vaultImporterWrapper")?.remove();
                        if ((window as any).runVaultSimulation) {
                            (window as any).runVaultSimulation(data);
                        } else {
                            console.error("runVaultSimulation is not defined on window");
                        }
                    } else {
                        statusDiv.innerText = `Import failed: ${data.error}`;
                    }
                } catch (e: any) {
                    statusDiv.innerText = `Network error: ${e.message}`;
                } finally {
                    importBtn.removeAttribute("disabled");
                }
            };
        }
    }
};
