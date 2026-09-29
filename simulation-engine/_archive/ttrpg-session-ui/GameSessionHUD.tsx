import React, { useState, useEffect, useRef } from 'react';
import { useSpeechToText, speakDMResponse } from './VoiceCoOpWrapper';

interface GameSessionHUDProps {
  sessionId: string;
}

export function GameSessionHUD({ sessionId }: GameSessionHUDProps) {
  const [sessionData, setSessionData] = useState<any>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [chatLog, setChatLog] = useState<{ sender: string; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchState = async () => {
    try {
      const res = await fetch(`/api/game/${sessionId}/state`);
      const data = await res.json();
      if (data.session) {
        setSessionData(data.session);
        setMapData(data.map);
        setCharacters(data.characters || []);
        setNpcs(data.npcs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Initial load
  useEffect(() => {
    fetchState();
    setChatLog([{ sender: 'System', text: `Welcome to Project Aetheria session ${sessionId}. Couch co-op initialized.` }]);
  }, [sessionId]);

  // Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData || !characters) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load Spritesheets
    const landImg = new Image();
    landImg.src = '/assets/sprites_land.jpg';
    
    const oceanImg = new Image();
    oceanImg.src = '/assets/sprites_ocean.jpg';

    const renderMap = () => {
      // Clear
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const CELL_SIZE = 40;
      const offsetX = 50;
      const offsetY = 50;
      
      const cols = 14;
      const rows = 10;
      
      const spriteW = landImg.width / cols;
      const spriteH = landImg.height / rows;

      // Map FMG Biomes to the exact Spritesheet Rows
      let isOceanSheet = false;
      let floorRow = 1; // Default Grass
      let wallRow = 0;  // Default Trees
      
      switch (mapData.map_type) {
        // --- LAND BIOMES ---
        case 'FOREST': floorRow = 1; wallRow = 0; break;
        case 'GRASSLAND': floorRow = 1; wallRow = 1; break;
        case 'DESERT': floorRow = 2; wallRow = 2; break;
        case 'JUNGLE': floorRow = 3; wallRow = 3; break;
        case 'MOUNTAIN': floorRow = 4; wallRow = 4; break;
        case 'BEACH': floorRow = 5; wallRow = 5; break;
        case 'SWAMP': floorRow = 6; wallRow = 6; break;
        case 'SNOW': floorRow = 7; wallRow = 7; break;
        case 'CAVE': floorRow = 8; wallRow = 8; break;
        case 'DUNGEON': floorRow = 9; wallRow = 9; break;
        
        // --- OCEAN BIOMES ---
        case 'CORAL_REEF': isOceanSheet = true; floorRow = 1; wallRow = 0; break;
        case 'SHALLOW_OCEAN': isOceanSheet = true; floorRow = 1; wallRow = 1; break;
        case 'KELP_FOREST': isOceanSheet = true; floorRow = 1; wallRow = 2; break;
        case 'DEEP_OCEAN': isOceanSheet = true; floorRow = 3; wallRow = 3; break;
        case 'ABYSSAL': isOceanSheet = true; floorRow = 5; wallRow = 5; break;
        case 'FROZEN_OCEAN': isOceanSheet = true; floorRow = 6; wallRow = 6; break;
        case 'UNDERWATER_CAVE': isOceanSheet = true; floorRow = 7; wallRow = 7; break;
        case 'SUNKEN_RUINS': isOceanSheet = true; floorRow = 8; wallRow = 8; break;
        
        default: floorRow = 1; wallRow = 0; break; // Default Wilderness
      }

      const activeImg = isOceanSheet ? oceanImg : landImg;
      
      // Select appropriate columns for floor and wall tiles (approximate from sheet structure)
      const floorCol = 1; 
      const wallCol = 0;
      const doorCol = 13; 
      const doorRow = isOceanSheet ? 8 : 9;

      // Draw Grid & Terrain
      try {
        const layout = typeof mapData.layout_data === 'string' ? JSON.parse(mapData.layout_data) : mapData.layout_data;
        if (layout && Array.isArray(layout)) {
          layout.forEach((cell: any) => {
            const cx = offsetX + (cell.x * CELL_SIZE);
            const cy = offsetY + (cell.y * CELL_SIZE);
            
            if (cell.terrain === 'WALL') {
              ctx.drawImage(activeImg, wallCol * spriteW, wallRow * spriteH, spriteW, spriteH, cx, cy, CELL_SIZE, CELL_SIZE);
            } else if (cell.terrain === 'DOOR') {
              ctx.drawImage(activeImg, doorCol * spriteW, doorRow * spriteH, spriteW, spriteH, cx, cy, CELL_SIZE, CELL_SIZE);
            } else {
              // OPEN FLOOR
              ctx.drawImage(activeImg, floorCol * spriteW, floorRow * spriteH, spriteW, spriteH, cx, cy, CELL_SIZE, CELL_SIZE);
            }
          });
        }
      } catch (e) {}

      // Draw Characters
      characters.forEach((char, idx) => {
        const cx = offsetX + (char.grid_x * CELL_SIZE);
        const cy = offsetY + (char.grid_y * CELL_SIZE);
        
        ctx.beginPath();
        ctx.arc(cx + CELL_SIZE/2, cy + CELL_SIZE/2, CELL_SIZE/2.5, 0, 2 * Math.PI);
        ctx.fillStyle = idx === activePlayerIndex ? '#4ade80' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(char.name.substring(0,2).toUpperCase(), cx + CELL_SIZE/2 - 6, cy + CELL_SIZE/2 + 3);
      });

      // Draw NPCs
      npcs.forEach((npc) => {
        const cx = offsetX + (npc.grid_x * CELL_SIZE);
        const cy = offsetY + (npc.grid_y * CELL_SIZE);
        
        ctx.beginPath();
        ctx.arc(cx + CELL_SIZE/2, cy + CELL_SIZE/2, CELL_SIZE/2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#dc2626'; // Red for hostiles
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText('HP', cx + CELL_SIZE/2 - 7, cy + CELL_SIZE/2 + 3);
      });
    };

    // When images load, or immediately if cached, trigger render
    let imagesLoaded = 0;
    const checkRender = () => {
      imagesLoaded++;
      if (imagesLoaded >= 2) renderMap();
    };
    landImg.onload = checkRender;
    oceanImg.onload = checkRender;
    if (landImg.complete && oceanImg.complete) {
      renderMap();
    }

    window.addEventListener('resize', renderMap);
    return () => window.removeEventListener('resize', renderMap);
  }, [mapData, characters, npcs, activePlayerIndex]);

  const { isListening, startListening } = useSpeechToText((transcript) => {
    setInputText(transcript);
    handleActionSubmit(transcript);
  });

  const handleActionSubmit = async (textToSend: string) => {
    if (!textToSend.trim() || characters.length === 0) return;
    
    const activeChar = characters[activePlayerIndex];
    
    setChatLog(prev => [...prev, { sender: activeChar.name, text: textToSend }]);
    setInputText('');

    try {
      const res = await fetch('/api/dm/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          characterId: activeChar.character_id,
          playerInput: textToSend
        })
      });

      const data = await res.json();
      if (data.response?.narrativeResponse) {
        setChatLog(prev => [...prev, { sender: 'AI DM', text: data.response.narrativeResponse }]);
        speakDMResponse(data.response.narrativeResponse, ttsEnabled);
      }
      
      // Re-fetch the state after action completes to get new positions/stats
      await fetchState();

    } catch (err) {
      setChatLog(prev => [...prev, { sender: 'AI DM', text: 'Backend connection failed.' }]);
    }
  };

  const activeChar = characters[activePlayerIndex];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#050505', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* LEFT COLUMN: Co-Op AI DM */}
      <div style={{ width: '380px', background: '#121212', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #333' }}>
          <h2 style={{ margin: 0, color: '#ffb703', letterSpacing: '2px', fontSize: '1.2rem', textTransform: 'uppercase' }}>
            Aetheria Engine
          </h2>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            {characters.map((c, i) => (
              <button 
                key={c.character_id}
                onClick={() => setActivePlayerIndex(i)}
                style={{ flex: 1, padding: '0.5rem', background: i === activePlayerIndex ? '#4ade80' : '#222', color: i === activePlayerIndex ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'AI DM' ? 'flex-start' : 'flex-end' }}>
              <span style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{msg.sender}</span>
              <div style={{ background: msg.sender === 'AI DM' ? '#1a1a1a' : '#2d3748', border: msg.sender === 'AI DM' ? '1px solid #333' : 'none', padding: '0.75rem', borderRadius: '6px', maxWidth: '85%', fontSize: '0.95rem', lineHeight: '1.4' }}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #333', background: '#0a0a0a' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#888' }}>
              <input type="checkbox" checked={ttsEnabled} onChange={e => setTtsEnabled(e.target.checked)} /> TTS Voice
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleActionSubmit(inputText)}
              placeholder={`${activeChar ? activeChar.name : 'Player'}'s Intent...`}
              style={{ flex: 1, padding: '0.75rem', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
            />
            <button 
              onMouseDown={startListening}
              style={{ padding: '0 1rem', background: isListening ? '#ef4444' : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              🎤
            </button>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: HTML5 Canvas */}
      <div style={{ flex: 1, position: 'relative', background: '#111' }}>
        <canvas ref={canvasRef} width={window.innerWidth - 760} height={window.innerHeight} style={{ display: 'block' }} />
      </div>

      {/* RIGHT COLUMN: Inventory & Stats */}
      <div style={{ width: '380px', background: '#0a0a0a', borderLeft: '1px solid #ffb703', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto' }}>
        {activeChar ? (
          <>
            <div style={{ borderBottom: '1px solid #ffb703', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', color: '#ffb703', fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{activeChar.name}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                <span style={{ color: '#ffb703' }}>Inventory & Stats</span>
              </div>
            </div>

            {/* Pools */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              <PoolBar label="Health" current={activeChar.health_current} max={activeChar.health_max} color="#ef4444" />
              <PoolBar label="Stamina" current={activeChar.stamina_current} max={activeChar.stamina_max} color="#f59e0b" />
            </div>

            {/* Inventory */}
            <div>
              <h3 style={{ fontSize: '1rem', color: '#ffb703', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>Inventory Items</h3>
              <ul style={{ listStyleType: 'square', color: '#fff', paddingLeft: '1.5rem', margin: 0, fontSize: '0.9rem', lineHeight: '1.6' }}>
                <li>Placeholder Item 1</li>
                <li>Placeholder Item 2</li>
                <li>Placeholder Item 3</li>
              </ul>
            </div>
          </>
        ) : (
          <div style={{ color: '#ffb703', textAlign: 'center', marginTop: '2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Loading character...</div>
        )}
      </div>
    </div>
  );
}

function PoolBar({ label, current, max, color }: { label: string, current: number, max: number, color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem', color: '#aaa', textTransform: 'uppercase' }}>
        <span>{label}</span>
        <span>{current} / {max}</span>
      </div>
      <div style={{ height: '8px', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}
