export class TutorialManager {
    private static instance: TutorialManager;
    private currentStep: number = 0;
    private wrapper: HTMLElement | null = null;
    
    private styleElement: HTMLStyleElement | null = null;
    
    private challenges = [
        {
            title: "Shape the Earth",
            description: "The world begins as a blank slate.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu from the top navigation bar.<br>2. Select <b>Heightmap</b>.<br>3. Choose a brush (like 'Raise' or 'Lower') and drag on the map to paint mountains and carve valleys.",
            motivation: "Every world needs a spine. Mountains dictate the flow of rivers and the birth of civilizations. Where will your greatest peaks lie?",
            actionText: "I've shaped the earth",
            highlights: ["#toolsTab", "#btnOpenHeightmap"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "Let it Rain",
            description: "Adjust the global climate settings.<br><br><b>How to do this:</b><br>1. Open the <b>Options</b> menu at the top.<br>2. Look under the <b>World Setup</b> section.<br>3. Adjust the <b>Equator Temperature</b>, <b>Precipitation</b>, and <b>Winds</b> sliders, then apply.",
            motivation: "Water is life. The interplay of temperature and wind determines where lush jungles flourish and harsh deserts bake. Craft a dynamic climate.",
            actionText: "Climate established",
            highlights: ["#optionsTab", "#configuratorMount"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "Birth of Nations",
            description: "Generate and tweak the cultures and states.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Click <b>Cultures</b> or <b>States</b>.<br>3. Use the editor to add new factions, change their colors, or manually paint their borders on the map using the brush tool.",
            motivation: "With the stage set, the actors arrive. Watch as borders form naturally along your rivers and mountain ranges.",
            actionText: "Civilizations have risen",
            highlights: ["#toolsTab", "#btnOpenLanguages", "#btnOpenStates"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "Cities and Settlements",
            description: "Place capitals and towns across your nations.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Click <b>Burgs</b>.<br>3. Review your cities, adjust their populations, or manually place new settlements on the map.",
            motivation: "Civilization requires infrastructure. Where people gather, trade and culture thrive.",
            actionText: "Cities are thriving",
            highlights: ["#toolsTab", "#btnOpenBurgs"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "Trade and Travel",
            description: "Connect your cities with roads and shipping lanes.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Click <b>Routes</b>.<br>3. Let the system generate trade routes automatically, or draw custom highways yourself.",
            motivation: "Roads are the arteries of an empire. Without them, remote cities wither and die.",
            actionText: "Roads are paved",
            highlights: ["#toolsTab", "#btnOpenRoutes"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "The Web of Diplomacy",
            description: "Forge alliances or declare wars.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Click <b>Diplomacy</b>.<br>3. Use the matrix to set relations (Enemy, Ally, Vassal) between your states.",
            motivation: "Peace is fragile. History is often written in the blood of conflicts and the ink of treaties.",
            actionText: "Relations established",
            highlights: ["#toolsTab", "#btnOpenDiplomacy"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "Faith and Worship",
            description: "Establish the major religions of your world.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Click <b>Religions</b>.<br>3. Create pantheons, cults, or monotheistic faiths and watch them spread across borders.",
            motivation: "What do your people believe in? Faith can unite disparate cultures or tear empires apart.",
            actionText: "Faiths have spread",
            highlights: ["#toolsTab", "#btnOpenReligions"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "The Arcane and the Epic",
            description: "Inject magic and legendary figures into the world.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Explore the <b>Magic</b> and <b>Paragons</b> tools.<br>3. Define the rules of magic and create legendary heroes or monsters.",
            motivation: "A fantasy world thrives on the extraordinary. Give your world its myths and legends.",
            actionText: "Magic flows",
            highlights: ["#toolsTab", "#btnOpenMagic", "#btnOpenParagons"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "Nature's Domain",
            description: "Flesh out the ecology of your world.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Explore <b>Biomes</b>, <b>Ecology</b>, and <b>Flora & Fauna</b>.<br>3. Define what beasts roam the forests and what crops grow in the plains.",
            motivation: "A believable world needs a living ecosystem. The environment shapes the people as much as they shape it.",
            actionText: "Ecosystems are alive",
            highlights: ["#toolsTab", "#btnOpenBiomes", "#btnOpenEcology", "#btnOpenSpecies"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "World Analytics",
            description: "Review the hard data of your simulation.<br><br><b>How to do this:</b><br>1. Open the <b>Tools</b> menu.<br>2. Click <b>Analytics Dashboard</b>.<br>3. View demographic breakdowns, military strength, and global statistics.",
            motivation: "Understanding the underlying numbers helps you balance the simulation and spot interesting anomalies.",
            actionText: "Data reviewed",
            highlights: ["#toolsTab", "#btnOpenDashboard"],
            onAction: () => { this.nextStep(); }
        },
        {
            title: "The Guiding Hand",
            description: "You've built the foundation. Now, it's time to import your lore or keep tweaking manually.<br><br><b>How to do this:</b><br>1. Open the <b>Options</b> menu.<br>2. Scroll down and click the <b>Import Notes Vault</b> button to ingest your local notes.",
            motivation: "A simulated world is fascinating, but a crafted world tells a story. What legends will unfold here?",
            actionText: "Finish Tutorial",
            highlights: ["#optionsTab", "#btnOpenVault"],
            onAction: () => { this.close(); }
        }
    ];

    private constructor() {
        this.injectStyles();
    }

    private injectStyles() {
        if (document.getElementById("tutorial-highlight-styles")) return;
        
        this.styleElement = document.createElement("style");
        this.styleElement.id = "tutorial-highlight-styles";
        this.styleElement.textContent = `
            @keyframes tutorialPulse {
                0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.8); }
                70% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); }
                100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
            }
            .tutorial-highlight {
                animation: tutorialPulse 1.5s infinite !important;
                border: 2px solid #38bdf8 !important;
                border-radius: 6px;
                position: relative;
                z-index: 100;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    private clearHighlights() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }

    private applyHighlights(selectors: string[] | undefined) {
        this.clearHighlights();
        if (!selectors) return;
        
        selectors.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                el.classList.add('tutorial-highlight');
            }
        });
    }

    public static getInstance(): TutorialManager {
        if (!TutorialManager.instance) {
            TutorialManager.instance = new TutorialManager();
        }
        return TutorialManager.instance;
    }

    public start(): void {
        this.currentStep = 0;
        this.render();
    }

    public nextStep(): void {
        if (this.currentStep < this.challenges.length - 1) {
            this.currentStep++;
            this.render();
        } else {
            this.close();
        }
    }

    public close(): void {
        this.clearHighlights();
        if (this.wrapper) {
            this.wrapper.remove();
            this.wrapper = null;
        }
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
    }

    private render(): void {
        if (this.wrapper) {
            this.wrapper.remove();
        }

        const challenge = this.challenges[this.currentStep];
        this.applyHighlights(challenge.highlights);

        const html = `
            <div id="tutorialWidget" style="position: fixed; bottom: 20px; right: 20px; width: 350px; background: rgba(15, 15, 18, 0.95); border: 2px solid #5e4fa2; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 10000; font-family: system-ui, sans-serif; color: #f8fafc; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(10px);">
                <div style="background: linear-gradient(90deg, #5e4fa2, #38bdf8); padding: 10px 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>Guided World Builder (${this.currentStep + 1}/${this.challenges.length})</span>
                    <button id="tutorialMinimizeBtn" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 1.2rem; line-height: 1;">_</button>
                </div>
                <div id="tutorialContent" style="padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                    <h3 style="margin: 0; color: #38bdf8; font-size: 1.3rem;">${challenge.title}</h3>
                    <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1; line-height: 1.4;">${challenge.description}</p>
                    <div style="background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 10px; font-style: italic; font-size: 0.9rem; color: #94a3b8;">
                        "${challenge.motivation}"
                    </div>
                    <button id="tutorialActionBtn" style="margin-top: 10px; padding: 10px; background: #5e4fa2; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s;">
                        ${challenge.actionText}
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", html);
        this.wrapper = document.getElementById("tutorialWidget");

        const actionBtn = document.getElementById("tutorialActionBtn");
        if (actionBtn) {
            actionBtn.onclick = () => challenge.onAction();
        }

        const minimizeBtn = document.getElementById("tutorialMinimizeBtn");
        if (minimizeBtn) {
            minimizeBtn.onclick = () => {
                const content = document.getElementById("tutorialContent");
                if (content) {
                    if (content.style.display === "none") {
                        content.style.display = "flex";
                        minimizeBtn.innerText = "_";
                    } else {
                        content.style.display = "none";
                        minimizeBtn.innerText = "+";
                    }
                }
            };
        }
    }
}

// Make it globally available so main.ts can trigger it
(window as any).TutorialManager = TutorialManager.getInstance();
