"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dashboard = Dashboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const RegionMap_1 = require("./RegionMap");
const BIOME_COLORS = {
    0: "#1e3a8a", 1: "#fde047", 2: "#d6d3d1", 3: "#fcd34d", 4: "#a3e635", 5: "#65a30d",
    6: "#4d7c0f", 7: "#166534", 8: "#0f766e", 9: "#334155", 10: "#94a3b8", 11: "#f8fafc",
    12: "#3f6212", 101: "#0f172a", 102: "#1e293b", 103: "#0369a1", 104: "#0284c7",
    105: "#0ea5e9", 106: "#38bdf8", 107: "#06b6d4", 108: "#0891b2", 109: "#1e3a8a",
    110: "#312e81", 111: "#e2e8f0", 112: "#14b8a6",
};
const SEASONS = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime', 'Shadow Week'];
function MapCanvas({ cells, factions, viewMode, economy, onCellClick }) {
    const canvasRef = (0, react_1.useRef)(null);
    const [zoom, setZoom] = (0, react_1.useState)(1);
    const [offset, setOffset] = (0, react_1.useState)({ x: 0, y: 0 });
    const isDragging = (0, react_1.useRef)(false);
    const lastMouse = (0, react_1.useRef)({ x: 0, y: 0 });
    const bounds = (0, react_1.useRef)({ minX: 0, maxX: 100, minY: 0, maxY: 100, baseScale: 1, baseOffX: 0, baseOffY: 0 });
    // Compute bounds once
    (0, react_1.useEffect)(() => {
        if (!cells || cells.length === 0)
            return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        cells.forEach((cell) => {
            if (!cell.geometry?.coordinates?.[0])
                return;
            cell.geometry.coordinates[0].forEach(([x, y]) => {
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            });
        });
        if (minX === Infinity)
            return;
        bounds.current = { minX, maxX, minY, maxY, baseScale: 1, baseOffX: 0, baseOffY: 0 };
    }, [cells]);
    (0, react_1.useEffect)(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        const pad = 10;
        const { minX, maxX, minY, maxY } = bounds.current;
        const scaleX = (canvas.width - pad * 2) / (maxX - minX || 1);
        const scaleY = (canvas.height - pad * 2) / (maxY - minY || 1);
        const baseScale = Math.min(scaleX, scaleY);
        bounds.current.baseScale = baseScale;
        bounds.current.baseOffX = (canvas.width - (maxX - minX) * baseScale) / 2 - minX * baseScale;
        bounds.current.baseOffY = (canvas.height - (maxY - minY) * baseScale) / 2 - minY * baseScale;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0d1117";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        // Move to center, scale, move back, then apply pan
        ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
        ctx.scale(zoom, zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        cells.forEach((cell) => {
            if (!cell.geometry?.coordinates?.[0])
                return;
            const coords = cell.geometry.coordinates[0];
            if (cell.elevation < 20) {
                ctx.fillStyle = "#0c182b";
            }
            else if (viewMode === "Biome") {
                ctx.fillStyle = BIOME_COLORS[cell.biome] || "#222";
            }
            else if (viewMode === "Political") {
                const f = cell.faction_id ? factions[cell.faction_id] : null;
                ctx.fillStyle = f ? f.color + "cc" : "#1e2a1e";
            }
            else if (viewMode === "Ecology") {
                const total = (cell.eco_plants || 0) + (cell.eco_prey || 0) + (cell.eco_predators || 0);
                const ratio = Math.min(1, total / 120);
                const r = Math.floor(20 + ratio * 60), g = Math.floor(40 + ratio * 140), b = Math.floor(20 + ratio * 30);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
            }
            else {
                const eco = economy[cell.id];
                const unrest = eco?.unrest ?? 0;
                const hue = Math.max(0, 120 - unrest * 1.2);
                ctx.fillStyle = `hsla(${hue},90%,40%,0.85)`;
            }
            ctx.beginPath();
            coords.forEach(([x, y], i) => {
                const cx = x * baseScale + bounds.current.baseOffX;
                const cy = y * baseScale + bounds.current.baseOffY;
                if (i === 0)
                    ctx.moveTo(cx, cy);
                else
                    ctx.lineTo(cx, cy);
            });
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#ffffff08";
            ctx.lineWidth = 0.5 / zoom;
            ctx.stroke();
            if (cell.elevation && cell.elevation >= 70 && String(cell.biome) !== "301") {
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                let pX = 0, pY = 0;
                coords.forEach((p) => { pX += p[0]; pY += p[1]; });
                pX = (pX / coords.length) * baseScale + bounds.current.baseOffX;
                pY = (pY / coords.length) * baseScale + bounds.current.baseOffY;
                ctx.moveTo(pX, pY - 8 / zoom);
                ctx.lineTo(pX + 6 / zoom, pY + 6 / zoom);
                ctx.lineTo(pX - 6 / zoom, pY + 6 / zoom);
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 0.5 / zoom;
                ctx.stroke();
            }
            if (economy[cell.id]) {
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                const cx = (coords[0][0]) * baseScale + bounds.current.baseOffX;
                const cy = (coords[0][1]) * baseScale + bounds.current.baseOffY;
                ctx.arc(cx, cy, 2 / zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 0.5 / zoom;
                ctx.stroke();
            }
        });
        ctx.restore();
    }, [cells, factions, viewMode, economy, zoom, offset]);
    const handleMouseDown = (e) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e) => {
        if (!isDragging.current)
            return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => { isDragging.current = false; };
    const handleWheel = (e) => {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(z => Math.max(0.5, Math.min(10, z * factor)));
    };
    const handleClick = (e) => {
        if (isDragging.current)
            return;
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        // inverse transform
        let mx = e.clientX - rect.left;
        let my = e.clientY - rect.top;
        mx -= canvas.width / 2 + offset.x;
        my -= canvas.height / 2 + offset.y;
        mx /= zoom;
        my /= zoom;
        mx += canvas.width / 2;
        my += canvas.height / 2;
        let bestCell = null;
        let minDist = Infinity;
        cells.forEach((cell) => {
            if (!cell.geometry?.coordinates?.[0])
                return;
            const pt = cell.geometry.coordinates[0][0];
            const cx = (pt[0]) * bounds.current.baseScale + bounds.current.baseOffX;
            const cy = (pt[1]) * bounds.current.baseScale + bounds.current.baseOffY;
            const dist = (cx - mx) ** 2 + (cy - my) ** 2;
            if (dist < minDist && dist < 100 / (zoom * zoom)) {
                minDist = dist;
                bestCell = cell.id;
            }
        });
        if (bestCell)
            onCellClick(bestCell);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }, children: [(0, jsx_runtime_1.jsx)("canvas", { ref: canvasRef, style: { width: '100%', height: '100%', display: "block", cursor: isDragging.current ? 'grabbing' : 'grab' }, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, onWheel: handleWheel, onClick: handleClick }), (0, jsx_runtime_1.jsxs)("div", { style: { position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', padding: '5px', borderRadius: '4px', color: '#fff' }, children: ["Zoom: ", zoom.toFixed(1), "x"] })] }));
}
function FactionPanel({ state, economy }) {
    if (!state.factions || state.factions.length === 0)
        return (0, jsx_runtime_1.jsx)("div", { style: { padding: '20px', color: '#888' }, children: "No factions data." });
    return ((0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }, children: [(0, jsx_runtime_1.jsx)("h3", { style: { color: '#58a6ff', margin: 0, paddingBottom: '10px', borderBottom: '1px solid #30363d' }, children: "Global Factions" }), state.factions.map(f => {
                const myBurgs = economy.filter(b => state.cells.find(c => c.id === b.cell_id)?.faction_id === f.id);
                const pop = myBurgs.reduce((sum, b) => sum + (b.pop_null || 0), 0);
                const wealth = myBurgs.reduce((sum, b) => sum + (b.wealth || 0), 0);
                return ((0, jsx_runtime_1.jsxs)("div", { style: { background: '#21262d', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${f.color}` }, children: [(0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 'bold', color: '#fff', fontSize: '14px' }, children: f.name }), (0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '12px', color: '#aaa', marginTop: '4px' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Burgs: ", myBurgs.length] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Pop: ", pop.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Wealth: ", wealth.toLocaleString()] })] })] }, f.id));
            }), state.fringeFactions && state.fringeFactions.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("h3", { style: { color: '#ff7b72', margin: '10px 0 0 0', paddingBottom: '10px', borderBottom: '1px solid #30363d' }, children: "Fringe Factions" }), state.fringeFactions.map(ff => ((0, jsx_runtime_1.jsx)("div", { style: { background: '#2d2121', padding: '10px', borderRadius: '6px', borderLeft: `4px solid #ff7b72` }, children: (0, jsx_runtime_1.jsxs)("div", { style: { fontWeight: 'bold', color: '#fff', fontSize: '13px' }, children: [ff.name, " ", (0, jsx_runtime_1.jsxs)("span", { style: { fontSize: '10px', color: '#aaa' }, children: ["(", ff.type, ")"] })] }) }, ff.id)))] }))] }));
}
function RightPanel({ state, economyMap, factionMap, selectedCell }) {
    const [tab, setTab] = (0, react_1.useState)('Burg');
    let burg = null;
    let cell = null;
    let faction = null;
    if (selectedCell) {
        burg = economyMap[selectedCell];
        cell = state.cells.find(c => c.id === selectedCell);
        faction = cell && cell.faction_id ? factionMap[cell.faction_id] : null;
        if (burg && typeof burg.military_forces === 'string')
            try {
                burg.military_forces = JSON.parse(burg.military_forces);
            }
            catch (e) { }
        if (burg && typeof burg.demographics === 'string')
            try {
                burg.demographics = JSON.parse(burg.demographics);
            }
            catch (e) { }
    }
    return ((0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#161b22' }, children: [(0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', background: '#010409', borderBottom: '1px solid #30363d' }, children: ['Burg', 'Events', 'Render'].map(t => ((0, jsx_runtime_1.jsx)("div", { onClick: () => setTab(t), style: {
                        flex: 1, padding: '10px', textAlign: 'center', cursor: 'pointer', fontSize: '13px',
                        borderBottom: tab === t ? '2px solid #58a6ff' : '2px solid transparent',
                        color: tab === t ? '#fff' : '#8b949e', fontWeight: tab === t ? 'bold' : 'normal'
                    }, children: t }, t))) }), (0, jsx_runtime_1.jsxs)("div", { style: { flex: 1, overflowY: 'auto', padding: '12px' }, children: [tab === 'Burg' && ((0, jsx_runtime_1.jsx)("div", { style: { fontSize: '13px', color: '#ccc' }, children: !burg ? (0, jsx_runtime_1.jsx)("div", { style: { color: '#888', textAlign: 'center' }, children: "Select a Burg on the map." }) : ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { style: { color: '#fff', margin: '0 0 10px 0' }, children: ["Burg ", burg.burg_id] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Cell ID:" }), " ", burg.cell_id] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Faction:" }), " ", faction ? faction.name : 'None'] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Biome ID:" }), " ", cell?.biome] }), (0, jsx_runtime_1.jsx)("hr", { style: { borderColor: '#30363d', margin: '10px 0' } }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Population:" }), " ", burg.pop_null] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Wealth:" }), " ", burg.wealth] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Food:" }), " ", burg.food] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Health:" }), " ", burg.health] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Unrest:" }), " ", burg.unrest] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Tier:" }), " ", burg.urban_tier || 1] })] }), (0, jsx_runtime_1.jsx)("hr", { style: { borderColor: '#30363d', margin: '10px 0' } }), (0, jsx_runtime_1.jsx)("strong", { style: { color: '#fbbf24', display: 'block', marginBottom: '4px' }, children: "Military:" }), burg.military_forces && Object.keys(burg.military_forces).length > 0 ? ((0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' }, children: Object.entries(burg.military_forces).map(([type, count]) => ((0, jsx_runtime_1.jsxs)("span", { style: { background: '#333', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', color: '#ff8c00' }, children: [type, ": ", String(count)] }, type))) })) : (0, jsx_runtime_1.jsx)("span", { style: { color: '#888' }, children: "None" }), (0, jsx_runtime_1.jsx)("hr", { style: { borderColor: '#30363d', margin: '10px 0' } }), (0, jsx_runtime_1.jsx)("strong", { style: { color: '#fbbf24', display: 'block', marginBottom: '4px' }, children: "Demographics:" }), burg.demographics && Object.keys(burg.demographics).length > 0 ? ((0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' }, children: Object.entries(burg.demographics).map(([species, count]) => ((0, jsx_runtime_1.jsxs)("span", { style: { background: '#333', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }, children: [species, ": ", String(count)] }, species))) })) : (0, jsx_runtime_1.jsx)("span", { style: { color: '#888' }, children: "None" })] })) })), tab === 'Events' && ((0, jsx_runtime_1.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "8px" }, children: [(state.events || []).map((e) => {
                                const isMajor = e.tier === "MAJOR";
                                return ((0, jsx_runtime_1.jsxs)("div", { style: {
                                        padding: "8px", background: isMajor ? "#2d2121" : "#1f2937",
                                        borderLeft: `4px solid ${isMajor ? "#ff7b72" : "#58a6ff"}`, borderRadius: "4px", fontSize: "12px",
                                    }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", color: "#8b949e", marginBottom: "4px", fontSize: "10px" }, children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Tick ", e.tick, " (", e.lore_date, ")"] }), (0, jsx_runtime_1.jsx)("span", { style: { fontWeight: "bold" }, children: e.type })] }), (0, jsx_runtime_1.jsx)("div", { style: { color: "#e6edf3", lineHeight: 1.4 }, children: e.message })] }, e.id));
                            }), (state.events || []).length === 0 && (0, jsx_runtime_1.jsx)("div", { style: { color: '#888', textAlign: 'center' }, children: "No events recorded." })] })), tab === 'Render' && ((0, jsx_runtime_1.jsxs)("div", { style: { color: '#ccc', fontSize: '13px' }, children: [(0, jsx_runtime_1.jsx)("p", { children: "Region Map Render Testing" }), selectedCell ? ((0, jsx_runtime_1.jsx)("div", { style: { border: '1px solid #30363d', borderRadius: '4px', overflow: 'hidden' }, children: (0, jsx_runtime_1.jsx)(RegionMap_1.RegionMap, { cellId: selectedCell }) })) : ((0, jsx_runtime_1.jsx)("div", { style: { color: '#888', textAlign: 'center' }, children: "Select a cell on the map to test its region render." }))] }))] })] }));
}
function Dashboard() {
    const [state, setState] = (0, react_1.useState)(null);
    const [cells, setCells] = (0, react_1.useState)([]);
    const [hasFetchedMap, setHasFetchedMap] = (0, react_1.useState)(false);
    const [zLayer, setZLayer] = (0, react_1.useState)(0);
    const [economyMap, setEconomyMap] = (0, react_1.useState)({});
    const [factionMap, setFactionMap] = (0, react_1.useState)({});
    const [selectedCell, setSelectedCell] = (0, react_1.useState)(null);
    const [isPlaying, setIsPlaying] = (0, react_1.useState)(false);
    const [viewMode, setViewMode] = (0, react_1.useState)("Political");
    const intervalRef = (0, react_1.useRef)(null);
    const fetchState = (0, react_1.useCallback)(async () => {
        if (!hasFetchedMap) {
            const mapRes = await fetch(`/api/observer/map?z=${zLayer}`);
            if (mapRes.ok) {
                const mapData = await mapRes.json();
                setCells(mapData.cells || []);
                setHasFetchedMap(true);
            }
        }
        try {
            const res = await fetch(`/api/observer/state?z=${zLayer}`);
            if (!res.ok)
                return;
            const data = await res.json();
            setState(data);
            const fm = {};
            (data.factions || []).forEach((f) => { fm[f.id] = f; });
            setFactionMap(fm);
            const em = {};
            (data.economy || []).forEach((e) => { em[e.cell_id] = e; });
            setEconomyMap(em);
        }
        catch (e) {
            console.error("Fetch state error:", e);
        }
    }, [zLayer, hasFetchedMap]);
    (0, react_1.useEffect)(() => { fetchState(); }, [fetchState]);
    (0, react_1.useEffect)(() => {
        let active = true;
        let timerId = null;
        async function tickLoop() {
            if (!active || !isPlaying)
                return;
            try {
                const r = await fetch("/api/observer/tick", { method: "POST" });
                if (r.status !== 429) {
                    await fetchState();
                }
            }
            catch (e) {
                console.error("Tick error:", e);
            }
            if (active && isPlaying) {
                // Schedule the next tick slightly after this one finishes
                timerId = setTimeout(tickLoop, 500);
            }
        }
        if (isPlaying) {
            tickLoop();
        }
        return () => {
            active = false;
            if (timerId)
                clearTimeout(timerId);
        };
    }, [isPlaying, fetchState]);
    const cal = state?.calendar;
    const seasonName = cal ? SEASONS[(cal.month - 1) % 8] : "-";
    if (!state)
        return (0, jsx_runtime_1.jsx)("div", { style: { color: 'white', padding: 20 }, children: "Loading Simulation..." });
    return ((0, jsx_runtime_1.jsxs)("div", { style: { fontFamily: "'Segoe UI', sans-serif", background: "#0d1117", color: "#e6edf3", height: "100vh", display: "flex", flexDirection: "column" }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "16px", padding: "10px 20px", background: "#010409", borderBottom: "1px solid #30363d", flexWrap: "wrap" }, children: [(0, jsx_runtime_1.jsx)("span", { style: { fontWeight: 700, fontSize: "15px", color: "#58a6ff" }, children: "World Observer" }), (0, jsx_runtime_1.jsx)("span", { style: { color: "#888", fontSize: "13px", marginLeft: "20px" }, children: cal ? `${seasonName}, Year ${cal.year} - Tick ${cal.tick}` : "Awaiting first tick..." }), state?.tickInProgress && (0, jsx_runtime_1.jsx)("span", { style: { color: "#ff6b35", fontSize: "12px", fontStyle: "italic" }, children: "Tick running..." }), (0, jsx_runtime_1.jsxs)("div", { style: { marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }, children: [(0, jsx_runtime_1.jsx)("select", { value: viewMode, onChange: (e) => setViewMode(e.target.value), style: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "4px", padding: "4px 8px" }, children: ["Political", "Biome", "Ecology", "Unrest"].map(m => (0, jsx_runtime_1.jsxs)("option", { value: m, children: [m, " View"] }, m)) }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setIsPlaying(!isPlaying), style: { padding: "4px 12px", background: isPlaying ? "#da3633" : "#238636", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }, children: isPlaying ? "STOP" : "PLAY" })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: "flex", flex: 1, overflow: "hidden" }, children: [(0, jsx_runtime_1.jsx)("div", { style: { width: "300px", borderRight: "1px solid #30363d", overflowY: "auto", background: "#0d1117" }, children: (0, jsx_runtime_1.jsx)(FactionPanel, { state: state, economy: state.economy || [] }) }), (0, jsx_runtime_1.jsx)("div", { style: { flex: 1, position: 'relative' }, children: (0, jsx_runtime_1.jsx)(MapCanvas, { cells: cells, factions: factionMap, viewMode: viewMode, economy: economyMap, onCellClick: setSelectedCell }) }), (0, jsx_runtime_1.jsx)("div", { style: { width: "350px", borderLeft: "1px solid #30363d", background: "#161b22" }, children: (0, jsx_runtime_1.jsx)(RightPanel, { state: state, economyMap: economyMap, factionMap: factionMap, selectedCell: selectedCell }) })] })] }));
}
//# sourceMappingURL=Dashboard.js.map