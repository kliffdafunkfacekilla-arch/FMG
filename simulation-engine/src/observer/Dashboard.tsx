// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RegionMap } from "./RegionMap";

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


const BIOME_COLORS: Record<number, string> = {
  0: "#1e3a8a", // Marine
  1: "#fde047", // Hot desert
  2: "#d6d3d1", // Cold desert
  3: "#fcd34d", // Savanna
  4: "#a3e635", // Grassland
  5: "#65a30d", // Tropical seasonal forest
  6: "#4d7c0f", // Temperate deciduous forest
  7: "#166534", // Tropical rainforest
  8: "#0f766e", // Temperate rainforest
  9: "#334155", // Taiga
  10: "#94a3b8",// Tundra
  11: "#f8fafc",// Glacier
  12: "#3f6212",// Wetland
  101: "#0f172a", // Marine Dead Zone
  102: "#1e293b", // Abyssal Cold Desert
  103: "#0369a1", // Kelp Savanna
  104: "#0284c7", // Seagrass Meadow
  105: "#0ea5e9", // Seasonal Algal Forest
  106: "#38bdf8", // Temperate Coral
  107: "#06b6d4", // Tropical Coral
  108: "#0891b2", // Temperate Deep Reef
  109: "#1e3a8a", // Pelagic Taiga
  110: "#312e81", // Arctic Ocean
  111: "#e2e8f0", // Pack Ice
  112: "#14b8a6", // Estuary
};

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

  return <canvas ref={canvasRef} width={800} height={600} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "#000", display: "block" }} />;
}

// ─── Event Feed ─────────────────────────────────────────────────────────────



function EventFeed({ events }: { events: SimEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const getLayerColor = (type: string) => {
    if (type.startsWith("WEATHER")) return "#4a9eff"; // Blue
    if (type === "ECONOMIC_CRASH") return "#f87171"; // Red
    if (type === "TRADE_BOOM") return "#4ade80"; // Green
    if (type === "ECOLOGY_SHIFT") return "#34d399"; // Emerald
    if (type === "DIPLOMACY_CHANGE") return "#fbbf24"; // Amber
    if (type === "WAR_CLASH") return "#ef4444"; // Strong Red
    if (type === "CHAOS_SURGE") return "#a855f7"; // Purple
    return "#888";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "20px" }}>
      {events.map((e) => {
        const borderColor = getLayerColor(e.type);
        return (
          <div key={e.id} style={{ 
            background: "#161b22", 
            borderLeft: `4px solid ${borderColor}`,
            padding: "10px 12px", 
            borderRadius: "4px",
            fontSize: "13px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", alignItems: "center" }}>
              <div style={{ color: "#888", fontSize: "11px", fontWeight: "bold" }}>
                Tick {e.tick} - {e.lore_date}
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



function FactionsPanel({ state }: { state: ObserverState | null }) {
  if (!state) return null;

  return (
    <div style={{ fontSize: "13px", color: "#ccc" }}>
      <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>State Factions</h3>
      {state.factions.map(f => (
        <div key={`fac-${f.id}`} style={{ marginBottom: "8px", padding: "8px", background: "#21262d", borderRadius: "4px", borderLeft: `4px solid ${f.color}` }}>
          <div style={{ fontWeight: "bold", color: "#fff" }}>{f.name}</div>
        </div>
      ))}

      <h3 style={{ margin: "20px 0 10px 0", color: "#fff" }}>Fringe Factions</h3>
      {(state.fringeFactions || []).map(f => (
        <div key={`fringe-${f.id}`} style={{ marginBottom: "8px", padding: "8px", background: "#21262d", borderRadius: "4px", borderLeft: `4px solid #a855f7` }}>
          <div style={{ fontWeight: "bold", color: "#fff", display: "flex", justifyContent: "space-between" }}>
            <span>{f.name}</span>
            <span style={{ color: "#fbbf24" }}>{f.wealth} W</span>
          </div>
          <div style={{ color: "#8b949e", fontSize: "11px", marginTop: "4px" }}>{f.type}</div>
        </div>
      ))}
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
  let burg = economyMap[selectedCell || -1];
  if (burg) {
    burg = { ...burg };
    if (typeof burg.military_forces === 'string') {
      try { burg.military_forces = JSON.parse(burg.military_forces); } catch(e) {}
    }
    if (typeof burg.demographics === 'string') {
      try { burg.demographics = JSON.parse(burg.demographics); } catch(e) {}
    }
  }
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
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resetting, setResetting] = useState(false);
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
          <span style={{ color: "#888", fontSize: "13px", marginLeft: "20px" }}>
            {cal ? `${seasonName}, Year ${cal.year} - Tick ${cal.tick}` : "Awaiting first tick..."}
          </span>
          {state?.tickInProgress && <span style={{ color: "#ff6b35", fontSize: "12px", fontStyle: "italic" }}>Tick running...</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
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
            <button onClick={async () => {
              if (!confirm("Reset the world to Tick 1? All simulated history will be lost.")) return;
              setIsPlaying(false);
              setResetting(true);
              await fetch("/api/observer/reset", { method: "POST" });
              setResetting(false);
              await fetchState();
            }} disabled={resetting} style={{ background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: "4px", padding: "5px 12px", cursor: "pointer", fontSize: "13px", opacity: resetting ? 0.5 : 1 }}>
              {resetting ? "Resetting..." : "Reset World"}
            </button>
          </div>
      </div>

      <div style={{ display: "flex", flexDirection: "row", flex: 1, overflow: "hidden" }}>
        
        {/* Left Panel: Factions */}
        <div style={{ flex: "0 0 300px", borderRight: "1px solid #30363d", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #30363d", fontWeight: "bold", color: "#58a6ff", fontSize: "12px", letterSpacing: "0.05em" }}>FACTIONS OVERVIEW</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", background: "#0d1117" }}>
            <FactionsPanel state={state} />
          </div>
        </div>

        {/* Middle Panel: Event Log */}
        <div style={{ flex: "1", borderRight: "1px solid #30363d", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #30363d", fontWeight: "bold", color: "#58a6ff", fontSize: "12px", letterSpacing: "0.05em" }}>GLOBAL EVENT LOG</div>
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", background: "#010409" }}>
            <EventFeed events={state?.events || []} />
          </div>
        </div>

        {/* Meso-Map Region Viewer */}
        <div style={{ flex: "0 0 450px", overflow: "hidden", background: "#161b22", borderRight: "1px solid #30363d" }}>
          <RegionMap />
        </div>

        {/* Right Side: Navigator Panel */}
        <div style={{ flex: "0 0 350px", overflow: "hidden", background: "#161b22" }}>
          <Navigator state={state} selectedCell={selectedCell} economyMap={economyMap} setSelectedCell={setSelectedCell} />
        </div>
      </div>
    </div>
  );
}
