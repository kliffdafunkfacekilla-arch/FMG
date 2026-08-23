// UI console binding for SAGA frontend
import { store } from './store';
import { invokeStoryDirector, SagaWebSocketClient } from './story-api';

export function initSagaConsole() {
    // 1. Establish WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsClient = new SagaWebSocketClient(`${protocol}//${window.location.host}/ws/chat`);
    wsClient.connect();

    // 2. Subscribe store to DOM updates
    store.subscribe((state) => {
        // Connection status badge
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = state.isConnected ? 'ONLINE' : 'OFFLINE';
            statusEl.style.color = state.isConnected ? '#4ade80' : '#f87171';
        }
        // Player panel
        const playerEl = document.getElementById('player-panel');
        if (playerEl) {
            playerEl.innerHTML = `<pre>${JSON.stringify(state.player, null, 2)}</pre>`;
        }
        // Chronicle panel
        const chronicleEl = document.getElementById('chronicle-panel');
        if (chronicleEl) {
            const items = Array.isArray(state.chronicle) ? state.chronicle : [state.chronicle];
            chronicleEl.innerHTML = items.map(item => `<div>• ${typeof item === 'string' ? item : JSON.stringify(item)}</div>`).join('');
        }
        // Chat messages
        const chatEl = document.getElementById('chat-messages');
        if (chatEl) {
            chatEl.innerHTML = state.messages.map(m => `
                <div class="message">
                    <span class="sender">${m.sender}:</span> 
                    <span class="text">${m.text}</span>
                </div>
            `).join('');
            chatEl.scrollTop = chatEl.scrollHeight;
        }
    });

    // 3. Bind UI actions
    const chatForm = document.getElementById('chat-form') as HTMLFormElement;
    if (chatForm) {
        chatForm.onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input') as HTMLInputElement;
            if (input && input.value.trim()) {
                wsClient.send({ type: 'chat', content: input.value });
                input.value = '';
            }
        };
    }

    const directorBtn = document.getElementById('run-director-btn');
    if (directorBtn) {
        directorBtn.onclick = async () => {
            directorBtn.setAttribute('disabled', 'true');
            try {
                await invokeStoryDirector({ player_input: 'Proceed game turn' });
            } finally {
                directorBtn.removeAttribute('disabled');
            }
        };
    }
}
