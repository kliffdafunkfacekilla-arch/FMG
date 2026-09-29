// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from "react";

interface Faction {
  id: number;
  name: string;
  color: string;
  wealth?: number;
}

interface FringeFaction {
  id: number;
  name: string;
  type: string;
  wealth?: number;
}

interface Cell {
  id: number;
  faction_id: number | null;
  biome: number;
  geometry: any;
  eco_plants: number;
  eco_prey: number;
  eco_predators: number; elevation: number;
}

interface SimEvent {
  id: number;
  tick: number;
  type: string;
  message: string;
  tier: string;
  lore_date: string;
  burg_id: number | null;
  faction_id: number | null;
  z_layer: number;
}

interface ObserverState {
  factions: Faction[];
  fringeFactions: FringeFaction[];
  cells: Cell[];
  events: SimEvent[];
  calendar: any;
  tickInProgress: boolean;
}

type ViewMode = "Biome" | "Political" | "Ecology" | "Unrest";

const SEASONS = ['The Thaw', 'The Bloom', 'The Zenith', 'The Wilt', 'The Fall', 'The Chill', 'The Rime', 'Shadow Week'];


function MapCanvas({
  cells,
  factions,
  viewMode,
  economy,
  onCellClick,
}: {
  cells: Cell[];
  factions: Record<number, Faction>;
  viewMode: ViewMode;
  economy: Record<number, any>;
  onCellClick: (id: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Fix stretching by matching internal resolution to CSS size
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cells.forEach((cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      cell.geometry.coordinates[0].forEach(([x, y]: any) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
    });
    if (minX === Infinity) return;

    const pad = 10;
    const scaleX = (canvas.width - pad * 2) / (maxX - minX);
    const scaleY = (canvas.height - pad * 2) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);
    const offX = pad - minX * scale;
    const offY = pad - minY * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    cells.forEach((cell) => {
      if (!cell.geometry?.coordinates?.[0]) return;
      const coords = cell.geometry.coordinates[0];

      if (viewMode === "Biome") {
        ctx.fillStyle = BIOME_COLORS[cell.biome] || "#222";
      } else if (viewMode === "Political") {
        const f = cell.faction_id ? factions[cell.faction_id] : null;
        ctx.fillStyle = f ? f.color + "cc" : "#1e2a1e";
      } else if (viewMode === "Ecology") {
        const total = (cell.eco_plants || 0) + (cell.eco_prey || 0) + (cell.eco_predators || 0);
        const ratio = Math.min(1, total / 120);
        const r = Math.floor(20 + ratio * 60);
        const g = Math.floor(40 + ratio * 140);
        const b = Math.floor(20 + ratio * 30);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        const eco = economy[cell.id];
        const unrest = eco?.unrest ?? 0;
        const hue = Math.max(0, 120 - unrest * 1.2);
        ctx.fillStyle = `hsla(${hue},90%,40%,0.85)`;
      }
      
      ctx.beginPath();
      coords.forEach(([x, y], i) => {
        const cx = x * scale + offX;
        const cy = y * scale + offY;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff08";
      ctx.lineWidth = 0.3;
              ctx.stroke();

        if (cell.elevation && cell.elevation >= 70 && String(cell.biome) !== "301") {
          ctx.fillStyle = 
"#ffffff";
          ctx.beginPath();
          let pX = 0, pY = 0;
          coords.forEach(p => { pX += p[0]; pY += p[1]; });
          pX = (pX / coords.length) * scale + offX;
          pY = (pY / coords.length) * scale + offY;
          ctx.moveTo(pX, pY - 10);
          ctx.lineTo(pX + 8, pY + 8);
          ctx.lineTo(pX - 8, pY + 8);
          ctx.fill(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
        }

      if (economy[cell.id]) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        const cx = (coords[0][0] as number) * scale + offX;
        const cy = (coords[0][1] as number) * scale + offY;
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
      }
    });

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      let bestCell = null;
      let minDist = Infinity;

      cells.forEach((cell) => {
        if (!cell.geometry?.coordinates?.[0]) return;
        const pt = cell.geometry.coordinates[0][0];
        const cx = (pt[0] as number) * scale + offX;
        const cy = (pt[1] as number) * scale + offY;
        const dist = (cx - mx) ** 2 + (cy - my) ** 2;
        if (dist < minDist && dist < 100) {
          minDist = dist;
          bestCell = cell.id;
        }
      });
      if (bestCell) onCellClick(bestCell);
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [cells, factions, viewMode, economy, onCellClick]);

  return <canvas ref={canvasRef} width={800} height={600} style={{ width: "100%", height: "100%", background: "#000" }} />;
}

// ─── Event Feed ─────────────────────────────────────────────────────────────

function EventFeed({ events }: { events: SimEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (!events || events.length === 0) return <div style={{ color: "#666" }}>No events yet.</div>;
  
  const getLayerColor = (type: string) => {
    switch (type?.toUpperCase()) {
      case "GEOLOGICAL": return "#8b7355"; // Brown
      case "METEOROLOGICAL": return "#87ceeb"; // Sky blue
      case "ECOLOGICAL": return "#4caf50"; // Green
      case "POLITICAL": return "#9c27b0"; // Purple
      case "SOCIAL": return "#ff9800"; // Orange
      case "ECONOMICAL": return "#ffd700"; // Gold
      case "COSMOLOGICAL": return "#3f51b5"; // Indigo
      case "MAGICAL": return "#e91e63"; // Pink
      case "COMBAT": return "#ff4444"; // Red
      default: return "#79c0ff"; // Default light blue
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {events.map((e) => {
        let borderColor = getLayerColor(e.type);
        let bg = e.tier === "MAJOR" ? "#302222" : "#21262d";
        return (
          <div key={e.id} style={{ 
            padding: "8px 12px", 
            background: bg, 
            borderRadius: "4px", 
            fontSize: "13px", 
            borderLeft: `4px solid ${borderColor}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#aaa", fontSize: "10px", background: "#333", padding: "2px 4px", borderRadius: "3px" }}>Z: {e.z_layer || 0}</span>
              <div style={{ color: "#888", fontSize: "11px", fontWeight: "bold" }}>
                Tick {e.tick} — {e.lore_date}
              </div>
              <div style={{ 
                background: borderColor + "22", 
                color: borderColor, 
                padding: "2px 6px", 
                borderRadius: "3px", 
                fontSize: "10px", 
                fontWeight: "bold",
                textTransform: "uppercase",
                border: `1px solid ${borderColor}55`
              }}>
                {e.type || "SYSTEM"}
              </div>
            </div>
            <div style={{ color: "#e6edf3", lineHeight: "1.4" }}>{e.message}</div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}


function Navigator({
  state,
  selectedCell,
  economyMap,
  setSelectedCell,
}: {
  state: ObserverState | null;
  selectedCell: number | null;
  economyMap: Record<number, any>;
  setSelectedCell: (id: number) => void;
}) {
  if (!state) return <div style={{ padding: "12px" }}>Loading...</div>;

  const burgs = Object.values(economyMap).sort((a, b) => a.burg_id - b.burg_id);
  const burg = economyMap[selectedCell || -1];
  const cell = burg ? state.cells.find(c => c.id === burg.cell_id) : null;
  const faction = cell ? state.factions.find(f => f.id === cell.faction_id) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#161b22" }}>
      <div style={{ padding: "12px", borderBottom: "1px solid #30363d", background: "#21262d" }}>
        <div style={{ fontWeight: "bold", color: "#58a6ff", fontSize: "12px", letterSpacing: "0.05em", marginBottom: "8px" }}>BURG INSPECTOR</div>
        <select 
          value={selectedCell || ""} 
          onChange={(e) => setSelectedCell(Number(e.target.value))}
          style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "4px", padding: "6px" }}
        >
          <option value="">-- Select a Burg --</option>
          {burgs.map((b: any) => (
            <option key={b.cell_id} value={b.cell_id}>Burg {b.burg_id} (Cell {b.cell_id})</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px", fontSize: "13px", color: "#ccc" }}>
        {!burg ? (
          <div style={{ color: "#888", textAlign: "center", marginTop: "20px" }}>Select a Burg to view stats.</div>
        ) : (
          <div>
            <h3 style={{ color: "#fff", margin: "0 0 10px 0" }}>Burg {burg.burg_id}</h3>
            <div><strong>Cell ID:</strong> {burg.cell_id}</div>
            <div><strong>Faction:</strong> {faction ? faction.name : "None"}</div>
            <div><strong>Biome ID:</strong> {cell?.biome}</div>
            <hr style={{ borderColor: "#30363d", margin: "10px 0" }} />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div><strong>Population:</strong> {burg.pop_null}</div>
              <div><strong>Wealth:</strong> {burg.wealth}</div>
              <div><strong>Food:</strong> {burg.food}</div>
              <div><strong>Health:</strong> {burg.health}</div>
              <div><strong>Unrest:</strong> {burg.unrest}</div>
            </div>
            
            <hr style={{ borderColor: "#30363d", margin: "10px 0" }} />
            <strong style={{ color: "#fbbf24", display: "block", marginBottom: "4px" }}>Military:</strong>
            {burg.military_forces && Object.keys(burg.military_forces).length > 0 ? (
               <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {Object.entries(burg.military_forces).map(([type, count]) => (
                  <span key={type} style={{ background: "#333", padding: "2px 6px", borderRadius: "10px", fontSize: "11px", color: "#ff8c00" }}>
                    {type}: {String(count)}
                  </span>
                ))}
               </div>
            ) : <span style={{color: '#888'}}>None</span>}

            <hr style={{ borderColor: "#30363d", margin: "10px 0" }} />
            <strong style={{ color: "#fbbf24", display: "block", marginBottom: "4px" }}>Demographics:</strong>
            {burg.demographics && Object.keys(burg.demographics).length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {Object.entries(burg.demographics).map(([species, count]) => (
                  <span key={species} style={{ background: "#333", padding: "2px 6px", borderRadius: "10px", fontSize: "11px" }}>
                    {species}: {String(count)}
                  </span>
                ))}
              </div>
            ) : <span style={{color: '#888'}}>None</span>}
          </div>
        )}
      </div>
    </div>
  );
}



export function Dashboard() {
  const [state, setState] = useState<ObserverState | null>(null);
  const [zLayer, setZLayer] = useState<number>(0);
  const [economyMap, setEconomyMap] = useState<Record<number, any>>({});
  const [factionMap, setFactionMap] = useState<Record<number, Faction>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("Biome");
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tickSpeed, setTickSpeed] = useState(3000);
  const intervalRef = useRef<any>(null);

  const fetchState = useCallback(async () => {
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
  }, [zLayer]);

  useEffect(() => { fetchState(); }, [fetchState]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;
    intervalRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/observer/tick", { method: "POST" });
        if (r.status === 429) return; 
        await fetchState();
      } catch (e) {
        console.error("Tick error:", e);
      }
    }, tickSpeed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, tickSpeed, fetchState]);

  const cal = state?.calendar;
  const seasonName = cal ? SEASONS[(cal.month - 1) % 8] : "-";

  return (
    <div style={{
      fontFamily: "'Segoe UI', sans-serif",
      background: "#0d1117",
      color: "#e6edf3",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "10px 20px",
        background: "#010409",
        borderBottom: "1px solid #30363d",
        flexWrap: "wrap",
      }}>
        <span style={{ fontWeight: 700, fontSize: "15px", color: "#58a6ff" }}>World Observer</span>
          <span style={{ color: "#fff", marginLeft: "10px", paddingLeft: "10px", borderLeft: "1px solid #444" }}>Layer:</span>
          <button onClick={() => setZLayer(1)} style={{ background: zLayer === 1 ? "#4a9eff" : "#21262d", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>Z: +1 (Aerial)</button>
          <button onClick={() => setZLayer(0)} style={{ background: zLayer === 0 ? "#4a9eff" : "#21262d", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>Z: 0 (Surface)</button>
          <button onClick={() => setZLayer(-1)} style={{ background: zLayer === -1 ? "#4a9eff" : "#21262d", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>Z: -1 (Sub-Layer)</button>

        <span style={{ color: "#888", fontSize: "13px" }}>
          {cal ? `${seasonName}, Year ${cal.year} - Tick ${cal.tick}` : "Awaiting first tick..."}
        </span>
        {state?.tickInProgress && <span style={{ color: "#ff6b35", fontSize: "12px", fontStyle: "italic" }}>Tick running...</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)} style={{ background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}>
            <option value="Biome">Biome Map</option>
            <option value="Political">Political Map</option>
            <option value="Ecology">Ecology Layer</option>
            <option value="Unrest">Unrest Heatmap</option>
          </select>
          <select value={tickSpeed} onChange={(e) => setTickSpeed(Number(e.target.value))} style={{ background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}>
            <option value={1000}>1s / tick</option>
            <option value={3000}>3s / tick</option>
            <option value={10000}>10s / tick</option>
          </select>
          <button onClick={() => setIsPlaying((p) => !p)} style={{ background: isPlaying ? "#b91c1c" : "#166534", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 16px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={async () => { await fetch("/api/observer/tick", { method: "POST" }); await fetchState(); }} style={{ background: "#1f3a5f", color: "#4a9eff", border: "1px solid #4a9eff44", borderRadius: "4px", padding: "5px 12px", cursor: "pointer", fontSize: "13px" }}>
            Step
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "row", flex: 1, overflow: "hidden" }}>
        
        {/* Left Side: Navigator Panel */}
        <div style={{ flex: "0 0 320px", borderRight: "1px solid #30363d", overflow: "hidden" }}>
          <Navigator state={state} selectedCell={selectedCell} economyMap={economyMap} setSelectedCell={setSelectedCell} />
        </div>

        {/* Right Side: Map & Event Log */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Map Row */}
          <div style={{ flex: "1", padding: "12px", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ flex: 1, border: "1px solid #30363d", borderRadius: "6px", overflow: "hidden", background: "#000" }}>
              <MapCanvas cells={state?.cells || []} factions={factionMap} viewMode={viewMode} economy={economyMap} onCellClick={setSelectedCell} />
            </div>
          </div>

          {/* Bottom Panel (Event Log) */}
          <div style={{ flex: "0 0 30%", borderTop: "1px solid #30363d", background: "#0d1117", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #30363d", fontWeight: "bold", color: "#58a6ff", fontSize: "12px", letterSpacing: "0.05em" }}>EVENT LOG</div>
            <div style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
              <EventFeed events={state?.events || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
