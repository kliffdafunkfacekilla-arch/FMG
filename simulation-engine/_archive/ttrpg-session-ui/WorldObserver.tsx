// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';

// Types for the mock/expected data
interface FactionStats {
  population: number;
  militaryStrength?: number;
  wealth?: number;
  traitScores?: Record<string, number>;
}

interface Faction {
  id: string;
  name: string;
  color: string;
  lore_text: string;
  stats: FactionStats;
}

interface Cell {
  id: string;
  faction_id: string | null; // which faction owns it
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // GeoJSON polygon format
  };
  sim_burg_economy?: { unrest?: number };
  sim_chaos_zones?: any;
  sim_agents?: { type: string }[];
  eco_plants?: number;
  eco_prey?: number;
  eco_predators?: number;
}

interface SimEvent {
  id: string;
  timestamp: number;
  text: string;
  relatedFactionIds?: string[];
}

interface TradeRoute {
  id: string;
  path: [number, number][];
}

interface SacredGrove {
  id: string;
  x: number;
  y: number;
  seal_strength: number;
}

interface ObserverState {
  tick: number;
  factions: Record<string, Faction>;
  cells: Cell[];
  events: SimEvent[];
  sim_trade_routes?: TradeRoute[];
  sim_sacred_groves?: SacredGrove[];
}

