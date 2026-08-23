export class CharacterPanel {
    constructor() {
        // We will eventually load this from the backend
        // For now, load some dummy data to ensure UI is wired up
        this.updateCharacterInfo({
            name: "Subject 000",
            origin: "Scavenger",
            hp: { current: 15, max: 20 },
            composure: { current: 10, max: 12 },
            stamina: { current: 3, max: 4 },
            focus: { current: 1, max: 2 },
            stats: {
                might: 3, end: 2, fin: 1, ref: 2, vit: 1, "for": 2,
                know: 1, log: 1, awa: 2, int: 1, cha: 1, wil: 2
            },
            tags: ["Exhausted", "Hidden"]
        });
    }

    public updateCharacterInfo(data: any) {
        // Basic Info
        const nameEl = document.getElementById("char-name");
        const originEl = document.getElementById("char-origin");
        if (nameEl) nameEl.textContent = data.name;
        if (originEl) originEl.textContent = data.origin;

        // Resource Text
        const setResourceText = (id: string, current: number, max: number) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `${current} / ${max}`;
        };
        setResourceText("char-hp", data.hp.current, data.hp.max);
        setResourceText("char-comp", data.composure.current, data.composure.max);
        setResourceText("char-stam", data.stamina.current, data.stamina.max);
        setResourceText("char-foc", data.focus.current, data.focus.max);

        // Resource Bars
        const setResourceBar = (id: string, current: number, max: number) => {
            const el = document.getElementById(id);
            if (el) {
                const percent = max > 0 ? (current / max) * 100 : 0;
                el.style.width = `${percent}%`;
            }
        };
        setResourceBar("bar-hp", data.hp.current, data.hp.max);
        setResourceBar("bar-comp", data.composure.current, data.composure.max);
        setResourceBar("bar-stam", data.stamina.current, data.stamina.max);
        setResourceBar("bar-foc", data.focus.current, data.focus.max);

        // Attributes
        for (const [key, val] of Object.entries(data.stats)) {
            const el = document.getElementById(`stat-${key}`);
            if (el) el.textContent = String(val);
        }

        // Tags
        const tagsContainer = document.getElementById("tags-container");
        if (tagsContainer) {
            tagsContainer.innerHTML = "";
            if (data.tags && data.tags.length > 0) {
                data.tags.forEach((t: string) => {
                    const span = document.createElement("span");
                    span.className = "status-tag";
                    span.textContent = t;
                    tagsContainer.appendChild(span);
                });
            } else {
                tagsContainer.innerHTML = `<span style="color: #64748b; font-size: 0.8rem; font-style: italic;">No active tags</span>`;
            }
        }
    }
}
