// API & WebSocket client for SAGA story director
import { store } from './store';

export async function invokeStoryDirector(payload: any) {
    try {
        const response = await fetch('/api/story/director', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Director invocation failed');
        const data = await response.json();
        // Sync full state payload into the central store
        store.setState({
            player: data.player ?? store.getState().player,
            world: data.world ?? store.getState().world,
            chronicle: data.chronicle ?? store.getState().chronicle
        });
        return data;
    } catch (err) {
        console.error('Story Director Error:', err);
        throw err;
    }
}

export class SagaWebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            store.setState({ isConnected: true });
            console.log('SAGA WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Narrative / chat message handling
                if (data.narrative_text || data.message) {
                    const newMsg = {
                        sender: data.sender || 'Director',
                        text: data.narrative_text || data.message
                    };
                    const msgs = [...store.getState().messages, newMsg];
                    store.setState({ messages: msgs });
                }
                // Sync any state fragments
                store.setState({
                    player: data.player ?? store.getState().player,
                    world: data.world ?? store.getState().world,
                    chronicle: data.chronicle ?? store.getState().chronicle
                });
            } catch (e) {
                console.error('Failed to parse WebSocket payload:', e);
            }
        };

        this.ws.onclose = () => {
            store.setState({ isConnected: false });
            console.warn('WebSocket disconnected. Reconnecting in 3s');
            setTimeout(() => this.connect(), 3000);
        };
    }

    send(payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        } else {
            console.error('Cannot send: WebSocket is closed');
        }
    }
}
