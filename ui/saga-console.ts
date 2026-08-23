import { processWorldFlags } from './world-feedback-processor';
import { store } from '../state/store';

export class SagaConsole {
    private container: HTMLElement;
    private logArea: HTMLElement;
    private inputField: HTMLInputElement;
    private isVisible: boolean = false;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'saga-console';
        this.container.style.display = 'none';
        
        // Basic styling for a DM screen/console overlay
        Object.assign(this.container.style, {
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            width: '450px',
            height: '600px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '2px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'none',
            flexDirection: 'column',
            fontFamily: '"Courier New", Courier, monospace',
            color: '#e2e8f0',
            zIndex: '9999',
            overflow: 'hidden'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '12px 16px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });
        header.innerHTML = '<span>SAGA AI Director</span>';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        Object.assign(closeBtn.style, {
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '16px'
        });
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);
        
        this.container.appendChild(header);

        // Log Area
        this.logArea = document.createElement('div');
        Object.assign(this.logArea.style, {
            flex: '1',
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        });
        this.container.appendChild(this.logArea);

        // Input Area
        const inputWrapper = document.createElement('div');
        Object.assign(inputWrapper.style, {
            padding: '16px',
            borderTop: '1px solid #334155',
            backgroundColor: '#0f172a'
        });

        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.placeholder = 'What do you do? (e.g. "I search the ruins")';
        Object.assign(this.inputField.style, {
            width: '100%',
            padding: '12px',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '6px',
            color: 'white',
            outline: 'none',
            fontFamily: 'inherit'
        });
        
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.inputField.value.trim()) {
                this.submitAction(this.inputField.value.trim());
                this.inputField.value = '';
            }
        });

        inputWrapper.appendChild(this.inputField);
        this.container.appendChild(inputWrapper);

        document.body.appendChild(this.container);
        
        // Initial welcome message
        this.appendMessage('system', 'The world awaits your action. The AI Director is listening... (Press ` to toggle)');
        
        // Global hotkey to toggle console
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || e.key === '~') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    private socket: WebSocket | null = null;

    public toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'flex' : 'none';
        if (this.isVisible) {
            this.inputField.focus();
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                this.initSocket();
            }
        }
    }

    private initSocket() {
        this.appendMessage('system', 'Connecting to SAGA Director...');
        this.socket = new WebSocket('ws://localhost:8000/ws/chat');
        
        this.socket.onopen = () => {
            const charId = (window as any).activeCharacterId || "Unknown Character";
            const currentStoreState = store.getState();
            this.socket?.send(JSON.stringify({
                type: 'session_init',
                world_id: currentStoreState.currentWorldId || "Unknown World",
                character_id: charId,
                region_id: "Unknown Region"
            }));
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const loader = document.getElementById('loading-indicator');
                if (loader) loader.remove();
                
                if (data.narrative_text) {
                    this.appendMessage('dm', data.narrative_text, data.world_flags);
                }
                
                if (data.world_flags && data.world_flags.length > 0) {
                    processWorldFlags(data.world_flags);
                }
            } catch (e) {
                console.error("Failed to parse socket message", e);
            }
        };

        this.socket.onerror = () => {
            this.appendMessage('system', 'Connection error to AI Director.');
        };
        
        this.socket.onclose = () => {
            this.appendMessage('system', 'Disconnected from AI Director.');
        };
    }

    private appendMessage(role: 'player' | 'dm' | 'system', text: string, flags?: string[]) {
        const msgDiv = document.createElement('div');
        
        const sender = document.createElement('div');
        sender.style.fontSize = '0.8em';
        sender.style.marginBottom = '4px';
        sender.style.textTransform = 'uppercase';
        
        const content = document.createElement('div');
        content.style.lineHeight = '1.5';
        
        if (role === 'player') {
            sender.innerText = 'Player';
            sender.style.color = '#94a3b8';
            content.style.color = '#f8fafc';
        } else if (role === 'dm') {
            sender.innerText = 'AI Director';
            sender.style.color = '#f59e0b';
            content.style.color = '#fcd34d';
            content.style.fontStyle = 'italic';
        } else {
            sender.innerText = 'System';
            sender.style.color = '#64748b';
            content.style.color = '#cbd5e1';
        }
        
        content.innerText = text;
        
        msgDiv.appendChild(sender);
        msgDiv.appendChild(content);

        // Display flags if any
        if (flags && flags.length > 0) {
            const flagsDiv = document.createElement('div');
            flagsDiv.style.marginTop = '8px';
            flagsDiv.style.display = 'flex';
            flagsDiv.style.gap = '4px';
            flagsDiv.style.flexWrap = 'wrap';
            
            flags.forEach(flag => {
                const badge = document.createElement('span');
                badge.innerText = flag;
                Object.assign(badge.style, {
                    backgroundColor: '#334155',
                    color: '#94a3b8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75em'
                });
                flagsDiv.appendChild(badge);
            });
            msgDiv.appendChild(flagsDiv);
        }
        
        this.logArea.appendChild(msgDiv);
        this.logArea.scrollTop = this.logArea.scrollHeight;
    }

    private submitAction(text: string) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.appendMessage('system', 'Error: Not connected to AI Director.');
            return;
        }

        this.appendMessage('player', text);
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.innerText = 'The Director is pondering...';
        loadingDiv.style.color = '#64748b';
        loadingDiv.style.fontStyle = 'italic';
        this.logArea.appendChild(loadingDiv);
        this.logArea.scrollTop = this.logArea.scrollHeight;

        const currentStoreState = store.getState();
        this.socket.send(JSON.stringify({
            type: 'player_input',
            content: text,
            world_state: {
                viewMode: currentStoreState.viewMode,
                zoom: currentStoreState.zoom
            }
        }));
    }
}

