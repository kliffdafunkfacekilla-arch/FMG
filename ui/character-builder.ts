import { store } from '../state/store';

export class CharacterBuilder {
    private container: HTMLElement;
    private isVisible: boolean = false;
    private stats = {
        might: 0, endurance: 0, finesse: 0, reflex: 0, vitality: 0, fortitude: 0,
        knowledge: 0, logic: 0, awareness: 0, intuition: 0, charm: 0, willpower: 0
    };
    private readonly MAX_POINTS = 36;
    private totalPointsSpent = 0;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'character-builder';
        this.container.style.display = 'none';

        Object.assign(this.container.style, {
            position: 'absolute',
            top: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '2px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            flexDirection: 'column',
            fontFamily: '"Courier New", Courier, monospace',
            color: '#e2e8f0',
            zIndex: '10000',
            padding: '20px'
        });

        this.render();
        document.body.appendChild(this.container);

        // Export a global toggle function
        (window as any).toggleCharacterBuilder = () => this.toggle();
    }

    public toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'flex' : 'none';
        if (this.isVisible) this.render();
    }

    private updatePoints() {
        this.totalPointsSpent = Object.values(this.stats).reduce((a, b) => a + b, 0);
    }

    private render() {
        this.container.innerHTML = '';
        this.updatePoints();

        const header = document.createElement('div');
        header.innerHTML = `<h2 style="margin:0">Character Builder</h2><p style="color:#94a3b8">Points Remaining: ${this.MAX_POINTS - this.totalPointsSpent} / ${this.MAX_POINTS}</p>`;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        Object.assign(closeBtn.style, {
            position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px'
        });
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);

        this.container.appendChild(header);

        const form = document.createElement('div');
        Object.assign(form.style, { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' });

        const nameInput = document.createElement('input');
        nameInput.id = 'charName';
        nameInput.type = 'text';
        nameInput.placeholder = 'Character Name';
        Object.assign(nameInput.style, { padding: '10px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '4px' });
        form.appendChild(nameInput);

        const statsContainer = document.createElement('div');
        Object.assign(statsContainer.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' });

        for (const [stat, val] of Object.entries(this.stats)) {
            const statDiv = document.createElement('div');
            Object.assign(statDiv.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '8px', borderRadius: '4px' });
            
            const label = document.createElement('span');
            label.innerText = stat.charAt(0).toUpperCase() + stat.slice(1);
            
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '8px';

            const minusBtn = document.createElement('button');
            minusBtn.innerText = '-';
            minusBtn.onclick = () => {
                if ((this.stats as any)[stat] > 0) {
                    (this.stats as any)[stat]--;
                    this.render();
                }
            };

            const valueDisplay = document.createElement('span');
            valueDisplay.innerText = val.toString();
            valueDisplay.style.width = '20px';
            valueDisplay.style.textAlign = 'center';

            const plusBtn = document.createElement('button');
            plusBtn.innerText = '+';
            plusBtn.onclick = () => {
                if (this.totalPointsSpent < this.MAX_POINTS) {
                    (this.stats as any)[stat]++;
                    this.render();
                }
            };

            [minusBtn, plusBtn].forEach(btn => Object.assign(btn.style, {
                background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '24px'
            }));

            controls.append(minusBtn, valueDisplay, plusBtn);
            statDiv.append(label, controls);
            statsContainer.appendChild(statDiv);
        }
        
        form.appendChild(statsContainer);

        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Save Character';
        Object.assign(saveBtn.style, { marginTop: '20px', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' });
        saveBtn.onclick = async () => {
            if (this.totalPointsSpent !== this.MAX_POINTS) {
                alert(`You must spend exactly ${this.MAX_POINTS} points.`);
                return;
            }
            
            const name = (document.getElementById('charName') as HTMLInputElement).value || 'Unknown';
            const charId = 'player-' + Date.now();
            
            const payload = {
                id: charId,
                name: name,
                stats: this.stats,
                armor: 0,
                mental_armor: 0
            };

            try {
                const response = await fetch('http://localhost:8000/api/brutal/create_character', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    alert('Character saved!');
                    (window as any).activeCharacterId = charId;
                    this.toggle();
                } else {
                    const data = await response.json();
                    alert('Error saving character: ' + JSON.stringify(data));
                }
            } catch (e) {
                alert('Connection error');
            }
        };

        form.appendChild(saveBtn);
        this.container.appendChild(form);
    }
}
