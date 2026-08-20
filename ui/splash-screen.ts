import { VaultImporter } from "./vault-importer";

export const SplashScreen = {
    open: (onStartNewWorld: () => void, onLoadMap: () => void): void => {
        const existing = document.getElementById("splashScreenWrapper");
        if (existing) existing.remove();

        const dialogHtml = `
            <div id="splashScreenWrapper" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #0f0f12; z-index: 100000; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: system-ui, sans-serif;">
                <div style="text-align: center; margin-bottom: 3rem;">
                    <h1 style="font-size: 4rem; color: #f8fafc; text-shadow: 0 4px 20px rgba(94, 79, 162, 0.8); margin-bottom: 0.5rem; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">FANTASY MAP SIMULATOR</h1>
                    <p style="font-size: 1.2rem; color: #94a3b8; max-width: 600px; margin: 0 auto;">Build worlds, simulate history, and craft legends.</p>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; max-width: 400px;">
                    <button id="splashStartBtn" style="padding: 1rem 2rem; font-size: 1.2rem; font-weight: bold; background: #5e4fa2; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(94, 79, 162, 0.4);">
                        Start a New World
                    </button>
                    
                    <button id="splashLoadBtn" style="padding: 1rem 2rem; font-size: 1.2rem; font-weight: bold; background: #334155; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);">
                        Load a Map
                    </button>
                    
                    <button id="splashImportBtn" style="padding: 1rem 2rem; font-size: 1.2rem; font-weight: bold; background: #334155; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);">
                        Import Notes Vault
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", dialogHtml);

        const startBtn = document.getElementById("splashStartBtn");
        const loadBtn = document.getElementById("splashLoadBtn");
        const importBtn = document.getElementById("splashImportBtn");

        if (startBtn) {
            startBtn.onmouseover = () => { startBtn.style.transform = "scale(1.05)"; startBtn.style.background = "#6b5bb6"; };
            startBtn.onmouseout = () => { startBtn.style.transform = "scale(1)"; startBtn.style.background = "#5e4fa2"; };
            startBtn.onclick = () => {
                document.getElementById("splashScreenWrapper")?.remove();
                onStartNewWorld();
            };
        }

        if (loadBtn) {
            loadBtn.onmouseover = () => { loadBtn.style.transform = "scale(1.05)"; loadBtn.style.background = "#475569"; };
            loadBtn.onmouseout = () => { loadBtn.style.transform = "scale(1)"; loadBtn.style.background = "#334155"; };
            loadBtn.onclick = () => {
                onLoadMap();
            };
        }

        if (importBtn) {
            importBtn.onmouseover = () => { importBtn.style.transform = "scale(1.05)"; importBtn.style.background = "#475569"; };
            importBtn.onmouseout = () => { importBtn.style.transform = "scale(1)"; importBtn.style.background = "#334155"; };
            importBtn.onclick = () => {
                VaultImporter.open();
            };
        }
    }
};
