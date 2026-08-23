export class ChatInterface {
    private chatHistory: HTMLElement;
    private chatInput: HTMLTextAreaElement;
    private sendButton: HTMLButtonElement;
    private ws: WebSocket | null = null;

    constructor() {
        this.chatHistory = document.getElementById("chat-history") as HTMLElement;
        this.chatInput = document.getElementById("chat-input") as HTMLTextAreaElement;
        this.sendButton = document.getElementById("chat-send") as HTMLButtonElement;

        this.bindEvents();
        this.connect();
    }

    private bindEvents() {
        this.sendButton.addEventListener("click", () => this.sendMessage());
        this.chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    private connect() {
        // Connect to FastAPI backend
        this.ws = new WebSocket("ws://localhost:8000/ws/chat");

        this.ws.onopen = () => {
            this.updateConnectionStatus(true);
            this.appendMessage("system", "Connected to the AI Director.");
        };

        this.ws.onmessage = (event) => {
            this.appendMessage("director", event.data);
        };

        this.ws.onclose = () => {
            this.updateConnectionStatus(false);
            this.appendMessage("system", "Lost connection to the AI Director. Retrying in 5s...");
            setTimeout(() => this.connect(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            this.ws?.close();
        };
    }

    private updateConnectionStatus(connected: boolean) {
        const statusText = document.getElementById("connection-status");
        const statusDot = document.getElementById("connection-dot");
        if (statusText && statusDot) {
            statusText.childNodes[1].nodeValue = connected ? " Connected" : " Disconnected";
            statusText.style.color = connected ? "#10b981" : "#f87171";
            statusDot.style.background = connected ? "#10b981" : "#f87171";
        }
    }

    private sendMessage() {
        const text = this.chatInput.value.trim();
        if (!text || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.appendMessage("player", text);
        this.ws.send(JSON.stringify({ type: "player_input", content: text }));
        this.chatInput.value = "";
    }

    private appendMessage(sender: "system" | "player" | "director", content: string) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = content;
        this.chatHistory.appendChild(msgDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
}
