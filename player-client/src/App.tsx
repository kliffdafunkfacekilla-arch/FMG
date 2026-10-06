import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { generateLevel3Map } from './utils/Level3Generator';

const CELL_ID = 13408;
const VIEWPORT_SIZE = 21; // 21x21 tiles visible at a time
const TILE_SIZE = 24; // pixels per tile

function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [regionalPos, setRegionalPos] = useState({ rx: 105, ry: 112 });
  const [localPos, setLocalPos] = useState({ lx: 128, ly: 128 });
  
  const [manifest, setManifest] = useState<any>(null);
  const [tilemap, setTilemap] = useState<{grid: Uint8Array, size: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Backend
  useEffect(() => {
    async function init() {
      try {
        setMessages([{ sender: 'System', text: `Connecting to Global Cell ${CELL_ID}...`, type: 'info' }]);
        await fetch(`http://localhost:3000/api/regional/start/${CELL_ID}`, { method: 'POST' });
        
        await fetchManifest(regionalPos.rx, regionalPos.ry);
        setMessages(prev => [...prev, { sender: 'System', text: `Regional instance active. Sub-cell loaded.`, type: 'info' }]);
        setLoading(false);
      } catch (err: any) {
        setMessages(prev => [...prev, { sender: 'System', text: `Connection failed: ${err.message}`, type: 'error' }]);
      }
    }
    init();
  }, []); // Only on mount

  // Fetch Manifest & Generate Tilemap
  const fetchManifest = async (rx: number, ry: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/regional/manifest/${CELL_ID}?x=${rx}&y=${ry}`);
      if (res.ok) {
        const data = await res.json();
        setManifest(data);
        
        // Procedurally generate the 256x256 Zelda map based on this manifest
        const map = generateLevel3Map(data);
        setTilemap(map);
        
        let desc = `You transition into Region (${rx}, ${ry}). `;
        if (data.environment.infrastructure_mask === 2 || data.environment.infrastructure_mask === 4) {
          desc += "You see a path cutting through the terrain. ";
        }
        setMessages(prev => [...prev, { sender: 'GM', text: desc, type: 'narrative' }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // WASD Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (!tilemap) return;
      
      let nx = localPos.lx;
      let ny = localPos.ly;
      let nr_x = regionalPos.rx;
      let nr_y = regionalPos.ry;
      
      if (e.key === 'w' || e.key === 'ArrowUp') ny -= 1;
      if (e.key === 's' || e.key === 'ArrowDown') ny += 1;
      if (e.key === 'a' || e.key === 'ArrowLeft') nx -= 1;
      if (e.key === 'd' || e.key === 'ArrowRight') nx += 1;
      
      let changedRegion = false;

      // Handle screen transitions (Zelda style border crossing)
      if (nx < 0) { nx = 255; nr_x -= 1; changedRegion = true; }
      if (nx > 255) { nx = 0; nr_x += 1; changedRegion = true; }
      if (ny < 0) { ny = 255; nr_y -= 1; changedRegion = true; }
      if (ny > 255) { ny = 0; nr_y += 1; changedRegion = true; }
      
      // Collision check (if not changing region)
      if (!changedRegion) {
        const tileType = tilemap.grid[ny * tilemap.size + nx];
        if (tileType === 1 || tileType === 2) {
          // 1 is Tree/Obstacle, 2 is deep water
          // Block movement
          return;
        }
      }

      if (changedRegion) {
        setRegionalPos({ rx: nr_x, ry: nr_y });
        setLocalPos({ lx: nx, ly: ny });
        fetchManifest(nr_x, nr_y); // Fetch new screen!
      } else if (nx !== localPos.lx || ny !== localPos.ly) {
        setLocalPos({ lx: nx, ly: ny });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localPos, regionalPos, tilemap]);

  // Render Canvas
  useEffect(() => {
    if (!canvasRef.current || !tilemap) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // We want to render a VIEWPORT_SIZE x VIEWPORT_SIZE grid centered on localPos
    const half = Math.floor(VIEWPORT_SIZE / 2);
    
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = localPos.lx + dx;
        const ty = localPos.ly + dy;
        
        const screenX = (dx + half) * TILE_SIZE;
        const screenY = (dy + half) * TILE_SIZE;

        if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) {
          // Out of bounds (Edge of region)
          ctx.fillStyle = '#111827';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          continue;
        }
        
        const tile = tilemap.grid[ty * tilemap.size + tx];
        const biomeId = manifest.global_context.biome_id;
        
        // Define Biome color palettes
        // [Base Terrain, Obstacle/Tree]
        const biomePalettes: Record<number, [string, string]> = {
          0: ['#1e3a8a', '#1e40af'], // Marine
          1: ['#fde047', '#a16207'], // Hot desert (sand, cactus/rock)
          2: ['#d6d3d1', '#78716c'], // Cold desert (gravel, rock)
          3: ['#fcd34d', '#b45309'], // Savanna (dry grass, acacia)
          4: ['#a3e635', '#4d7c0f'], // Grassland (grass, bushes)
          5: ['#bef264', '#65a30d'], // Chaparral (shrubland)
          6: ['#86efac', '#166534'], // Woodland
          7: ['#6ee7b7', '#065f46'], // Boreal forest (pine)
          8: ['#4ade80', '#14532d'], // Temperate forest (oak)
          9: ['#22c55e', '#064e3b'], // Tropical forest (jungle)
          10: ['#e0f2fe', '#94a3b8'], // Tundra (permafrost, dead shrub)
          11: ['#f8fafc', '#cbd5e1'], // Glacier (ice, snow mound)
          12: ['#14b8a6', '#0f766e']  // Wetland (swamp)
        };

        const palette = biomePalettes[biomeId] || ['#4ade80', '#166534'];
        
        // Colors
        if (tile === 0) ctx.fillStyle = palette[0]; // Base
        else if (tile === 1) ctx.fillStyle = palette[1]; // Trees/Obstacle
        else if (tile === 2) ctx.fillStyle = '#3b82f6'; // Water
        else if (tile === 3) ctx.fillStyle = '#a8a29e'; // Path/Road/Street
        else if (tile === 4) ctx.fillStyle = '#451a03'; // Building Wood/Brick
        else if (tile === 5) ctx.fillStyle = '#1c1917'; // Ancient Ruin Stone
        else if (tile === 6) ctx.fillStyle = '#c026d3'; // Chaos Altar Purple
        else if (tile === 7) ctx.fillStyle = '#7f1d1d'; // Tent/Camp
        else if (tile === 8) ctx.fillStyle = '#f97316'; // Campfire
        else if (tile === 9) ctx.fillStyle = '#991b1b'; // Blood/Gore
        else if (tile === 10) ctx.fillStyle = '#f3f4f6'; // Bone Totem
        else if (tile === 11) ctx.fillStyle = '#78350f'; // Mud
        else if (tile === 12) ctx.fillStyle = '#111827'; // Crater/Scorched Earth
        
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
      }
    }
    
    // Draw NPCs (Entities)
    if (manifest && manifest.entities_present) {
      manifest.entities_present.forEach((entity: any, index: number) => {
        // Just scatter them near the player for now since they are in the same local Level 2 cell
        // A simple deterministic offset based on index so they don't jump around
        const ox = (index * 7) % VIEWPORT_SIZE - half;
        const oy = (index * 13) % VIEWPORT_SIZE - half;
        
        const px = (ox + half) * TILE_SIZE;
        const py = (oy + half) * TILE_SIZE;
        
        let color = '#a3e635'; // Prey/Default
        if (entity.type === 'Predator') color = '#dc2626';
        else if (entity.type === 'Smuggler') color = '#000000';
        else if (entity.type === 'Cultist') color = '#7e22ce'; // Purple
        else if (entity.type === 'Patrol') color = '#1d4ed8'; // Blue Guard
        else if (entity.type === 'Refugee') color = '#d1d5db'; // Light Gray
        else if (entity.type === 'Bandit') color = '#1f2937'; // Dark Gray
        else if (entity.type === 'Cannibal') color = '#991b1b'; // Dark Red

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      });
    }

    // Draw Player exactly in center
    const px = half * TILE_SIZE;
    const py = half * TILE_SIZE;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

  }, [localPos, tilemap]);


  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, { sender: 'You', text: chatInput, type: 'player' }]);
    setChatInput('');
  };

  const getBiomeName = (id: number) => {
    const names = ["Marine", "Hot Desert", "Cold Desert", "Savanna", "Grassland", "Chaparral", "Woodland", "Boreal Forest", "Temperate Forest", "Tropical Forest", "Tundra", "Glacier", "Wetland"];
    return names[id] || "Unknown";
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden font-sans">
      
      {/* Top Main Section */}
      <div className="flex-1 flex flex-row overflow-hidden">
        
        {/* Left Pane: Character HUD */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-amber-500">HUD</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gray-600 rounded-full border-2 border-amber-600 mr-3"></div>
              <div>
                <div className="font-bold">Player One</div>
                <div className="text-xs text-gray-400">Level 3 Explorer</div>
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">GPS</h3>
              <p className="text-sm text-gray-300">Global Hex: {CELL_ID}</p>
              <p className="text-sm text-blue-300">Regional (rx, ry): {regionalPos.rx}, {regionalPos.ry}</p>
              <p className="text-sm text-amber-400 font-mono mt-1">Local (x, y): {localPos.lx}, {localPos.ly}</p>
            </div>
            
            {manifest && (
              <div className="mt-8 space-y-2">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Environment</h3>
                <div className="text-sm font-bold text-green-400 mb-2">{getBiomeName(manifest.global_context.biome_id)}</div>
                
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">Sensors</h3>
                <div className="bg-gray-900 p-2 rounded text-xs font-mono space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Elev</span> <span className="text-blue-300">{manifest.environment.elevation}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Veg</span> <span className="text-green-400">{manifest.environment.vegetation_density}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Chaos</span> <span className="text-purple-400">{manifest.environment.chaos_radiation}</span></div>
                </div>
                
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">Context</h3>
                <div className="text-xs text-gray-300">
                  <p>Faction: <span className="text-amber-300">{manifest.global_context.faction_owner}</span></p>
                  <p>Crime: <span className="text-red-400">{manifest.global_context.crime_rate}</span></p>
                  {manifest.global_context.isWarzone && <p className="text-red-500 font-bold mt-1 uppercase animate-pulse">WAR ZONE</p>}
                  {manifest.global_context.isFamine && <p className="text-amber-500 font-bold mt-1 uppercase animate-pulse">FAMINE</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Pane: Tactical 2D Grid Map */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between">
            <h1 className="text-2xl font-bold text-white/80 tracking-widest">TACTICAL VIEW</h1>
            <div className="text-gray-400 text-sm">Use WASD to move. Walk to edge to transition screens.</div>
          </div>
          
          {loading ? (
            <div className="text-amber-500 animate-pulse text-xl tracking-widest">CONNECTING TO REGION...</div>
          ) : (
            <div className="shadow-2xl border-4 border-gray-800 rounded">
              <canvas 
                ref={canvasRef} 
                width={VIEWPORT_SIZE * TILE_SIZE} 
                height={VIEWPORT_SIZE * TILE_SIZE}
                className="bg-black block"
              />
            </div>
          )}
        </div>

        {/* Right Pane: Chat / Narrative Log */}
        <div className="w-[400px] bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-blue-400">Log</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 font-serif text-sm flex flex-col">
            {messages.map((m, i) => (
              <div key={i} className={`${m.type === 'info' ? 'text-gray-500 italic' : m.type === 'error' ? 'text-red-500 font-bold' : m.type === 'player' ? 'text-amber-200 text-right' : 'text-gray-200'}`}>
                {m.type === 'player' && <span className="font-bold mr-2 text-amber-500">You:</span>}
                {m.type === 'narrative' && <span className="font-bold text-blue-400 mr-2">GM:</span>}
                {m.text}
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-700 bg-gray-900">
            <form onSubmit={handleSend} className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                placeholder="What do you do?"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded text-sm font-bold transition">Send</button>
            </form>
          </div>
        </div>

      </div>

      {/* Bottom Pane: Action Bar */}
      <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center justify-center gap-2 p-2 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20">
        {['Move', 'Attack', 'Hide', 'Search', 'Inventory', 'Camp'].map((action, i) => (
          <button key={i} className="w-16 h-16 bg-gray-800 border border-gray-600 rounded hover:bg-gray-700 hover:border-amber-500 flex flex-col items-center justify-center group transition">
            <span className="text-gray-400 group-hover:text-amber-400 font-bold text-xl">{i+1}</span>
            <span className="text-[10px] text-gray-500 group-hover:text-gray-300 uppercase">{action}</span>
          </button>
        ))}
      </div>

    </div>
  );
}

export default App;
