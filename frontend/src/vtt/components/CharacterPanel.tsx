import React from 'react';

interface CharacterPanelProps {
  character: any;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({ character }) => {
  // Use dummy data if none provided (e.g. hitting play without creating)
  const char = character || {
    name: "Subject 000",
    origin: "Scavenger",
    hp: { current: 15, max: 20 },
    composure: { current: 10, max: 12 },
    stamina: { current: 3, max: 4 },
    focus: { current: 1, max: 2 },
    stats: {
        might: 3, end: 2, fin: 1, ref: 2, vit: 1, "for": 2,
        know: 1, log: 1, awa: 2, int: 1, cha: 1, wil: 2
    },
    tags: ["Exhausted", "Hidden"]
  };

  const ResourceBar = ({ label, current, max, color }: { label: string, current: number, max: number, color: string }) => (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#cbd5e1' }}>
        <span>{label}</span> <span>{current} / {max}</span>
      </div>
      <div style={{ height: '12px', background: '#000', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ width: `${max > 0 ? (current / max) * 100 : 0}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );

  return (
    <div style={{ background: '#18181c', display: 'flex', flexDirection: 'column', padding: '1.5rem', height: '100%', overflowY: 'auto', color: '#e2e8f0' }}>
      
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fbbf24' }}>{char.name}</h2>
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', color: '#94a3b8', fontStyle: 'italic' }}>{char.origin}</p>
      </div>

      <ResourceBar label="HP (Physical)" current={char.hp?.current} max={char.hp?.max} color="#ef4444" />
      <ResourceBar label="Composure (Mental)" current={char.composure?.current} max={char.composure?.max} color="#8b5cf6" />
      <ResourceBar label="Stamina (Physical Pool)" current={char.stamina?.current} max={char.stamina?.max} color="#10b981" />
      <ResourceBar label="Focus (Mental Pool)" current={char.focus?.current} max={char.focus?.max} color="#3b82f6" />

      <h3 style={{ fontSize: '0.9rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem', marginTop: '1.5rem', marginBottom: '1rem' }}>Attributes</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
        {Object.entries(char.stats).map(([key, val]) => (
          <div key={key} style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{key}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{String(val)}</span>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: '0.9rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem', marginBottom: '1rem' }}>Active Tags</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {char.tags && char.tags.length > 0 ? (
          char.tags.map((t: string) => (
            <span key={t} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {t}
            </span>
          ))
        ) : (
          <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>No active tags</span>
        )}
      </div>

    </div>
  );
};
