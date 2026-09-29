"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = App;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const MainMenu_1 = require("./MainMenu");
const CharacterCreator_1 = require("./CharacterCreator");
const GameSessionHUD_1 = require("./GameSessionHUD");
const WorldObserver_1 = require("./WorldObserver");
function App() {
    const [appState, setAppState] = (0, react_1.useState)('MENU');
    const [sessionId, setSessionId] = (0, react_1.useState)(null);
    const [p1Id, setP1Id] = (0, react_1.useState)(null);
    const [p2Id, setP2Id] = (0, react_1.useState)(null);
    const startNewGame = async () => {
        try {
            const res = await fetch('/api/game/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Session - ${new Date().toLocaleTimeString()}` })
            });
            const data = await res.json();
            if (data.success) {
                setSessionId(data.sessionId.toString());
                setAppState('CREATE_P1');
            }
        }
        catch (e) {
            console.error(e);
        }
    };
    const loadGame = async (sid) => {
        setSessionId(sid);
        // On a real load, we'd fetch characters associated with session and set them.
        // For this prototype, we'll assume characters are fetched inside GameSessionHUD.
        setAppState('PLAY');
    };
    if (window.location.pathname === '/observer') {
        return (0, jsx_runtime_1.jsx)(WorldObserver_1.WorldObserver, {});
    }
    if (appState === 'MENU') {
        return (0, jsx_runtime_1.jsx)(MainMenu_1.MainMenu, { onStartNewGame: startNewGame, onLoadGame: loadGame });
    }
    if (appState === 'CREATE_P1' && sessionId) {
        return (0, jsx_runtime_1.jsx)(CharacterCreator_1.CharacterCreator, { title: "Create Player 1", sessionId: sessionId, onCharacterCreated: (cid) => { setP1Id(cid); setAppState('CREATE_P2'); } });
    }
    if (appState === 'CREATE_P2' && sessionId) {
        return (0, jsx_runtime_1.jsx)(CharacterCreator_1.CharacterCreator, { title: "Create Player 2", sessionId: sessionId, onCharacterCreated: (cid) => { setP2Id(cid); setAppState('PLAY'); } });
    }
    if (appState === 'PLAY' && sessionId) {
        return (0, jsx_runtime_1.jsx)(GameSessionHUD_1.GameSessionHUD, { sessionId: sessionId });
    }
    return (0, jsx_runtime_1.jsx)("div", { children: "Invalid State" });
}
//# sourceMappingURL=App.js.map