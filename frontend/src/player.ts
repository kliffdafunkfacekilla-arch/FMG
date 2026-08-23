import { ChatInterface } from "./vtt/chat-interface";
import { CharacterPanel } from "./vtt/character-panel";
import { LocalMap } from "./vtt/local-map";

console.log("SAGA Player Interface Initialized");

document.addEventListener("DOMContentLoaded", () => {
    const chat = new ChatInterface();
    const charPanel = new CharacterPanel();
    const map = new LocalMap();

    // In the future, we will fetch character data and map context from the API here.
});
