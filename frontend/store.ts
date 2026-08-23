// Central reactive store (Zustand-inspired)
export interface AppState {
    player: Record<string, any>;
    world: Record<string, any>;
    chronicle: any[];
    messages: Array<{ sender: string; text: string }>;
    isConnected: boolean;
}

type Listener = (state: AppState) => void;

class Store {
    private state: AppState = {
        player: {},
        world: {},
        chronicle: [],
        messages: [],
        isConnected: false,
    };
    private listeners: Set<Listener> = new Set();

    getState(): AppState {
        return this.state;
    }

    setState(partial: Partial<AppState>) {
        this.state = { ...this.state, ...partial };
        this.notify();
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        listener(this.state); // immediate trigger
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }
}

export const store = new Store();
