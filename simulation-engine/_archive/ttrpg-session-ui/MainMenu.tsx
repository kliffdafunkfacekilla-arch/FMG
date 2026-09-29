import React, { useState, useEffect } from 'react';

interface MainMenuProps {
  onStartNewGame: () => void;
  onLoadGame: (sessionId: string) => void;
}

export function MainMenu({ onStartNewGame, onLoadGame }: MainMenuProps) {
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/game/list')
      .then(res => res.json())
      .then(data => {
        if (data.sessions) setSessions(data.sessions);
      })
      .catch(err => console.error("Failed to load sessions:", err));
  }, []);

  const [isBuildingWorld, setIsBuildingWorld] = useState(false);
  const [seed, setSeed] = useState('Aetheria-Prime');
  const [generating, setGenerating] = useState(false);
  
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
    } catch (err) {
      alert('Failed to build world');
    }
    setGenerating(false);
  };

  if (isBuildingWorld) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#ffb703', fontSize: '2rem', marginBottom: '2rem' }}>World Builder Engine</h1>
        <div style={{ background: '#111', padding: '2rem', borderRadius: '8px', border: '1px solid #333', width: '400px' }}>
          <p style={{ color: '#aaa', marginBottom: '1rem' }}>Initialize the macro-simulation (Climate, Tectonics, History).</p>
          <input 
            value={seed} onChange={e => setSeed(e.target.value)} 
            placeholder="World Seed"
            style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: '#222', color: '#fff', border: '1px solid #444' }} 
          />
          <button 
            onClick={handleWorldBuild} disabled={generating}
            style={{ width: '100%', padding: '1rem', background: generating ? '#555' : '#4ade80', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }}>
            {generating ? 'SIMULATING 100 YEARS...' : 'GENERATE WORLD'}
          </button>
          <button onClick={() => setIsBuildingWorld(false)} style={{ width: '100%', padding: '0.5rem', background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#ffb703', fontSize: '3rem', marginBottom: '1rem', letterSpacing: '4px', textTransform: 'uppercase' }}>Project Aetheria</h1>
      <p style={{ color: '#888', marginBottom: '3rem' }}>The 4-Tier Tactical Simulation VTT</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setIsBuildingWorld(true)}
          style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          BUILD NEW WORLD
        </button>
        <button 
          onClick={onStartNewGame}
          style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#d90429', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          START NEW SESSION
        </button>
      </div>

      <div style={{ width: '400px', background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>Load Existing Session</h3>
        {sessions.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No saved sessions found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sessions.map(s => (
              <li key={s.session_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #222' }}>
                <span>{s.name} <span style={{ color: '#555', fontSize: '0.8rem' }}>(Map #{s.current_sub_map_id})</span></span>
                <button 
                  onClick={() => onLoadGame(s.session_id.toString())}
                  style={{ padding: '0.25rem 1rem', background: '#ffb703', color: '#000', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  LOAD
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
