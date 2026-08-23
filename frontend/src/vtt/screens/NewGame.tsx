import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Globe, User, MapPin } from 'lucide-react';

interface NewGameProps {
  onBack: () => void;
  onStart: (worldId: string, characterId: string, regionId: string) => void;
}

export const NewGame: React.FC<NewGameProps> = ({ onBack, onStart }) => {
  const [worlds, setWorlds] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/brutal/worlds')
      .then(res => res.json())
      .then(data => setWorlds(data))
      .catch(err => console.error(err));

    fetch('http://localhost:8000/api/brutal/characters')
      .then(res => res.json())
      .then(data => setCharacters(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedWorld) {
      setSelectedRegion(null);
      fetch(`http://localhost:8000/api/brutal/worlds/${selectedWorld}/regions`)
        .then(res => res.json())
        .then(data => setRegions(data))
        .catch(err => console.error(err));
    } else {
      setRegions([]);
    }
  }, [selectedWorld]);

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#121216', color: '#e2e8f0', padding: '2rem'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3rem', gap: '1rem' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
            padding: '0.5rem', borderRadius: '50%', cursor: 'pointer'
          }}>
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ margin: 0, color: '#fbbf24', fontSize: '2.5rem' }}>Initialize Session</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* World Selection */}
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Globe color="#60a5fa" />
                <h3 style={{ margin: 0, color: '#60a5fa' }}>1. Select World State</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {worlds.length === 0 ? <p style={{ color: '#64748b', fontStyle: 'italic' }}>No world data found...</p> : null}
                {worlds.map(w => (
                  <button 
                    key={w.id}
                    onClick={() => setSelectedWorld(w.id)}
                    style={{
                      padding: '1rem', textAlign: 'left', borderRadius: '6px', cursor: 'pointer',
                      background: selectedWorld === w.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: selectedWorld === w.id ? '1px solid #3b82f6' : '1px solid transparent',
                      color: 'white', fontWeight: selectedWorld === w.id ? 'bold' : 'normal'
                    }}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Region Selection */}
            {selectedWorld && (
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <MapPin color="#f43f5e" />
                  <h3 style={{ margin: 0, color: '#f43f5e' }}>2. Select Starting Region</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {regions.length === 0 ? <p style={{ color: '#64748b', fontStyle: 'italic' }}>Loading regions...</p> : null}
                  {regions.map(r => (
                    <button 
                      key={r.id}
                      onClick={() => setSelectedRegion(r.id)}
                      style={{
                        padding: '1rem', textAlign: 'left', borderRadius: '6px', cursor: 'pointer',
                        background: selectedRegion === r.id ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: selectedRegion === r.id ? '1px solid #f43f5e' : '1px solid transparent',
                        color: 'white', fontWeight: selectedRegion === r.id ? 'bold' : 'normal'
                      }}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Character Selection */}
          <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <User color="#10b981" />
              <h3 style={{ margin: 0, color: '#10b981' }}>3. Select Subject</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {characters.length === 0 ? <p style={{ color: '#64748b', fontStyle: 'italic' }}>No characters created...</p> : null}
              {characters.map(c => (
                <button 
                  key={c.id}
                  onClick={() => setSelectedCharacter(c.id)}
                  style={{
                    padding: '1rem', textAlign: 'left', borderRadius: '6px', cursor: 'pointer',
                    background: selectedCharacter === c.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedCharacter === c.id ? '1px solid #10b981' : '1px solid transparent',
                    color: 'white', display: 'flex', justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontWeight: selectedCharacter === c.id ? 'bold' : 'normal' }}>{c.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{c.origin}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        <button 
          disabled={!selectedWorld || !selectedCharacter || !selectedRegion}
          onClick={() => selectedWorld && selectedCharacter && selectedRegion && onStart(selectedWorld, selectedCharacter, selectedRegion)}
          style={{ 
            width: '100%', padding: '1.2rem', 
            background: selectedWorld && selectedCharacter && selectedRegion ? '#3b82f6' : '#1e293b', 
            color: selectedWorld && selectedCharacter && selectedRegion ? 'white' : '#64748b', 
            border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', 
            cursor: selectedWorld && selectedCharacter && selectedRegion ? 'pointer' : 'not-allowed', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s'
          }}>
          <Play size={24} /> Launch Session
        </button>

      </div>
    </div>
  );
};
