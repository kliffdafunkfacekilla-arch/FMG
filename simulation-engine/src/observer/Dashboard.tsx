import React, { useState, useEffect, useRef, useCallback } from "react";
import { RegionMap } from "./RegionMap";

interface Faction {
  id: number;
  name: string;
  color: string;
  wealth?: number;
}
interface FringeFaction { id: number; name: string; type: string; wealth?: number; }
interface Cell {
  id: number; faction_id: number | null; biome: number; geometry: any;
  eco_plants: number; eco_prey: number; eco_predators: number; elevation: number;
}
interface SimEvent {
  id: number; tick: number; type: string; message: string; tier: string;
  lore_date: string; burg_id: number | null; faction_id: number | null; z_layer: number;
}
interface ObserverState {
  factions: Faction[]; fringeFactions: FringeFaction[]; cells: Cell[];
  events: SimEvent[]; calendar: any; tickInProgress: boolean; economy: any[];
}
type ViewMode = "Biome" | "Political" | "Ecology" | "Unrest";

const BIOME_COLORS: Record<number, string> = {
  0: "#1e3a8a", 1: "#fde047", 2: "#d6d3d1", 3: "#fcd34d", 4: "#a3e635", 5: "#65a30d",
  6: "#4d7c0f", 7: "#166534", 8: "#0f766e", 9: "#334155", 10: "#94a3b8", 11: "#f8fafc",
  12: "#3f6212", 101: "#0f172a", 102: "#1e293b", 103: "#0369a1", 104: "#0284c7",
  105: "#0ea5e9", 106: "#38bdf8", 107: "#06b6d4", 108: "#0891b2", 109: "#1e3a8a",
  110: "#312e81", 111: "#e2e8f0", 112: "#14b8a6",
};

const SEASONS = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime', 'Shadow Week'];

