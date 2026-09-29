"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainMenu = MainMenu;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function MainMenu({ onStartNewGame, onLoadGame }) {
    const [sessions, setSessions] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        fetch('/api/game/list')
            .then(res => res.json())
            .then(data => {
            if (data.sessions)
                setSessions(data.sessions);
        })
            .catch(err => console.error("Failed to load sessions:", err));
    }, []);
    const [isBuildingWorld, setIsBuildingWorld] = (0, react_1.useState)(false);
    const [seed, setSeed] = (0, react_1.useState)('Aetheria-Prime');
    const [generating, setGenerating] = (0, react_1.useState)(false);
    const handleWorldBuild = async () => {
        setGenerating(true);
        try {
            await fetch('/api/world/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seed, resolution: 200, axialTilt: 23.5, daysPerYear: 365 })
            });
            // Optionally trigger subgrid generation here
            setIsBuildingWorld(false);
            alert('World successfully generated! You can now start a new session.');
        }
        catch (err) {
            alert('Failed to build world');
        }
        setGenerating(false);
    };
    if (isBuildingWorld) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { color: '#ffb703', fontSize: '2rem', marginBottom: '2rem' }, children: "World Builder Engine" }), (0, jsx_runtime_1.jsxs)("div", { style: { background: '#111', padding: '2rem', borderRadius: '8px', border: '1px solid #333', width: '400px' }, children: [(0, jsx_runtime_1.jsx)("p", { style: { color: '#aaa', marginBottom: '1rem' }, children: "Initialize the macro-simulation (Climate, Tectonics, History)." }), (0, jsx_runtime_1.jsx)("input", { value: seed, onChange: e => setSeed(e.target.value), placeholder: "World Seed", style: { width: '100%', padding: '0.75rem', marginBottom: '1rem', background: '#222', color: '#fff', border: '1px solid #444' } }), (0, jsx_runtime_1.jsx)("button", { onClick: handleWorldBuild, disabled: generating, style: { width: '100%', padding: '1rem', background: generating ? '#555' : '#4ade80', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }, children: generating ? 'SIMULATING 100 YEARS...' : 'GENERATE WORLD' }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setIsBuildingWorld(false), style: { width: '100%', padding: '0.5rem', background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }, children: "Cancel" })] })] }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { color: '#ffb703', fontSize: '3rem', marginBottom: '1rem', letterSpacing: '4px', textTransform: 'uppercase' }, children: "Project Aetheria" }), (0, jsx_runtime_1.jsx)("p", { style: { color: '#888', marginBottom: '3rem' }, children: "The 4-Tier Tactical Simulation VTT" }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '1rem', marginBottom: '2rem' }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setIsBuildingWorld(true), style: { padding: '1rem 2rem', fontSize: '1.2rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }, children: "BUILD NEW WORLD" }), (0, jsx_runtime_1.jsx)("button", { onClick: onStartNewGame, style: { padding: '1rem 2rem', fontSize: '1.2rem', background: '#d90429', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }, children: "START NEW SESSION" })] }), (0, jsx_runtime_1.jsxs)("div", { style: { width: '400px', background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '1rem' }, children: [(0, jsx_runtime_1.jsx)("h3", { style: { marginTop: 0, color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }, children: "Load Existing Session" }), sessions.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { style: { color: '#666', fontStyle: 'italic' }, children: "No saved sessions found." })) : ((0, jsx_runtime_1.jsx)("ul", { style: { listStyle: 'none', padding: 0, margin: 0 }, children: sessions.map(s => ((0, jsx_runtime_1.jsxs)("li", { style: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #222' }, children: [(0, jsx_runtime_1.jsxs)("span", { children: [s.name, " ", (0, jsx_runtime_1.jsxs)("span", { style: { color: '#555', fontSize: '0.8rem' }, children: ["(Map #", s.current_sub_map_id, ")"] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => onLoadGame(s.session_id.toString()), style: { padding: '0.25rem 1rem', background: '#ffb703', color: '#000', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }, children: "LOAD" })] }, s.session_id))) }))] })] }));
}
//# sourceMappingURL=MainMenu.js.map