export function WorldObserver() {
  type ViewMode = 'Political' | 'Unrest Heatmap' | 'Chaos & Weather' | 'Ecology Trophic Layer' | 'Aether-Tech Routes' | 'Sacred Groves';

  const [isPlaying, setIsPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [factions, setFactions] = useState<Record<string, Faction>>({});
  const [cells, setCells] = useState<Cell[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [tradeRoutes, setTradeRoutes] = useState<TradeRoute[]>([]);
  const [sacredGroves, setSacredGroves] = useState<SacredGrove[]>([]);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Political');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Initial load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await fetch('/api/observer/state');
        if (res.ok) {
          const data: ObserverState = await res.json();
          const factionRecord: Record<string, Faction> = {};
          if (Array.isArray(data.factions)) {
            data.factions.forEach((f: any) => factionRecord[f.id] = f);
          } else if (data.factions) {
            Object.assign(factionRecord, data.factions);
          }
          setFactions(factionRecord);
          setCells(data.cells || []);
          setEvents(data.events || []);
          setTradeRoutes(data.sim_trade_routes || []);
          setSacredGroves(data.sim_sacred_groves || []);
          setTick(data.tick || 0);
        } else {
          console.error("Failed to fetch state:", res.status);
        }
      } catch (e) {
        console.error("Error fetching state:", e);
      }
    };
    fetchInitialData();
  }, []);

  const setupMockData = () => {
    const mockCells: Cell[] = [];
    const size = 20;
    const cols = 20;
    const rows = 15;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * size;
        const y = r * size;
        mockCells.push({
          id: `cell_${r}_${c}`,
          faction_id: null,
          geometry: {
            type: 'Polygon',
            coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]]
          },
          eco_plants: Math.random() * 50,
          eco_prey: Math.random() * 30,
          eco_predators: Math.random() * 20
        });
      }
    }

    const mockFactions: Record<string, Faction> = {
      'f1': {
        id: 'f1',
        name: 'The Red Empire',
        color: '#ff4444',
        lore_text: 'An ancient empire originating from the northern mountains.',
        stats: { population: 15000, traitScores: { aggression: 8, diplomacy: 3 } }
      },
      'f2': {
        id: 'f2',
        name: 'Blue Republic',
        color: '#4444ff',
        lore_text: 'A merchant republic focused on coastal trade.',
        stats: { population: 12000, traitScores: { aggression: 4, diplomacy: 9 } }
      }
    };

    mockCells[10].faction_id = 'f1';
    mockCells[11].faction_id = 'f1';
    mockCells[50].faction_id = 'f2';

    const mockGroves: SacredGrove[] = [
      { id: 'g1', x: 100, y: 100, seal_strength: 80 },
      { id: 'g2', x: 300, y: 200, seal_strength: 30 }
    ];
    
    const mockRoutes: TradeRoute[] = [
      { id: 'r1', path: [[50, 50], [150, 100], [250, 150], [350, 200]] }
    ];

    setCells(mockCells);
    setFactions(mockFactions);
    setTradeRoutes(mockRoutes);
    setSacredGroves(mockGroves);
    setEvents([{ id: 'e1', timestamp: 0, text: 'The world observer initialized.' }]);
  };

  // Rendering map on canvas
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      cells.forEach(c => {
        if (c.geometry && c.geometry.coordinates && c.geometry.coordinates[0]) {
          c.geometry.coordinates[0].forEach((p: any) => {
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
          });
        }
      });
      
      if (minX === Infinity) { minX = 0; maxX = 800; minY = 0; maxY = 600; }
      const mapWidth = maxX - minX;
      const mapHeight = maxY - minY;
      const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight) * 0.95;
      const offsetX = (canvas.width - mapWidth * scale) / 2 - minX * scale;
      const offsetY = (canvas.height - mapHeight * scale) / 2 - minY * scale;
      
      const transform = (x: number, y: number) => [x * scale + offsetX, y * scale + offsetY];

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (viewMode === 'Chaos & Weather') {
         ctx.fillStyle = '#050510';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (viewMode === 'Sacred Groves' || viewMode === 'Aether-Tech Routes') {
         ctx.fillStyle = '#1a1a1a';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      cells.forEach(cell => {
        ctx.beginPath();
        const coords = cell.geometry.coordinates[0];
        if (coords && coords.length > 0) {
          const [sx, sy] = transform(coords[0][0], coords[0][1]);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < coords.length; i++) {
            const [lx, ly] = transform(coords[i][0], coords[i][1]);
            ctx.lineTo(lx, ly);
          }
          ctx.closePath();

          if (viewMode === 'Political') {
            if (cell.faction_id && factions[cell.faction_id]) {
              ctx.fillStyle = factions[cell.faction_id].color;
              ctx.fill();
            }
          } else if (viewMode === 'Unrest Heatmap') {
            const unrest = cell.sim_burg_economy?.unrest || 0;
            const hue = 120 - (Math.min(100, Math.max(0, unrest)) * 1.2);
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.fill();
          } else if (viewMode === 'Ecology Trophic Layer') {
            const plants = cell.eco_plants || 0;
            const prey = cell.eco_prey || 0;
            const predators = cell.eco_predators || 0;
            const total = plants + prey + predators;
            
            // Map total to shades of deep green to brown
            const ratio = Math.min(1, Math.max(0, total / 100));
            const r = Math.floor(45 + ratio * (139 - 45));
            const g = Math.floor(76 + ratio * (90 - 76));
            const b = Math.floor(30 + ratio * (43 - 30));
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fill();
          } else if (viewMode === 'Chaos & Weather') {
            ctx.fillStyle = '#111';
            ctx.fill();
            
            if (cell.sim_chaos_zones) {
              const cellMinX = Math.min(...coords.map(p => p[0]));
              const cellMaxX = Math.max(...coords.map(p => p[0]));
              const cellMinY = Math.min(...coords.map(p => p[1]));
              const cellMaxY = Math.max(...coords.map(p => p[1]));
              const cx = (cellMinX + cellMaxX) / 2;
              const cy = (cellMinY + cellMaxY) / 2;
              const [tcx, tcy] = transform(cx, cy);

              const radius = 6 + Math.sin(Date.now() / 150) * 3;
              ctx.beginPath();
              ctx.arc(tcx, tcy, radius, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(138, 43, 226, 0.6)'; // Blue violet
              ctx.shadowColor = '#8a2be2';
              ctx.shadowBlur = 15;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          } else if (viewMode === 'Aether-Tech Routes' || viewMode === 'Sacred Groves') {
            ctx.fillStyle = '#222';
            ctx.fill();
          }
          
          if (viewMode !== 'Chaos & Weather' && viewMode !== 'Aether-Tech Routes' && viewMode !== 'Sacred Groves') {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (cell.sim_agents && cell.sim_agents.length > 0) {
            const cellMinX = Math.min(...coords.map(p => p[0]));
            const cellMaxX = Math.max(...coords.map(p => p[0]));
            const cellMinY = Math.min(...coords.map(p => p[1]));
            const cellMaxY = Math.max(...coords.map(p => p[1]));
            const cx = (cellMinX + cellMaxX) / 2;
            const cy = (cellMinY + cellMaxY) / 2;
            const [tcx, tcy] = transform(cx, cy);
            
            cell.sim_agents.forEach((agent, idx) => {
              const agentOffsetX = (idx % 2 === 0 ? 1 : -1) * (idx * 5);
              const agentOffsetY = (idx % 2 === 0 ? -1 : 1) * (idx * 5);
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              if (agent.type.includes('Pirate') || agent.type.includes('Cultist')) {
                 ctx.fillText('☠️', tcx + agentOffsetX, tcy + agentOffsetY);
              } else if (agent.type.includes('Warden')) {
                 ctx.fillText('🛡️', tcx + agentOffsetX, tcy + agentOffsetY);
              } else {
                 ctx.fillText('🔵', tcx + agentOffsetX, tcy + agentOffsetY);
              }
            });
          }
        }
      });
      
      if (viewMode === 'Aether-Tech Routes') {
        tradeRoutes.forEach(route => {
          if (!route.path || route.path.length < 2) return;
          
          let isDanger = false;
          // Check if near weakened grove
          route.path.forEach(pt => {
            sacredGroves.forEach(grove => {
              if (grove.seal_strength < 50) {
                const dist = Math.hypot(pt[0] - grove.x, pt[1] - grove.y);
                if (dist < 60) isDanger = true;
              }
            });
          });

          ctx.beginPath();
          const [sx, sy] = transform(route.path[0][0], route.path[0][1]);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < route.path.length; i++) {
            const [lx, ly] = transform(route.path[i][0], route.path[i][1]);
            ctx.lineTo(lx, ly);
          }

          if (isDanger) {
            // pulse red
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2; // 0 to 1
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + pulse * 0.5})`;
            ctx.shadowColor = 'red';
            ctx.shadowBlur = 10 + pulse * 10;
          } else {
            // bright glowing lines
            ctx.strokeStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 10;
          }
          
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        });
      }

      if (viewMode === 'Sacred Groves') {
        sacredGroves.forEach(grove => {
          const [gx, gy] = transform(grove.x, grove.y);
          ctx.beginPath();
          ctx.arc(gx, gy, 15, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
          ctx.shadowColor = 'gold';
          ctx.shadowBlur = 20;
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.font = '24px "Times New Roman"';
          ctx.fillStyle = 'gold';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Rune symbol
          ctx.fillText('🜚', gx, gy);

          // Seal strength
          ctx.font = '12px Arial';
          ctx.fillStyle = grove.seal_strength < 50 ? '#ff4444' : '#44ff44';
          ctx.fillText(`Seal: ${grove.seal_strength}`, gx, gy - 25);
        });
      }
    };

    render();
  }, [cells, factions, viewMode, tradeRoutes, sacredGroves]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cells.forEach(c => {
      if (c.geometry && c.geometry.coordinates && c.geometry.coordinates[0]) {
        c.geometry.coordinates[0].forEach((p: any) => {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        });
      }
    });
    
    if (minX === Infinity) { minX = 0; maxX = 800; minY = 0; maxY = 600; }
    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;
    const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight) * 0.95;
    const offsetX = (canvas.width - mapWidth * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - mapHeight * scale) / 2 - minY * scale;
    
    const mapX = (x - offsetX) / scale;
    const mapY = (y - offsetY) / scale;

    let clickedCell: Cell | null = null;
    for (const cell of cells) {
      const coords = cell.geometry.coordinates[0];
      if (coords && coords.length > 0) {
        const cellMinX = Math.min(...coords.map(p => p[0]));
        const cellMaxX = Math.max(...coords.map(p => p[0]));
        const cellMinY = Math.min(...coords.map(p => p[1]));
        const cellMaxY = Math.max(...coords.map(p => p[1]));
        if (mapX >= cellMinX && mapX <= cellMaxX && mapY >= cellMinY && mapY <= cellMaxY) {
          clickedCell = cell;
          break;
        }
      }
    }

    if (clickedCell && clickedCell.faction_id) {
      setSelectedFactionId(clickedCell.faction_id);
    } else {
      setSelectedFactionId(null);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPlaying) {
      intervalId = setInterval(async () => {
        try {
          await fetch('/api/observer/tick', { method: 'POST' });
          const res = await fetch('/api/observer/state');
          if (res.ok) {
            const data: ObserverState = await res.json();
            const factionRecord: Record<string, Faction> = {};
            if (Array.isArray(data.factions)) {
              data.factions.forEach((f: any) => factionRecord[f.id] = f);
            } else if (data.factions) {
              Object.assign(factionRecord, data.factions);
            }
            setFactions(prev => ({ ...prev, ...factionRecord }));
            setCells(data.cells || cells);
            setEvents(prev => [...prev, ...(data.events || [])]);
            setTradeRoutes(data.sim_trade_routes || tradeRoutes);
            setSacredGroves(data.sim_sacred_groves || sacredGroves);
            setTick(data.tick || tick + 1);
          } else {
            console.error("Failed to fetch state:", res.status);
          }
        } catch (e) {
          console.error("Error fetching state:", e);
        }
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, tick, cells]);


  const selectedFaction = selectedFactionId ? factions[selectedFactionId] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', backgroundColor: '#111', color: '#eee', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2>World Observer Dashboard - Tick: {tick}</h2>
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer', backgroundColor: isPlaying ? '#ff4444' : '#44ff44', color: '#000', border: 'none', borderRadius: '4px' }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <select 
            value={viewMode} 
            onChange={e => setViewMode(e.target.value as ViewMode)} 
            style={{ marginLeft: '10px', padding: '8px', fontSize: '16px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #555' }}
          >
            <option value="Political">Political Mode</option>
            <option value="Unrest Heatmap">Unrest Heatmap</option>
            <option value="Chaos & Weather">Chaos & Weather</option>
            <option value="Ecology Trophic Layer">Ecology Trophic Layer</option>
            <option value="Aether-Tech Routes">Aether-Tech Routes</option>
            <option value="Sacred Groves">Sacred Groves</option>
          </select>
        </div>
        
        <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            onClick={handleMapClick}
            style={{ cursor: 'pointer', backgroundColor: '#222' }}
          />
        </div>
      </div>

      <div style={{ width: '350px', backgroundColor: '#222', padding: '20px', borderLeft: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
        <div style={{ minHeight: '200px', borderBottom: '1px solid #444', marginBottom: '20px', paddingBottom: '20px' }}>
          <h3>Faction Details</h3>
          {selectedFaction ? (
            <div>
              <h4 style={{ color: selectedFaction.color }}>{selectedFaction.name}</h4>
              <p style={{ fontStyle: 'italic', fontSize: '14px', color: '#aaa' }}>{selectedFaction.lore_text}</p>
              
              <div style={{ marginTop: '15px' }}>
                <strong>Dynamic Stats:</strong>
                <ul style={{ paddingLeft: '20px', fontSize: '14px', marginTop: '5px' }}>
                  <li>Population: {(selectedFaction.stats?.population || 0).toLocaleString()}</li>
                  {selectedFaction.wealth !== undefined && <li>Wealth: {selectedFaction.wealth}</li>}
                  {selectedFaction.manpower !== undefined && <li>Military: {selectedFaction.manpower}</li>}
                </ul>
                
                {selectedFaction.stats?.traitScores && (
                  <div>
                    <strong>Traits:</strong>
                    <ul style={{ paddingLeft: '20px', fontSize: '14px', marginTop: '5px' }}>
                      {Object.entries(selectedFaction.stats?.traitScores).map(([trait, score]) => (
                        <li key={trait}>{trait}: {score}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: '#888' }}>Click on a colored cell on the map to view faction details.</p>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3>History & Events</h3>
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#111', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>
            {events.slice().reverse().map(ev => (
              <div key={ev.id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #333' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>[Tick {ev.timestamp}]</span><br/>
                {ev.text}
              </div>
            ))}
            {events.length === 0 && <p style={{ color: '#555' }}>No events recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