function MapCanvas({ cells, factions, viewMode, economy, onCellClick }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const bounds = useRef({ minX: 0, maxX: 100, minY: 0, maxY: 100, baseScale: 1, baseOffX: 0, baseOffY: 0 });

  // Compute bounds once
  useEffect(() => {
    if (!cells || cells.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cells.forEach((cell: Cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      cell.geometry.coordinates[0].forEach(([x, y]: any) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
    });
    if (minX === Infinity) return;
    bounds.current = { minX, maxX, minY, maxY, baseScale: 1, baseOffX: 0, baseOffY: 0 };
  }, [cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
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
    ctx.translate(canvas.width/2 + offset.x, canvas.height/2 + offset.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width/2, -canvas.height/2);

    cells.forEach((cell: Cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      const coords = cell.geometry.coordinates[0];

      if (cell.elevation < 20) { ctx.fillStyle = "#0c182b"; } 
      else if (viewMode === "Biome") { ctx.fillStyle = BIOME_COLORS[cell.biome] || "#222"; } 
      else if (viewMode === "Political") {
        const actualFactionId = economy[cell.id]?.faction_id || cell.faction_id;
        const f = actualFactionId ? factions[actualFactionId] : null;
        ctx.fillStyle = f ? f.color + "cc" : "#1e2a1e";
      } else if (viewMode === "Ecology") {
        const total = (cell.eco_plants || 0) + (cell.eco_prey || 0) + (cell.eco_predators || 0);
        const ratio = Math.min(1, total / 120);
        const r = Math.floor(20 + ratio * 60), g = Math.floor(40 + ratio * 140), b = Math.floor(20 + ratio * 30);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        const eco = economy[cell.id];
        const unrest = eco?.unrest ?? 0;
        const hue = Math.max(0, 120 - unrest * 1.2);
        ctx.fillStyle = `hsla(${hue},90%,40%,0.85)`;
      }
      
      ctx.beginPath();
      coords.forEach(([x, y]: any, i: number) => {
        const cx = x * baseScale + bounds.current.baseOffX;
        const cy = y * baseScale + bounds.current.baseOffY;
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      });
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ffffff08"; ctx.lineWidth = 0.5 / zoom; ctx.stroke();

      if (cell.elevation && cell.elevation >= 70 && String(cell.biome) !== "301") {
          ctx.fillStyle = "#ffffff"; ctx.beginPath();
          let pX = 0, pY = 0;
          coords.forEach((p: any) => { pX += p[0]; pY += p[1]; });
          pX = (pX / coords.length) * baseScale + bounds.current.baseOffX;
          pY = (pY / coords.length) * baseScale + bounds.current.baseOffY;
          ctx.moveTo(pX, pY - 8/zoom);
          ctx.lineTo(pX + 6/zoom, pY + 6/zoom);
          ctx.lineTo(pX - 6/zoom, pY + 6/zoom);
          ctx.fill(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 0.5/zoom; ctx.stroke();
      }

      if (economy[cell.id]) {
        ctx.fillStyle = "#fff"; ctx.beginPath();
        const cx = (coords[0][0]) * baseScale + bounds.current.baseOffX;
        const cy = (coords[0][1]) * baseScale + bounds.current.baseOffY;
        ctx.arc(cx, cy, 2/zoom, 0, Math.PI * 2);
        ctx.fill(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 0.5/zoom; ctx.stroke();
      }
    });
    ctx.restore();
  }, [cells, factions, viewMode, economy, zoom, offset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.max(0.5, Math.min(10, z * factor)));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // inverse transform
    let mx = e.clientX - rect.left;
    let my = e.clientY - rect.top;
    mx -= canvas.width/2 + offset.x; my -= canvas.height/2 + offset.y;
    mx /= zoom; my /= zoom;
    mx += canvas.width/2; my += canvas.height/2;

    let bestCell = null;
    let minDist = Infinity;
    cells.forEach((cell: Cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      const pt = cell.geometry.coordinates[0][0];
      const cx = (pt[0]) * bounds.current.baseScale + bounds.current.baseOffX;
      const cy = (pt[1]) * bounds.current.baseScale + bounds.current.baseOffY;
      const dist = (cx - mx) ** 2 + (cy - my) ** 2;
      if (dist < minDist && dist < 100 / (zoom*zoom)) {
        minDist = dist; bestCell = cell.id;
      }
    });
    if (bestCell) onCellClick(bestCell);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <canvas 
            ref={canvasRef} 
            style={{ width: '100%', height: '100%', display: "block", cursor: isDragging.current ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onClick={handleClick}
        />
        <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', padding: '5px', borderRadius: '4px', color: '#fff' }}>
            Zoom: {zoom.toFixed(1)}x
        </div>
    </div>
  );
}

function FactionPanel({ state, economy, cells }: { state: ObserverState, economy: any[], cells: any[] }) {
    if (!state.factions || state.factions.length === 0) return <div style={{padding: '20px', color: '#888'}}>No factions data.</div>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
            <h3 style={{ color: '#58a6ff', margin: 0, paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>Global Factions</h3>
            {state.factions.map(f => {
                const myBurgs = economy.filter(b => b.faction_id === f.id);
                const pop = myBurgs.reduce((sum, b) => sum + (b.pop_null||0), 0);
                const wealth = myBurgs.reduce((sum, b) => sum + (b.wealth||0), 0);
                return (
                    <div key={f.id} style={{ background: '#21262d', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${f.color}` }}>
                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{f.name}</div>
                        <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                            <div>Burgs: {myBurgs.length}</div>
                            <div>Pop: {pop.toLocaleString()}</div>
                            <div>Wealth: {wealth.toLocaleString()}</div>
                        </div>
                    </div>
                );
            })}
            {state.fringeFactions && state.fringeFactions.length > 0 && (
                <>
                    <h3 style={{ color: '#ff7b72', margin: '10px 0 0 0', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>Fringe Factions</h3>
                    {state.fringeFactions.map(ff => (
                        <div key={ff.id} style={{ background: '#2d2121', padding: '10px', borderRadius: '6px', borderLeft: `4px solid #ff7b72` }}>
                            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{ff.name} <span style={{fontSize: '10px', color: '#aaa'}}>({ff.type})</span></div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

function RightPanel({ state, economyMap, factionMap, selectedCell, cells }: { state: ObserverState, economyMap: any, factionMap: any, selectedCell: number | null, cells: any[] }) {
    const [tab, setTab] = useState<'Burg'|'Events'|'Render'>('Burg');
    
    let burg: any = null; let cell: any = null; let faction: any = null;
    if (selectedCell) {
        burg = economyMap[selectedCell];
        cell = cells.find(c => c.id === selectedCell);
        faction = cell ? factionMap[economyMap[selectedCell]?.faction_id || cell.faction_id] : null;
        if (burg && typeof burg.military_forces === 'string') try { burg.military_forces = JSON.parse(burg.military_forces); } catch(e){}
        if (burg && typeof burg.demographics === 'string') try { burg.demographics = JSON.parse(burg.demographics); } catch(e){}
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#161b22' }}>
            <div style={{ display: 'flex', background: '#010409', borderBottom: '1px solid #30363d' }}>
                {['Burg', 'Events', 'Render'].map(t => (
                    <div key={t} onClick={() => setTab(t as any)} style={{ 
                        flex: 1, padding: '10px', textAlign: 'center', cursor: 'pointer', fontSize: '13px',
                        borderBottom: tab === t ? '2px solid #58a6ff' : '2px solid transparent',
                        color: tab === t ? '#fff' : '#8b949e', fontWeight: tab === t ? 'bold' : 'normal'
                    }}>
                        {t}
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {tab === 'Burg' && (
                    <div style={{ fontSize: '13px', color: '#ccc' }}>
                        {!burg ? <div style={{ color: '#888', textAlign: 'center' }}>Select a Burg on the map.</div> : (
                            <div>
                                <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>Burg {burg.burg_id}</h3>
                                <div><strong>Cell ID:</strong> {burg.cell_id}</div>
                                <div><strong>Faction:</strong> {faction ? faction.name : 'None'}</div>
                                <div><strong>Biome ID:</strong> {cell?.biome}</div>
                                <hr style={{ borderColor: '#30363d', margin: '10px 0' }} />
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div><strong>Population:</strong> {burg.pop_null}</div>
                                <div><strong>Wealth:</strong> {burg.wealth}</div>
                                <div><strong>Food:</strong> {burg.food}</div>
                                <div><strong>Health:</strong> {burg.health}</div>
                                <div><strong>Unrest:</strong> {burg.unrest}</div>
                                <div><strong>Tier:</strong> {burg.urban_tier || 1}</div>
                                </div>
                                
                                <hr style={{ borderColor: '#30363d', margin: '10px 0' }} />
                                <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '4px' }}>Military:</strong>
                                {burg.military_forces && Object.keys(burg.military_forces).length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {Object.entries(burg.military_forces).map(([type, count]) => (
                                        <span key={type} style={{ background: '#333', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', color: '#ff8c00' }}>
                                        {type}: {String(count)}
                                        </span>
                                    ))}
                                    </div>
                                ) : <span style={{color: '#888'}}>None</span>}

                                <hr style={{ borderColor: '#30363d', margin: '10px 0' }} />
                                <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '4px' }}>Demographics:</strong>
                                {burg.demographics && Object.keys(burg.demographics).length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {Object.entries(burg.demographics).map(([species, count]) => (
                                        <span key={species} style={{ background: '#333', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>
                                        {species}: {String(count)}
                                        </span>
                                    ))}
                                    </div>
                                ) : <span style={{color: '#888'}}>None</span>}
                            </div>
                        )}
                    </div>
                )}
                {tab === 'Events' && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(state.events || []).filter(e => !["CHAOS_STORM", "MERCY_ALIGNMENT", "LUNAR_HEMORRHAGE", "NIGHTMARE_ASCENDANT"].includes(e.type)).map((e) => {
                            const isMajor = e.tier === "MAJOR";
                            return (
                                <div key={e.id} style={{
                                    padding: "8px", background: isMajor ? "#2d2121" : "#1f2937",
                                    borderLeft: `4px solid ${isMajor ? "#ff7b72" : "#58a6ff"}`, borderRadius: "4px", fontSize: "12px",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", color: "#8b949e", marginBottom: "4px", fontSize: "10px" }}>
                                        <span>Tick {e.tick} ({e.lore_date})</span>
                                        <span style={{ fontWeight: "bold" }}>{e.type}</span>
                                    </div>
                                    <div style={{ color: "#e6edf3", lineHeight: 1.4 }}>{e.message}</div>
                                </div>
                            );
                        })}
                        {(state.events || []).length === 0 && <div style={{color: '#888', textAlign: 'center'}}>No events recorded.</div>}
                    </div>
                )}
                {tab === 'Render' && (
                    <div style={{ color: '#ccc', fontSize: '13px' }}>
                        <p>Region Map Render Testing</p>
                        {selectedCell ? (
                            <div style={{ border: '1px solid #30363d', borderRadius: '4px', overflow: 'hidden' }}>
                                <RegionMap cellId={selectedCell} />
                            </div>
                        ) : (
                            <div style={{ color: '#888', textAlign: 'center' }}>Select a cell on the map to test its region render.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function Dashboard() {
  const [state, setState] = useState<ObserverState | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [hasFetchedMap, setHasFetchedMap] = useState(false);
  const [zLayer, setZLayer] = useState<number>(0);
  const [economyMap, setEconomyMap] = useState<Record<number, any>>({});
  const [factionMap, setFactionMap] = useState<Record<number, Faction>>({});
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("Political");
  const intervalRef = useRef<any>(null);

  const fetchState = useCallback(async () => {
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
        if (!res.ok) return;
        const data = await res.json();
        setState(data);
        const fm: Record<number, Faction> = {};
        (data.factions || []).forEach((f: Faction) => { fm[f.id] = f; });
        setFactionMap(fm);
        const em: Record<number, any> = {};
        (data.economy || []).forEach((e: any) => { em[e.cell_id] = e; });
        setEconomyMap(em);
      } catch (e) {
        console.error("Fetch state error:", e);
      }
  }, [zLayer, hasFetchedMap]);

  useEffect(() => { fetchState(); }, [fetchState]);

  
  // Polling loop for state
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    async function poll() {
      if (!active) return;
      await fetchState();
      if (active) timerId = setTimeout(poll, 1500);
    }
    
    poll();

    // Also fetch initial autoplay state
    fetch("/api/observer/autoplay").then(r => r.json()).then(d => {
        if (active) setIsPlaying(d.autoplay);
    }).catch(()=>{});

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [fetchState]);

  const togglePlay = async () => {
      const nextState = !isPlaying;
      setIsPlaying(nextState);
      await fetch("/api/observer/autoplay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextState })
      });
  };


  const cal = state?.calendar;
  const seasonName = cal ? SEASONS[(cal.month - 1) % 8] : "-";

  if (!state) return <div style={{ color: 'white', padding: 20 }}>Loading Simulation...</div>;

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0d1117", color: "#e6edf3", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 20px", background: "#010409", borderBottom: "1px solid #30363d", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: "15px", color: "#58a6ff" }}>World Observer</span>
        <span style={{ color: "#888", fontSize: "13px", marginLeft: "20px" }}>
            {cal ? `${seasonName}, Year ${cal.year} - Tick ${cal.tick}` : "Awaiting first tick..."}
        </span>
        {state?.tickInProgress && <span style={{ color: "#ff6b35", fontSize: "12px", fontStyle: "italic" }}>Tick running...</span>}
        
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)} style={{ background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "4px", padding: "4px 8px" }}>
            {["Political", "Biome", "Ecology", "Unrest"].map(m => <option key={m} value={m}>{m} View</option>)}
          </select>
          <button onClick={togglePlay} style={{ padding: "4px 12px", background: isPlaying ? "#da3633" : "#238636", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
            {isPlaying ? "STOP" : "PLAY"}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* LEFT: FACTIONS */}
          <div style={{ width: "300px", borderRight: "1px solid #30363d", overflowY: "auto", background: "#0d1117" }}>
              <FactionPanel state={state} economy={state.economy || []} cells={cells} />
          </div>

          {/* CENTER: MAP */}
          <div style={{ flex: 1, position: 'relative' }}>
              <MapCanvas cells={cells} factions={factionMap} viewMode={viewMode} economy={economyMap} onCellClick={setSelectedCell} />
          </div>

          {/* RIGHT: DETAILS & TABS */}
          <div style={{ width: "350px", borderLeft: "1px solid #30363d", background: "#161b22" }}>
              <RightPanel state={state} economyMap={economyMap} factionMap={factionMap} selectedCell={selectedCell} cells={cells} />
          </div>
      </div>
    </div>
  );
}
